import type { CalendarEvent, GasSettings, GasSyncResult } from "@kaisha/shared";
import { Hono } from "hono";
import { getSetting, nowIso, setSetting } from "../db/index.js";
import { fetchCalendar, fetchTasks, listFiles, type GasConfig } from "../services/gas.js";

const GAS_SETTINGS_KEY = "gas.config";
const GAS_LAST_SYNC_KEY = "gas.lastSyncAt";

const defaultGasSettings: GasSettings = {
  endpoint: "",
  calendarUrl: "",
  projectUrl: "",
  enabled: false,
  calendarSync: true,
  taskSync: false,
  syncIntervalMinutes: 30,
  lastSyncAt: null
};

function parseBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function getGasSettings(): GasSettings {
  const stored = getSetting<Record<string, unknown>>(GAS_SETTINGS_KEY) ?? {};
  return {
    endpoint: typeof stored.endpoint === "string" ? stored.endpoint : defaultGasSettings.endpoint,
    calendarUrl: typeof stored.calendarUrl === "string" ? stored.calendarUrl : defaultGasSettings.calendarUrl,
    projectUrl: typeof stored.projectUrl === "string" ? stored.projectUrl : defaultGasSettings.projectUrl,
    enabled: parseBoolean(stored.enabled, defaultGasSettings.enabled),
    calendarSync: parseBoolean(stored.calendarSync, defaultGasSettings.calendarSync),
    taskSync: parseBoolean(stored.taskSync, defaultGasSettings.taskSync),
    syncIntervalMinutes: Math.max(1, parseNumber(stored.syncIntervalMinutes, defaultGasSettings.syncIntervalMinutes)),
    lastSyncAt: getSetting<string>(GAS_LAST_SYNC_KEY) ?? null
  };
}

function toGasConfig(settings: GasSettings): GasConfig {
  return {
    endpoint: settings.endpoint,
    enabled: settings.enabled,
    calendarSync: settings.calendarSync,
    taskSync: settings.taskSync,
    syncIntervalMinutes: settings.syncIntervalMinutes
  };
}

function saveGasSettings(settings: GasSettings): GasSettings {
  const next = {
    ...settings,
    syncIntervalMinutes: Math.max(1, settings.syncIntervalMinutes)
  };
  setSetting(GAS_SETTINGS_KEY, {
    endpoint: next.endpoint,
    calendarUrl: next.calendarUrl,
    projectUrl: next.projectUrl,
    enabled: next.enabled,
    calendarSync: next.calendarSync,
    taskSync: next.taskSync,
    syncIntervalMinutes: next.syncIntervalMinutes
  });
  return getGasSettings();
}

async function runGasSync(settings: GasSettings): Promise<GasSyncResult> {
  if (!settings.enabled) {
    throw new Error("GAS連携が無効です");
  }
  if (!settings.endpoint.trim()) {
    throw new Error("GASエンドポイントURLが未設定です");
  }

  const config = toGasConfig(settings);
  const calendarEvents = settings.calendarSync ? await fetchCalendar(config, 7) : [];
  const tasks = settings.taskSync ? await fetchTasks(config) : [];
  const syncedAt = nowIso();
  setSetting(GAS_LAST_SYNC_KEY, syncedAt);

  return {
    ok: true,
    message: "GAS同期が完了しました",
    syncedAt,
    calendarEvents,
    tasks
  };
}

export async function getDashboardCalendar(): Promise<{ settings: GasSettings; calendarEvents: CalendarEvent[] }> {
  const settings = getGasSettings();
  if (!settings.enabled || !settings.calendarSync || !settings.endpoint.trim()) {
    return { settings, calendarEvents: [] };
  }

  try {
    const result = await runGasSync(settings);
    return { settings: { ...settings, lastSyncAt: result.syncedAt }, calendarEvents: result.calendarEvents };
  } catch {
    return { settings, calendarEvents: [] };
  }
}

export const settingsRoutes = new Hono();

settingsRoutes.get("/settings", (c) => c.json({ gas: getGasSettings() }));

settingsRoutes.put("/settings", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const gasBody = body.gas && typeof body.gas === "object" ? (body.gas as Record<string, unknown>) : body;
  const current = getGasSettings();
  const next = saveGasSettings({
    endpoint: typeof gasBody.endpoint === "string" ? gasBody.endpoint.trim() : current.endpoint,
    calendarUrl: typeof gasBody.calendarUrl === "string" ? gasBody.calendarUrl.trim() : current.calendarUrl,
    projectUrl: typeof gasBody.projectUrl === "string" ? gasBody.projectUrl.trim() : current.projectUrl,
    enabled: parseBoolean(gasBody.enabled, current.enabled),
    calendarSync: parseBoolean(gasBody.calendarSync, current.calendarSync),
    taskSync: parseBoolean(gasBody.taskSync, current.taskSync),
    syncIntervalMinutes: Math.max(1, parseNumber(gasBody.syncIntervalMinutes, current.syncIntervalMinutes)),
    lastSyncAt: current.lastSyncAt
  });

  return c.json({ gas: next });
});

settingsRoutes.post("/settings/gas/test", async (c) => {
  const settings = getGasSettings();
  if (!settings.endpoint.trim()) {
    return c.json({ ok: false, message: "GASエンドポイントURLが未設定です" }, 400);
  }

  try {
    await listFiles(toGasConfig({ ...settings, enabled: true }));
    return c.json({ ok: true, message: "GAS接続テスト成功" });
  } catch (error) {
    return c.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "GAS接続テストに失敗しました"
      },
      500
    );
  }
});

settingsRoutes.post("/settings/gas/sync", async (c) => {
  try {
    const result = await runGasSync(getGasSettings());
    return c.json(result);
  } catch (error) {
    return c.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "GAS同期に失敗しました",
        syncedAt: nowIso(),
        calendarEvents: [],
        tasks: []
      },
      500
    );
  }
});
