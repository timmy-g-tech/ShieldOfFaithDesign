const {
  shopIdFromEnv,
  DEFAULT_SHOP_ID,
  loadProductsSource,
  loadSiteSource,
  loadCatalogFile,
  fallbackCatalog,
  catalogFromPrintify,
  isPrintifyCatalog,
  writeCatalog,
} = require("./catalog");
const { listProducts } = require("./printify");

async function runSync({
  env = process.env,
  fetchImpl = fetch,
  log = console,
  write = true,
  writer = writeCatalog,
} = {}) {
  const productsDoc = loadProductsSource();
  const site = loadSiteSource();
  let shopId = DEFAULT_SHOP_ID;
  try {
    shopId = shopIdFromEnv(env);
  } catch (err) {
    log.error(`[printify] ${err.message} Using ${DEFAULT_SHOP_ID}.`);
  }
  const token = String(env.PRINTIFY_API_TOKEN || "").trim();
  log.log(`[printify] Shop id ${shopId}. PRINTIFY_API_TOKEN ${token ? "is set" : "is not set"}.`);
  if (!token) {
    log.error(
      "[printify] PRINTIFY_API_TOKEN is not set. Writing the 10 listings from data/products.json. No products or prices were invented. Items have no variant ids, so checkout stays on Etsy."
    );
    const catalog = fallbackCatalog(productsDoc, { shopId });
    if (write) writer(catalog);
    return { catalog, wrote: Boolean(write), fallback: true };
  }

  try {
    const raw = await listProducts({ token, shopId, fetchImpl });
    log.log(`[printify] Printify returned ${raw.length} products before filters.`);
    const { catalog, skipped } = catalogFromPrintify(raw, {
      shopId,
      categories: site.categories,
    });
    if (!catalog.products.length) {
      log.error(
        `[printify] The API returned no published products with a Printify mockup, an enabled variant, and a price. Skipped: ${JSON.stringify(skipped)}.`
      );
      const existing = loadCatalogFile();
      if (isPrintifyCatalog(existing)) {
        log.error("[printify] Left the existing Printify catalog in place.");
        return { catalog: existing, wrote: false, fallback: false, skipped };
      }
      const fallback = fallbackCatalog(productsDoc, { shopId });
      if (write) writer(fallback);
      log.error("[printify] Wrote the data/products.json fallback.");
      return { catalog: fallback, wrote: Boolean(write), fallback: true, skipped };
    }
    if (write) writer(catalog);
    log.log(
      `[printify] Saved ${catalog.products.length} published products to data/catalog.json. Skipped: ${JSON.stringify(skipped)}.`
    );
    return { catalog, wrote: Boolean(write), fallback: false, skipped };
  } catch (err) {
    log.error(`[printify] Catalog sync failed: ${err.message}`);
    const existing = loadCatalogFile();
    if (isPrintifyCatalog(existing)) {
      log.error("[printify] Left the existing Printify catalog in place.");
      return { catalog: existing, wrote: false, fallback: false, error: err.message };
    }
    const fallback = fallbackCatalog(productsDoc, { shopId });
    if (write) writer(fallback);
    log.error("[printify] Wrote the data/products.json fallback.");
    return { catalog: fallback, wrote: Boolean(write), fallback: true, error: err.message };
  }
}

module.exports = { runSync };
