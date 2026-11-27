const { isPrintifyCatalog, resolveCatalog } = require("./catalog");
const { getCatalogBlob } = require("./blobs");

function newer(left, right) {
  return String((left && left.syncedAt) || "").localeCompare(String((right && right.syncedAt) || ""));
}

async function loadRuntimeCatalog({ env = process.env, fetchImpl = fetch, log = console } = {}) {
  let blob = null;
  try {
    blob = await getCatalogBlob();
  } catch (err) {
    log.error(`[catalog] Netlify Blobs is not available (${err.message}).`);
  }

  let published = null;
  const origin = String(env.DEPLOY_PRIME_URL || env.URL || "").trim().replace(/\/$/, "");
  if (origin) {
    try {
      const response = await fetchImpl(`${origin}/catalog.json`);
      if (response.ok) published = await response.json();
      else log.error(`[catalog] Published catalog request returned HTTP ${response.status}.`);
    } catch (err) {
      log.error(`[catalog] Could not read the published catalog: ${err.message}`);
    }
  }

  const local = resolveCatalog({ env });
  const fresh = [blob, published].filter(isPrintifyCatalog).sort(newer).pop();
  if (fresh && (!isPrintifyCatalog(local) || newer(fresh, local) > 0)) return fresh;
  if (isPrintifyCatalog(local)) return local;
  if (isPrintifyCatalog(published)) return published;
  if (isPrintifyCatalog(blob)) return blob;
  return local;
}

module.exports = { loadRuntimeCatalog };
