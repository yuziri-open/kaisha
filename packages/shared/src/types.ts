export type AgentRole = "ceo" | "manager" | "worker";
export type AgentStatus = "idle" | "running" | "error" | "paused";
export type AdapterType = "claude_code" | "codex" | "shell" | "http" | "openclaw";
export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "in_review"
  | "done"
  | "cancelled";
export type TaskPriority = "critical" | "high" | "medium" | "low";
export type ProjectStatus = "active" | "archived";
export type RunStatus = "running" | "success" | "error" | "cancelled";

export interface Company {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Agent {
  id: string;
  companyId: string;
  name: string;
  role: AgentRole;
  title: string | null;
  capabilities: string[];
  adapterType: AdapterType;
  adapterConfig: Record<string, unknown> | null;
  reportsTo: string | null;
  status: AgentStatus;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  companyId: string;
  projectId: string | null;
  parentId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  taskNumber: number | null;
  identifier: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  workspacePath: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Run {
  id: string;
  agentId: string;
  taskId: string | null;
  status: RunStatus;
  adapterType: AdapterType;
  stdout: string | null;
  stderr: string | null;
  costCents: number;
  tokensUsed: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

export interface Activity {
  id: string;
  companyId: string;
  agentId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummary {
  tasksTotal: number;
  tasksInProgress: number;
  tasksInReview: number;
  tasksDoneToday: number;
  agentsTotal: number;
  agentsOnline: number;
  monthlyCostCents: number;
}

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string | null;
  description: string | null;
  location: string | null;
}

export interface GasFile {
  id: string;
  name: string;
  mimeType: string | null;
  url: string | null;
  updatedAt: string | null;
}

export interface GasTask {
  id: string;
  title: string;
  status: string | null;
  dueDate: string | null;
}

export interface GasSettings {
  endpoint: string;
  calendarUrl: string;
  projectUrl: string;
  enabled: boolean;
  calendarSync: boolean;
  taskSync: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
}

export interface GasTestResult {
  ok: boolean;
  message: string;
}

export interface GasSyncResult {
  ok: boolean;
  message: string;
  syncedAt: string;
  calendarEvents: CalendarEvent[];
  tasks: GasTask[];
}

export interface DashboardResponse {
  company: Company;
  summary: DashboardSummary;
  tasksByStatus: Record<TaskStatus, Task[]>;
  agents: Agent[];
  projects: Project[];
  recentActivity: Activity[];
  gasSettings: GasSettings;
  calendarEvents: CalendarEvent[];
}
