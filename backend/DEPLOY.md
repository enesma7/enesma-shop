# Deploy The ENESMA Shop Order Service

The shop site sends orders and admin sign-in to a Google Apps Script web app. Nothing secret belongs in the git repo. Set the values below as **Script properties** after you create the script.

## 1. Create the Apps Script project

1. Open [script.google.com](https://script.google.com) while signed in as the account that should own the orders (this account sends the mail and owns the Sheet and Drive folder).
2. New project. Name it `ENESMA Shop Orders`.
3. Delete the placeholder `Code.gs` contents and paste in `backend/Code.gs` from this repo.
4. Project Settings (gear) → check **Show "appsscript.json" manifest file**.
5. Open `appsscript.json` and replace it with `backend/appsscript.json` from this repo.

## 2. Create the orders Sheet and photo folder

1. Create a Google Sheet named `ENESMA Shop Orders`. Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/THIS_PART/edit`.
2. Create a Drive folder named `ENESMA Shop Photos`. Open it and copy the folder ID from the URL.
3. Share the Sheet and the folder with the account that deploys the script if they are not already the owner.

Photo links are set to "anyone with the link can view" so Grafek can open them from the order email. Do not put other files in that folder.

## 3. Script properties

Project Settings → Script properties → Add each of these:

| Property | Value |
| --- | --- |
| `ORDERS_SHEET_ID` | The Sheet ID from step 2 |
| `DRIVE_FOLDER_ID` | The photo folder ID from step 2 |
| `ORDER_TO` | `grafekprinting@gmail.com` |
| `ORDER_CC` | `enrique@enesmabroker.com` |
| `SHOP_OWNER_ADMINS` | Comma-separated owner and admin emails who may request a shop sign-in code. Example: `enrique@enesmabroker.com` |
| `SHOP_PRINT_PARTNER` | `grafekprinting@gmail.com` |
| `HUB_API_URL` | The existing ENESMA Agent Hub / Transaction Center web app URL (`…/exec`). The shop calls only its `me` action to reuse an owner or admin session. |

`SHOP_PRINT_PARTNER` must be a single email. That address receives a shop-only **Print Partner** role: order history on this shop, and nothing else. Do not add that address to `SHOP_OWNER_ADMINS`. Do not add preferred partners, agents, or any other partner. The script never writes roles back to the Agent Hub or the Transaction Center.

Leave `SESSIONS` unset. The script creates it.

## 4. Deploy the web app

1. Deploy → New deployment → type **Web app**.
2. Description: `ENESMA Shop`.
3. Execute as: **Me**.
4. Who has access: **Anyone**.
5. Deploy. Authorize the requested permissions (Sheets, Drive, send email, call the Hub URL).
6. Copy the web app URL that ends in `/exec`.

If you change `Code.gs` later: Deploy → Manage deployments → Edit → New version → Deploy. The URL stays the same.

## 5. Point the shop at the web app

In `js/config.js`, set:

```js
APPS_SCRIPT_URL: 'https://script.google.com/macros/s/…/exec'
```

Leave `ACCESS_MODE` as `'open'` while the shop is being reviewed. Change it to `'members'` later to limit browsing and ordering to ENESMA agents, admins, and preferred partners who are signed in on the Agent Hub.

Until `APPS_SCRIPT_URL` is set, checkout shows **Ordering not yet connected** and does not pretend an order was sent.

## 6. How sign-in works

- **Owners and admins** can choose **Continue With ENESMA**. The shop reads the `enesma_sso` cookie set by the Agent Hub (domain `.enesmarealty.com`) and asks the Hub `me` action who they are. Only `owner` and `admin` roles get a shop session. Agents, transaction coordinators, and preferred partners do not.
- **The same people** can also request a one-time code if their email is listed in `SHOP_OWNER_ADMINS`.
- **Grafek** uses **Print Partner**. They enter `grafekprinting@gmail.com`, receive a 10-minute code, and get a shop session whose role is `print_partner`. That role is stored only in this script. It cannot open the Agent Hub, Transaction Center, or any other ENESMA app.
- Sessions last 8 hours. Every order-history request checks the session on the server. Order rows are never returned without a valid owner, admin, or print-partner session.

## 7. What an order does

1. Checks a honeypot field and a rate limit (6 orders per buyer email per hour, and 40 orders per hour for the whole shop).
2. Writes one row to the Orders sheet: order number, time, status `New`, buyer contact, line items (options, sizes, colors, quantities, prices), estimated total, photo links.
3. Saves uploaded photos into the Drive folder.
4. Emails `ORDER_TO`, CCs `ORDER_CC`, and sets Reply-To to the buyer.

Grafek changes status in Admin to **New**, **Sent To Printer**, or **Completed**. Grafek contacts the buyer to confirm details and collect payment. The site does not take payment.

## 8. GitHub Pages

The site is a static site from the `main` branch, root folder, with `CNAME` set to `shop.enesmarealty.com`.

1. Repo → Settings → Pages → Build and deployment → Deploy from branch → `main` → `/ (root)` → Save.
2. Custom domain: `shop.enesmarealty.com` (the `CNAME` file already contains it).
3. DNS for `shop.enesmarealty.com` should point at `enesma7.github.io`. That step is done outside this repo.
