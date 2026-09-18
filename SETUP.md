# Stamp POS — Setup

```
index.html                       cashier UI → published to GitHub Pages
apps-script/Code.gs              backend   → pushed to Google Apps Script by CI
apps-script/appsscript.json      Apps Script manifest (web app: execute as me, access anyone)
.github/workflows/apps-script.yml  clasp push + update Web App deployment
.github/workflows/pages.yml        build index.html (inject Web App URL) + deploy Pages
```

Everything after the one-time Google authorisation is automatic: push to `main` → script and site redeploy.

## One-time setup (≈15 min)

### 1. Create the spreadsheet + script project

1. [sheets.new](https://sheets.new) → name it (e.g. **Stamp POS**).
2. **Extensions → Apps Script**. You'll see an empty `Code.gs` — leave it, CI will overwrite it.
3. **Project Settings (⚙) → IDs → Script ID** → copy it. You'll need it in step 3.
4. While you're in Project Settings: **Script Properties → Add script property** → `POS_PIN` = a PIN of your choice (e.g. `4821`). This stops strangers who find the public page from posting sales. Optional but recommended.

### 2. Let CI log in to Google as you (`clasp`)

`clasp` is Google's CLI for Apps Script. You authorise it **once** on your machine and give the resulting token to GitHub Actions as a secret.

1. Enable the Apps Script API for your account: <https://script.google.com/home/usersettings> → **Google Apps Script API → On**.
2. Log in (needs Node.js; opens a browser window):

   ```bash
   npx @google/clasp@2.4.2 login
   ```

3. Store the token as a repository secret (it's written to `~/.clasprc.json`):

   ```bash
   gh secret set CLASPRC_JSON --repo Omegaswitch/stamp-pos < ~/.clasprc.json
   ```

   (On Windows PowerShell: `Get-Content "$HOME\.clasprc.json" -Raw | gh secret set CLASPRC_JSON --repo Omegaswitch/stamp-pos`)

### 3. Tell CI which script to push to

```bash
gh variable set APPS_SCRIPT_ID --repo Omegaswitch/stamp-pos --body "PASTE_SCRIPT_ID_HERE"
```

### 4. First deployment

1. **Actions → Deploy Apps Script → Run workflow**. It pushes the code and, because no deployment exists yet, **creates** the Web App and prints its deployment ID in the run summary.
2. Save that ID:

   ```bash
   gh variable set APPS_SCRIPT_DEPLOYMENT_ID --repo Omegaswitch/stamp-pos --body "AKfyc..."
   ```

3. Authorise the script once: open the Apps Script editor → pick `setupSheets` in the toolbar dropdown → **Run** → *Review permissions* → your account → *Advanced → Go to … (unsafe)* → *Allow*. This also creates the **Inventory** and **Sales Log** tabs with sample rows.
4. Edit **Inventory** rows 2–4 with your real stamps:

   | Item Name | Unit Price | Current Stock |
   |-----------|-----------:|--------------:|
   | Stamp A   | 2.50       | 100           |
   | Stamp B   | 4.00       | 50            |
   | Stamp C   | 7.50       | 25            |

5. **Actions → Deploy site to GitHub Pages → Run workflow**. The build injects `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec` into `index.html` and publishes it at **https://omegaswitch.github.io/stamp-pos/**.

Check: open the `/exec` URL in a tab — you should see `{"ok":true,"items":[...]}`. Then open the Pages URL; the status pill should read **Connected**. Click **PIN** once and enter the PIN from step 1.4 (remembered in that browser).

## Day-to-day

- **Sold something by mistake?** The **Recent sales** table under the payment buttons lists the last 15 sales.
  - **Edit** → change the quantities / payment method → **Save**. Stock moves by the difference only; the total is re-priced at current unit prices. The row is marked `EDITED`.
  - **Void** → confirm → the full quantities go back on the shelf and the row is marked `VOID`. Nothing is ever deleted from the log, so the sheet stays a full audit trail.
  - Both need the cashier PIN if one is set.
- Edit `apps-script/Code.gs` → push → the Web App updates in place (same URL).
- Edit `index.html` → push → Pages redeploys.
- Restock / change prices in the **Inventory** tab → click **Refresh stock** in the app.
- Currency/locale: `CONFIG.CURRENCY` / `CONFIG.LOCALE` in `index.html`. Timezone for the script: `apps-script/appsscript.json`.

## Running locally without CI

Open `index.html` directly and set `CONFIG.SCRIPT_URL` by hand (keep the `// @inject SCRIPT_URL` comment on that line or the CI injection stops working). With the URL empty the page runs in demo mode.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Workflow: `CLASPRC_JSON is not set` / `invalid_grant` | Re-run `npx @google/clasp@2.4.2 login` and re-set the secret. Tokens can expire if unused for months. |
| Workflow: `User has not enabled the Apps Script API` | Step 2.1. |
| Page says "Could not load inventory" | `APPS_SCRIPT_DEPLOYMENT_ID` missing (page is in demo mode), or the script hasn't been authorised yet (step 4.3). Open the `/exec` URL to see the actual error. |
| "PIN required" / "Invalid PIN" toast | Click **PIN** in the header and enter the value of `POS_PIN`. Remove the script property to disable PINs. |
| GET works, POST fails with CORS | Keep the frontend's `Content-Type: text/plain`. Apps Script can't answer preflight requests, so `application/json` gets blocked. |
| `Missing sheet tab "Inventory"` | Run `setupSheets()` once (step 4.3). |
| "Not enough stock" on sale | Someone else sold it first — **Refresh stock**. The server validates against the live sheet. |
| A sale is missing from Recent sales | Only the last 15 are shown; older ones can be corrected directly in the **Sales Log** tab (adjust Inventory stock by hand too). |

## Security notes

- The repo and the Pages site are public; the Apps Script `/exec` URL is visible in the page source. That's unavoidable for a static page — the `POS_PIN` is what gates writes. Reads (stock + prices) are open to anyone with the URL.
- `CLASPRC_JSON` is a Google OAuth token for your account, scoped to Apps Script. Keep it as a GitHub secret only; never commit `.clasprc.json` or `apps-script/.clasp.json` (both are gitignored).
- **Sales Log columns:** `Timestamp | Qty Stamp 1 | Qty Stamp 2 | Qty Stamp 3 | Payment Method | Total Amount | Sale ID | Status | Updated At`. Status is `OK`, `EDITED` or `VOID`. Logs created before these columns existed are upgraded automatically on the next request.
- Sales are serialised with `LockService` and validated server-side, so concurrent cashiers can't oversell.
