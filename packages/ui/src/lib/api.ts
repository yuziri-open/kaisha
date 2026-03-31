import type {
  Activity,
  Agent,
  AgentRole,
  AdapterType,
  Company,
  DashboardResponse,
  GasSettings,
  GasSyncResult,
  GasTestResult,
  Project,
  Task,
  TaskStatus
} from "@kaisha/shared";

const BASE_URL = "/api";

export type SupportedAdapterType = Extract<AdapterType, "claude_code" | "codex" | "shell">;

export type CreateCompanyInput = {
  name: string;
  description?: string | null;
};

export type CreateAgentInput = {
  name: string;
  role: AgentRole;
  adapterType: SupportedAdapterType;
  adapterConfig: Record<string, unknown>;
};

export type AdapterDiagnosis = {
  ok: boolean;
  message: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

async function request<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const { body: requestBody, headers, ...rest } = init;
  const body = requestBody === undefined ? undefined : JSON.stringify(requestBody);

  const response = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    ...(body === undefined ? {} : { body })
  });

  if (!response.ok) {
    const fallback = `${response.status} ${response.statusText}`.trim();
    const payload = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiError(payload?.error ?? payload?.message ?? fallback, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const statusLabels: Record<string, string> = {
  backlog: "バックログ",
  todo: "着手可能",
  in_progress: "進行中",
  in_review: "レビュー待ち",
  done: "完了",
  cancelled: "キャンセル"
};

export const api = {
  listCompanies: () => request<Company[]>("/companies"),
  createCompany: (payload: CreateCompanyInput) =>
    request<Company>("/companies", {
      method: "POST",
      body: payload
    }),
  getAgents: (companyId: string) => request<Agent[]>(`/companies/${companyId}/agents`),
  createAgent: (companyId: string, payload: CreateAgentInput) =>
    request<Agent>(`/companies/${companyId}/agents`, {
      method: "POST",
      body: payload
    }),
  deleteAgent: (agentId: string) =>
    request<void>(`/agents/${agentId}`, {
      method: "DELETE"
    }),
  getTasks: (companyId: string) => request<Task[]>(`/companies/${companyId}/tasks`),
  getProjects: (companyId: string) => request<Project[]>(`/companies/${companyId}/projects`),
  getDashboard: (companyId: string) => request<DashboardResponse>(`/companies/${companyId}/dashboard`),
  getActivity: (companyId: string) => request<Activity[]>(`/companies/${companyId}/activity`),
  diagnoseAdapter: (adapterType: SupportedAdapterType) =>
    request<AdapterDiagnosis>("/adapters/diagnose", {
      method: "POST",
      body: { adapterType }
    }),
  createTask: (companyId: string, payload: Partial<Task>) =>
    request<Task>(`/companies/${companyId}/tasks`, {
      method: "POST",
      body: payload
    }),
  updateTask: (
    taskId: string,
    payload: Partial<
      Pick<Task, "status" | "title" | "description" | "priority" | "assigneeId" | "projectId" | "parentId">
    >
  ) =>
    request<Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: payload
    }),
  getSettings: () => request<{ gas: GasSettings }>("/settings"),
  updateSettings: (payload: { gas: Omit<GasSettings, "lastSyncAt"> | GasSettings }) =>
    request<{ gas: GasSettings }>("/settings", {
      method: "PUT",
      body: payload
    }),
  testGasConnection: () =>
    request<GasTestResult>("/settings/gas/test", {
      method: "POST"
    }),
  syncGas: () =>
    request<GasSyncResult>("/settings/gas/sync", {
      method: "POST"
    })
};

export const kanbanStatuses: TaskStatus[] = ["backlog", "todo", "in_progress", "in_review", "done"];
