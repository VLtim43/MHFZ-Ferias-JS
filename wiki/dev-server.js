// Preview the new wiki and its original data files without installing packages.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT) || 8000;
const types = { ".html": "text/html", ".htm": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp" };

http.createServer((request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  const file = path.resolve(root, `.${pathname}`, pathname.endsWith("/") ? "index.html" : "");
  if (file !== root && !file.startsWith(root + path.sep)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      response.writeHead(404).end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": `${types[path.extname(file)] || "application/octet-stream"}${[".html", ".htm", ".js", ".css"].includes(path.extname(file)) ? "; charset=utf-8" : ""}` });
    fs.createReadStream(file).pipe(response);
  });
}).listen(port, () => console.log(`Open http://localhost:${port}/wiki/`));
