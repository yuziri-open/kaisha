import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { initializeDatabase } from "./db/index.js";
import { activityRoutes } from "./routes/activity.js";
import { adaptersRoutes } from "./routes/adapters.js";
import { agentsRoutes } from "./routes/agents.js";
import { companiesRoutes } from "./routes/companies.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { gasRoutes } from "./routes/gas.js";
import { projectsRoutes } from "./routes/projects.js";
import { runsRoutes } from "./routes/runs.js";
import { settingsRoutes } from "./routes/settings.js";
import { tasksRoutes } from "./routes/tasks.js";

const mimeTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function getUiDistPath(): string {
  return resolve(process.cwd(), "packages/ui/dist");
}

async function serveUiAsset(pathname: string): Promise<Response | null> {
  const uiDist = getUiDistPath();
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = join(uiDist, relativePath);

  if (!existsSync(filePath)) {
    return null;
  }

  const body = await readFile(filePath);
  return new Response(body, {
    headers: {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream"
    }
  });
}

export function createApp(): Hono {
  initializeDatabase();

  const app = new Hono();
  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ ok: true }));
  app.route("/api", adaptersRoutes);
  app.route("/api", companiesRoutes);
  app.route("/api", agentsRoutes);
  app.route("/api", tasksRoutes);
  app.route("/api", projectsRoutes);
  app.route("/api", runsRoutes);
  app.route("/api", activityRoutes);
  app.route("/api", dashboardRoutes);
  app.route("/api", settingsRoutes);
  app.route("/api", gasRoutes);

  app.get("*", async (c) => {
    const uiDist = getUiDistPath();
    if (!existsSync(uiDist)) {
      return c.html(
        `<!doctype html><html><body style="font-family:sans-serif;background:#0b1220;color:#fff;padding:24px">
          <h1>KAISHA</h1>
          <p>UI build not found. Run <code>npm run build -w @kaisha/ui</code> and reload.</p>
        </body></html>`
      );
    }

    const asset = await serveUiAsset(c.req.path);
    if (asset) {
      return asset;
    }

    return (await serveUiAsset("/index.html")) ?? c.notFound();
  });

  return app;
}

export function startServer(port = Number(process.env.PORT ?? "4000")) {
  return serve({
    fetch: createApp().fetch,
    port
  });
}

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`;

if (isMain || process.argv[1]?.endsWith("index.ts")) {
  const port = Number(process.env.PORT ?? "4000");
  startServer(port);
  console.log(`KAISHA server listening on http://localhost:${port}`);
}
