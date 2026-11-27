const { createCheckoutSession, siteOrigin, openingSoonBody } = require("../../lib/checkout");
const { loadShippingConfig } = require("../../lib/catalog");
const { loadRuntimeCatalog } = require("../../lib/runtime-catalog");

const MAX_BODY = 100_000;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async function handler(event) {
  const method = event.httpMethod || "GET";
  if (method === "GET") {
    if (!String(process.env.STRIPE_SECRET_KEY || "").trim()) {
      return response(200, openingSoonBody());
    }
    return response(200, { ok: true, code: "open" });
  }
  if (method !== "POST") return response(405, { ok: false, message: "Method not allowed." });
  if (!event.body || event.body.length > MAX_BODY) {
    return response(400, { ok: false, message: "The checkout request is empty or too large." });
  }
  let payload;
  try {
    const raw = event.isBase64Encoded ? Buffer.from(event.body, "base64").toString("utf8") : event.body;
    payload = JSON.parse(raw);
  } catch (err) {
    return response(400, { ok: false, message: "Checkout details could not be read." });
  }
  try {
    const catalog = await loadRuntimeCatalog();
    const result = await createCheckoutSession({
      items: payload.items,
      address: payload.address,
      catalog,
      shippingConfig: loadShippingConfig(),
      origin: siteOrigin(event),
      stripe: stripeClient(),
    });
    return response(result.statusCode, result.body);
  } catch (err) {
    console.error(`[checkout] ${err.message}`);
    return response(500, { ok: false, message: "Checkout could not be started." });
  }
};

function stripeClient() {
  const key = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) return null;
  const Stripe = require("stripe");
  return new Stripe(key);
}
