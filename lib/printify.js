const USER_AGENT = "ShieldOfFaithDesign";

function summarizeError(data) {
  if (!data || typeof data !== "object") return "";
  const reason = data.errors?.reason || data.message || data.raw || "";
  return String(reason).replace(/\s+/g, " ").slice(0, 300);
}

async function printifyRequest({
  token,
  shopId,
  pathname,
  method = "GET",
  body,
  fetchImpl = fetch,
}) {
  const response = await fetchImpl(`https://api.printify.com/v1/shops/${shopId}${pathname}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (err) {
      data = { raw: text.slice(0, 500) };
    }
  }
  return { ok: response.ok, status: response.status, data };
}

async function listProducts({ token, shopId, fetchImpl }) {
  const products = [];
  let page = 1;
  let lastPage = 1;
  do {
    const result = await printifyRequest({
      token,
      shopId,
      fetchImpl,
      pathname: `/products.json?limit=50&page=${page}`,
    });
    if (!result.ok) {
      const error = new Error(
        `Printify product list failed with HTTP ${result.status}. ${summarizeError(result.data)}`.trim()
      );
      error.result = result;
      throw error;
    }
    const batch = Array.isArray(result.data?.data) ? result.data.data : null;
    if (!batch) {
      throw new Error("Printify product list did not include a data array.");
    }
    products.push(...batch);
    lastPage = Number(result.data?.last_page) || 1;
    page += 1;
  } while (page <= lastPage && page <= 100);
  return products;
}

function addressTo(address) {
  return {
    first_name: address.first_name,
    last_name: address.last_name,
    email: address.email,
    phone: address.phone,
    country: address.country,
    region: address.region,
    address1: address.address1,
    address2: address.address2,
    city: address.city,
    zip: address.zip,
  };
}

async function shippingQuote({ token, shopId, lines, address, fetchImpl }) {
  return printifyRequest({
    token,
    shopId,
    fetchImpl,
    method: "POST",
    pathname: "/orders/shipping.json",
    body: {
      line_items: lines.map((line) => ({
        product_id: line.productId,
        variant_id: line.variantId,
        quantity: line.quantity,
      })),
      address_to: addressTo(address),
    },
  });
}

async function createOrder({ token, shopId, externalId, lineItems, address, fetchImpl }) {
  return printifyRequest({
    token,
    shopId,
    fetchImpl,
    method: "POST",
    pathname: "/orders.json",
    body: {
      external_id: externalId,
      line_items: lineItems.map((line) => ({
        product_id: line.product_id,
        variant_id: line.variant_id,
        quantity: line.quantity,
      })),
      shipping_method: 1,
      send_shipping_notification: false,
      address_to: addressTo(address),
    },
  });
}

async function getOrder({ token, shopId, orderId, fetchImpl }) {
  return printifyRequest({
    token,
    shopId,
    fetchImpl,
    pathname: `/orders/${encodeURIComponent(orderId)}.json`,
  });
}

async function sendToProduction({ token, shopId, orderId, fetchImpl }) {
  return printifyRequest({
    token,
    shopId,
    fetchImpl,
    method: "POST",
    pathname: `/orders/${encodeURIComponent(orderId)}/send_to_production.json`,
  });
}

module.exports = {
  USER_AGENT,
  summarizeError,
  printifyRequest,
  listProducts,
  shippingQuote,
  createOrder,
  getOrder,
  sendToProduction,
};
