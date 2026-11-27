const fs = require("fs");
const path = require("path");
const { assertNoBanned } = require("../lib/banned");
const { ROOT, SHOP_URL, resolveCatalog } = require("../lib/catalog");
const { allPages } = require("./render");

const DIST = path.join(ROOT, "dist");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function copyAssets() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, "assets", "images"), path.join(DIST, "images"), { recursive: true });
  fs.cpSync(path.join(ROOT, "assets", "fonts"), path.join(DIST, "fonts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
  fs.copyFileSync(path.join(ROOT, "src", "store.js"), path.join(DIST, "store.js"));
  for (const file of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png", "og-image.jpg"]) {
    fs.copyFileSync(path.join(ROOT, "assets", file), path.join(DIST, file));
  }
  fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nAllow: /\n");
}

function localImageExists(src) {
  if (!src || src.startsWith("https://") || src.startsWith("http://")) return true;
  const relative = String(src).replace(/^\//, "");
  return fs.existsSync(path.join(ROOT, "assets", relative));
}

function validate(site, catalog, pages) {
  if (site.shopUrl !== SHOP_URL) {
    throw new Error(`data/site.json shopUrl must be exactly ${SHOP_URL}`);
  }
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error("The catalog needs at least one product.");
  }
  const slugs = new Set();
  for (const product of catalog.products) {
    if (!product.title || !product.slug || !product.etsyUrl) {
      throw new Error(`Catalog product is missing title, slug, or etsyUrl: ${product.id || "(no id)"}`);
    }
    if (product.etsyUrl !== SHOP_URL) {
      throw new Error(`${product.title} etsyUrl must be exactly ${SHOP_URL}`);
    }
    if (slugs.has(product.slug)) throw new Error(`Duplicate product slug: ${product.slug}`);
    slugs.add(product.slug);
    const image = product.image || (product.images && product.images[0] && product.images[0].src);
    if (!localImageExists(image)) throw new Error(`Missing image for ${product.title}: ${image}`);
    if (product.purchasable) {
      if (!product.variants || !product.variants.length) {
        throw new Error(`${product.title} is purchasable but has no variants.`);
      }
      for (const variant of product.variants) {
        if (!Number.isInteger(variant.price) || variant.price <= 0) {
          throw new Error(`${product.title} has a variant without a real price.`);
        }
      }
    }
  }

  const html = pages.map((entry) => entry.html).join("\n");
  assertNoBanned(JSON.stringify(site), "site.json");
  assertNoBanned(JSON.stringify(catalog), "catalog");
  assertNoBanned(html, "built HTML");

  const urls = html.match(/https?:\/\/[^"'\\\s<]*etsy\.com[^"'\\\s<]*/gi) || [];
  const bad = urls.filter((url) => url.replace(/<wbr>/g, "") !== SHOP_URL && url !== SHOP_URL);
  if (bad.length) {
    throw new Error(`Found Etsy URLs that are not the shop link:\n${[...new Set(bad)].join("\n")}`);
  }
  if (html.includes("etsy.com/listing") || html.includes("etsy.com/shop")) {
    throw new Error("Built HTML must not link to individual listings or the www shop URL.");
  }
  for (const entry of pages) {
    if (!entry.html.includes(SHOP_URL)) {
      throw new Error(`${entry.file} is missing the Also on Etsy shop link.`);
    }
    if (!entry.html.includes("Also on Etsy")) {
      throw new Error(`${entry.file} is missing the Also on Etsy label.`);
    }
  }
  const checkout = pages.find((entry) => entry.file === "checkout/index.html");
  if (!checkout || !checkout.html.includes("Store opening soon")) {
    throw new Error("The checkout page must show the store opening soon state.");
  }
}

function main() {
  const site = readJson("data/site.json");
  const products = readJson("data/products.json");
  const catalog = resolveCatalog({ products });
  const pages = allPages(site, catalog);
  validate(site, catalog, pages);
  copyAssets();
  for (const entry of pages) {
    const dest = path.join(DIST, entry.file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.html);
  }
  fs.writeFileSync(path.join(DIST, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  const purchasable = catalog.products.filter((product) => product.purchasable).length;
  console.log(
    `Built dist/ with ${catalog.products.length} products (${purchasable} purchasable) from ${catalog.source}.`
  );
}

main();
