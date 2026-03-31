import type { Adapter, DiagnosisResult, ExecutionContext, ExecutionResult } from "./types.js";

const DEFAULT_GATEWAY_URL = "http://localhost:18789";
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 300_000;

interface SessionResponse {
  sessionKey?: string;
  session_key?: string;
  id?: string;
  key?: string;
}

interface SessionStatus {
  status?: string;
  state?: string;
  output?: string;
  result?: string;
  error?: string;
}

async function runOpenclaw(context: ExecutionContext): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const config = context.agent.adapterConfig ?? {};
  const gatewayUrl = typeof config.gatewayUrl === "string" ? config.gatewayUrl : DEFAULT_GATEWAY_URL;
  const runtime = typeof config.runtime === "string" ? config.runtime : "subagent";
  const mode = typeof config.mode === "string" ? config.mode : "run";
  const timeoutMs = context.timeoutMs ?? POLL_TIMEOUT_MS;

  // セッション作成
  const createRes = await fetch(`${gatewayUrl}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ task: context.prompt, runtime, mode })
  });

  if (!createRes.ok) {
    const text = await createRes.text().catch(() => "");
    return {
      status: "error",
      stdout: "",
      stderr: `OpenClaw Gateway error: ${createRes.status} ${createRes.statusText} ${text}`.trim(),
      durationMs: Date.now() - startedAt
    };
  }

  const created = (await createRes.json()) as SessionResponse;
  const sessionKey = created.sessionKey ?? created.session_key ?? created.id ?? created.key;

  if (!sessionKey) {
    return {
      status: "error",
      stdout: "",
      stderr: "OpenClaw Gateway: セッションキーが取得できませんでした。",
      durationMs: Date.now() - startedAt
    };
  }

  // ポーリングで完了待ち
  const deadline = startedAt + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    const pollRes = await fetch(`${gatewayUrl}/api/sessions/${sessionKey}`, {
      headers: { "Content-Type": "application/json" }
    }).catch(() => null);

    if (!pollRes || !pollRes.ok) {
      continue;
    }

    const status = (await pollRes.json()) as SessionStatus;
    const state = status.status ?? status.state ?? "";

    if (state === "done" || state === "completed" || state === "success") {
      return {
        status: "success",
        stdout: status.output ?? status.result ?? "",
        stderr: "",
        durationMs: Date.now() - startedAt
      };
    }

    if (state === "error" || state === "failed") {
      return {
        status: "error",
        stdout: status.output ?? "",
        stderr: status.error ?? "OpenClaw Gateway: エラーが発生しました。",
        durationMs: Date.now() - startedAt
      };
    }
  }

  return {
    status: "error",
    stdout: "",
    stderr: `OpenClaw Gateway: タイムアウト (${timeoutMs}ms)`,
    durationMs: Date.now() - startedAt
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function diagnoseOpenclaw(): Promise<DiagnosisResult> {
  const gatewayUrl = DEFAULT_GATEWAY_URL;
  try {
    const res = await fetch(`${gatewayUrl}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      return { ok: true, message: `OpenClaw Gateway is reachable at ${gatewayUrl}` };
    }
    return { ok: false, message: `OpenClaw Gateway responded with ${res.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : `OpenClaw Gateway unreachable at ${gatewayUrl}` };
  }
}

export const openclawAdapter: Adapter = {
  type: "openclaw",
  label: "OpenClaw Gateway",
  execute: runOpenclaw,
  diagnose: diagnoseOpenclaw
};
