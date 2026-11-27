const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { describe, it, before, after } = require("node:test");
const { spawnSync } = require("node:child_process");

const {
  SHOP_URL,
  fallbackCatalog,
  catalogFromPrintify,
  resolveOrderLines,
  isPrintifyMockupUrl,
  isPublishedProduct,
  loadProductsSource,
  centsFromDollars,
} = require("../lib/catalog");
const { quoteShipping } = require("../lib/shipping");
const { createCheckoutSession, OPENING_SOON } = require("../lib/checkout");
const { fulfillPaidSession } = require("../lib/fulfill");
const { handleWebhook } = require("../netlify/functions/stripe-webhook");
const { handler: checkoutHandler } = require("../netlify/functions/create-checkout");
const { runSync } = require("../lib/sync");
const { allPages } = require("./render");

const ROOT = path.join(__dirname, "..");
const silent = { log() {}, error() {} };

function jsonResponse(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(data),
  };
}

function samplePrintifyProduct(overrides = {}) {
  return {
    id: "5d39b159e7c48c000728c89f",
    title: "He Will Cover You Tee",
    description: "<p>Psalm 91:4</p>",
    tags: ["Faith"],
    visible: true,
    options: [
      {
        name: "Colors",
        type: "color",
        values: [{ id: 11, title: "Black", colors: ["#111111"] }],
      },
      {
        name: "Sizes",
        type: "size",
        values: [
          { id: 21, title: "S" },
          { id: 22, title: "M" },
        ],
      },
    ],
    variants: [
      {
        id: 501,
        price: 2999,
        cost: 1400,
        title: "Black / S",
        is_enabled: true,
        is_available: true,
        is_default: true,
        options: [11, 21],
      },
      {
        id: 502,
        price: 2999,
        cost: 1400,
        title: "Black / M",
        is_enabled: true,
        is_available: true,
        options: [11, 22],
      },
      {
        id: 503,
        price: 100,
        title: "Black / L",
        is_enabled: false,
        is_available: true,
        options: [11, 23],
      },
    ],
    images: [
      {
        src: "https://images.printify.com/mockup/5d39b159e7c48c000728c89f/501/front.jpg",
        variant_ids: [501],
        position: "front",
        is_default: true,
      },
      {
        src: "https://images.example.com/ai-model.jpg",
        variant_ids: [501],
        position: "front",
        is_default: false,
      },
      {
        src: "https://images.printify.com/api/catalog/not-a-mockup.svg",
        variant_ids: [501],
        is_default: false,
      },
    ],
    ...overrides,
  };
}

function address() {
  return {
    firstName: "Timothy",
    lastName: "Gardner",
    email: "shop@example.com",
    phone: "555-0100",
    address1: "1 Faith Lane",
    address2: "",
    city: "Austin",
    region: "TX",
    zip: "78701",
    country: "US",
  };
}

const purchasableCatalog = {
  source: "printify",
  currency: "usd",
  shopUrl: SHOP_URL,
  products: [
    {
      id: "5d39b159e7c48c000728c89f",
      title: "He Will Cover You Tee",
      slug: "he-will-cover-you-tee",
      etsyUrl: SHOP_URL,
      purchasable: true,
      image: "https://images.printify.com/mockup/5d39b159e7c48c000728c89f/501/front.jpg",
      images: [
        {
          src: "https://images.printify.com/mockup/5d39b159e7c48c000728c89f/501/front.jpg",
          alt: "He Will Cover You Tee, front",
          variantIds: [501],
          isDefault: true,
        },
      ],
      options: [],
      variants: [{ id: 501, title: "Black / S", price: 2999, enabled: true, available: true, optionIds: [] }],
    },
  ],
};

describe("catalog fallback", () => {
  it("uses the 10 saved products and does not invent variants or prices", () => {
    const products = loadProductsSource();
    const catalog = fallbackCatalog(products, { shopId: "29744663" });
    assert.equal(catalog.source, "products-json");
    assert.equal(catalog.products.length, 10);
    assert.equal(catalog.shopUrl, SHOP_URL);
    products.products.forEach((source, index) => {
      const product = catalog.products[index];
      assert.equal(product.title, source.name);
      assert.equal(product.etsyUrl, SHOP_URL);
      assert.equal(product.purchasable, false);
      assert.deepEqual(product.variants, []);
      assert.equal(product.price, centsFromDollars(source.price));
      assert.equal(product.image.startsWith("/images/"), true);
    });
  });
});

describe("Printify mapping", () => {
  it("keeps mockups, variant ids, and retail prices", () => {
    const { catalog, skipped } = catalogFromPrintify([samplePrintifyProduct()], {
      shopId: "29744663",
      categories: [{ name: "Faith" }],
    });
    assert.deepEqual(skipped, {});
    assert.equal(catalog.products.length, 1);
    const product = catalog.products[0];
    assert.equal(product.purchasable, true);
    assert.equal(product.category, "Faith");
    assert.equal(product.etsyUrl, SHOP_URL);
    assert.equal(product.images.length, 1);
    assert.equal(product.images[0].src.includes("/mockup/"), true);
    assert.deepEqual(
      product.variants.map((variant) => variant.id),
      [501, 502]
    );
    assert.equal(product.variants[0].price, 2999);
    assert.equal(product.variants[0].cost, undefined);
    assert.equal(JSON.stringify(product).includes("1400"), false);
    const colors = product.options.find((option) => option.type === "color");
    assert.deepEqual(colors.values.map((value) => value.title), ["Black"]);
  });

  it("hides a color that has no priced variant", () => {
    const raw = samplePrintifyProduct();
    raw.options[0].values.push({ id: 99, title: "Purple", colors: ["#800080"] });
    const { catalog } = catalogFromPrintify([raw], { shopId: "1" });
    const colors = catalog.products[0].options.find((option) => option.type === "color");
    assert.deepEqual(
      colors.values.map((value) => value.title),
      ["Black"]
    );
  });

  it("drops unpublished products, banned phrases, and products with no mockup", () => {
    const unpublished = samplePrintifyProduct({ external: null });
    const banned = samplePrintifyProduct({
      id: "banned-id",
      title: "Thin Blue Line mug",
    });
    const noMockup = samplePrintifyProduct({
      id: "photo-id",
      title: "Photo only",
      images: [{ src: "https://images.example.com/model.jpg", variant_ids: [501], is_default: true }],
    });
    assert.equal(isPublishedProduct(unpublished), false);
    assert.equal(isPublishedProduct(samplePrintifyProduct()), true);
    assert.equal(isPrintifyMockupUrl("https://images.printify.com/mockup/a/b.jpg"), true);
    assert.equal(isPrintifyMockupUrl("https://images.printify.com/mockup/ai-model/a.jpg"), false);
    const { catalog, skipped } = catalogFromPrintify([unpublished, banned, noMockup], { shopId: "1" });
    assert.equal(catalog.products.length, 0);
    assert.equal(skipped.unpublished, 1);
    assert.equal(skipped["banned-phrase"], 1);
    assert.equal(skipped["no-mockup"], 1);
  });
});

describe("order prices", () => {
  it("ignores a price sent by the browser", () => {
    const lines = resolveOrderLines(purchasableCatalog, [
      { productId: purchasableCatalog.products[0].id, variantId: 501, quantity: 2, price: 1 },
    ]);
    assert.equal(lines[0].unitAmount, 2999);
    assert.equal(lines[0].quantity, 2);
  });

  it("rejects a missing variant and a bad quantity", () => {
    assert.throws(
      () => resolveOrderLines(purchasableCatalog, [{ productId: purchasableCatalog.products[0].id, variantId: 999, quantity: 1 }]),
      /available option/
    );
    assert.throws(
      () => resolveOrderLines(purchasableCatalog, [{ productId: purchasableCatalog.products[0].id, variantId: 501, quantity: 11 }]),
      /Quantity/
    );
  });
});

describe("shipping", () => {
  const lines = [{ productId: "5d39b159e7c48c000728c89f", variantId: 501, quantity: 1 }];

  it("charges Printify standard shipping", async () => {
    let seen = null;
    const result = await quoteShipping({
      lines,
      address: {
        first_name: "Timothy",
        last_name: "Gardner",
        email: "shop@example.com",
        phone: "555-0100",
        country: "US",
        region: "TX",
        address1: "1 Faith Lane",
        address2: "",
        city: "Austin",
        zip: "78701",
      },
      config: { flatRateCents: null, flatRateLabel: "Shipping" },
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663" },
      log: silent,
      fetchImpl: async (url, options) => {
        seen = { url, options };
        return jsonResponse(200, { standard: 450, express: 1500 });
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.cents, 450);
    assert.equal(result.source, "printify");
    assert.match(seen.url, /\/v1\/shops\/29744663\/orders\/shipping\.json$/);
    assert.equal(seen.options.headers["User-Agent"], "ShieldOfFaithDesign");
    assert.equal(seen.options.headers.Authorization, "Bearer token");
  });

  it("does not invent a rate when Printify and the flat rate are unavailable", async () => {
    const result = await quoteShipping({
      lines,
      address: address(),
      config: { flatRateCents: null },
      env: {},
      log: silent,
      fetchImpl: async () => {
        throw new Error("should not be called");
      },
    });
    assert.equal(result.ok, false);
  });

  it("uses a configured flat rate only after Printify fails", async () => {
    const result = await quoteShipping({
      lines,
      address: address(),
      config: { flatRateCents: 599, flatRateLabel: "Shipping", shippingMethod: 1 },
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663" },
      log: silent,
      fetchImpl: async () => jsonResponse(500, { message: "down" }),
    });
    assert.equal(result.source, "flat");
    assert.equal(result.cents, 599);
  });
});

describe("checkout", () => {
  it("shows store opening soon when Stripe is not configured", async () => {
    let called = false;
    const result = await createCheckoutSession({
      items: [{ productId: "5d39b159e7c48c000728c89f", variantId: 501, quantity: 1, price: 1 }],
      address: address(),
      catalog: purchasableCatalog,
      shippingConfig: { flatRateCents: null },
      env: {},
      origin: "http://localhost:8080",
      stripe: { checkout: { sessions: { create: async () => { called = true; } } } },
      log: silent,
    });
    assert.equal(result.statusCode, 503);
    assert.equal(result.body.code, "opening_soon");
    assert.equal(result.body.message, OPENING_SOON);
    assert.equal(called, false);
  });

  it("creates a session from catalog prices plus Printify shipping", async () => {
    let payload = null;
    const result = await createCheckoutSession({
      items: [{ productId: "5d39b159e7c48c000728c89f", variantId: 501, quantity: 2, price: 1 }],
      address: address(),
      catalog: purchasableCatalog,
      shippingConfig: { flatRateCents: null, flatRateLabel: "Shipping" },
      env: { STRIPE_SECRET_KEY: "sk_test_123", PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663" },
      origin: "https://shop.example",
      log: silent,
      fetchImpl: async () => jsonResponse(200, { standard: 450 }),
      stripe: {
        checkout: {
          sessions: {
            create: async (session) => {
              payload = session;
              return { id: "cs_test_123", url: "https://checkout.stripe.com/c/pay/cs_test_123" };
            },
          },
        },
      },
    });
    assert.equal(result.statusCode, 200);
    assert.equal(result.body.url, "https://checkout.stripe.com/c/pay/cs_test_123");
    assert.equal(payload.line_items[0].price_data.unit_amount, 2999);
    assert.equal(payload.line_items[0].quantity, 2);
    assert.equal(payload.line_items[1].price_data.unit_amount, 450);
    assert.equal(payload.line_items[0].price_data.product_data.metadata.printify_variant_id, "501");
    assert.equal(payload.metadata.ship_city, "Austin");
    assert.equal(payload.success_url, "https://shop.example/success/?session_id={CHECKOUT_SESSION_ID}");
    assert.equal(payload.shipping_address_collection, undefined);
  });
});

describe("fulfillment", () => {
  function session(metadata = {}) {
    return {
      id: "cs_test_order",
      payment_status: "paid",
      metadata: {
        source: "shield-of-faith",
        ship_first_name: "Timothy",
        ship_last_name: "Gardner",
        ship_email: "shop@example.com",
        ship_phone: "555-0100",
        ship_address1: "1 Faith Lane",
        ship_address2: "",
        ship_city: "Austin",
        ship_region: "TX",
        ship_zip: "78701",
        ship_country: "US",
        ...metadata,
      },
    };
  }

  function stripeMock(list) {
    const updates = [];
    return {
      updates,
      checkout: {
        sessions: {
          listLineItems: async () => list,
          update: async (id, body) => {
            updates.push({ id, body });
            return body;
          },
        },
      },
    };
  }

  const lines = {
    data: [
      {
        quantity: 1,
        price: {
          product: { metadata: { printify_product_id: "5d39b159e7c48c000728c89f", printify_variant_id: "501" } },
        },
      },
      { quantity: 1, price: { product: { metadata: { kind: "shipping" } } } },
    ],
  };

  it("leaves the Printify order as a draft unless PRINTIFY_AUTO_SEND is true", async () => {
    const calls = [];
    const stripe = stripeMock(lines);
    const result = await fulfillPaidSession({
      session: session(),
      stripe,
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663", PRINTIFY_AUTO_SEND: "false" },
      log: silent,
      fetchImpl: async (url, options) => {
        calls.push({ url, method: options.method, body: options.body });
        return jsonResponse(200, { id: "pfy_100" });
      },
    });
    assert.equal(result.status, "draft");
    assert.equal(result.orderId, "pfy_100");
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/orders\.json$/);
    const body = JSON.parse(calls[0].body);
    assert.equal(body.external_id, "cs_test_order");
    assert.deepEqual(body.line_items, [{ product_id: "5d39b159e7c48c000728c89f", variant_id: 501, quantity: 1 }]);
    assert.equal(body.shipping_method, 1);
    assert.equal(stripe.updates[0].body.metadata.printify_status, "draft");
  });

  it("sends the order to production only when PRINTIFY_AUTO_SEND=true", async () => {
    const calls = [];
    const result = await fulfillPaidSession({
      session: session(),
      stripe: stripeMock(lines),
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663", PRINTIFY_AUTO_SEND: "true" },
      log: silent,
      fetchImpl: async (url, options) => {
        calls.push(`${options.method} ${url}`);
        if (url.endsWith("/orders.json")) return jsonResponse(200, { id: "pfy_200" });
        if (url.endsWith("/orders/pfy_200.json")) return jsonResponse(200, { id: "pfy_200", status: "on-hold" });
        if (url.endsWith("/send_to_production.json")) return jsonResponse(202, { id: "pfy_200" });
        throw new Error(url);
      },
    });
    assert.equal(result.status, "sent");
    assert.equal(calls.some((call) => call.includes("send_to_production")), true);
  });

  it("does not create a second order when Printify returns 409", async () => {
    let creates = 0;
    const result = await fulfillPaidSession({
      session: session(),
      stripe: stripeMock(lines),
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663" },
      log: silent,
      fetchImpl: async (url) => {
        if (url.endsWith("/orders.json")) {
          creates += 1;
          return jsonResponse(409, {
            message: "Operation failed.",
            order: { id: "pfy_existing", external_id: "cs_test_order" },
          });
        }
        throw new Error(url);
      },
    });
    assert.equal(creates, 1);
    assert.equal(result.duplicate, undefined);
    assert.equal(result.orderId, "pfy_existing");
    assert.equal(result.status, "draft");
  });

  it("skips a session that was already fulfilled", async () => {
    let listed = false;
    const result = await fulfillPaidSession({
      session: session({ printify_order_id: "pfy_existing" }),
      stripe: {
        checkout: {
          sessions: {
            listLineItems: async () => {
              listed = true;
              return { data: [] };
            },
          },
        },
      },
      env: { PRINTIFY_API_TOKEN: "token" },
      log: silent,
      fetchImpl: async () => {
        throw new Error("should not call Printify");
      },
    });
    assert.equal(result.duplicate, true);
    assert.equal(listed, false);
  });
});

describe("webhook signature", () => {
  const Stripe = require("stripe");
  const stripe = new Stripe("sk_test_51H");
  const payload = JSON.stringify({
    id: "evt_test",
    object: "event",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_webhook",
        object: "checkout.session",
        payment_status: "paid",
        metadata: {},
      },
    },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_right" });

  it("rejects a bad signature", async () => {
    const result = await handleWebhook(
      { body: payload, headers: { "stripe-signature": header } },
      {
        stripe,
        env: { STRIPE_SECRET_KEY: "sk_test_51H", STRIPE_WEBHOOK_SECRET: "whsec_wrong" },
        log: silent,
      }
    );
    assert.equal(result.statusCode, 400);
  });

  it("accepts a signed event and ignores a session that is not ours", async () => {
    const result = await handleWebhook(
      { body: payload, headers: { "stripe-signature": header } },
      {
        stripe,
        env: { STRIPE_SECRET_KEY: "sk_test_51H", STRIPE_WEBHOOK_SECRET: "whsec_right" },
        log: silent,
      }
    );
    assert.equal(result.statusCode, 200);
  });

  it("rejects the webhook when the secret is missing", async () => {
    const result = await handleWebhook(
      { body: payload, headers: {} },
      { stripe, env: { STRIPE_SECRET_KEY: "sk_test_51H" }, log: silent }
    );
    assert.equal(result.statusCode, 500);
  });
});

describe("sync script", () => {
  it("writes the products.json fallback without calling Printify when the token is missing", async () => {
    const writes = [];
    const result = await runSync({
      env: {},
      log: silent,
      fetchImpl: async () => {
        throw new Error("should not fetch");
      },
      writer: (catalog) => writes.push(catalog),
    });
    assert.equal(result.fallback, true);
    assert.equal(writes.length, 1);
    assert.equal(writes[0].source, "products-json");
    assert.equal(writes[0].products.length, 10);
    assert.equal(writes[0].products.every((product) => product.variants.length === 0), true);
  });

  it("defaults the shop id to 29744663 when PRINTIFY_SHOP_ID is unset", async () => {
    let seen = "";
    const result = await runSync({
      env: { PRINTIFY_API_TOKEN: "token" },
      log: silent,
      write: false,
      fetchImpl: async (url) => {
        seen = url;
        return jsonResponse(200, {
          current_page: 1,
          last_page: 1,
          data: [samplePrintifyProduct()],
        });
      },
    });
    assert.match(seen, /\/v1\/shops\/29744663\/products\.json/);
    assert.equal(result.fallback, false);
    assert.equal(result.catalog.shopId, "29744663");
  });

  it("saves published Printify products when a token is present", async () => {
    const writes = [];
    const result = await runSync({
      env: { PRINTIFY_API_TOKEN: "token", PRINTIFY_SHOP_ID: "29744663" },
      log: silent,
      writer: (catalog) => writes.push(catalog),
      fetchImpl: async (url, options) => {
        assert.match(url, /\/v1\/shops\/29744663\/products\.json\?limit=50&page=1$/);
        assert.equal(options.headers["User-Agent"], "ShieldOfFaithDesign");
        return jsonResponse(200, {
          current_page: 1,
          last_page: 1,
          data: [samplePrintifyProduct()],
        });
      },
    });
    assert.equal(result.fallback, false);
    assert.equal(writes[0].source, "printify");
    assert.equal(writes[0].products.length, 1);
    assert.equal(writes[0].shopId, "29744663");
  });
});

describe("static build", () => {
  before(() => {
    const result = spawnSync("node", ["scripts/build.js"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  });

  it("builds the shop, cart, checkout, and policy pages without API keys", () => {
    const dist = path.join(ROOT, "dist");
    for (const file of [
      "index.html",
      "shop/index.html",
      "cart/index.html",
      "checkout/index.html",
      "success/index.html",
      "cancel/index.html",
      "shipping/index.html",
      "returns/index.html",
      "catalog.json",
      "products/he-will-cover-you-tee/index.html",
    ]) {
      assert.equal(fs.existsSync(path.join(dist, file)), true, file);
    }
    const checkout = fs.readFileSync(path.join(dist, "checkout/index.html"), "utf8");
    const css = fs.readFileSync(path.join(dist, "styles.css"), "utf8");
    assert.match(checkout, /Store opening soon/);
    assert.match(checkout, /id="checkout-form"[^>]*hidden/);
    assert.match(css, /\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
    assert.match(checkout, /Also on Etsy/);
    const product = fs.readFileSync(path.join(dist, "products/he-will-cover-you-tee/index.html"), "utf8");
    assert.match(product, /\$29\.99/);
    assert.match(product, /Also on Etsy/);
    assert.doesNotMatch(product, /Add to cart/);
    const catalog = JSON.parse(fs.readFileSync(path.join(dist, "catalog.json"), "utf8"));
    assert.equal(catalog.products.length, 10);
    assert.equal(catalog.products.every((item) => item.purchasable === false), true);
    const shipping = fs.readFileSync(path.join(dist, "shipping/index.html"), "utf8");
    const returns = fs.readFileSync(path.join(dist, "returns/index.html"), "utf8");
    assert.match(shipping, /Timothy: please review this page/);
    assert.match(returns, /Timothy: please review this page/);
    const html = fs.readdirSync(dist, { recursive: true })
      .filter((file) => String(file).endsWith(".html"))
      .map((file) => fs.readFileSync(path.join(dist, file), "utf8"))
      .join("\n");
    assert.equal(/thin blue line/i.test(html), false);
    assert.equal(/blue lives matter/i.test(html), false);
  });

  it("renders size and color choices for a purchasable product", () => {
    const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
    const { catalog } = catalogFromPrintify([samplePrintifyProduct()], {
      shopId: "29744663",
      categories: site.categories,
    });
    const pages = allPages(site, catalog);
    const page = pages.find((entry) => entry.file.startsWith("products/"));
    assert.match(page.html, /Add to cart/);
    assert.match(page.html, /name="quantity"/);
    assert.match(page.html, />S</);
    assert.match(page.html, />Black</);
    assert.match(page.html, /\$29\.99/);
    assert.match(page.html, /Also on Etsy/);
  });
});

describe("checkout function without keys", () => {
  const previous = process.env.STRIPE_SECRET_KEY;
  before(() => {
    delete process.env.STRIPE_SECRET_KEY;
  });
  after(() => {
    if (previous === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previous;
  });

  it("answers GET with store opening soon", async () => {
    const result = await checkoutHandler({ httpMethod: "GET", headers: {} });
    const body = JSON.parse(result.body);
    assert.equal(result.statusCode, 200);
    assert.equal(body.code, "opening_soon");
  });
});
