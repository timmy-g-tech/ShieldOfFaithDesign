const { fulfillPaidSession } = require("../../lib/fulfill");

function rawBody(event) {
  if (!event || !event.body) return "";
  if (event.isBase64Encoded) return Buffer.from(event.body, "base64").toString("utf8");
  return event.body;
}

function header(event, name) {
  const headers = (event && event.headers) || {};
  const wanted = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === wanted) return headers[key];
  }
  return "";
}

async function handleWebhook(event, { stripe, env = process.env, fetchImpl, log = console } = {}) {
  const secret = String(env.STRIPE_WEBHOOK_SECRET || "").trim();
  const key = String(env.STRIPE_SECRET_KEY || "").trim();
  if (!secret || !key) {
    log.error("[stripe] STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY is not set. The webhook was rejected.");
    return { statusCode: 500, body: "Webhook is not configured." };
  }
  const Stripe = require("stripe");
  const client = stripe || new Stripe(key);
  let stripeEvent;
  try {
    stripeEvent = client.webhooks.constructEvent(rawBody(event), header(event, "stripe-signature"), secret);
  } catch (err) {
    log.error(`[stripe] Webhook signature verification failed: ${err.message}`);
    return { statusCode: 400, body: "Invalid signature." };
  }
  if (
    stripeEvent.type !== "checkout.session.completed" &&
    stripeEvent.type !== "checkout.session.async_payment_succeeded"
  ) {
    return { statusCode: 200, body: "Ignored." };
  }
  try {
    await fulfillPaidSession({
      session: stripeEvent.data.object,
      stripe: client,
      env,
      fetchImpl,
      log,
    });
    return { statusCode: 200, body: "OK" };
  } catch (err) {
    log.error(`[printify] Webhook fulfillment failed for ${stripeEvent.data.object?.id || "unknown session"}: ${err.message}`);
    return { statusCode: 500, body: "Fulfillment failed." };
  }
}

exports.handleWebhook = handleWebhook;

exports.handler = async function handler(event) {
  const result = await handleWebhook(event);
  return {
    statusCode: result.statusCode,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    body: result.body,
  };
};
