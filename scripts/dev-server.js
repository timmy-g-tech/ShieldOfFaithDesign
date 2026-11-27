const http = require("http");
const fs = require("fs");
const path = require("path");
const { handler: checkout } = require("../netlify/functions/create-checkout");
const { handler: webhook } = require("../netlify/functions/stripe-webhook");

const DIST = path.join(__dirname, "..", "dist");
const PORT = Number(process.env.PORT || 8080);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length > 1_000_000) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function fileFor(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const file = path.normalize(path.join(DIST, clean));
  if (!file.startsWith(DIST)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    const index = path.join(file, "index.html");
    return fs.existsSync(index) ? index : null;
  }
  return fs.existsSync(file) && fs.statSync(file).isFile() ? file : null;
}

async function netlifyEvent(req, body) {
  const host = req.headers.host || `localhost:${PORT}`;
  return {
    httpMethod: req.method,
    headers: {
      ...req.headers,
      host,
      "x-forwarded-proto": "http",
      "x-forwarded-host": host,
    },
    body,
    isBase64Encoded: false,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname === "/api/checkout" || url.pathname === "/.netlify/functions/create-checkout") {
    const body = await readBody(req);
    const result = await checkout(await netlifyEvent(req, body));
    res.writeHead(result.statusCode, result.headers || { "Content-Type": "application/json" });
    res.end(result.body || "");
    return;
  }
  if (url.pathname === "/api/stripe-webhook" || url.pathname === "/.netlify/functions/stripe-webhook") {
    const body = await readBody(req);
    const result = await webhook(await netlifyEvent(req, body));
    res.writeHead(result.statusCode, result.headers || { "Content-Type": "text/plain" });
    res.end(result.body || "");
    return;
  }
  const file = fileFor(url.pathname);
  if (!file) {
    const missing = path.join(DIST, "404.html");
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fs.existsSync(missing) ? fs.readFileSync(missing) : "Not found");
    return;
  }
  const ext = path.extname(file);
  res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream" });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, () => {
  console.log(`Store preview at http://localhost:${PORT}`);
});
