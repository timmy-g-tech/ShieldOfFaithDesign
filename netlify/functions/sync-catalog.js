const { runSync } = require("../../lib/sync");
const { setCatalogBlob } = require("../../lib/blobs");

function isScheduled(event) {
  const headers = (event && event.headers) || {};
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === "x-nf-event" && String(headers[key]).toLowerCase() === "schedule") {
      return true;
    }
  }
  return false;
}

exports.handler = async function handler(event) {
  if (!isScheduled(event)) {
    return { statusCode: 404, headers: { "Content-Type": "text/plain" }, body: "Not found" };
  }
  const result = await runSync({ write: false });
  try {
    await setCatalogBlob(result.catalog);
    console.log(
      `[printify] Stored catalog in Netlify Blobs (${result.catalog.products.length} products, source ${result.catalog.source}). Product pages update on the next build.`
    );
  } catch (err) {
    console.error(
      `[catalog] Netlify Blobs is not available (${err.message}). The scheduled sync did not store a catalog. Run npm run sync-catalog and redeploy to refresh pages.`
    );
  }
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: result.catalog.source,
      products: result.catalog.products.length,
      fallback: Boolean(result.fallback),
    }),
  };
};

exports.config = {
  schedule: "0 11 * * *",
};
