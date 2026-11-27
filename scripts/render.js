const { SHOP_URL, displayPrice, money, slugify } = require("../lib/catalog");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function shieldMark() {
  return `<svg class="brand-mark" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M6 6h36v18L24 52 6 24z"/>
    <path d="M24 14v26M15.5 22.5h17" fill="none" stroke="#f4efe6" stroke-width="3.2" stroke-linecap="square"/>
  </svg>`;
}

function heroMark() {
  return `<svg class="hero-mark" viewBox="0 0 48 56" aria-hidden="true" focusable="false">
    <path fill="currentColor" d="M6 4h36v20L24 54 6 24z"/>
  </svg>`;
}

function icon(name) {
  const common = `class="category-icon" viewBox="0 0 36 36" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"`;
  if (name === "Faith") {
    return `<svg ${common}><path d="M18 6v24M11 13h14"/></svg>`;
  }
  if (name === "Back the Blue") {
    return `<svg ${common}><path d="M8 6h20v12L18 30 8 18z"/></svg>`;
  }
  if (name === "Patriotic") {
    return `<svg ${common}><path d="M18 5.5l2.7 6.4 6.9.6-5.2 4.4 1.6 6.7L18 20.2 11.9 23.6l1.6-6.7L8.3 12.5l6.9-.6z"/></svg>`;
  }
  if (name === "Second Amendment") {
    return `<svg ${common}><rect x="6" y="8" width="24" height="20" rx="3"/><text x="18" y="22" text-anchor="middle" fill="currentColor" stroke="none" font-family="Georgia, serif" font-size="11" font-weight="700">2A</text></svg>`;
  }
  return `<svg ${common}><path d="M6 16.5 18 7l12 9.5V29H6z"/><path d="M14 29v-8h8v8"/></svg>`;
}

function etsyLink(className, label) {
  const cls = className ? ` class="${className}"` : "";
  return `<a${cls} href="${SHOP_URL}" target="_blank" rel="noopener noreferrer">${label}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

function header() {
  const links = [
    ["/#categories", "Categories"],
    ["/shop/", "Shop"],
    ["/#about", "About"],
    ["/#faq", "FAQ"],
  ];
  const nav = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  const menu = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join("");
  return `<a class="skip" href="#main">Skip to content</a>
  <header class="site-header">
    <div class="wrap header-inner">
      <a class="brand" href="/">
        ${shieldMark()}
        <span>
          <span class="brand-name">Shield of Faith</span>
          <span class="brand-sub">Design</span>
        </span>
      </a>
      <nav class="primary-nav" aria-label="Primary">${nav}</nav>
      <a class="cart-link" href="/cart/">Cart <span class="cart-count" aria-live="polite">0</span><span class="sr-only"> items</span></a>
      ${etsyLink("btn btn-small header-cta", "Also on Etsy")}
      <details class="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile">
          ${menu}
          <a href="/cart/">Cart <span class="cart-count">0</span></a>
          ${etsyLink("menu-shop", "Also on Etsy")}
        </nav>
      </details>
    </div>
  </header>`;
}

function footer(site) {
  const social = site.social
    .map(
      (item) =>
        `<li><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.name)}<span class="sr-only"> (opens in a new tab)</span></a></li>`
    )
    .join("");
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <h2>Shield of Faith Design</h2>
        <p>A small family shop for faith, family, and freedom.</p>
        <p class="footer-label">Also on Etsy</p>
        ${etsyLink("shop-url", "https://<wbr>shieldoffaithdesign.etsy.com")}
      </div>
      <div>
        <p class="footer-label">Policies</p>
        <ul class="policy-links">
          <li><a href="/shipping/">Shipping</a></li>
          <li><a href="/returns/">Returns</a></li>
          <li><a href="/cart/">Cart</a></li>
        </ul>
        <p class="footer-label">Social</p>
        <ul class="social">${social}</ul>
      </div>
    </div>
    <div class="wrap">
      <p class="legal">© ${year} Shield of Faith Design. Family-run. Printed on demand.</p>
    </div>
  </footer>`;
}

function headTags(site, { title, description, path, robots = "index, follow" }) {
  const origin = String(site.siteUrl || "").replace(/\/$/, "");
  const canonical = origin ? `${origin}${path === "/index.html" ? "/" : path}` : "";
  const image = origin ? `${origin}/og-image.jpg` : "";
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${robots}">
  <meta name="theme-color" content="#12243c">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:locale" content="en_US">
  ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
  ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}">` : ""}
  ${image ? `<meta property="og:image" content="${escapeHtml(image)}">` : ""}
  ${image ? `<meta property="og:image:alt" content="Shield of Faith Design. Faith, family, and freedom.">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  ${image ? `<meta name="twitter:image" content="${escapeHtml(image)}">` : ""}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="preload" href="/fonts/source-serif-4-700.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/fonts/source-sans-3-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="stylesheet" href="/styles.css">`;
}

function page({ site, title, description, path, main, robots }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags(site, { title, description, path, robots })}
</head>
<body>
  ${header()}
  ${main}
  ${footer(site)}
  <script src="/store.js"></script>
</body>
</html>
`;
}

function imgTag(image, { eager = false } = {}) {
  const width = image.width ? ` width="${Number(image.width)}"` : "";
  const height = image.height ? ` height="${Number(image.height)}"` : "";
  const loading = eager ? ` fetchpriority="high"` : ` loading="lazy"`;
  return `<img src="${escapeHtml(image.src)}" alt="${escapeHtml(image.alt || "")}"${width}${height}${loading} decoding="async">`;
}

function productCard(product) {
  const price = displayPrice(product);
  const image = (product.images && product.images[0]) || {
    src: product.image,
    alt: product.alt,
    width: product.width,
    height: product.height,
  };
  return `<a class="product" href="/products/${escapeHtml(product.slug)}/">
        <span class="product-media">
          ${imgTag(image)}
        </span>
        <span class="product-body">
          <span class="product-meta">
            <span class="kicker">${escapeHtml(product.category || "Shop")}</span>
            ${price ? `<span class="price">${escapeHtml(price.label)}</span>` : ""}
          </span>
          <h3>${escapeHtml(product.title)}</h3>
          <span class="more">See details <span aria-hidden="true">→</span></span>
        </span>
      </a>`;
}

function productGrid(products) {
  if (!products.length) {
    return `<p class="lede">No listings in this theme yet.</p>
      <div class="hero-actions">${etsyLink("btn", "Also on Etsy")}</div>`;
  }
  return `<div class="product-grid">${products.map(productCard).join("")}</div>`;
}

function defaultVariant(product) {
  return (product.variants || []).find((variant) => variant.isDefault) || (product.variants || [])[0] || null;
}

function optionFields(product, variant) {
  const selected = new Set((variant && variant.optionIds) || []);
  return (product.options || [])
    .map((option, index) => {
      const buttons = option.values
        .map((value) => {
          const pressed = selected.has(value.id) ? "true" : "false";
          const swatch =
            option.type === "color" && value.colors && value.colors[0]
              ? `<span class="swatch" style="background:${escapeHtml(value.colors[0])}"></span>`
              : "";
          return `<button type="button" class="choice" data-option-index="${index}" data-value-id="${value.id}" aria-pressed="${pressed}">${swatch}${escapeHtml(value.title)}</button>`;
        })
        .join("");
      return `<fieldset>
        <legend>${escapeHtml(option.name)}</legend>
        <div class="choices">${buttons}</div>
      </fieldset>`;
    })
    .join("");
}

function homePage(site, catalog) {
  const headline = site.headline.map((line) => escapeHtml(line)).join("<br>");
  const trust = site.trust.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const categories = site.categories
    .map((category) => {
      const href = `/categories/${slugify(category.name)}/`;
      return `<a class="category" href="${href}">
        ${icon(category.name)}
        <strong>${escapeHtml(category.name)}</strong>
        <span class="summary">${escapeHtml(category.summary)}</span>
        <span class="more">See this theme <span aria-hidden="true">→</span></span>
      </a>`;
    })
    .join("");
  const about = site.about.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const facts = site.about.facts
    .map((fact) => `<li><strong>${escapeHtml(fact.title)}</strong><span>${escapeHtml(fact.text)}</span></li>`)
    .join("");
  const faq = site.faq
    .map(
      (item, index) => `<details${index === 0 ? " open" : ""}>
        <summary><h3>${escapeHtml(item.question)}</h3></summary>
        <p>${escapeHtml(item.answer)}</p>
      </details>`
    )
    .join("");
  const heroImage = {
    src: "/images/products/lord-is-my-shield-ornament.jpg",
    alt: "Round cream ornament with a navy shield, a gold cross, and the words The Lord Is My Shield.",
    width: 900,
    height: 900,
  };
  const main = `<main id="main">
    <section class="hero" id="top">
      ${heroMark()}
      <div class="wrap hero-grid">
        <div>
          <p class="eyebrow">A family print shop</p>
          <h1>${headline}</h1>
          <p class="hero-text">${escapeHtml(site.heroText)}</p>
          <div class="hero-actions">
            <a class="btn" href="/shop/">Shop the collection</a>
            ${etsyLink("btn btn-ghost", "Also on Etsy")}
          </div>
          <ul class="trust">${trust}</ul>
        </div>
        <div class="hero-visual">
          ${imgTag(heroImage, { eager: true }).replace("<img ", '<img class="hero-photo" ')}
        </div>
      </div>
    </section>
    <section class="section" id="categories">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow on-light">Categories</p>
          <h2>Shop by what you stand for</h2>
          <p class="lede">Five themes from the shop.</p>
        </div>
        <div class="category-grid">${categories}</div>
      </div>
    </section>
    <section class="section band" id="featured">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow on-light">Featured</p>
          <h2>${escapeHtml(catalog.heading || "From the shop")}</h2>
          <p class="lede">${escapeHtml(catalog.note || "")}</p>
        </div>
        ${productGrid(catalog.products)}
      </div>
    </section>
    <section class="section" id="about">
      <div class="wrap about-grid">
        <div>
          <p class="eyebrow on-light">${escapeHtml(site.about.eyebrow)}</p>
          <h2>${escapeHtml(site.about.heading)}</h2>
          ${about}
        </div>
        <ul class="facts">${facts}</ul>
      </div>
    </section>
    <section class="section band" id="faq">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow on-light">FAQ</p>
          <h2>Ordering, printing, and returns</h2>
        </div>
        <div class="faq-list">${faq}</div>
        <p class="lede policy-links-inline"><a href="/shipping/">Shipping</a> and <a href="/returns/">returns</a></p>
      </div>
    </section>
  </main>
  <script type="application/ld+json">${jsonForScript({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: site.name,
    description: site.description,
    url: site.siteUrl || SHOP_URL,
  })}</script>`;
  return page({
    site,
    title: "Shield of Faith Design | Faith, Family, and Freedom",
    description: site.description,
    path: "/",
    main,
  });
}

function shopPage(site, catalog) {
  const main = `<main id="main" class="page">
    <div class="wrap">
      <p class="eyebrow on-light">Shop</p>
      <h1>${escapeHtml(catalog.heading || "From the shop")}</h1>
      <p class="lede">${escapeHtml(catalog.note || "")}</p>
      ${productGrid(catalog.products)}
    </div>
  </main>`;
  return page({
    site,
    title: "Shop | Shield of Faith Design",
    description: catalog.note || site.description,
    path: "/shop/",
    main,
  });
}

function categoryPage(site, catalog, category) {
  const products = catalog.products.filter((product) => product.category === category.name);
  const main = `<main id="main" class="page">
    <div class="wrap">
      <p class="eyebrow on-light">Category</p>
      <h1>${escapeHtml(category.name)}</h1>
      <p class="lede">${escapeHtml(category.summary)}</p>
      ${productGrid(products)}
    </div>
  </main>`;
  return page({
    site,
    title: `${category.name} | Shield of Faith Design`,
    description: category.summary,
    path: `/categories/${slugify(category.name)}/`,
    main,
  });
}

function productPage(site, product) {
  const price = displayPrice(product);
  const variant = defaultVariant(product);
  const shown = variant ? money(variant.price) : price ? price.label : "";
  const image = (product.images && product.images[0]) || { src: product.image, alt: product.alt };
  const thumbs =
    product.images && product.images.length > 1
      ? `<div class="thumbs">${product.images
          .map(
            (item, index) =>
              `<button type="button" class="thumb${index === 0 ? " is-current" : ""}" data-src="${escapeHtml(item.src)}" data-alt="${escapeHtml(item.alt || product.title)}">${imgTag(item)}</button>`
          )
          .join("")}</div>`
      : "";
  const buy = product.purchasable
    ? `<form id="product-form" class="buy-box">
        ${optionFields(product, variant)}
        <div class="quantity-row">
          <label for="quantity">Quantity</label>
          <input id="quantity" name="quantity" type="number" inputmode="numeric" min="1" max="10" value="1">
        </div>
        <button class="btn" id="add-to-cart" type="submit">Add to cart</button>
        <p id="product-status" class="form-error" role="status"></p>
        <p class="also">${etsyLink("", "Also on Etsy")}</p>
      </form>
      <noscript><p>JavaScript is off, so the cart on this site will not update. ${etsyLink("", "Also on Etsy")}</p></noscript>`
    : `<div class="buy-box">
        <p>This listing does not have size or color data on this site yet. You can buy it on Etsy.</p>
        ${etsyLink("btn", "Also on Etsy")}
      </div>`;
  const description = product.description ? `<div class="product-copy"><p>${escapeHtml(product.description)}</p></div>` : "";
  const main = `<main id="main" class="page">
    <div class="wrap product-layout">
      <div class="gallery">
        ${imgTag({ ...image, alt: image.alt || product.alt || product.title }, { eager: true }).replace("<img ", '<img id="product-photo" ')}
        ${thumbs}
      </div>
      <div>
        <p class="eyebrow on-light">${escapeHtml(product.category || "Shop")}</p>
        <h1>${escapeHtml(product.title)}</h1>
        ${shown ? `<p class="price price-large" id="product-price">${escapeHtml(shown)}</p>` : `<p class="price price-large" id="product-price"></p>`}
        ${buy}
        ${description}
      </div>
    </div>
    <script id="product-json" type="application/json">${jsonForScript(product)}</script>
  </main>`;
  return page({
    site,
    title: `${product.title} | Shield of Faith Design`,
    description: product.description || product.alt || product.title,
    path: `/products/${product.slug}/`,
    main,
  });
}

function cartPage(site) {
  const main = `<main id="main" class="page">
    <div class="wrap">
      <p class="eyebrow on-light">Cart</p>
      <h1>Your cart</h1>
      <div id="cart-root">
        <p>Your cart is empty.</p>
      </div>
      <noscript>
        <p>JavaScript is off, so this cart cannot load. ${etsyLink("", "Also on Etsy")}</p>
      </noscript>
    </div>
  </main>`;
  return page({
    site,
    title: "Cart | Shield of Faith Design",
    description: "Review the items in your Shield of Faith Design cart.",
    path: "/cart/",
    robots: "noindex, follow",
    main,
  });
}

function checkoutPage(site) {
  const main = `<main id="main" class="page">
    <div class="wrap checkout-layout">
      <p class="eyebrow on-light">Checkout</p>
      <h1>Checkout</h1>
      <div id="opening-soon" class="notice">
        <p><strong>Store opening soon.</strong> You can still shop these designs on Etsy.</p>
        ${etsyLink("btn", "Also on Etsy")}
      </div>
      <form id="checkout-form" class="checkout-form" hidden>
        <p class="lede">Shipping is calculated for this address before you pay. The item prices come from the shop catalog.</p>
        <div class="form-grid">
          <div>
            <label for="email">Email</label>
            <input id="email" name="email" type="email" autocomplete="email" required>
          </div>
          <div>
            <label for="phone">Phone</label>
            <input id="phone" name="phone" type="tel" autocomplete="tel" required>
          </div>
          <div>
            <label for="firstName">First name</label>
            <input id="firstName" name="firstName" autocomplete="given-name" required>
          </div>
          <div>
            <label for="lastName">Last name</label>
            <input id="lastName" name="lastName" autocomplete="family-name" required>
          </div>
          <div class="span-2">
            <label for="address1">Street address</label>
            <input id="address1" name="address1" autocomplete="address-line1" required>
          </div>
          <div class="span-2">
            <label for="address2">Apartment, suite (optional)</label>
            <input id="address2" name="address2" autocomplete="address-line2">
          </div>
          <div>
            <label for="city">City</label>
            <input id="city" name="city" autocomplete="address-level2" required>
          </div>
          <div>
            <label for="region">State or region</label>
            <input id="region" name="region" autocomplete="address-level1">
          </div>
          <div>
            <label for="zip">Postal code</label>
            <input id="zip" name="zip" autocomplete="postal-code" required>
          </div>
          <div>
            <label for="country">Country</label>
            <input id="country" name="country" autocomplete="country" value="US" maxlength="2" required>
          </div>
        </div>
        <p id="checkout-status" class="form-error" role="status"></p>
        <button class="btn" id="pay-button" type="submit">Continue to payment</button>
      </form>
    </div>
  </main>`;
  return page({
    site,
    title: "Checkout | Shield of Faith Design",
    description: "Checkout for Shield of Faith Design.",
    path: "/checkout/",
    robots: "noindex, follow",
    main,
  });
}

function successPage(site) {
  const main = `<main id="main" class="page">
    <div class="wrap narrow">
      <p class="eyebrow on-light">Thank you</p>
      <h1>Your payment went through.</h1>
      <p>We have your order and will send it to our print partner. You will get a shipping update when it ships.</p>
      <p id="order-ref"></p>
      <div class="hero-actions">
        <a class="btn btn-navy" href="/shop/">Back to the shop</a>
        ${etsyLink("btn", "Also on Etsy")}
      </div>
    </div>
  </main>`;
  return page({
    site,
    title: "Order received | Shield of Faith Design",
    description: "Your Shield of Faith Design payment went through.",
    path: "/success/",
    robots: "noindex, follow",
    main,
  });
}

function cancelPage(site) {
  const main = `<main id="main" class="page">
    <div class="wrap narrow">
      <p class="eyebrow on-light">Checkout</p>
      <h1>Checkout was canceled.</h1>
      <p>Your cart is still here. You can return to it, or shop the same designs on Etsy.</p>
      <div class="hero-actions">
        <a class="btn btn-navy" href="/cart/">Back to the cart</a>
        ${etsyLink("btn", "Also on Etsy")}
      </div>
    </div>
  </main>`;
  return page({
    site,
    title: "Checkout canceled | Shield of Faith Design",
    description: "Checkout was canceled. Your cart is still here.",
    path: "/cancel/",
    robots: "noindex, follow",
    main,
  });
}

const REVIEW_BANNER =
  "Timothy: please review this page before the shop opens. It uses the shop's existing FAQ plus standard print-on-demand wording for you to edit. It is not a promise from a specific printer.";

function policyPage(site, { title, path: policyPath, description, paragraphs }) {
  const body = paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const main = `<main id="main" class="page">
    <div class="wrap narrow">
      <p class="review-note">${escapeHtml(REVIEW_BANNER)}</p>
      <h1>${escapeHtml(title)}</h1>
      ${body}
      <p class="policy-links-inline"><a href="/shipping/">Shipping</a> · <a href="/returns/">Returns</a> · ${etsyLink("", "Also on Etsy")}</p>
    </div>
  </main>`;
  return page({
    site,
    title: `${title} | Shield of Faith Design`,
    description,
    path: policyPath,
    main,
  });
}

function shippingPage(site) {
  const printed = site.faq.find((item) => item.question.startsWith("How are items printed"));
  return policyPage(site, {
    title: "Shipping",
    path: "/shipping/",
    description: "How Shield of Faith Design prints and ships made-to-order items.",
    paragraphs: [
      printed ? printed.answer : "",
      "Production usually takes a few business days. The print partner then ships the package. Shipping is charged at checkout, before you pay. Transit time depends on the destination and the print partner.",
      "Questions about an order: message the shop on Etsy.",
    ].filter(Boolean),
  });
}

function returnsPage(site) {
  const orders = site.faq.find((item) => item.question.startsWith("How do orders"));
  return policyPage(site, {
    title: "Returns",
    path: "/returns/",
    description: "Returns for made-to-order items from Shield of Faith Design.",
    paragraphs: [
      orders ? orders.answer : "",
      "Made-to-order items are not restocked. We cannot accept a return for a size change or a change of mind. If an item arrives damaged or misprinted, message the shop on Etsy and we will make it right.",
    ].filter(Boolean),
  });
}

function notFoundPage(site) {
  const main = `<main id="main" class="missing">
    <div class="wrap">
      <p class="eyebrow on-light">404</p>
      <h1>That page is not on this site.</h1>
      <p>The shop and the gifts live on the home page. The same designs are also on Etsy.</p>
      <div class="hero-actions">
        <a class="btn btn-navy" href="/">Back to the home page</a>
        ${etsyLink("btn", "Also on Etsy")}
      </div>
    </div>
  </main>`;
  return page({
    site,
    title: "Page not found | Shield of Faith Design",
    description: "That page is not on the Shield of Faith Design site.",
    path: "/404.html",
    robots: "noindex, follow",
    main,
  });
}

function allPages(site, catalog) {
  const pages = [
    { file: "index.html", html: homePage(site, catalog) },
    { file: "shop/index.html", html: shopPage(site, catalog) },
    { file: "cart/index.html", html: cartPage(site) },
    { file: "checkout/index.html", html: checkoutPage(site) },
    { file: "success/index.html", html: successPage(site) },
    { file: "cancel/index.html", html: cancelPage(site) },
    { file: "shipping/index.html", html: shippingPage(site) },
    { file: "returns/index.html", html: returnsPage(site) },
    { file: "404.html", html: notFoundPage(site) },
  ];
  for (const category of site.categories) {
    pages.push({
      file: `categories/${slugify(category.name)}/index.html`,
      html: categoryPage(site, catalog, category),
    });
  }
  for (const product of catalog.products) {
    pages.push({
      file: `products/${product.slug}/index.html`,
      html: productPage(site, product),
    });
  }
  return pages;
}

module.exports = {
  escapeHtml,
  allPages,
  SHOP_URL,
};
