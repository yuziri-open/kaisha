import type { AdapterType } from "@kaisha/shared";
import { Hono } from "hono";
import { claudeCodeAdapter } from "../adapters/claude-code.js";
import { codexAdapter } from "../adapters/codex.js";
import { httpAdapter } from "../adapters/http.js";
import { openclawAdapter } from "../adapters/openclaw.js";
import { shellAdapter } from "../adapters/shell.js";

type SupportedAdapterType = Extract<AdapterType, "claude_code" | "codex" | "shell" | "openclaw" | "http">;

const adapters: Record<SupportedAdapterType, { diagnose: () => Promise<{ ok: boolean; message: string }> }> = {
  claude_code: claudeCodeAdapter,
  codex: codexAdapter,
  shell: shellAdapter,
  openclaw: openclawAdapter,
  http: httpAdapter
};

export const adaptersRoutes = new Hono();

adaptersRoutes.post("/adapters/diagnose", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const adapterType = typeof body.adapterType === "string" ? body.adapterType : "";

  if (!isSupportedAdapterType(adapterType)) {
    return c.json({ error: "adapterType must be one of claude_code, codex, shell, openclaw, or http" }, 400);
  }

  try {
    const result = await adapters[adapterType].diagnose();
    return c.json(result);
  } catch (error) {
    return c.json({
      ok: false,
      message: error instanceof Error ? error.message : "Adapter diagnosis failed."
    });
  }
});

function isSupportedAdapterType(value: string): value is SupportedAdapterType {
  return value === "claude_code" || value === "codex" || value === "shell" || value === "openclaw" || value === "http";
}
