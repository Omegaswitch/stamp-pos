# Stamp POS — Setup

Two files, ~10 minutes:

- `index.html` — the cashier UI (open it in any desktop browser, no server needed)
- `Code.gs` — the Apps Script backend that reads/writes the Google Sheet

## 1. Create the spreadsheet

1. Go to [sheets.new](https://sheets.new) and name the spreadsheet (e.g. **Stamp POS**).
2. Open **Extensions → Apps Script**.
3. Delete the placeholder code, paste the full contents of `Code.gs`, and save (Ctrl/Cmd+S).
4. In the function dropdown (toolbar), choose **`setupSheets`** and click **Run**.
   - The first run asks for authorization → *Review permissions* → pick your account → *Advanced* → *Go to … (unsafe)* → *Allow*. This is normal for personal scripts.
   - This creates both tabs with headers and sample rows.
5. Back in the spreadsheet, edit the **Inventory** tab so rows 2–4 hold your real stamps:

   | Item Name | Unit Price | Current Stock |
   |-----------|-----------:|--------------:|
   | Stamp A   | 2.50       | 100           |
   | Stamp B   | 4.00       | 50            |
   | Stamp C   | 7.50       | 25            |

   Keep the header in row 1 and exactly three item rows. The **Sales Log** tab (`Timestamp | Qty Stamp 1 | Qty Stamp 2 | Qty Stamp 3 | Payment Method | Total Amount`) fills itself.

   > Prefer to build the tabs by hand? Name them exactly `Inventory` and `Sales Log`, with the headers above in row 1.

## 2. Deploy the Web App

1. In the Apps Script editor: **Deploy → New deployment**.
2. Click the gear next to *Select type* → **Web app**.
3. Settings:
   - **Description:** anything (e.g. `v1`)
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**  ← required, otherwise browsers get a login redirect instead of JSON
4. **Deploy**, then copy the **Web app URL** (ends in `/exec`).

Optional check: open that URL in a browser tab — you should see `{"ok":true,"items":[...]}`.

## 3. Connect the frontend

1. Open `index.html` in a text editor and paste the URL into the config block near the top of the `<script>`:

   ```js
   const CONFIG = {
     SCRIPT_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
     CURRENCY: 'USD',    // e.g. 'EUR', 'CZK', 'GBP'
     LOCALE: 'en-US',    // e.g. 'cs-CZ', 'de-DE'
     LOW_STOCK_AT: 5
   };
   ```

2. Save and open `index.html` in Chrome/Edge/Firefox (double-click works; no hosting required). The status pill turns green ("Connected") and the cards show the live stock from the sheet.

Until `SCRIPT_URL` is set the page runs in **Demo mode** with sample items so you can try the UI; demo sales are not saved.

## Daily use

- Set quantities with **+ / −** or type a number (capped at available stock), pick **Cash / Card / Bank Transfer / QR**, click **Mark as Sold** (or press **Ctrl+Enter**).
- Stock is deducted on screen immediately and written to the sheet; a row is appended to **Sales Log**. If the request fails, the on-screen stock is restored and an error toast appears.
- **Refresh stock** re-reads the sheet (useful after restocking or when several cashiers share one sheet).
- To restock or change prices, edit the **Inventory** tab and click **Refresh stock**.

## Updating the script later

After editing `Code.gs`, changes are **not** live until you publish a new version: **Deploy → Manage deployments → ✎ (edit) → Version: New version → Deploy**. The URL stays the same.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Could not load inventory" / CORS error in console | Deployment must be **Execute as: Me** + **Who has access: Anyone**. Redeploy a new version if you changed it. |
| GET works, POST fails | Keep the frontend's `Content-Type: text/plain` (already set). Apps Script cannot answer CORS preflight requests, so `application/json` will be blocked. |
| `Missing sheet tab "Inventory"` | Tab names must match exactly (`Inventory`, `Sales Log`). Run `setupSheets()` or rename. |
| Sale rejected: "Not enough stock" | Another cashier sold it first — click **Refresh stock**. The server always validates against the live sheet. |
| Wrong currency symbol | Change `CURRENCY` / `LOCALE` in `index.html`. Prices themselves come from the sheet. |

## Notes

- Concurrency: `doPost` uses `LockService` and validates stock server-side, so two browsers can't oversell the same stamp.
- Security: an "Anyone" deployment means anyone with the `/exec` URL can post sales. Don't share the URL publicly; if it leaks, delete the deployment and create a new one.
