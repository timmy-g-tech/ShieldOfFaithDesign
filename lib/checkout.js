const { resolveOrderLines, loadShippingConfig, money } = require("./catalog");
const { quoteShipping } = require("./shipping");

const OPENING_SOON = "Store opening soon. You can still shop these designs on Etsy.";

function requiredText(value, label, max) {
  const text = String(value || "").trim();
  if (!text) {
    const error = new Error(`${label} is required.`);
    error.code = "address";
    throw error;
  }
  if (text.length > max) {
    const error = new Error(`${label} is too long.`);
    error.code = "address";
    throw error;
  }
  return text;
}

function cleanAddress(input) {
  const address = input && typeof input === "object" ? input : {};
  const country = String(address.country || "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    const error = new Error("Country must be a two-letter code.");
    error.code = "address";
    throw error;
  }
  const email = String(address.email || "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    const error = new Error("Email is not valid.");
    error.code = "address";
    throw error;
  }
  const phone = requiredText(address.phone, "Phone", 40);
  if (!/^[\d\s()+\-.]{7,40}$/.test(phone)) {
    const error = new Error("Phone is not valid.");
    error.code = "address";
    throw error;
  }
  return {
    first_name: requiredText(address.firstName ?? address.first_name, "First name", 80),
    last_name: requiredText(address.lastName ?? address.last_name, "Last name", 80),
    email,
    phone,
    country,
    region: String(address.region || "").trim().slice(0, 80),
    address1: requiredText(address.address1, "Street address", 200),
    address2: String(address.address2 || "").trim().slice(0, 200),
    city: requiredText(address.city, "City", 80),
    zip: requiredText(address.zip ?? address.postalCode, "Postal code", 20),
  };
}

function siteOrigin(event, env = process.env) {
  const configured = String(env.SITE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const headers = event && event.headers ? event.headers : {};
  const proto = headers["x-forwarded-proto"] || headers["X-Forwarded-Proto"] || "";
  const host = headers["x-forwarded-host"] || headers.host || headers.Host || "";
  if (proto && host) return `${proto}://${host}`.replace(/\/$/, "");
  const deploy = String(env.DEPLOY_PRIME_URL || env.URL || "").trim().replace(/\/$/, "");
  return deploy;
}

function openingSoonBody() {
  return { ok: false, code: "opening_soon", message: OPENING_SOON };
}

function stripeLineItems(lines, shipping) {
  const currency = (lines[0] && lines[0].currency) || "usd";
  const items = lines.map((line) => {
    const name = line.variantTitle ? `${line.title} (${line.variantTitle})` : line.title;
    const productData = {
      name: name.slice(0, 250),
      metadata: {
        printify_product_id: line.productId,
        printify_variant_id: String(line.variantId),
      },
    };
    if (typeof line.image === "string" && line.image.startsWith("https://")) {
      productData.images = [line.image];
    }
    return {
      quantity: line.quantity,
      price_data: {
        currency,
        unit_amount: line.unitAmount,
        product_data: productData,
      },
    };
  });
  items.push({
    quantity: 1,
    price_data: {
      currency,
      unit_amount: shipping.cents,
      product_data: {
        name: shipping.label || "Shipping",
        metadata: {
          kind: "shipping",
          source: shipping.source,
        },
      },
    },
  });
  return items;
}

function sessionMetadata(address, shipping) {
  return {
    source: "shield-of-faith",
    ship_first_name: address.first_name,
    ship_last_name: address.last_name,
    ship_email: address.email,
    ship_phone: address.phone,
    ship_address1: address.address1,
    ship_address2: address.address2,
    ship_city: address.city,
    ship_region: address.region,
    ship_zip: address.zip,
    ship_country: address.country,
    shipping_cents: String(shipping.cents),
    shipping_source: shipping.source,
    shipping_method: "1",
  };
}

async function createCheckoutSession({
  items,
  address,
  catalog,
  shippingConfig,
  env = process.env,
  origin,
  stripe,
  fetchImpl,
  log = console,
}) {
  if (!String(env.STRIPE_SECRET_KEY || "").trim()) {
    return { statusCode: 503, body: openingSoonBody() };
  }
  if (!origin) {
    log.error("[checkout] SITE_URL is not set and the request had no host.");
    return {
      statusCode: 500,
      body: { ok: false, code: "config", message: "Checkout is not available yet." },
    };
  }
  let lines;
  try {
    lines = resolveOrderLines(catalog, items);
  } catch (err) {
    return { statusCode: 400, body: { ok: false, code: err.code || "cart", message: err.message } };
  }
  let clean;
  try {
    clean = cleanAddress(address);
  } catch (err) {
    return { statusCode: 400, body: { ok: false, code: "address", message: err.message } };
  }
  const config = shippingConfig || loadShippingConfig();
  const shipping = await quoteShipping({
    lines,
    address: clean,
    config,
    env,
    fetchImpl,
    log,
  });
  if (!shipping.ok) {
    return { statusCode: 503, body: { ok: false, code: "shipping", message: shipping.message } };
  }
  const metadata = sessionMetadata(clean, shipping);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: clean.email,
    success_url: `${origin}/success/?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/cancel/`,
    line_items: stripeLineItems(lines, shipping),
    metadata,
    payment_intent_data: {
      metadata,
      shipping: {
        name: `${clean.first_name} ${clean.last_name}`,
        phone: clean.phone,
        address: {
          line1: clean.address1,
          line2: clean.address2 || undefined,
          city: clean.city,
          state: clean.region || undefined,
          postal_code: clean.zip,
          country: clean.country,
        },
      },
    },
  });
  if (!session || !session.url) {
    log.error("[stripe] Checkout Session did not return a URL.");
    return { statusCode: 502, body: { ok: false, code: "stripe", message: "Checkout could not be started." } };
  }
  log.log(
    `[checkout] Created Stripe session ${session.id || "(no id)"} for ${lines.length} line(s), shipping ${money(shipping.cents)} from ${shipping.source}.`
  );
  return { statusCode: 200, body: { ok: true, url: session.url } };
}

module.exports = {
  OPENING_SOON,
  cleanAddress,
  siteOrigin,
  openingSoonBody,
  stripeLineItems,
  createCheckoutSession,
};
