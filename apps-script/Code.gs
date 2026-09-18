/**
 * Stamp POS — Google Apps Script backend
 *
 * Bound to a Google Sheet with two tabs:
 *   "Inventory": A=Item Name | B=Unit Price | C=Current Stock   (rows 2–4 = the 3 stamps)
 *   "Sales Log": A=Timestamp | B=Qty Stamp 1 | C=Qty Stamp 2 | D=Qty Stamp 3 | E=Payment Method | F=Total Amount
 *
 * Endpoints (deployed as a Web App, "Execute as: Me", "Who has access: Anyone"):
 *   GET  → { ok, items: [{ name, price, stock }, ×3] }
 *   POST → body (text/plain JSON): { quantities: [q1, q2, q3], paymentMethod: "Cash" }
 *          → { ok, items: [...updated stock...], sale: { timestamp, quantities, paymentMethod, total } }
 *
 * Run setupSheets() once from the editor to create both tabs with headers and sample rows.
 */

var INVENTORY_SHEET = 'Inventory';
var SALES_SHEET = 'Sales Log';
var ITEM_COUNT = 3;
var ALLOWED_PAYMENTS = ['Cash', 'Card', 'Bank Transfer / QR'];

// ───────────────────────── HTTP handlers ─────────────────────────

function doGet(e) {
  try {
    return jsonResponse({ ok: true, items: readInventory_() });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    // Serialise concurrent sales so two cashiers can't both sell the last stamp.
    lock.waitLock(15000);

    var body = parseBody_(e);
    checkPin_(body.pin);
    var quantities = normaliseQuantities_(body.quantities);
    var paymentMethod = String(body.paymentMethod || '').trim();

    if (ALLOWED_PAYMENTS.indexOf(paymentMethod) === -1) {
      throw new Error('Invalid payment method: "' + paymentMethod + '"');
    }
    var soldCount = quantities.reduce(function (a, b) { return a + b; }, 0);
    if (soldCount === 0) throw new Error('No items in the sale');

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var inv = getSheetOrThrow_(ss, INVENTORY_SHEET);
    var log = getSheetOrThrow_(ss, SALES_SHEET);

    var range = inv.getRange(2, 1, ITEM_COUNT, 3);   // A2:C4
    var rows = range.getValues();
    var total = 0;

    // Validate against live stock before touching any cell.
    for (var i = 0; i < ITEM_COUNT; i++) {
      var name = String(rows[i][0] || ('Item ' + (i + 1)));
      var price = Number(rows[i][1]) || 0;
      var stock = Math.max(0, Math.floor(Number(rows[i][2]) || 0));
      if (quantities[i] > stock) {
        throw new Error('Not enough stock for ' + name + ' (requested ' + quantities[i] + ', available ' + stock + ')');
      }
      total += quantities[i] * price;
    }
    total = Math.round(total * 100) / 100;

    // Subtract sold quantities directly from the Current Stock cells (column C).
    var newStock = rows.map(function (row, i) {
      return [Math.max(0, Math.floor(Number(row[2]) || 0)) - quantities[i]];
    });
    inv.getRange(2, 3, ITEM_COUNT, 1).setValues(newStock);

    // Append the transaction row.
    var timestamp = new Date();
    log.appendRow([timestamp, quantities[0], quantities[1], quantities[2], paymentMethod, total]);
    SpreadsheetApp.flush();

    return jsonResponse({
      ok: true,
      items: readInventory_(),
      sale: { timestamp: timestamp.toISOString(), quantities: quantities, paymentMethod: paymentMethod, total: total }
    });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (ignore) {}
  }
}

// ───────────────────────── Helpers ─────────────────────────

function readInventory_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var inv = getSheetOrThrow_(ss, INVENTORY_SHEET);
  var rows = inv.getRange(2, 1, ITEM_COUNT, 3).getValues();
  return rows.map(function (row, i) {
    return {
      name: String(row[0] || ('Item ' + (i + 1))),
      price: Number(row[1]) || 0,
      stock: Math.max(0, Math.floor(Number(row[2]) || 0))
    };
  });
}

function parseBody_(e) {
  var raw = e && e.postData && e.postData.contents;
  if (!raw) throw new Error('Empty request body');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error('Body is not valid JSON');
  }
}

function normaliseQuantities_(list) {
  if (!Array.isArray(list)) throw new Error('quantities must be an array of ' + ITEM_COUNT + ' numbers');
  var out = [];
  for (var i = 0; i < ITEM_COUNT; i++) {
    var n = Math.floor(Number(list[i]));
    if (!isFinite(n) || n < 0) n = 0;
    out.push(n);
  }
  return out;
}

/**
 * Optional cashier PIN. Set it in the editor: Project Settings → Script Properties →
 * add property POS_PIN. When it is set, every sale must carry the matching `pin`.
 * (The page is public on GitHub Pages, so this stops strangers from posting sales.)
 */
function checkPin_(pin) {
  var expected = PropertiesService.getScriptProperties().getProperty('POS_PIN');
  if (!expected) return;                                   // no PIN configured
  if (String(pin || '').trim() !== String(expected).trim()) {
    throw new Error(pin ? 'Invalid PIN' : 'PIN required');
  }
}

function getSheetOrThrow_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet tab "' + name + '". Run setupSheets() or create it manually.');
  return sheet;
}

/**
 * JSON output via ContentService. When the Web App is deployed with access "Anyone",
 * Google serves ContentService responses with `Access-Control-Allow-Origin: *`, so
 * browsers on any origin can read them. (Apps Script does not handle OPTIONS preflights,
 * which is why the frontend POSTs with Content-Type text/plain.)
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ───────────────────────── One-time setup ─────────────────────────

/**
 * Creates the "Inventory" and "Sales Log" tabs with headers, sample items and formatting.
 * Safe to re-run: existing tabs are left untouched.
 */
function setupSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var inv = ss.getSheetByName(INVENTORY_SHEET);
  if (!inv) {
    inv = ss.insertSheet(INVENTORY_SHEET);
    inv.getRange('A1:C1').setValues([['Item Name', 'Unit Price', 'Current Stock']]).setFontWeight('bold');
    inv.getRange('A2:C4').setValues([
      ['Stamp A', 2.50, 100],
      ['Stamp B', 4.00, 50],
      ['Stamp C', 7.50, 25]
    ]);
    inv.getRange('B2:B4').setNumberFormat('#,##0.00');
    inv.getRange('C2:C4').setNumberFormat('0');
    inv.setFrozenRows(1);
    inv.autoResizeColumns(1, 3);
  }

  var log = ss.getSheetByName(SALES_SHEET);
  if (!log) {
    log = ss.insertSheet(SALES_SHEET);
    log.getRange('A1:F1')
      .setValues([['Timestamp', 'Qty Stamp 1', 'Qty Stamp 2', 'Qty Stamp 3', 'Payment Method', 'Total Amount']])
      .setFontWeight('bold');
    log.getRange('A2:A').setNumberFormat('yyyy-mm-dd hh:mm:ss');
    log.getRange('F2:F').setNumberFormat('#,##0.00');
    log.setFrozenRows(1);
    log.autoResizeColumns(1, 6);
  }

  // Remove the default empty "Sheet1" if it is still around and unused.
  var def = ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 2 && def.getLastRow() === 0) ss.deleteSheet(def);

  Logger.log('Setup complete: "%s" and "%s" are ready.', INVENTORY_SHEET, SALES_SHEET);
}

/** Quick manual test from the editor: logs the current inventory JSON. */
function testGet() {
  Logger.log(doGet({}).getContent());
}

/** Quick manual test from the editor: sells 1 of item 1 by Cash and logs the response. */
function testPost() {
  var fake = { postData: { contents: JSON.stringify({ quantities: [1, 0, 0], paymentMethod: 'Cash' }) } };
  Logger.log(doPost(fake).getContent());
}
