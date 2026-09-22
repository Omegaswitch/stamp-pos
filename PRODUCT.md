# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One staff person at the Czech Grand Priory of the Order of Malta (Velkopřevorské náměstí 4, Praha 1) sells commemorative stamps from a desktop/laptop browser. Sales are quick, with buyers queuing at the table, and collectors frequently buy several sets of each item in one transaction. The same person and machine handle every sale; nobody else needs an account.

## Product Purpose

A single-screen cashier for three stamp products that records each sale to a Google Sheet, keeps the live stock count correct, and tells the cashier how much change to hand back. Success: a sale takes a few seconds, the sheet is always the truth about stock and takings, and a mistake can be corrected without anyone editing the spreadsheet by hand.

## Positioning

Purpose-built for exactly three items and one cashier: no catalogue, no login, no checkout funnel. The spreadsheet is the back office (inventory, log, reconciliation), so the page can stay a dumb, fast front-end that works from any browser with the URL and the PIN.

## Operating Context

- Stock came from one purchase: Order of Malta sale receipt N. 178 (27/07/2026), 250 pcs each of Stamp Set (4 stamps), First Day Cover, and Stamp Set in Christmas folder. Prices are set in CZK by the Priory (215 / 193 / 218 Kč, from EUR at 24.25 Kč).
- Payments are Cash, Card, Bank Transfer / QR, or Gift. Cash is common enough that change calculation is part of every cash sale; Czech banknotes (100 / 200 / 500 / 1 000 / 2 000 / 5 000 Kč) drive the quick-amount suggestions.
- **Gift** records what was bought, how many and for whom — everything except the money. As a non-profit the Priory cannot turn the exchange into income, so nothing is charged in the page: the buyer pays on the card terminal, the minimum sum plus a donation on top, and that payment is reconciled to the row afterwards by the buyer's name. The row is logged with its quantities at a Total Amount of 0, which is why the name is mandatory for a gift and optional for everything else.
- The Google Sheet "Stamp POS" (tabs Inventory, Sales Log) is the system of record. Restocking or price changes are made in the sheet, then the page is refreshed.
- Corrections happen in the page: Edit adjusts a sale's quantities/payment/buyer and moves stock by the difference; Void re-adds stock; Delete removes a voided row. Nothing is silently deleted from the log.
- Hosting: GitHub Pages (public URL) with the Apps Script Web App as the only backend; a cashier PIN (Script Property `POS_PIN`) gates writes. CI pushes `apps-script/` to Google and republishes the page on every push to `main`.

## Capabilities and Constraints

- Exactly three products, rows 2–4 of the Inventory tab; adding a fourth is out of scope.
- Interface language: English (confirmed). Currency display: CZK, `cs-CZ` formatting, whole koruna.
- Server enforces stock caps, PIN, and serialises writes (LockService); the page mirrors those rules for immediate feedback and rolls back on failure.
- Apps Script cannot answer CORS preflight, so the page must keep POSTing as `text/plain`.
- No user accounts, no offline mode, no printing/receipts (undecided; not requested).
- Buyer name is optional free text, max 80 characters.
- The page is a single self-contained `index.html`; the logo is embedded, no external font requests.

## Brand Commitments

- Name in the interface: "Stamp Sales — Order of Malta · Grand Priory of Bohemia".
- Logo: the Order of Malta shield (red with white Maltese cross), supplied by the Priory; embedded in `index.html`.
- The shield red (`#d42e11`) is the accent colour; errors and stock-out states must use a distinct colour so they never read as brand.
- Typeface: Helvetica Neue system stack (user rejected serif/Garamond).

## Evidence on Hand

- `SETUP.md`: deployment and daily-use documentation.
- `apps-script/Code.gs`: the backend, including the invoice-derived inventory seed.
- `tools/stress-test.mjs`: end-to-end test (random sales, edit, void, delete) run against the live sheet and passed on 2026-09-19.
- Invoice PDF (sale receipt N. 178) held by the Priory; not in the repo.
- No customer testimonials, usage metrics, or press; none should be invented.

## Product Principles

1. **One sale, one screen, no navigation.** Everything the cashier needs is visible at once; nothing opens in a modal or a second page.
2. **The sheet is the truth.** The page never holds state the sheet doesn't; after every write it re-syncs from the server's answer.
3. **Fast for a queue, safe for a mistake.** Quantities and payment are one tap away; every write is reversible in the page (edit → void → delete), and stock always follows.
4. **Cash handled explicitly.** A cash sale always shows what was received and what to give back, and stores both.
5. **Nothing to maintain.** No accounts, no build step, no dependencies; CI does the deploying.
