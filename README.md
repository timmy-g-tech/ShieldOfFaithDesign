# Shield of Faith Design

A static storefront for [Shield of Faith Design](https://shieldoffaithdesign.etsy.com), Timothy Gardner's print-on-demand shop. The site is HTML and CSS, built with Node, and hosted on Netlify. Paid checkout uses Stripe. Paid orders are created in Printify.

Every Etsy link is exactly:

`https://shieldoffaithdesign.etsy.com`

Do not add a trailing slash, `www`, or tracking parameters. The header, footer, and product pages keep an **Also on Etsy** link to that address.

This pull request does not deploy the site to production and should not be merged until Timothy has reviewed the policy pages and placed a test order.

## What works with no API keys

The site builds and browses with every secret empty.

- Home, shop, category, and product pages for the 10 listings in `data/products.json`.
- Prices and photos are those saved listings. Nothing new is invented.
- Those listings have no Printify variant ids yet, so they cannot be added to an on-site cart. Each one links to Etsy.
- Cart, success, and cancel pages render.
- Checkout shows **Store opening soon. You can still shop these designs on Etsy.**
- Shipping and returns pages render. They are marked for Timothy to review.

`npm test` and `npm run build` do not need keys.

## Edit the shop

- `data/site.json` — tagline, about copy, FAQ, categories, and social links.
- `data/products.json` — the 10 saved listings used when Printify is not connected.
- `data/catalog.json` — written by the sync script. A Printify catalog replaces the fallback. A fallback catalog is ignored at build time in favor of `data/products.json`, so those prices cannot drift.
- `data/shipping.json` — shipping behavior. See below.
- Product photos for the fallback live in `assets/images/products/`.

Social links are placeholders that point at each platform's home page. Replace the `url` for Facebook, Instagram, Pinterest, X, and TikTok when the shop profiles are ready.

The phrases "Thin Blue Line" and "Blue Lives Matter" are rejected by the build. The artwork stays original: no official badges, patches, seals, or agency logos.

## Catalog sync

`npm run sync-catalog` reads published products from Printify and writes `data/catalog.json`.

- `GET https://api.printify.com/v1/shops/{shop_id}/products.json`
- Header `Authorization: Bearer PRINTIFY_API_TOKEN`
- Header `User-Agent: ShieldOfFaithDesign` (Printify requires a User-Agent)
- `PRINTIFY_SHOP_ID` defaults to `29744663`

A product is included only when it is published (`visible` is not false; if the payload has `external`, that must point at a sales channel), has an enabled variant with an integer price in cents, and has a Printify mockup image. Prices are the variant's retail `price`. Production `cost` is not stored and is not charged.

Images are kept only when the URL is `https://images.printify.com/.../mockup/...`. Other hosts, uploaded files, and non-mockup Printify URLs are dropped. The sync does not generate images. If a published product has no mockup left after that filter, it is skipped and the reason is logged.

Until `PRINTIFY_API_TOKEN` is set, the script writes the 10 listings from `data/products.json` and does not call Printify. Those items keep the Etsy link as the buy option.

If the token is set but the API fails, an existing Printify `data/catalog.json` is left in place. Otherwise the script writes the fallback and still exits 0, so a Netlify build can finish.

Netlify's build command is `node scripts/sync-catalog.js && node scripts/build.js`. With the token set in Netlify, each deploy refreshes the catalog before the pages are built. A scheduled function, `sync-catalog`, runs daily at 11:00 UTC. It stores the catalog in Netlify Blobs for checkout and logs the result. Product pages update on the next build. The schedule runs on the production site after this is published, not as part of this pull request.

## Shipping

Checkout collects the shipping address on this site, then prices shipping before Stripe opens.

1. The function calls Printify `POST /v1/shops/{shop_id}/orders/shipping.json` with the catalog's product id, variant id, quantity, and the address.
2. It charges the `standard` amount (integer cents). The Printify order uses `shipping_method` 1, which is standard.
3. If that call cannot be made and `flatRateCents` in `data/shipping.json` is a whole number of cents, that flat rate is charged instead. The repo leaves `flatRateCents` as `null`, so no shipping price is invented.
4. If neither rate is available, checkout does not take payment.

Item prices on the Stripe session always come from the catalog on the server. A price in the browser request is ignored.

## Checkout and orders

`create-checkout` creates a Stripe Checkout Session. The address is stored on the session and on the PaymentIntent shipping details. Stripe collects the card. Success returns to `/success/`. Cancel returns to `/cancel/`.

`stripe-webhook` accepts `checkout.session.completed` (and `checkout.session.async_payment_succeeded` for delayed payment methods). It verifies `STRIPE_WEBHOOK_SECRET`. A bad signature is rejected. The same session id is not sent to Printify twice: a session that already has `printify_order_id` is ignored, and Printify's HTTP 409 for a repeated `external_id` reuses the existing order.

The Printify order is `POST /v1/shops/{shop_id}/orders.json` with `line_items` of `product_id`, `variant_id`, and `quantity`, plus `address_to`. It is created as a draft.

`PRINTIFY_AUTO_SEND` must be the word `true` to call `POST /v1/shops/{shop_id}/orders/{order_id}/send_to_production.json`. Any other value, including empty, leaves the order as a draft for manual review. Sending an order to production spends money at Printify. Leave this off until a draft looks right.

Failures are logged with the `[printify]`, `[stripe]`, `[checkout]`, or `[shipping]` prefix, the session id, and the HTTP status. The webhook returns 500 when the Printify order was not created, so Stripe retries.

## Preview locally

```bash
npm install
npm test
npm run build
npm run dev
```

Open `http://localhost:8080`. `npm run dev` serves `dist/` and the checkout and webhook functions. Without keys, checkout stays on the opening-soon message.

`npm run preview` serves the built files only, with no functions. The opening-soon message is still in the page.

## Environment

Copy `.env.example` to `.env` for local Netlify dev. Do not commit `.env`. There are no real secrets in the repo.

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key. Use a test key (`sk_test_...`) until the shop is ready. |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the webhook endpoint (`whsec_...`). |
| `PRINTIFY_API_TOKEN` | Printify personal access token. |
| `PRINTIFY_SHOP_ID` | Printify shop id. Defaults to `29744663` when unset. |
| `PRINTIFY_AUTO_SEND` | `true` sends the Printify order to production. Anything else leaves a draft. |
| `SITE_URL` | Public site origin, no trailing slash. Used for the Stripe success and cancel URLs. If it is empty, the function uses the request host, which is what a Netlify preview needs. |

Set the same names in Netlify: **Site configuration → Environment variables**. Apply them to the preview and production contexts you intend to use. Changing them requires a new deploy.

Variant prices are stored as integer cents and charged as US dollars. That matches the dollar prices already in `data/products.json`. Confirm the Printify shop currency is USD before taking a live payment.

## What Timothy needs to do

1. Read `/shipping/` and `/returns/`. The banner on each page is the review note. Edit the wording before the shop takes orders.
2. Create or open the Stripe account for the shop. In test mode, copy the secret key into `STRIPE_SECRET_KEY`.
3. In Stripe, add a webhook endpoint. The URL is `https://<the-netlify-site>/api/stripe-webhook` (the same function is also at `/.netlify/functions/stripe-webhook`). Subscribe to `checkout.session.completed`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`. For local tests, the Stripe CLI can forward events to `http://localhost:8080/api/stripe-webhook`.
4. In Printify, open the shop `29744663` and create a personal access token (My Profile → Connections). The token needs to read products and create orders. Put it in `PRINTIFY_API_TOKEN`. Leave `PRINTIFY_SHOP_ID` as `29744663` unless the shop id is different.
5. Connect this GitHub repository to Netlify if it is not connected yet. Build command: `node scripts/sync-catalog.js && node scripts/build.js`. Publish directory: `dist`. Node 22 is set in `netlify.toml`.
6. Add the environment variables in Netlify. Leave `PRINTIFY_AUTO_SEND` unset or set it to `false`.
7. Set `SITE_URL` to the Netlify origin after the first deploy, with no trailing slash, or leave it empty so each deploy uses its own host.
8. Deploy a preview. Confirm checkout no longer says the store is opening soon. Place a Stripe test-card order. In Printify, confirm a **draft** order with the right product, variant, quantity, and address. Do not send it to production until that draft is right.
9. Only then set `PRINTIFY_AUTO_SEND` to `true` and redeploy, if orders should go to production without a manual check.
10. Optional: if you want a fallback shipping price when Printify's shipping call fails, set `flatRateCents` in `data/shipping.json` to a whole number of cents that you choose, then redeploy. Leave it `null` to refuse checkout instead of guessing.

Live Stripe keys and `PRINTIFY_AUTO_SEND=true` charge real cards and send real print jobs. Use test mode first.

## Netlify

The GitHub repository is connected to a Netlify site. Production deploys the `main` branch. Pull requests get a deploy preview. `main` still only has the initial README, so a production deploy of that branch fails until this work is merged. Do not merge it yet. This pull request does not publish a production site.

- Build command: `node scripts/sync-catalog.js && node scripts/build.js`
- Publish directory: `dist`
- Functions directory: `netlify/functions`
