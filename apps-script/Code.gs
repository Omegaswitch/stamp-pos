/**
 * Stamp POS — Google Apps Script backend
 *
 * Bound to a Google Sheet with two tabs:
 *   "Inventory": A=Item Name | B=Unit Price | C=Current Stock   (rows 2–4 = the 3 stamps)
 *   "Sales Log": A=Timestamp | B=Qty Stamp 1 | C=Qty Stamp 2 | D=Qty Stamp 3 | E=Payment Method
 *                | F=Total Amount | G=Sale ID | H=Status (OK / EDITED / VOID) | I=Updated At
 *
 * Endpoints (deployed as a Web App, "Execute as: Me", "Who has access: Anyone"):
 *   GET  → { ok, items: [{ name, price, stock }, ×3], sales: [recent sales, newest first] }
 *   POST body (text/plain JSON), all require `pin` when POS_PIN is configured:
 *     { action: "sale", quantities: [q1,q2,q3], paymentMethod }        → records a sale, deducts stock
 *     { action: "void", saleId }                                        → cancels a sale, re-adds its stock
 *     { action: "edit", saleId, quantities: [..], paymentMethod? }      → changes a sale, adjusts stock by the difference
 *   Every POST answers { ok, items, sales, sale } or { ok:false, error }.
 *
 * Run setupSheets() once from the editor to create both tabs (and to authorise the script).
 */

var INVENTORY_SHEET = 'Inventory';
var SALES_SHEET = 'Sales Log';
var ITEM_COUNT = 3;
var ALLOWED_PAYMENTS = ['Cash', 'Card', 'Bank Transfer / QR'];
var SALES_HEADERS = ['Timestamp', 'Qty Stamp 1', 'Qty Stamp 2', 'Qty Stamp 3', 'Payment Method', 'Total Amount', 'Sale ID', 'Status', 'Updated At'];
var SALES_COLS = SALES_HEADERS.length;
var RECENT_SALES = 15;

// Order of Malta commemorative stamps, GP of Bohemia — sale receipt N. 178 (27/07/2026).
// Prices in CZK (1 EUR = 24.25 CZK, rounded): 8.85 → 215, 7.65 → 193, 9.00 → 218. Stock: 250 each.
var INVOICE_ITEMS = [
  ['Stamp Set (4 stamps)', 215, 250],
  ['First Day Cover',      193, 250],
  ['Christmas Folder Set', 218, 250]
];

// ───────────────────────── HTTP handlers ─────────────────────────

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var log = getSheetOrThrow_(ss, SALES_SHEET);
    ensureSalesLog_(log);
    return jsonResponse({ ok: true, items: readInventory_(), sales: readSales_(log) });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Serialise concurrent writes so two cashiers can't both sell the last stamp.
    lock.waitLock(15000);

    var body = parseBody_(e);
    checkPin_(body.pin);

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var inv = getSheetOrThrow_(ss, INVENTORY_SHEET);
    var log = getSheetOrThrow_(ss, SALES_SHEET);
    ensureSalesLog_(log);

    var action = String(body.action || 'sale');
    var sale;
    if (action === 'sale') sale = recordSale_(inv, log, body);
    else if (action === 'void') sale = voidSale_(inv, log, body);
    else if (action === 'edit') sale = editSale_(inv, log, body);
    else throw new Error('Unknown action: ' + action);

    SpreadsheetApp.flush();
    return jsonResponse({ ok: true, items: readInventory_(), sales: readSales_(log), sale: sale });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ───────────────────────── Actions ─────────────────────────

function recordSale_(inv, log, body) {
  var quantities = normaliseQuantities_(body.quantities);
  var paymentMethod = checkPayment_(body.paymentMethod);
  if (sum_(quantities) === 0) throw new Error('No items in the sale');

  var items = readInventoryRows_(inv);
  for (var i = 0; i < ITEM_COUNT; i++) {
    if (quantities[i] > items[i].stock) {
      throw new Error('Not enough stock for ' + items[i].name + ' (requested ' + quantities[i] + ', available ' + items[i].stock + ')');
    }
  }
  var total = computeTotal_(items, quantities);

  writeStock_(inv, items.map(function (it, i) { return it.stock - quantities[i]; }));

  var timestamp = new Date();
  var id = newSaleId_();
  log.appendRow([timestamp, quantities[0], quantities[1], quantities[2], paymentMethod, total, id, 'OK', '']);

  return { id: id, timestamp: timestamp.toISOString(), quantities: quantities, paymentMethod: paymentMethod, total: total, status: 'OK' };
}

function voidSale_(inv, log, body) {
  var found = findSale_(log, body.saleId);
  if (found.sale.status === 'VOID') throw new Error('This sale is already voided');

  // Re-add the sold quantities to stock.
  var items = readInventoryRows_(inv);
  writeStock_(inv, items.map(function (it, i) { return it.stock + found.sale.quantities[i]; }));

  log.getRange(found.row, 8, 1, 2).setValues([['VOID', new Date()]]);
  found.sale.status = 'VOID';
  return found.sale;
}

function editSale_(inv, log, body) {
  var found = findSale_(log, body.saleId);
  var old = found.sale;
  if (old.status === 'VOID') throw new Error('A voided sale cannot be edited — record a new sale instead');

  var quantities = normaliseQuantities_(body.quantities);
  if (sum_(quantities) === 0) throw new Error('Quantities are all zero — use Void to cancel the sale');
  var paymentMethod = body.paymentMethod ? checkPayment_(body.paymentMethod) : old.paymentMethod;

  // Only the difference moves in or out of stock.
  var items = readInventoryRows_(inv);
  var newStock = [];
  for (var i = 0; i < ITEM_COUNT; i++) {
    var delta = quantities[i] - old.quantities[i];
    if (delta > items[i].stock) {
      throw new Error('Not enough stock for ' + items[i].name + ' (need ' + delta + ' more, available ' + items[i].stock + ')');
    }
    newStock.push(items[i].stock - delta);
  }
  var total = computeTotal_(items, quantities);   // re-priced at current unit prices

  writeStock_(inv, newStock);
  log.getRange(found.row, 2, 1, 5).setValues([[quantities[0], quantities[1], quantities[2], paymentMethod, total]]);
  log.getRange(found.row, 8, 1, 2).setValues([['EDITED', new Date()]]);

  old.quantities = quantities; old.paymentMethod = paymentMethod; old.total = total; old.status = 'EDITED';
  return old;
}

// ───────────────────────── Sheet access ─────────────────────────

function readInventoryRows_(inv) {
  var rows = inv.getRange(2, 1, ITEM_COUNT, 3).getValues();
  return rows.map(function (row, i) {
    return {
      name: String(row[0] || ('Item ' + (i + 1))),
      price: Number(row[1]) || 0,
      stock: Math.max(0, Math.floor(Number(row[2]) || 0))
    };
  });
}

function readInventory_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return readInventoryRows_(getSheetOrThrow_(ss, INVENTORY_SHEET));
}

function writeStock_(inv, stock) {
  inv.getRange(2, 3, ITEM_COUNT, 1).setValues(stock.map(function (s) { return [Math.max(0, s)]; }));
}

function computeTotal_(items, quantities) {
  var total = 0;
  for (var i = 0; i < ITEM_COUNT; i++) total += quantities[i] * items[i].price;
  return Math.round(total * 100) / 100;
}

function rowToSale_(r, rowNumber) {
  return {
    row: rowNumber,
    id: String(r[6] || ''),
    timestamp: toIso_(r[0]),
    quantities: [r[1], r[2], r[3]].map(toInt_),
    paymentMethod: String(r[4] || ''),
    total: Number(r[5]) || 0,
    status: String(r[7] || 'OK'),
    updatedAt: toIso_(r[8])
  };
}

/** Newest RECENT_SALES sales, newest first. */
function readSales_(log) {
  var last = log.getLastRow();
  if (last < 2) return [];
  var n = Math.min(RECENT_SALES, last - 1);
  var start = last - n + 1;
  var rows = log.getRange(start, 1, n, SALES_COLS).getValues();
  return rows.map(function (r, i) { return rowToSale_(r, start + i); })
             .filter(function (s) { return s.id; })
             .reverse();
}

function findSale_(log, saleId) {
  var id = String(saleId || '').trim();
  if (!id) throw new Error('saleId is required');
  var last = log.getLastRow();
  if (last < 2) throw new Error('Sale not found: ' + id);
  var ids = log.getRange(2, 7, last - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {           // newest first: edits are usually recent
    if (String(ids[i][0]) === id) {
      var row = i + 2;
      return { row: row, sale: rowToSale_(log.getRange(row, 1, 1, SALES_COLS).getValues()[0], row) };
    }
  }
  throw new Error('Sale not found: ' + id);
}

/**
 * Makes sure the Sales Log has the ID/Status/Updated columns and that every existing
 * row has a Sale ID (so logs created before this feature can still be voided/edited).
 */
function ensureSalesLog_(log) {
  if (String(log.getRange(1, 7).getValue()) !== 'Sale ID') {
    log.getRange(1, 1, 1, SALES_COLS).setValues([SALES_HEADERS]).setFontWeight('bold');
    log.getRange('I2:I').setNumberFormat('yyyy-mm-dd hh:mm:ss');
  }
  var last = log.getLastRow();
  if (last < 2) return;
  var rng = log.getRange(2, 7, last - 1, 2);
  var vals = rng.getValues();
  var changed = false;
  vals.forEach(function (r) {
    if (!r[0]) { r[0] = newSaleId_(); r[1] = r[1] || 'OK'; changed = true; }
  });
  if (changed) rng.setValues(vals);
}

function getSheetOrThrow_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab "' + name + '". Run setupSheets() or create it manually.');
  return sheet;
}

// ───────────────────────── Validation / helpers ─────────────────────────

function parseBody_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw) throw new Error('Empty request body');
  try { return JSON.parse(raw); } catch (err) { throw new Error('Body is not valid JSON'); }
}

/**
 * Optional cashier PIN. Set it in the editor: Project Settings → Script Properties →
 * add property POS_PIN. When set, every write (sale / void / edit) must carry it.
 */
function checkPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('POS_PIN');
  if (!expected) return;
  if (String(pin || '').trim() !== String(expected).trim()) {
    throw new Error(pin ? 'Invalid PIN' : 'PIN required');
  }
}

function checkPayment_(value) {
  var p = String(value || '').trim();
  if (ALLOWED_PAYMENTS.indexOf(p) === -1) throw new Error('Invalid payment method: "' + p + '"');
  return p;
}

function normaliseQuantities_(list) {
  if (!Array.isArray(list)) throw new Error('quantities must be an array of ' + ITEM_COUNT + ' numbers');
  var out = [];
  for (var i = 0; i < ITEM_COUNT; i++) out.push(toInt_(list[i]));
  return out;
}

function toInt_(v) { var n = Math.floor(Number(v)); return isFinite(n) && n > 0 ? n : 0; }
function sum_(arr) { return arr.reduce(function (a, b) { return a + b; }, 0); }
function toIso_(v) {
  if (v instanceof Date && !isNaN(v)) return v.toISOString();
  return v ? String(v) : '';
}
function newSaleId_() { return 'S-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10).toUpperCase(); }

/**
 * JSON output via ContentService. When the Web App is deployed with access "Anyone",
 * Google serves ContentService responses with `Access-Control-Allow-Origin: *`.
 * (Apps Script does not handle OPTIONS preflights, which is why the frontend POSTs as text/plain.)
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── One-time setup ─────────────────────────

/**
 * Creates the "Inventory" and "Sales Log" tabs with headers, sample items and formatting.
 * Safe to re-run: existing data is left untouched (missing Sales Log columns are added).
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var inv = ss.getSheetByName(INVENTORY_SHEET);
  if (!inv) {
    inv = ss.insertSheet(INVENTORY_SHEET);
    inv.getRange('A1:C1').setValues([['Item Name', 'Unit Price', 'Current Stock']]).setFontWeight('bold');
    inv.getRange('A2:C4').setValues(INVOICE_ITEMS);
    inv.getRange('B2:B4').setNumberFormat('#,##0');
    inv.getRange('C2:C4').setNumberFormat('0');
    inv.setFrozenRows(1);
    inv.autoResizeColumns(1, 3);
  }

  var log = ss.getSheetByName(SALES_SHEET);
  if (!log) {
    log = ss.insertSheet(SALES_SHEET);
    log.getRange(1, 1, 1, SALES_COLS).setValues([SALES_HEADERS]).setFontWeight('bold');
    log.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    log.getRange('F2:F').setNumberFormat('#,##0.00');
    log.getRange('I2:I').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    log.setFrozenRows(1);
    log.autoResizeColumns(1, SALES_COLS);
  }
  ensureSalesLog_(log);

  // Remove the default empty "Sheet1" if it is still around and unused.
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 2 && def.getLastRow() === 0) ss.deleteSheet(def);

  Logger.log('Setup complete: "%s" and "%s" are ready.', INVENTORY_SHEET, SALES_SHEET);
}

/**
 * Overwrites Inventory rows 2–4 with the items, CZK prices and stock from the invoice
 * (INVOICE_ITEMS above). Run once from the editor after setupSheets(); re-run to reset stock to 250.
 */
function resetInventoryFromInvoice() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inv = getSheetOrThrow_(ss, INVENTORY_SHEET);
  inv.getRange(2, 1, ITEM_COUNT, 3).setValues(INVOICE_ITEMS);
  inv.getRange('B2:B4').setNumberFormat('#,##0');
  inv.autoResizeColumns(1, 3);
  Logger.log('Inventory set: ' + JSON.stringify(readInventoryRows_(inv)));
}

/** Quick manual test from the editor: logs the current inventory + recent sales JSON. */
function testGet() {
  Logger.log(doGet({}).getContent());
}

/** Quick manual test from the editor: sells 1 of item 1 by Cash, then voids it again. */
function testSaleAndVoid() {
  var pin = PropertiesService.getScriptProperties().getProperty('POS_PIN') || '';
  var sold = JSON.parse(doPost({ postData: { contents: JSON.stringify({ action: 'sale', quantities: [1, 0, 0], paymentMethod: 'Cash', pin: pin }) } }).getContent());
  Logger.log(JSON.stringify(sold));
  if (sold.ok) {
    var voided = doPost({ postData: { contents: JSON.stringify({ action: 'void', saleId: sold.sale.id, pin: pin }) } }).getContent();
    Logger.log(voided);
  }
}
