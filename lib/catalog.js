const fs = require("fs");
const path = require("path");
const { containsBanned } = require("./banned");

const ROOT = path.join(__dirname, "..");
const SHOP_URL = "https://shieldoffaithdesign.etsy.com";
const DEFAULT_SHOP_ID = "29744663";
const MAX_QUANTITY = 10;
const MAX_LINES = 20;

function shopIdFromEnv(env = process.env) {
  const raw = String(env.PRINTIFY_SHOP_ID || "").trim();
  if (!raw) return DEFAULT_SHOP_ID;
  if (!/^\d+$/.test(raw)) {
    throw new Error("PRINTIFY_SHOP_ID must be digits.");
  }
  return raw;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function dataFile(name) {
  return path.join(ROOT, "data", name);
}

function readRepoJson(name) {
  const filePath = dataFile(name);
  if (!fs.existsSync(filePath)) return null;
  return readJson(filePath);
}

function loadProductsSource() {
  return readRepoJson("products.json") || require("../data/products.json");
}

function loadSiteSource() {
  return readRepoJson("site.json") || require("../data/site.json");
}

function loadShippingConfig() {
  return readRepoJson("shipping.json") || require("../data/shipping.json");
}

function loadCatalogFile() {
  const fromDisk = readRepoJson("catalog.json");
  if (fromDisk) return fromDisk;
  try {
    return require("../data/catalog.json");
  } catch (err) {
    return null;
  }
}

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return slug || "item";
}

function uniqueSlug(base, used) {
  let slug = base || "item";
  let n = 2;
  while (used.has(slug)) {
    slug = `${base}-${n}`;
    n += 1;
  }
  used.add(slug);
  return slug;
}

function centsFromDollars(amount) {
  const cents = Math.round(Number(amount) * 100);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error(`Price is not a positive dollar amount: ${amount}`);
  }
  return cents;
}

function money(cents) {
  return `$${(Number(cents) / 100).toFixed(2)}`;
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function isPrintifyMockupUrl(src) {
  if (typeof src !== "string") return false;
  let url;
  try {
    url = new URL(src);
  } catch (err) {
    return false;
  }
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "images.printify.com") return false;
  const pathname = url.pathname.toLowerCase();
  if (!pathname.includes("/mockup/")) return false;
  if (pathname.includes("/ai/") || pathname.includes("ai-model") || pathname.includes("model-photo")) {
    return false;
  }
  return true;
}

function isPublishedProduct(product) {
  if (!product || typeof product !== "object") return false;
  if (product.visible === false) return false;
  if (Object.prototype.hasOwnProperty.call(product, "external")) {
    const external = product.external;
    if (!external) return false;
    if (Array.isArray(external)) return external.length > 0;
    if (typeof external === "object") return Boolean(external.id || external.handle);
    return false;
  }
  return true;
}

function mapPrintifyImages(images) {
  const mapped = [];
  for (const image of images || []) {
    if (!image || !isPrintifyMockupUrl(image.src)) continue;
    mapped.push({
      src: image.src,
      alt: "",
      isDefault: Boolean(image.is_default),
      position: typeof image.position === "string" ? image.position : "",
      variantIds: Array.isArray(image.variant_ids)
        ? image.variant_ids.filter((id) => Number.isInteger(id))
        : [],
    });
  }
  const defaults = mapped.filter((image) => image.isDefault);
  const rest = mapped.filter((image) => !image.isDefault);
  return [...defaults, ...rest].slice(0, 8);
}

function categoryFromTags(tags, categories) {
  const names = (categories || []).map((category) => category.name).filter(Boolean);
  const tagList = (tags || []).map((tag) => String(tag).toLowerCase());
  for (const name of names) {
    if (tagList.includes(name.toLowerCase())) return name;
  }
  return "";
}

function mapPrintifyProduct(product, { categories } = {}) {
  if (!product || typeof product.id !== "string" || !product.id.trim()) {
    return { skip: "no-id" };
  }
  if (!isPublishedProduct(product)) return { skip: "unpublished" };
  const title = String(product.title || "").trim();
  const description = stripHtml(product.description || "").slice(0, 4000);
  if (containsBanned(`${product.title || ""}\n${product.description || ""}\n${description}`)) {
    return { skip: "banned-phrase" };
  }
  if (!title) return { skip: "no-title" };
  const images = mapPrintifyImages(product.images);
  if (!images.length) return { skip: "no-mockup" };
  const variants = [];
  for (const variant of product.variants || []) {
    if (!variant || variant.is_enabled !== true) continue;
    if (variant.is_available === false) continue;
    if (!Number.isInteger(variant.id)) continue;
    if (!Number.isInteger(variant.price) || variant.price <= 0) continue;
    variants.push({
      id: variant.id,
      title: String(variant.title || ""),
      price: variant.price,
      enabled: true,
      available: true,
      isDefault: Boolean(variant.is_default),
      optionIds: Array.isArray(variant.options)
        ? variant.options.filter((id) => Number.isInteger(id))
        : [],
    });
  }
  if (!variants.length) return { skip: "no-variants" };
  const options = (product.options || [])
    .map((option) => ({
      name: String(option.name || "Option"),
      type: String(option.type || ""),
      values: (option.values || [])
        .filter((value) => value && Number.isInteger(value.id) && value.title)
        .map((value) => {
          const colors = Array.isArray(value.colors)
            ? value.colors.filter((color) => typeof color === "string" && /^#[0-9a-fA-F]{3,8}$/.test(color))
            : [];
          const entry = { id: value.id, title: String(value.title) };
          if (colors.length) entry.colors = colors;
          return entry;
        }),
    }))
    .filter((option) => option.values.length);
  for (const image of images) {
    image.alt = image.position ? `${title}, ${image.position}` : title;
  }
  const defaultImage = images.find((image) => image.isDefault) || images[0];
  return {
    product: {
      id: product.id.trim(),
      slug: slugify(title),
      title,
      description,
      category: categoryFromTags(product.tags, categories),
      etsyUrl: SHOP_URL,
      purchasable: true,
      images,
      image: defaultImage.src,
      alt: defaultImage.alt,
      options,
      variants,
    },
  };
}

function fallbackCatalog(productsDoc, { shopId } = {}) {
  const used = new Set();
  const products = (productsDoc.products || []).map((product) => {
    for (const key of ["name", "image", "etsyUrl", "category", "alt"]) {
      if (!product[key]) throw new Error(`Product is missing ${key}: ${product.name || "(unnamed)"}`);
    }
    if (product.etsyUrl !== SHOP_URL) {
      throw new Error(`${product.name} etsyUrl must be exactly ${SHOP_URL}`);
    }
    const imageFile = String(product.image);
    const base = slugify(path.basename(imageFile, path.extname(imageFile)) || product.name);
    const slug = uniqueSlug(base, used);
    const price = centsFromDollars(product.price);
    const src = `/${imageFile.replace(/^\//, "")}`;
    return {
      id: `etsy:${slug}`,
      slug,
      title: product.name,
      listingTitle: product.listingTitle || "",
      description: "",
      category: product.category,
      etsyUrl: SHOP_URL,
      purchasable: false,
      images: [
        {
          src,
          alt: product.alt,
          isDefault: true,
          position: "",
          variantIds: [],
          width: product.width,
          height: product.height,
        },
      ],
      image: src,
      alt: product.alt,
      width: product.width,
      height: product.height,
      options: [],
      variants: [],
      price,
    };
  });
  return {
    source: "products-json",
    shopId: String(shopId || DEFAULT_SHOP_ID),
    syncedAt: null,
    currency: "usd",
    shopUrl: SHOP_URL,
    heading: productsDoc.heading || "From the shop",
    note: productsDoc.note || "",
    products,
  };
}

function assignUniqueSlugs(products) {
  const used = new Set();
  return products.map((product) => ({
    ...product,
    slug: uniqueSlug(product.slug || slugify(product.title), used),
  }));
}

function catalogFromPrintify(rawProducts, { shopId, categories } = {}) {
  const skipped = {};
  const products = [];
  for (const raw of rawProducts || []) {
    const result = mapPrintifyProduct(raw, { categories });
    if (!result.product) {
      const reason = result.skip || "skipped";
      skipped[reason] = (skipped[reason] || 0) + 1;
      continue;
    }
    products.push(result.product);
  }
  return {
    catalog: {
      source: "printify",
      shopId: String(shopId),
      syncedAt: new Date().toISOString(),
      currency: "usd",
      shopUrl: SHOP_URL,
      heading: "From the shop",
      note: "Open an item to choose a size or color. The same designs are also on Etsy.",
      products: assignUniqueSlugs(products),
    },
    skipped,
  };
}

function isPrintifyCatalog(catalog) {
  return Boolean(
    catalog &&
      catalog.source === "printify" &&
      Array.isArray(catalog.products) &&
      catalog.products.length > 0
  );
}

function resolveCatalog({ catalog, products, env = process.env } = {}) {
  const fileCatalog = catalog === undefined ? loadCatalogFile() : catalog;
  const productsDoc = products || loadProductsSource();
  if (isPrintifyCatalog(fileCatalog)) return fileCatalog;
  let shopId = DEFAULT_SHOP_ID;
  try {
    shopId = shopIdFromEnv(env);
  } catch (err) {
    shopId = DEFAULT_SHOP_ID;
  }
  return fallbackCatalog(productsDoc, { shopId });
}

function displayPrice(product) {
  const prices = (product.variants || [])
    .map((variant) => variant.price)
    .filter((price) => Number.isInteger(price) && price > 0);
  if (prices.length) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min !== max) return { cents: min, label: `From ${money(min)}` };
    return { cents: min, label: money(min) };
  }
  if (Number.isInteger(product.price) && product.price > 0) {
    return { cents: product.price, label: money(product.price) };
  }
  return null;
}

function findProduct(catalog, productId) {
  return (catalog.products || []).find((product) => product.id === String(productId)) || null;
}

function findVariant(product, variantId) {
  const id = Number(variantId);
  if (!Number.isInteger(id)) return null;
  return (product.variants || []).find((variant) => variant.id === id) || null;
}

function imageForVariant(product, variantId) {
  const images = product.images || [];
  const match = images.find(
    (image) => Array.isArray(image.variantIds) && image.variantIds.includes(variantId)
  );
  if (match) return match.src;
  const fallback = images.find((image) => image.isDefault) || images[0];
  return fallback ? fallback.src : product.image || "";
}

function resolveOrderLines(catalog, items) {
  if (!Array.isArray(items) || items.length === 0) {
    const error = new Error("Your cart is empty.");
    error.code = "cart";
    throw error;
  }
  if (items.length > MAX_LINES) {
    const error = new Error("The cart has too many different items.");
    error.code = "cart";
    throw error;
  }
  const lines = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      const error = new Error("A cart line is not valid.");
      error.code = "cart";
      throw error;
    }
    const product = findProduct(catalog, item.productId || item.id);
    if (!product) {
      const error = new Error("A cart item is not in the catalog.");
      error.code = "cart";
      throw error;
    }
    if (!product.purchasable) {
      const error = new Error(`${product.title} is not available for checkout on this site yet.`);
      error.code = "cart";
      throw error;
    }
    const variant = findVariant(product, item.variantId);
    if (!variant || variant.enabled === false || variant.available === false) {
      const error = new Error(`Choose an available option for ${product.title}.`);
      error.code = "cart";
      throw error;
    }
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      const error = new Error(`Quantity for ${product.title} must be from 1 to ${MAX_QUANTITY}.`);
      error.code = "cart";
      throw error;
    }
    lines.push({
      productId: product.id,
      variantId: variant.id,
      quantity,
      unitAmount: variant.price,
      currency: catalog.currency || "usd",
      title: product.title,
      variantTitle: variant.title || "",
      image: imageForVariant(product, variant.id),
    });
  }
  return lines;
}

function writeCatalog(catalog) {
  fs.writeFileSync(dataFile("catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
}

module.exports = {
  ROOT,
  SHOP_URL,
  DEFAULT_SHOP_ID,
  MAX_QUANTITY,
  MAX_LINES,
  shopIdFromEnv,
  dataFile,
  readRepoJson,
  loadProductsSource,
  loadSiteSource,
  loadShippingConfig,
  loadCatalogFile,
  slugify,
  centsFromDollars,
  money,
  stripHtml,
  isPrintifyMockupUrl,
  isPublishedProduct,
  mapPrintifyImages,
  mapPrintifyProduct,
  fallbackCatalog,
  catalogFromPrintify,
  isPrintifyCatalog,
  resolveCatalog,
  displayPrice,
  findProduct,
  findVariant,
  imageForVariant,
  resolveOrderLines,
  writeCatalog,
};
