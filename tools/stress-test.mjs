// Usage:  POS_PIN=1234 node tools/stress-test.mjs 30      (PowerShell: $env:POS_PIN='1234'; node tools/stress-test.mjs 30)
// Runs N random sales against the live Web App, verifies stock after each one,
// then voids + deletes every sale it created and verifies the sheet is back where it started.
const URL = 'https://script.google.com/macros/s/AKfycbzbzwWSHFFCB9F9h8IPr543PLzZ-BrycKo5yLYdSsm33V_dM3LD_s5BJ3t_IPjX6W7k7Q/exec';
const N = Number(process.argv[2] || 30);
const MODE = process.argv[3] || 'full';   // 'probe' = one sale attempt only
const PAY = ['Cash', 'Card', 'Bank Transfer / QR'];
const pin = process.env.POS_PIN || '';

const get = async () => (await fetch(URL + '?t=' + Date.now(), { redirect: 'follow' })).json();
const post = async body => (await fetch(URL, { method: 'POST', redirect: 'follow',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...body, pin }) })).json();
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = msg => { console.error('FAIL:', msg); process.exit(1); };

const start = await get();
if (!start.ok) fail('GET failed: ' + start.error);
const startStock = start.items.map(i => i.stock);
const prices = start.items.map(i => i.price);
const preexisting = new Set(start.sales.map(s => s.id));
console.log('Start stock:', startStock.join('/'), '| prices:', prices.join('/'), '| existing sales rows visible:', preexisting.size);

if (MODE === 'probe') {
  const r = await post({ action: 'sale', quantities: [1, 0, 0], paymentMethod: 'Cash', buyer: 'TEST probe' });
  console.log('probe →', JSON.stringify(r).slice(0, 200));
  if (r.ok) { // clean up immediately
    await post({ action: 'void', saleId: r.sale.id }); await post({ action: 'delete', saleId: r.sale.id });
    console.log('probe sale voided + deleted');
  }
  process.exit(0);
}

let stock = startStock.slice();
const created = [];
let expectedRevenue = 0;

for (let n = 1; n <= N; n++) {
  let q;
  do { q = [0, 1, 2].map(i => Math.min(stock[i], Math.floor(Math.random() * 4))); } while (q.every(x => x === 0));
  const paymentMethod = PAY[Math.floor(Math.random() * PAY.length)];
  const buyer = 'TEST buyer ' + n;
  const r = await post({ action: 'sale', quantities: q, paymentMethod, buyer });
  if (!r.ok) fail(`sale ${n} rejected: ${r.error}`);
  stock = stock.map((s, i) => s - q[i]);
  const total = q.reduce((s, x, i) => s + x * prices[i], 0);
  expectedRevenue += total;
  const got = r.items.map(i => i.stock);
  if (!eq(got, stock)) fail(`sale ${n}: stock ${got.join('/')} expected ${stock.join('/')}`);
  if (Math.abs(r.sale.total - total) > 0.001) fail(`sale ${n}: total ${r.sale.total} expected ${total}`);
  const inList = r.sales.find(s => s.id === r.sale.id);
  if (!inList || inList.buyer !== buyer || inList.paymentMethod !== paymentMethod || !eq(inList.quantities, q)) fail(`sale ${n}: row mismatch ${JSON.stringify(inList)}`);
  created.push({ id: r.sale.id, q, total });
  console.log(`sale ${String(n).padStart(2)}  ${r.sale.id}  qty ${q.join('/')}  ${String(paymentMethod).padEnd(18)} ${total} Kč  → stock ${got.join('/')}`);
}
console.log(`\n${N} sales OK. Revenue ${expectedRevenue} Kč. Stock now ${stock.join('/')} (sold ${startStock.map((s, i) => s - stock[i]).join('/')})`);

// Edit one at random: bump/drop a quantity, check the stock delta.
const pick = created[Math.floor(Math.random() * created.length)];
const newQ = pick.q.map((x, i) => (i === 0 ? Math.max(0, x - 1) : x));
if (newQ.every(x => x === 0)) newQ[1] = 1;
const e = await post({ action: 'edit', saleId: pick.id, quantities: newQ, paymentMethod: 'Card', buyer: 'TEST edited' });
if (!e.ok) fail('edit rejected: ' + e.error);
stock = stock.map((s, i) => s - (newQ[i] - pick.q[i]));
if (!eq(e.items.map(i => i.stock), stock)) fail(`edit: stock ${e.items.map(i => i.stock).join('/')} expected ${stock.join('/')}`);
const edited = e.sales.find(s => s.id === pick.id);
if (!edited || edited.status !== 'EDITED' || edited.buyer !== 'TEST edited' || !eq(edited.quantities, newQ)) fail('edit: row mismatch ' + JSON.stringify(edited));
pick.q = newQ;
console.log(`edit ${pick.id}: qty → ${newQ.join('/')} OK, stock ${stock.join('/')}`);

// Delete must be refused while the sale is still active.
const refused = await post({ action: 'delete', saleId: created[0].id });
if (refused.ok) fail('delete of an active sale was accepted');
console.log('delete on active sale correctly refused:', refused.error);

// Void + delete everything we created.
for (const c of created) {
  const v = await post({ action: 'void', saleId: c.id });
  if (!v.ok) fail(`void ${c.id}: ${v.error}`);
  stock = stock.map((s, i) => s + c.q[i]);
  if (!eq(v.items.map(i => i.stock), stock)) fail(`void ${c.id}: stock ${v.items.map(i => i.stock).join('/')} expected ${stock.join('/')}`);
  const d = await post({ action: 'delete', saleId: c.id });
  if (!d.ok) fail(`delete ${c.id}: ${d.error}`);
  if (d.sales.some(s => s.id === c.id)) fail(`delete ${c.id}: still listed`);
}
console.log(`voided + deleted ${created.length} sales`);

// Final check against the sheet.
const end = await get();
const endStock = end.items.map(i => i.stock);
if (!eq(endStock, startStock)) fail(`final stock ${endStock.join('/')} != start ${startStock.join('/')}`);
const leftovers = end.sales.filter(s => created.some(c => c.id === s.id));
if (leftovers.length) fail('test rows still present: ' + leftovers.map(s => s.id).join(', '));
const kept = end.sales.filter(s => preexisting.has(s.id)).length;
console.log(`\nALL GOOD — stock back to ${endStock.join('/')}, no test rows left, ${kept} pre-existing sale row(s) untouched.`);
