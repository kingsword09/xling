import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { ChatRoom } from "./room.ts";
import { createRouter } from "@/services/prompt/router.ts";

export async function createDiscussServer(port: number = 3000): Promise<http.Server> {
  const router = await createRouter();
  const clients = new Set<http.ServerResponse>();

  const broadcast = (data: any) => {
    const msg = JSON.stringify(data);
    for (const client of clients) {
      client.write(`data: ${msg}\n\n`);
    }
  };

  const room = new ChatRoom(router, (message) => {
    broadcast({ type: "message", message });
  });

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API Endpoints
    if (url.pathname === "/api/models") {
      const models = router.getRegistry().getAllModels();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models }));
      return;
    }

    if (url.pathname === "/api/chat/start" && req.method === "POST") {
      const body = await readBody(req);
      room.start(body.topic, body.models);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url.pathname === "/api/chat/stop" && req.method === "POST") {
      room.stop();
      broadcast({ type: "stop" });
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url.pathname === "/api/chat/next" && req.method === "POST") {
      room.nextTurn();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (url.pathname === "/api/chat/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      clients.add(res);

      // Send initial history
      room.messages.forEach((msg) => {
        res.write(`data: ${JSON.stringify({ type: "message", message: msg })}\n\n`);
      });

      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    // Static File Serving
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";
    
    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    const distPath = path.resolve(currentDir, "ui");
    const fullPath = path.join(distPath, filePath.substring(1));

    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath);
        const contentType = getContentType(ext);
        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    } catch (e) {
      // ignore
    }

    res.writeHead(404);
    res.end("Not Found");
  });

  server.listen(port);
  return server;
}

function readBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function getContentType(ext: string): string {
  switch (ext) {
    case ".html": return "text/html";
    case ".js": return "text/javascript";
    case ".css": return "text/css";
    case ".json": return "application/json";
    case ".png": return "image/png";
    case ".jpg": return "image/jpeg";
    default: return "application/octet-stream";
  }
}
