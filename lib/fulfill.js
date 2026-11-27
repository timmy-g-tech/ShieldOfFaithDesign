const { shopIdFromEnv } = require("./catalog");
const { createOrder, getOrder, sendToProduction, summarizeError } = require("./printify");

const READY_TO_SEND = new Set(["on-hold", "pending", "payment-not-received"]);

function autoSendEnabled(env = process.env) {
  return String(env.PRINTIFY_AUTO_SEND || "").trim().toLowerCase() === "true";
}

function addressFromMetadata(metadata) {
  const source = metadata || {};
  const address = {
    first_name: source.ship_first_name || "",
    last_name: source.ship_last_name || "",
    email: source.ship_email || "",
    phone: source.ship_phone || "",
    country: source.ship_country || "",
    region: source.ship_region || "",
    address1: source.ship_address1 || "",
    address2: source.ship_address2 || "",
    city: source.ship_city || "",
    zip: source.ship_zip || "",
  };
  const missing = ["first_name", "last_name", "email", "address1", "city", "zip", "country"].filter(
    (key) => !address[key]
  );
  if (missing.length) {
    throw new Error(`Session is missing shipping fields: ${missing.join(", ")}.`);
  }
  return address;
}

function productMetadata(item) {
  const product = item && item.price && item.price.product;
  if (!product || typeof product === "string") return {};
  return product.metadata || {};
}

function lineItemsFromSession(list) {
  const rows = list && Array.isArray(list.data) ? list.data : [];
  const lineItems = [];
  for (const item of rows) {
    const metadata = productMetadata(item);
    if (metadata.kind === "shipping") continue;
    const productId = metadata.printify_product_id;
    const variantId = Number(metadata.printify_variant_id);
    if (!productId || !Number.isInteger(variantId) || !Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error("A paid line is missing a Printify product id, variant id, or quantity.");
    }
    lineItems.push({
      product_id: String(productId),
      variant_id: variantId,
      quantity: item.quantity,
    });
  }
  if (!lineItems.length) throw new Error("The paid session has no product lines.");
  return lineItems;
}

async function rememberOrder(stripe, session, orderId, status) {
  await stripe.checkout.sessions.update(session.id, {
    metadata: {
      ...(session.metadata || {}),
      printify_order_id: String(orderId),
      printify_status: status,
    },
  });
}

async function fulfillPaidSession({ session, stripe, env = process.env, fetchImpl = fetch, log = console }) {
  const sessionId = session && session.id ? session.id : "unknown";
  if (!session || session.metadata?.source !== "shield-of-faith") {
    log.error(`[stripe] Ignoring session ${sessionId}: it is not a Shield of Faith checkout.`);
    return { ok: true, ignored: true };
  }
  if (session.payment_status !== "paid") {
    log.error(`[stripe] Session ${sessionId} payment_status is ${session.payment_status || "missing"}. No Printify order was created.`);
    return { ok: true, pending: true };
  }
  if (session.metadata.printify_order_id) {
    log.log(`[printify] Session ${sessionId} already has Printify order ${session.metadata.printify_order_id}.`);
    return { ok: true, duplicate: true, orderId: session.metadata.printify_order_id };
  }

  const token = String(env.PRINTIFY_API_TOKEN || "").trim();
  if (!token) {
    log.error(`[printify] PRINTIFY_API_TOKEN is not set. Cannot create an order for session ${sessionId}.`);
    throw new Error("PRINTIFY_API_TOKEN is not set.");
  }
  const shopId = shopIdFromEnv(env);
  const listed = await stripe.checkout.sessions.listLineItems(session.id, {
    limit: 100,
    expand: ["data.price.product"],
  });
  const lineItems = lineItemsFromSession(listed);
  const address = addressFromMetadata(session.metadata);
  const created = await createOrder({
    token,
    shopId,
    externalId: session.id,
    lineItems,
    address,
    fetchImpl,
  });

  let orderId = created.data && created.data.id;
  if (created.status === 409) {
    orderId = created.data && created.data.order && created.data.order.id;
    log.log(
      `[printify] Order already exists for session ${sessionId} (HTTP 409). Existing order ${orderId || "has no id in the response"}.`
    );
  } else if (!created.ok || !orderId) {
    log.error(
      `[printify] Failed to create order for session ${sessionId}: HTTP ${created.status}. ${summarizeError(created.data)}`.trim()
    );
    throw new Error(`Printify order creation failed with HTTP ${created.status}.`);
  } else {
    log.log(`[printify] Created order ${orderId} for session ${sessionId}.`);
  }
  if (!orderId) {
    log.error(`[printify] No order id for session ${sessionId} after create.`);
    throw new Error("Printify did not return an order id.");
  }

  let status = "draft";
  if (autoSendEnabled(env)) {
    const current = await getOrder({ token, shopId, orderId, fetchImpl });
    const orderStatus = current.ok && current.data ? current.data.status : "";
    if (current.ok && orderStatus && !READY_TO_SEND.has(orderStatus)) {
      status = "sent";
      log.log(`[printify] Order ${orderId} status is ${orderStatus}. It was not sent again.`);
    } else {
      const sent = await sendToProduction({ token, shopId, orderId, fetchImpl });
      if (!sent.ok && sent.status !== 202) {
        log.error(
          `[printify] Failed to send order ${orderId} to production for session ${sessionId}: HTTP ${sent.status}. ${summarizeError(sent.data)}`.trim()
        );
        throw new Error(`Printify send_to_production failed with HTTP ${sent.status}.`);
      }
      status = "sent";
      log.log(`[printify] Sent order ${orderId} to production for session ${sessionId}.`);
    }
  } else {
    log.log(
      `[printify] PRINTIFY_AUTO_SEND is not true. Order ${orderId} was left as a draft for manual review. Session ${sessionId}.`
    );
  }

  try {
    await rememberOrder(stripe, session, orderId, status);
  } catch (err) {
    log.error(
      `[stripe] Printify order ${orderId} exists, but session ${sessionId} metadata was not updated: ${err.message}`
    );
  }
  return { ok: true, orderId, status };
}

module.exports = {
  autoSendEnabled,
  addressFromMetadata,
  lineItemsFromSession,
  fulfillPaidSession,
};
