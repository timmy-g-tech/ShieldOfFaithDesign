const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const DIST = path.join(ROOT, "dist");
const SHOP = "https://shieldoffaithdesign.etsy.com";
const BANNED = [/thin blue line/i, /blue lives matter/i];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function money(amount) {
  return `$${Number(amount).toFixed(2)}`;
}

function assertNoBanned(text, label) {
  for (const pattern of BANNED) {
    if (pattern.test(text)) {
      throw new Error(`${label} contains a phrase this site does not use (${pattern}).`);
    }
  }
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

function shopAnchor(className, inner) {
  const cls = className ? ` class="${className}"` : "";
  return `<a${cls} href="${SHOP}" target="_blank" rel="noopener noreferrer">${inner}<span class="sr-only"> (opens in a new tab)</span></a>`;
}

function header(site) {
  const links = [
    ["/#categories", "Categories"],
    ["/#featured", "Featured"],
    ["/#about", "About"],
    ["/#faq", "FAQ"],
  ];
  const nav = links
    .map(([href, label]) => `<a href="${href}">${label}</a>`)
    .join("");
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
      ${shopAnchor("btn btn-small header-cta", "Shop on Etsy")}
      <details class="mobile-nav">
        <summary>Menu</summary>
        <nav aria-label="Mobile">
          ${nav}
          ${shopAnchor("menu-shop", "Shop on Etsy")}
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
  const shopLabel = "https://<wbr>shieldoffaithdesign.etsy.com";
  return `<footer class="site-footer">
    <div class="wrap footer-grid">
      <div>
        <h2>Shield of Faith Design</h2>
        <p>A small family shop for faith, family, and freedom.</p>
        <p class="footer-label">Shop</p>
        ${shopAnchor("shop-url", shopLabel)}
      </div>
      <div>
        <p class="footer-label">Social</p>
        <ul class="social">${social}</ul>
      </div>
    </div>
    <div class="wrap">
      <p class="legal">© ${new Date().getFullYear()} Shield of Faith Design. Family-run. Printed on demand. Sold on Etsy.</p>
    </div>
  </footer>`;
}

function headTags(site, { title, description, path }) {
  const origin = String(site.siteUrl || "").replace(/\/$/, "");
  const canonical = origin ? `${origin}${path}` : "";
  const image = origin ? `${origin}/og-image.jpg` : "";
  const robots = `<meta name="robots" content="index, follow">`;
  return `<meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  ${robots}
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

function jsonLd(site) {
  const data = {
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    name: site.name,
    description: site.description,
    url: SHOP,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function page({ site, title, description, path, main }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  ${headTags(site, { title, description, path })}
</head>
<body>
  ${header(site)}
  ${main}
  ${footer(site)}
  <script>
    document.querySelectorAll(".mobile-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        const menu = link.closest("details");
        if (menu) menu.open = false;
      });
    });
  </script>
</body>
</html>
`;
}

function homePage(site, catalog) {
  const headline = site.headline.map((line) => escapeHtml(line)).join("<br>");
  const trust = site.trust.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const categories = site.categories
    .map(
      (category) => `<a class="category" href="${SHOP}" target="_blank" rel="noopener noreferrer">
        ${icon(category.name)}
        <strong>${escapeHtml(category.name)}</strong>
        <span class="summary">${escapeHtml(category.summary)}</span>
        <span class="more">Shop on Etsy <span aria-hidden="true">→</span></span>
        <span class="sr-only"> (opens in a new tab)</span>
      </a>`
    )
    .join("");
  const products = catalog.products
    .map((product) => {
      const src = `/${String(product.image).replace(/^\//, "")}`;
      return `<a class="product" href="${SHOP}" target="_blank" rel="noopener noreferrer">
        <span class="product-media">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(product.alt)}" width="${Number(product.width)}" height="${Number(product.height)}" loading="lazy" decoding="async">
        </span>
        <span class="product-body">
          <span class="product-meta">
            <span class="kicker">${escapeHtml(product.category)}</span>
            <span class="price">${money(product.price)}</span>
          </span>
          <h3>${escapeHtml(product.name)}</h3>
          <span class="more">Shop on Etsy <span aria-hidden="true">→</span></span>
        </span>
        <span class="sr-only"> (opens in a new tab)</span>
      </a>`;
    })
    .join("");
  const about = site.about.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
  const facts = site.about.facts
    .map(
      (fact) =>
        `<li><strong>${escapeHtml(fact.title)}</strong><span>${escapeHtml(fact.text)}</span></li>`
    )
    .join("");
  const faq = site.faq
    .map(
      (item, index) => `<details${index === 0 ? " open" : ""}>
        <summary><h3>${escapeHtml(item.question)}</h3></summary>
        <p>${escapeHtml(item.answer)}</p>
      </details>`
    )
    .join("");

  const main = `<main id="main">
    <section class="hero" id="top">
      ${heroMark()}
      <div class="wrap hero-grid">
        <div>
          <p class="eyebrow">A family print shop</p>
          <h1>${headline}</h1>
          <p class="hero-text">${escapeHtml(site.heroText)}</p>
          <div class="hero-actions">
            ${shopAnchor("btn", "Shop on Etsy")}
            <a class="btn btn-ghost" href="#featured">See featured gifts</a>
          </div>
          <ul class="trust">${trust}</ul>
        </div>
        <div class="hero-visual">
          <img class="hero-photo" src="/images/products/lord-is-my-shield-ornament.jpg" alt="Round cream ornament with a navy shield, a gold cross, and the words The Lord Is My Shield." width="900" height="900" fetchpriority="high" decoding="async">
        </div>
      </div>
    </section>
    <section class="section" id="categories">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow on-light">Categories</p>
          <h2>Shop by what you stand for</h2>
          <p class="lede">Five themes. Each one opens the Etsy shop.</p>
        </div>
        <div class="category-grid">${categories}</div>
      </div>
    </section>
    <section class="section band" id="featured">
      <div class="wrap">
        <div class="section-head">
          <p class="eyebrow on-light">Featured</p>
          <h2>${escapeHtml(catalog.heading)}</h2>
          <p class="lede">${escapeHtml(catalog.note)}</p>
        </div>
        <div class="product-grid">${products}</div>
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
      </div>
    </section>
  </main>
  <script type="application/ld+json">${jsonLd(site)}</script>`;

  return page({
    site,
    title: "Shield of Faith Design | Faith, Family, and Freedom",
    description: site.description,
    path: "/",
    main,
  });
}

function notFoundPage(site) {
  const main = `<main id="main" class="missing">
    <div class="wrap">
      <p class="eyebrow on-light">404</p>
      <h1>That page is not on this site.</h1>
      <p>The shop and the gifts live on the home page and on Etsy.</p>
      <div class="hero-actions">
        <a class="btn btn-navy" href="/">Back to the home page</a>
        ${shopAnchor("btn", "Shop on Etsy")}
      </div>
    </div>
  </main>`;
  return page({
    site,
    title: "Page not found | Shield of Faith Design",
    description: "That page is not on the Shield of Faith Design site. Visit the home page or the Etsy shop.",
    path: "/404.html",
    main,
  });
}

function validate(site, catalog, html) {
  if (site.shopUrl !== SHOP) {
    throw new Error(`data/site.json shopUrl must be exactly ${SHOP}`);
  }
  if (catalog.shopUrl !== SHOP) {
    throw new Error(`data/products.json shopUrl must be exactly ${SHOP}`);
  }
  if (!Array.isArray(catalog.products) || catalog.products.length === 0) {
    throw new Error("products.json needs at least one product.");
  }
  const seen = new Set();
  for (const product of catalog.products) {
    for (const key of ["name", "image", "etsyUrl", "category", "alt"]) {
      if (!product[key]) throw new Error(`Product is missing ${key}: ${product.name || "(unnamed)"}`);
    }
    if (product.etsyUrl !== SHOP) {
      throw new Error(`${product.name} etsyUrl must be exactly ${SHOP}`);
    }
    const imagePath = path.join(ROOT, "assets", product.image);
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Missing image for ${product.name}: ${imagePath}`);
    }
    if (seen.has(product.name)) throw new Error(`Duplicate product name: ${product.name}`);
    seen.add(product.name);
  }

  assertNoBanned(JSON.stringify(site), "site.json");
  assertNoBanned(JSON.stringify(catalog), "products.json");
  assertNoBanned(html, "built HTML");

  const urls = html.match(/https?:\/\/[^"'\\\s<]*etsy\.com[^"'\\\s<]*/gi) || [];
  const bad = urls.filter((url) => url !== SHOP);
  if (bad.length) {
    throw new Error(`Found Etsy URLs that are not the shop link:\n${bad.join("\n")}`);
  }
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
  const shopHrefs = hrefs.filter((href) => href === SHOP);
  if (shopHrefs.length < catalog.products.length + site.categories.length) {
    throw new Error("Not enough shop links were written into the page.");
  }
  if (html.includes("etsy.com/listing") || html.includes("etsy.com/shop")) {
    throw new Error("Built HTML must not link to individual listings or the www shop URL.");
  }
}

function copyAssets() {
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(DIST, { recursive: true });
  fs.cpSync(path.join(ROOT, "assets", "images"), path.join(DIST, "images"), { recursive: true });
  fs.cpSync(path.join(ROOT, "assets", "fonts"), path.join(DIST, "fonts"), { recursive: true });
  fs.copyFileSync(path.join(ROOT, "src", "styles.css"), path.join(DIST, "styles.css"));
  for (const file of ["favicon.svg", "favicon-32.png", "apple-touch-icon.png", "og-image.jpg"]) {
    fs.copyFileSync(path.join(ROOT, "assets", file), path.join(DIST, file));
  }
  fs.writeFileSync(path.join(DIST, "robots.txt"), "User-agent: *\nAllow: /\n");
}

function main() {
  const site = readJson("data/site.json");
  const catalog = readJson("data/products.json");
  const html = homePage(site, catalog);
  const notFound = notFoundPage(site);
  validate(site, catalog, html + notFound);
  copyAssets();
  fs.writeFileSync(path.join(DIST, "index.html"), html);
  fs.writeFileSync(path.join(DIST, "404.html"), notFound);
  const shopLinks = (html.match(new RegExp(SHOP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  console.log(`Built dist/ with ${catalog.products.length} products and ${shopLinks} shop URL mentions on the home page.`);
}

main();
