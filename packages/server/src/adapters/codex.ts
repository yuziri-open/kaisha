import { spawn } from "node:child_process";
import type { Adapter, DiagnosisResult, ExecutionContext, ExecutionResult } from "./types.js";

function runCodex(context: ExecutionContext): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const config = context.agent.adapterConfig ?? {};
  const model = typeof config.model === "string" ? config.model : "gpt-5.4-codex";
  const approval =
    typeof config.approvalMode === "string"
      ? config.approvalMode
      : typeof config.approval === "string"
        ? config.approval
        : "full-auto";
  const yolo = config.yolo === true || config.yolo === "true";
  const args = ["exec", context.prompt, "--model", model];

  if (approval === "full-auto") {
    args.push("--full-auto");
  } else {
    args.push("-a", approval);
  }

  if (yolo) {
    args.push("--yolo");
  }

  return new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: context.workingDir ?? process.cwd(),
      env: {
        ...process.env,
        ...context.env
      },
      stdio: ["ignore", "pipe", "pipe"],
      shell: true
    });

    let stdout = "";
    let stderr = "";
    let timeout: NodeJS.Timeout | undefined;

    if (context.timeoutMs) {
      timeout = setTimeout(() => {
        child.kill("SIGTERM");
      }, context.timeoutMs);
    }

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (timeout) {
        clearTimeout(timeout);
      }

      resolve({
        status: code === 0 ? "success" : "error",
        stdout,
        stderr,
        durationMs: Date.now() - startedAt
      });
    });
  });
}

async function diagnoseCodex(): Promise<DiagnosisResult> {
  try {
    await runCodex({
      agent: {
        id: "diag",
        companyId: "diag",
        name: "diag",
        role: "worker",
        title: null,
        capabilities: [],
        adapterType: "codex",
        adapterConfig: null,
        reportsTo: null,
        status: "idle",
        budgetMonthlyCents: 0,
        spentMonthlyCents: 0,
        lastHeartbeatAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      prompt: "Respond with OK.",
      timeoutMs: 10000
    });

    return { ok: true, message: "codex CLI is reachable." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "codex CLI failed." };
  }
}

export const codexAdapter: Adapter = {
  type: "codex",
  label: "OpenAI Codex",
  execute: runCodex,
  diagnose: diagnoseCodex
};
