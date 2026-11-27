const { shopIdFromEnv } = require("./catalog");
const { shippingQuote, summarizeError } = require("./printify");

function flatRateCents(config) {
  if (!config || config.flatRateCents === null || config.flatRateCents === undefined || config.flatRateCents === "") {
    return null;
  }
  if (!Number.isInteger(config.flatRateCents) || config.flatRateCents < 0) {
    throw new Error("data/shipping.json flatRateCents must be a whole number of cents, or null.");
  }
  return config.flatRateCents;
}

async function quoteShipping({ lines, address, config, env = process.env, fetchImpl = fetch, log = console }) {
  const token = String(env.PRINTIFY_API_TOKEN || "").trim();
  let shopId;
  try {
    shopId = shopIdFromEnv(env);
  } catch (err) {
    log.error(`[printify] ${err.message}`);
    shopId = null;
  }

  if (token && shopId) {
    try {
      const result = await shippingQuote({ token, shopId, lines, address, fetchImpl });
      const standard = result.data && result.data.standard;
      if (result.ok && Number.isInteger(standard) && standard >= 0) {
        return {
          ok: true,
          cents: standard,
          source: "printify",
          method: 1,
          label: (config && config.flatRateLabel) || "Shipping",
        };
      }
      log.error(
        `[printify] Shipping quote failed with HTTP ${result.status}. ${summarizeError(result.data)}`.trim()
      );
    } catch (err) {
      log.error(`[printify] Shipping quote error: ${err.message}`);
    }
  } else if (!token) {
    log.error("[printify] PRINTIFY_API_TOKEN is not set. Printify shipping was not requested.");
  }

  let flat = null;
  try {
    flat = flatRateCents(config);
  } catch (err) {
    log.error(`[shipping] ${err.message}`);
    return { ok: false, message: "Shipping rates are not available yet." };
  }
  if (flat !== null) {
    log.error("[shipping] Using flatRateCents from data/shipping.json because Printify did not return a standard rate.");
    return {
      ok: true,
      cents: flat,
      source: "flat",
      method: Number(config.shippingMethod) || 1,
      label: config.flatRateLabel || "Shipping",
    };
  }

  return {
    ok: false,
    message: "Shipping rates are not available yet. You can still shop these designs on Etsy.",
  };
}

module.exports = { quoteShipping, flatRateCents };
