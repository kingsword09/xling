import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";
import { DiscussionEngine, DiscussionConfig } from "./engine.ts";
import { createRouter } from "@/services/prompt/router.ts";
import type { ModelRouter } from "@/services/prompt/router.ts";

interface Session {
  id: string;
  name: string;
  engine: DiscussionEngine;
  createdAt: number;
}

class SessionManager {
  #sessions: Map<string, Session> = new Map();
  private readonly router: ModelRouter;

  constructor(router: ModelRouter) {
    this.router = router;
  }

  createSession(name: string, config: Partial<DiscussionConfig>): Session {
    const id = crypto.randomUUID();
    const engine = new DiscussionEngine(this.router, {
      topic: name, // Default topic to session name initially
      ...config,
    });

    const session: Session = {
      id,
      name,
      engine,
      createdAt: Date.now(),
    };

    this.#sessions.set(id, session);
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.#sessions.get(id);
  }

  getAllSessions(): Omit<Session, "engine">[] {
    return Array.from(this.#sessions.values())
      .map(({ id, name, createdAt }) => ({
        id,
        name,
        createdAt,
      }))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  deleteSession(id: string): boolean {
    const session = this.#sessions.get(id);
    if (session) {
      session.engine.stop();
      return this.#sessions.delete(id);
    }
    return false;
  }
}

export async function createDiscussServer(
  port: number = 3000,
): Promise<http.Server> {
  const router = await createRouter();
  const sessions = new SessionManager(router);
  const clients = new Set<http.ServerResponse>();

  // Broadcast to all clients about global updates (like session list)
  // For session-specific updates, we might want to filter, but for now broadcast all
  // and let frontend filter by session ID.
  const broadcast = (data: any) => {
    const msg = JSON.stringify(data);
    for (const client of clients) {
      client.write(`data: ${msg}\n\n`);
    }
  };

  const attachEngineListeners = (session: Session) => {
    const { engine, id } = session;
    const wrap = (type: string, payload: any) => ({
      type,
      sessionId: id,
      ...payload,
    });

    engine.on("status-changed", (status) =>
      broadcast(wrap("status", { status })),
    );
    engine.on("turn-start", (participantId) =>
      broadcast(wrap("turn-start", { participantId })),
    );
    engine.on("message", (message) => broadcast(wrap("message", { message })));
    engine.on("message-chunk", (chunk) => broadcast(wrap("chunk", { chunk })));
    engine.on("error", (error) => broadcast(wrap("error", { error })));
    engine.on("participant-dropped", (id) =>
      broadcast(wrap("participant-dropped", { id })),
    );
    engine.on("participants-updated", (participants) =>
      broadcast(wrap("participants", { participants })),
    );
    engine.on("mode-changed", (mode) => broadcast(wrap("mode", { mode })));
    engine.on("history-cleared", () => broadcast(wrap("history-cleared", {})));
  };

  // Create a default session
  const defaultSession = sessions.createSession("General Discussion", {
    topic: "Welcome to xling discuss",
    strategy: "random",
    timeoutMs: 30000,
  });
  attachEngineListeners(defaultSession);

  const handleRequest = async (
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> => {
    const url = new URL(req.url || "/", `http://${req.headers.host}`);

    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // API Endpoints

    // Models
    if (url.pathname === "/api/models") {
      if (typeof router.reloadConfig === "function") {
        await router.reloadConfig();
      }
      const models = router.getRegistry().getAllModels();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ models }));
      return;
    }

    // Sessions
    if (url.pathname === "/api/sessions" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ sessions: sessions.getAllSessions() }));
      return;
    }

    if (url.pathname === "/api/sessions" && req.method === "POST") {
      const body = await readBody(req);
      const session = sessions.createSession(body.name || "New Discussion", {
        topic: body.topic || "New Topic",
        strategy: "random",
        timeoutMs: 30000,
      });
      attachEngineListeners(session);

      // Initialize participants if provided
      if (body.models) {
        body.models.forEach((model: string, i: number) => {
          session.engine.addParticipant({
            id: `model-${i}`,
            name: model,
            model: model,
            type: "ai",
          });
        });
        session.engine.addParticipant({
          id: "user",
          name: "User",
          type: "human",
        });

        // Auto-start the session
        session.engine.start();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          session: {
            id: session.id,
            name: session.name,
            createdAt: session.createdAt,
          },
        }),
      );
      return;
    }

    // Session-specific actions
    // URL pattern: /api/sessions/:id/:action
    const sessionMatch = url.pathname.match(
      /^\/api\/sessions\/([^/]+)(?:\/(.+))?$/,
    );

    if (sessionMatch) {
      const sessionId = sessionMatch[1];
      const action = sessionMatch[2];
      const session = sessions.getSession(sessionId);

      // Handle DELETE session
      if (req.method === "DELETE" && !action) {
        const deleted = sessions.deleteSession(sessionId);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, deleted }));
        return;
      }

      if (!session) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      if (!action) {
        // GET session details
        if (req.method === "GET") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              id: session.id,
              name: session.name,
              topic: session.engine.topic,
              status: session.engine.status,
              mode: session.engine.mode,
              participants: session.engine.participants,
              history: session.engine.history,
              currentMessage: session.engine.currentMessage,
            }),
          );
          return;
        }
      } else if (req.method === "POST") {
        const engine = session.engine;
        const body = await readBody(req);

        let responsePayload: Record<string, unknown> = { success: true };

        switch (action) {
          case "start":
            // Update config if provided
            if (body.topic) engine.updateConfig({ topic: body.topic });
            if (body.models) {
              // Reset participants
              engine.participants.forEach((p) =>
                engine.removeParticipant(p.id),
              );
              body.models.forEach((model: string, i: number) => {
                engine.addParticipant({
                  id: `model-${i}`,
                  name: model,
                  model: model,
                  type: "ai",
                });
              });
              engine.addParticipant({
                id: "user",
                name: "User",
                type: "human",
              });
            }
            engine.start();
            break;
          case "stop":
            engine.stop();
            break;
          case "pause":
            engine.pause();
            break;
          case "resume":
            engine.resume();
            break;
          case "interrupt":
            engine.interrupt();
            break;
          case "reset":
            engine.reset();
            break;
          case "mode":
            engine.setMode(body.mode);
            break;
          case "next":
            if (body.participantId) {
              engine.setNextSpeaker(body.participantId);
            } else {
              const ais = engine.participants.filter((p) => p.type === "ai");
              const random = ais[Math.floor(Math.random() * ais.length)];
              if (random) engine.setNextSpeaker(random.id);
            }
            break;
          case "message":
            await engine.injectMessage("user", body.content);
            break;
          case "summary":
            try {
              const summary = await engine.generateSummary(body.modelId);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ summary, success: true }));
              return;
            } catch (e) {
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: (e as Error).message }));
              return;
            }
          case "add-participant":
            try {
              const newParticipant = {
                id: body.id || `model-${Date.now()}`,
                name: body.name || body.model,
                model: body.model,
                type: body.type || "ai",
              };
              engine.addParticipant(newParticipant);

              const explicitStart = body.start === true;
              const defaultStart =
                body.start === undefined && engine.mode === "auto";
              const shouldStart = explicitStart || defaultStart;
              const canStart =
                engine.status !== "idle" &&
                (!engine.currentSpeakerId || engine.status === "paused");

              if (shouldStart && canStart) {
                engine.setNextSpeaker(newParticipant.id);
              }

              responsePayload.participant = newParticipant;
            } catch (error) {
              res.writeHead(400, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: (error as Error).message }));
              return;
            }
            break;
          case "remove-participant":
            engine.removeParticipant(body.participantId);
            responsePayload.removed = true;
            break;
          default:
            res.writeHead(404);
            res.end("Action not found");
            return;
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(responsePayload));
        return;
      }
    }

    // Stream endpoint (Global)
    if (url.pathname === "/api/stream") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      clients.add(res);

      // Send initial state for ALL sessions? Or just let client fetch?
      // Let's send a "connected" event
      res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

      req.on("close", () => {
        clients.delete(res);
      });
      return;
    }

    // Static File Serving
    let filePath = url.pathname;
    if (filePath === "/") filePath = "/index.html";

    const possiblePaths = [
      path.resolve(process.cwd(), "dist/ui"),
      path.resolve(__dirname, "../../ui"),
      path.resolve(__dirname, "../../../dist/ui"),
    ];

    let distPath = possiblePaths.find((p) => fs.existsSync(p));

    if (!distPath) {
      res.writeHead(404);
      res.end("UI not found. Please run `bun run build`.");
      return;
    }

    const fullPath = path.join(distPath, filePath.substring(1));

    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath);
        const contentType = getContentType(ext);
        res.writeHead(200, { "Content-Type": contentType });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    } catch {
      // ignore
    }

    // SPA fallback
    if (filePath.indexOf(".") === -1) {
      const indexHtml = path.join(distPath, "index.html");
      if (fs.existsSync(indexHtml)) {
        res.writeHead(200, { "Content-Type": "text/html" });
        fs.createReadStream(indexHtml).pipe(res);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not Found");
  };

  const server = http.createServer((req, res) => {
    void handleRequest(req, res).catch((error) => {
      console.error("Discuss server error:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Internal server error" }));
      } else {
        res.end();
      }
    });
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
      } catch {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

function getContentType(ext: string): string {
  switch (ext) {
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".css":
      return "text/css";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".jpg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
}
