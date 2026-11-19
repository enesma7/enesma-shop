# ENESMA Shop

Static shop for [shop.enesmarealty.com](https://shop.enesmarealty.com). Gear, signs, and cards. Orders are emailed to Grafek Printing and logged in a Google Sheet. The site does not take payment.

## Edit the catalog

Prices, names, and the back-emblem price live in `js/catalog.js`.

- `backEmblemPrice: null` shows **Back Emblem (Pending Price)** and does not add it to the total.
- Set `backEmblemPrice` to a number when the price is confirmed.
- `agentNamePrice` is the optional name add-on for the polo, quarter-zip, and cap.

## Ordering

`js/config.js` holds `APPS_SCRIPT_URL` and `ACCESS_MODE`.

- `ACCESS_MODE: 'open'` — anyone can browse and order.
- `ACCESS_MODE: 'members'` — browsing and ordering require an ENESMA Agent Hub session for an agent, admin, owner, or preferred partner. Admin order history stays separate.
- Leave `APPS_SCRIPT_URL` empty until the Apps Script web app is deployed. Checkout then shows **Ordering not yet connected**.

Deploy steps: `backend/DEPLOY.md`.

## Gear models

`models/*.glb` are the closet garments. `scripts/build-models.mjs` rebuilds them. `scripts/render-stills.mjs` writes the HD stills in `assets/renders/` from those same files. Product photos, the home Gear tile, and cart thumbnails use those stills.

## Pages

GitHub Pages serves this repo from `main` at the site root. `CNAME` is `shop.enesmarealty.com`.
