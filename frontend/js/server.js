/* =====================================================================
   ReservaYa - Servidor estático del frontend
   Solo sirve HTML, CSS, JS e imágenes. Toda la API vive en el backend:
   las páginas llaman al api-gateway (http://localhost:8080) desde el
   navegador, este servidor no intermedia ninguna petición.
   ===================================================================== */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.resolve(__dirname, "..");

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function serveStaticFile(response, pathname) {
  let filePath = path.resolve(publicDirectory, `.${pathname}`);

  if (!filePath.startsWith(publicDirectory) || !fs.existsSync(filePath)) {
    sendJson(response, 404, { message: "Recurso no encontrado." });
    return;
  }

  // Una carpeta (por ejemplo "/html/") se sirve con su index.html.
  if (fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
    if (!fs.existsSync(filePath)) {
      sendJson(response, 404, { message: "Recurso no encontrado." });
      return;
    }
  }

  const contentType = contentTypes[path.extname(filePath)] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });

  const stream = fs.createReadStream(filePath);
  stream.on("error", () => response.destroy());
  stream.pipe(response);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  // Mismas URLs limpias que Caddy en produccion: /login.html se sirve desde
  // html/login.html y las URLs viejas con /html/ redirigen a la raiz.
  const oldPage = url.pathname.match(/^\/html\/([^/]*\.html)?$/);
  if (oldPage) {
    response.writeHead(302, { Location: "/" + (oldPage[1] || "") + url.search });
    response.end();
    return;
  }

  if (request.method === "GET") {
    const pathname = url.pathname === "/" ? "/html/index.html" : url.pathname;
    const inRoot = path.resolve(publicDirectory, `.${pathname}`);
    const exists = inRoot.startsWith(publicDirectory) && fs.existsSync(inRoot);
    serveStaticFile(response, exists ? pathname : `/html${pathname}`);
    return;
  }

  sendJson(response, 405, { message: "Método no permitido." });
});

server.listen(port, () => {
  console.log(`Servidor disponible en http://localhost:${port}`);
});
