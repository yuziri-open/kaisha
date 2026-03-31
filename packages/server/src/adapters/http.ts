import type { Adapter, DiagnosisResult, ExecutionContext, ExecutionResult } from "./types.js";

async function runHttp(context: ExecutionContext): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const config = context.agent.adapterConfig ?? {};
  const url = typeof config.url === "string" ? config.url : "";
  const method = typeof config.method === "string" ? config.method.toUpperCase() : "POST";
  const extraHeaders: Record<string, string> =
    config.headers && typeof config.headers === "object" && !Array.isArray(config.headers)
      ? (config.headers as Record<string, string>)
      : {};

  if (!url) {
    return {
      status: "error",
      stdout: "",
      stderr: "HTTP Adapterの設定にURLが指定されていません。",
      durationMs: Date.now() - startedAt
    };
  }

  const body = JSON.stringify({
    prompt: context.prompt,
    agentId: context.agent.id,
    agentName: context.agent.name,
    taskId: context.task?.id ?? null,
    taskTitle: context.task?.title ?? null,
    workingDir: context.workingDir ?? null
  });

  try {
    const fetchInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders
      }
    };
    if (method !== "GET") fetchInit.body = body;
    if (context.timeoutMs) fetchInit.signal = AbortSignal.timeout(context.timeoutMs);

    const res = await fetch(url, fetchInit);

    const text = await res.text().catch(() => "");

    return {
      status: res.ok ? "success" : "error",
      stdout: text,
      stderr: res.ok ? "" : `HTTP ${res.status} ${res.statusText}`.trim(),
      durationMs: Date.now() - startedAt
    };
  } catch (error) {
    return {
      status: "error",
      stdout: "",
      stderr: error instanceof Error ? error.message : "HTTP リクエストに失敗しました。",
      durationMs: Date.now() - startedAt
    };
  }
}

async function diagnoseHttp(): Promise<DiagnosisResult> {
  return { ok: true, message: "HTTP Adapterは設定されたURLにリクエストを送信します。URLをアダプター設定で指定してください。" };
}

export const httpAdapter: Adapter = {
  type: "http",
  label: "HTTP Webhook",
  execute: runHttp,
  diagnose: diagnoseHttp
};
