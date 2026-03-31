import { spawn } from "node:child_process";
import type { Adapter, DiagnosisResult, ExecutionContext, ExecutionResult } from "./types.js";

function runClaude(context: ExecutionContext): Promise<ExecutionResult> {
  const startedAt = Date.now();
  const config = context.agent.adapterConfig ?? {};
  const model = typeof config.model === "string" ? config.model : "claude-sonnet-4-20250514";
  const permissionMode = typeof config.permissionMode === "string" ? config.permissionMode : undefined;
  const budgetMonthlyCents = context.agent.budgetMonthlyCents;
  const args = ["-p", "--output-format", "json", "--model", model];

  if (permissionMode === "skip" || permissionMode === "dangerously-skip-permissions") {
    args.push("--dangerously-skip-permissions");
  } else if (permissionMode && permissionMode !== "default") {
    args.push("--permission-mode", permissionMode);
  }

  if (budgetMonthlyCents > 0) {
    const budgetUsd = (budgetMonthlyCents / 100).toFixed(2);
    args.push("--max-budget-usd", budgetUsd);
  }

  args.push(context.prompt);

  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, {
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

      const durationMs = Date.now() - startedAt;
      const parsed = (() => {
        try {
          return JSON.parse(stdout) as { content?: string; usage?: { input_tokens?: number; output_tokens?: number } };
        } catch {
          return null;
        }
      })();
      const tokensUsed = parsed?.usage
        ? (parsed.usage.input_tokens ?? 0) + (parsed.usage.output_tokens ?? 0)
        : undefined;

      resolve({
        status: code === 0 ? "success" : "error",
        stdout: parsed?.content ?? stdout,
        stderr,
        durationMs,
        ...(tokensUsed === undefined ? {} : { tokensUsed })
      });
    });
  });
}

async function diagnoseClaude(): Promise<DiagnosisResult> {
  try {
    await runClaude({
      agent: {
        id: "diag",
        companyId: "diag",
        name: "diag",
        role: "worker",
        title: null,
        capabilities: [],
        adapterType: "claude_code",
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

    return { ok: true, message: "claude CLI is reachable." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "claude CLI failed." };
  }
}

export const claudeCodeAdapter: Adapter = {
  type: "claude_code",
  label: "Claude Code",
  execute: runClaude,
  diagnose: diagnoseClaude
};
