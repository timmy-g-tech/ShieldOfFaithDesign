(function () {
  const CART_KEY = "sof-cart";
  const MAX_QTY = 10;

  function readCart() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "");
      const items = Array.isArray(parsed && parsed.items) ? parsed.items : [];
      return {
        items: items
          .map((item) => ({
            productId: String(item.productId || ""),
            variantId: Number(item.variantId),
            quantity: Number(item.quantity),
          }))
          .filter(
            (item) =>
              item.productId &&
              Number.isInteger(item.variantId) &&
              Number.isInteger(item.quantity) &&
              item.quantity >= 1 &&
              item.quantity <= MAX_QTY
          ),
      };
    } catch (err) {
      return { items: [] };
    }
  }

  function writeCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify({ items: cart.items }));
    paintCount();
  }

  function paintCount() {
    const count = readCart().items.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll(".cart-count").forEach((node) => {
      node.textContent = String(count);
    });
  }

  function money(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  function findVariant(product, selected) {
    return (product.variants || []).find((variant) =>
      (product.options || []).every((option, index) => variant.optionIds.includes(selected[index]))
    );
  }

  function selectVariant(product, selected, optionIndex, valueId) {
    const next = selected.slice();
    next[optionIndex] = valueId;
    const exact = findVariant(product, next);
    if (exact) return { selected: next, variant: exact };
    const fallback = (product.variants || []).find((entry) => entry.optionIds.includes(valueId));
    if (!fallback) return { selected: next, variant: null };
    const aligned = (product.options || []).map((option) => {
      const value = option.values.find((entry) => fallback.optionIds.includes(entry.id));
      return value ? value.id : null;
    });
    return { selected: aligned, variant: fallback };
  }

  function imageFor(product, variant) {
    const images = product.images || [];
    const match = images.find(
      (image) => variant && Array.isArray(image.variantIds) && image.variantIds.includes(variant.id)
    );
    return match || images.find((image) => image.isDefault) || images[0] || null;
  }

  function initProduct() {
    const node = document.getElementById("product-json");
    const form = document.getElementById("product-form");
    if (!node || !form) return;
    const product = JSON.parse(node.textContent);
    const status = document.getElementById("product-status");
    const price = document.getElementById("product-price");
    const photo = document.getElementById("product-photo");
    function selectionFromVariant(current) {
      return (product.options || []).map((option) => {
        const value = option.values.find((entry) => current.optionIds.includes(entry.id));
        return value ? value.id : option.values[0].id;
      });
    }

    let selected = (product.options || []).map((option, index) => {
      const pressed = form.querySelector(`[data-option-index="${index}"][aria-pressed="true"]`);
      return pressed ? Number(pressed.getAttribute("data-value-id")) : option.values[0].id;
    });
    let variant = findVariant(product, selected) || (product.variants || [])[0] || null;
    if (variant) selected = selectionFromVariant(variant);

    function paint() {
      form.querySelectorAll(".choice").forEach((button) => {
        const index = Number(button.getAttribute("data-option-index"));
        const valueId = Number(button.getAttribute("data-value-id"));
        button.setAttribute("aria-pressed", selected[index] === valueId ? "true" : "false");
      });
      if (price && variant) price.textContent = money(variant.price);
      const image = imageFor(product, variant);
      if (photo && image) {
        photo.src = image.src;
        photo.alt = image.alt || product.title;
      }
    }

    form.addEventListener("click", (event) => {
      const button = event.target.closest(".choice");
      if (!button) return;
      const picked = selectVariant(
        product,
        selected,
        Number(button.getAttribute("data-option-index")),
        Number(button.getAttribute("data-value-id"))
      );
      selected = picked.selected;
      variant = picked.variant;
      paint();
    });

    document.querySelectorAll(".thumb").forEach((button) => {
      button.addEventListener("click", () => {
        if (!photo) return;
        photo.src = button.getAttribute("data-src");
        photo.alt = button.getAttribute("data-alt") || product.title;
        document.querySelectorAll(".thumb").forEach((thumb) => thumb.classList.remove("is-current"));
        button.classList.add("is-current");
      });
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!variant) {
        if (status) status.textContent = "Choose an available option.";
        return;
      }
      const quantity = Number(document.getElementById("quantity").value);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
        if (status) status.textContent = `Quantity must be from 1 to ${MAX_QTY}.`;
        return;
      }
      const cart = readCart();
      const existing = cart.items.find(
        (item) => item.productId === product.id && item.variantId === variant.id
      );
      if (existing) existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
      else cart.items.push({ productId: product.id, variantId: variant.id, quantity });
      writeCart(cart);
      if (status) status.textContent = "Added to cart.";
    });

    paint();
  }

  function lineView(catalog, item) {
    const product = (catalog.products || []).find((entry) => entry.id === item.productId);
    if (!product) return { missing: true, item };
    const variant = (product.variants || []).find((entry) => entry.id === item.variantId);
    if (!product.purchasable || !variant) {
      return { product, unavailable: true, item };
    }
    return { product, variant, item, lineCents: variant.price * item.quantity };
  }

  async function initCart() {
    const root = document.getElementById("cart-root");
    if (!root) return;
    let catalog;
    try {
      const response = await fetch("/catalog.json");
      catalog = await response.json();
    } catch (err) {
      root.innerHTML = "<p>The catalog could not be loaded.</p>";
      return;
    }

    function render() {
      const cart = readCart();
      if (!cart.items.length) {
        root.innerHTML = `<p>Your cart is empty.</p><div class="hero-actions"><a class="btn btn-navy" href="/shop/">Shop the collection</a><a class="btn" href="https://shieldoffaithdesign.etsy.com" target="_blank" rel="noopener noreferrer">Also on Etsy<span class="sr-only"> (opens in a new tab)</span></a></div>`;
        return;
      }
      const views = cart.items.map((item) => lineView(catalog, item));
      const rows = views
        .map((view, index) => {
          if (view.missing || view.unavailable) {
            const title = view.product ? view.product.title : "This item";
            return `<li class="cart-line"><div><strong>${escapeText(title)}</strong><p>This item is not available for checkout on this site.</p><a href="https://shieldoffaithdesign.etsy.com" target="_blank" rel="noopener noreferrer">Also on Etsy<span class="sr-only"> (opens in a new tab)</span></a></div><button type="button" data-remove="${index}">Remove</button></li>`;
          }
          const image = (view.product.images || []).find((entry) => entry.variantIds && entry.variantIds.includes(view.variant.id)) || view.product.images[0];
          return `<li class="cart-line">
            <a class="cart-photo" href="/products/${escapeText(view.product.slug)}/"><img src="${escapeText(image ? image.src : view.product.image)}" alt=""></a>
            <div>
              <strong><a href="/products/${escapeText(view.product.slug)}/">${escapeText(view.product.title)}</a></strong>
              <p>${escapeText(view.variant.title || "")}</p>
              <p class="price">${money(view.variant.price)}</p>
              <label>Quantity <input data-qty="${index}" type="number" min="1" max="${MAX_QTY}" value="${view.item.quantity}"></label>
              <button type="button" data-remove="${index}">Remove</button>
            </div>
          </li>`;
        })
        .join("");
      const payable = views.filter((view) => view.lineCents);
      const subtotal = payable.reduce((sum, view) => sum + view.lineCents, 0);
      const checkout =
        payable.length > 0
          ? `<a class="btn" href="/checkout/">Checkout</a>`
          : `<p>These listings do not have checkout data on this site yet.</p><a class="btn" href="https://shieldoffaithdesign.etsy.com" target="_blank" rel="noopener noreferrer">Also on Etsy<span class="sr-only"> (opens in a new tab)</span></a>`;
      root.innerHTML = `<ul class="cart-list">${rows}</ul><p class="cart-subtotal">Subtotal <span class="price">${money(subtotal)}</span></p><p class="lede">Shipping is added at checkout.</p><div class="hero-actions">${checkout}</div>`;
    }

    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-remove]");
      if (!button) return;
      const cart = readCart();
      cart.items.splice(Number(button.getAttribute("data-remove")), 1);
      writeCart(cart);
      render();
    });
    root.addEventListener("change", (event) => {
      const input = event.target.closest("[data-qty]");
      if (!input) return;
      const cart = readCart();
      const quantity = Number(input.value);
      const index = Number(input.getAttribute("data-qty"));
      if (!cart.items[index]) return;
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QTY) {
        input.value = String(cart.items[index].quantity);
        return;
      }
      cart.items[index].quantity = quantity;
      writeCart(cart);
      render();
    });
    render();
  }

  function escapeText(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function field(id) {
    const node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  async function initCheckout() {
    const form = document.getElementById("checkout-form");
    const notice = document.getElementById("opening-soon");
    if (!form || !notice) return;
    const status = document.getElementById("checkout-status");
    let open = false;
    try {
      const response = await fetch("/api/checkout");
      const body = await response.json();
      open = body.code === "open";
    } catch (err) {
      open = false;
    }
    form.addEventListener("submit", (event) => {
      if (!open) event.preventDefault();
    });
    if (!open) return;
    notice.hidden = true;
    form.hidden = false;
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = document.getElementById("pay-button");
      const cart = readCart();
      if (!cart.items.length) {
        if (status) status.textContent = "Your cart is empty.";
        return;
      }
      if (button) button.disabled = true;
      if (status) status.textContent = "";
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cart.items,
            address: {
              email: field("email"),
              phone: field("phone"),
              firstName: field("firstName"),
              lastName: field("lastName"),
              address1: field("address1"),
              address2: field("address2"),
              city: field("city"),
              region: field("region"),
              zip: field("zip"),
              country: field("country"),
            },
          }),
        });
        const body = await response.json();
        if (body.url) {
          window.location.href = body.url;
          return;
        }
        if (body.code === "opening_soon") {
          form.hidden = true;
          notice.hidden = false;
          return;
        }
        if (status) status.textContent = body.message || "Checkout could not be started.";
      } catch (err) {
        if (status) status.textContent = "Checkout could not be started.";
      }
      if (button) button.disabled = false;
    });
  }

  function initSuccess() {
    const ref = document.getElementById("order-ref");
    if (!ref) return;
    const id = new URLSearchParams(window.location.search).get("session_id") || "";
    if (/^cs_[A-Za-z0-9_]+$/.test(id)) ref.textContent = `Reference: ${id}`;
  }

  function initMenu() {
    document.querySelectorAll(".mobile-nav a").forEach((link) => {
      link.addEventListener("click", () => {
        const menu = link.closest("details");
        if (menu) menu.open = false;
      });
    });
  }

  paintCount();
  initMenu();
  initProduct();
  initCart();
  initCheckout();
  initSuccess();
})();
