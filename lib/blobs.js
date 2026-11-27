async function getCatalogBlob() {
  const { getStore } = require("@netlify/blobs");
  const store = getStore("catalog");
  const text = await store.get("catalog.json");
  if (!text) return null;
  return JSON.parse(text);
}

async function setCatalogBlob(catalog) {
  const { getStore } = require("@netlify/blobs");
  const store = getStore("catalog");
  await store.set("catalog.json", JSON.stringify(catalog));
}

module.exports = { getCatalogBlob, setCatalogBlob };
