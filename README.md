# Shield of Faith Design

A small, fast storefront for [Shield of Faith Design](https://shieldoffaithdesign.etsy.com). The site introduces the shop and sends every shop and buy link to Etsy. It is plain HTML and CSS, built with Node and no paid services.

Every shop link is exactly:

`https://shieldoffaithdesign.etsy.com`

That address is required for Etsy’s Share and Save program. Do not add a trailing slash, `www`, or tracking parameters.

## Edit the shop

Two files hold the words visitors see.

- `data/site.json` — tagline, about copy, FAQ, category blurbs, and social links.
- `data/products.json` — the featured grid. Each item has a name, image, Etsy URL, and category.

Social links are placeholders that point at each platform’s home page. Replace the `url` for Facebook, Instagram, Pinterest, X, and TikTok when the shop profiles are ready.

Product photos live in `assets/images/products/`. After you change either data file or an image, rebuild.

After Netlify gives the site a URL, set `siteUrl` in `data/site.json` to that address (for example `https://your-site.netlify.app`, with no trailing slash) and redeploy. That turns on the canonical link and the absolute Open Graph image.

## Preview locally

```bash
node scripts/build.js
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`.

`npm run build` and `npm run preview` do the same thing. The build uses Node only. There are no packages to install.

## Deploy on Netlify

The site deploys from this GitHub repository. No custom domain and no paid add-on is required.

1. Sign in at [https://app.netlify.com](https://app.netlify.com).
2. Choose **Add new site**, then **Import an existing project**.
3. Choose **GitHub** and authorize Netlify if it asks.
4. Pick this repository, `ShieldOfFaithDesign`.
5. Leave the branch as `main` once this work is merged. To preview a feature branch, pick that branch instead.
6. Confirm the build settings. Netlify also reads `netlify.toml`, which already sets them:
   - **Build command:** `node scripts/build.js`
   - **Publish directory:** `dist`
7. Leave environment variables empty. The site does not use API keys, analytics, or a custom domain.
8. Choose **Deploy site**. Netlify installs nothing, runs the build, and publishes the `dist` folder.
9. When the deploy finishes, open the `*.netlify.app` URL Netlify shows. Set `siteUrl` in `data/site.json` to that URL and push again so link previews use a full image address.

Later pushes to the connected branch deploy on their own.

## Where the listings came from

On November 23, 2026 the public shop page returned HTTP 403 from Etsy’s bot protection. The public RSS feed for the same shop (`https://www.etsy.com/shop/ShieldOfFaithDesign/rss`) returned the current listings. Titles, prices, and photos in `data/products.json` came from that feed. Photos are saved in the repo so the site does not call Etsy when a visitor opens a page. Buy links still go only to `https://shieldoffaithdesign.etsy.com`.
