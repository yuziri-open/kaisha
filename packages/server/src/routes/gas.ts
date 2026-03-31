import { Hono } from "hono";
import { GasService } from "../services/gas.js";
import { getGasSettings } from "./settings.js";

export const gasRoutes = new Hono();

function getGasService(): GasService {
  const settings = getGasSettings();
  return new GasService({
    calendarUrl: settings.calendarUrl ?? settings.endpoint ?? "",
    projectUrl: settings.projectUrl ?? settings.endpoint ?? ""
  });
}

// GET /api/gas/calendar?days=7
gasRoutes.get("/gas/calendar", async (c) => {
  const days = Math.max(1, Number(c.req.query("days") ?? "7") || 7);
  try {
    const events = await getGasService().getCalendar(days);
    return c.json({ events });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "カレンダー取得に失敗しました" }, 500);
  }
});

// GET /api/gas/files?folderId=XXX
gasRoutes.get("/gas/files", async (c) => {
  const folderId = c.req.query("folderId") ?? undefined;
  try {
    const files = await getGasService().listFiles(folderId);
    return c.json({ files });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "ファイル一覧取得に失敗しました" }, 500);
  }
});

// POST /api/gas/upload
gasRoutes.post("/gas/upload", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const fileName = typeof body.fileName === "string" ? body.fileName : "";
  const content = typeof body.content === "string" ? body.content : "";
  const mimeType = typeof body.mimeType === "string" ? body.mimeType : "text/plain";
  const folderName = typeof body.folderName === "string" ? body.folderName : undefined;

  if (!fileName || !content) {
    return c.json({ error: "fileName と content は必須です" }, 400);
  }

  try {
    await getGasService().uploadFile(fileName, content, mimeType, folderName);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "アップロードに失敗しました" }, 500);
  }
});

// POST /api/gas/task
gasRoutes.post("/gas/task", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const task = typeof body.task === "string" ? body.task.trim() : "";

  if (!task) {
    return c.json({ error: "task は必須です" }, 400);
  }

  try {
    await getGasService().addTask(task);
    return c.json({ ok: true });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "タスク追加に失敗しました" }, 500);
  }
});

// GET /api/gas/project/tree
gasRoutes.get("/gas/project/tree", async (c) => {
  const maxDepth = c.req.query("maxDepth") ? Number(c.req.query("maxDepth")) : undefined;
  try {
    const tree = await getGasService().getProjectTree(maxDepth);
    return c.json({ tree });
  } catch (error) {
    return c.json({ error: error instanceof Error ? error.message : "プロジェクトツリー取得に失敗しました" }, 500);
  }
});
