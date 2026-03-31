import type { CalendarEvent, GasFile, GasTask } from "@kaisha/shared";

export interface GasConfig {
  endpoint: string;
  calendarUrl?: string;
  projectUrl?: string;
  enabled: boolean;
  calendarSync: boolean;
  taskSync: boolean;
  syncIntervalMinutes: number;
}

export interface GasServiceConfig {
  calendarUrl: string;
  projectUrl: string;
}

export class GasService {
  constructor(private config: GasServiceConfig) {}

  async getCalendar(days: number): Promise<CalendarEvent[]> {
    if (!this.config.calendarUrl) return [];
    const url = new URL(this.config.calendarUrl);
    url.searchParams.set("action", "calendar");
    url.searchParams.set("days", String(days));
    const payload = await fetchJson(url);
    return unwrapArray(payload, ["events", "data", "items"]).map(toCalendarEvent);
  }

  async listFiles(folderId?: string): Promise<GasFile[]> {
    if (!this.config.calendarUrl) return [];
    const url = new URL(this.config.calendarUrl);
    url.searchParams.set("action", "list");
    if (folderId) url.searchParams.set("folderId", folderId);
    const payload = await fetchJson(url);
    return unwrapArray(payload, ["files", "data", "items"]).map(toGasFile);
  }

  async downloadFile(fileId: string): Promise<string> {
    if (!this.config.calendarUrl) return "";
    const url = new URL(this.config.calendarUrl);
    url.searchParams.set("fileId", fileId);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GAS download failed: ${res.status}`);
    return res.text();
  }

  async uploadFile(fileName: string, content: string, mimeType: string, folderName?: string): Promise<void> {
    if (!this.config.calendarUrl) return;
    await fetchJson(this.config.calendarUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "upload", fileName, content, mimeType, folderName })
    });
  }

  async addTask(task: string): Promise<void> {
    if (!this.config.calendarUrl) return;
    await fetchJson(this.config.calendarUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add_task", task })
    });
  }

  async getProjectTree(maxDepth?: number): Promise<unknown> {
    if (!this.config.projectUrl) return null;
    const url = new URL(this.config.projectUrl);
    url.searchParams.set("action", "tree");
    if (maxDepth !== undefined) url.searchParams.set("maxDepth", String(maxDepth));
    return fetchJson(url);
  }

  async readSheet(fileId: string): Promise<unknown> {
    if (!this.config.projectUrl) return null;
    const url = new URL(this.config.projectUrl);
    url.searchParams.set("action", "readSheet");
    url.searchParams.set("fileId", fileId);
    return fetchJson(url);
  }

  async readDoc(fileId: string): Promise<string> {
    if (!this.config.projectUrl) return "";
    const url = new URL(this.config.projectUrl);
    url.searchParams.set("action", "readDoc");
    url.searchParams.set("fileId", fileId);
    const payload = await fetchJson(url);
    return typeof payload === "string" ? payload : JSON.stringify(payload);
  }
}

type UnknownRecord = Record<string, unknown>;

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim();
}

function ensureEndpoint(config: GasConfig): string {
  const endpoint = normalizeEndpoint(config.endpoint);
  if (!endpoint) {
    throw new Error("GASエンドポイントURLが未設定です");
  }
  return endpoint;
}

async function fetchJson(input: RequestInfo | URL, init?: RequestInit): Promise<unknown> {
  const response = await fetch(input, init);
  if (!response.ok) {
    throw new Error(`GAS request failed: ${response.status} ${response.statusText}`.trim());
  }
  return response.json().catch(() => null);
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toRecord(value: unknown): UnknownRecord {
  return value && typeof value === "object" ? (value as UnknownRecord) : {};
}

function toCalendarEvent(value: unknown, index: number): CalendarEvent {
  const record = toRecord(value);
  const title = typeof record.title === "string" ? record.title : typeof record.summary === "string" ? record.summary : `?? ${index + 1}`;
  const start = typeof record.start === "string" ? record.start : typeof record.startTime === "string" ? record.startTime : new Date().toISOString();
  const end = typeof record.end === "string" ? record.end : typeof record.endTime === "string" ? record.endTime : null;

  return {
    id: typeof record.id === "string" ? record.id : `calendar-${index}`,
    title,
    start,
    end,
    description: typeof record.description === "string" ? record.description : null,
    location: typeof record.location === "string" ? record.location : null
  };
}

function toGasTask(value: unknown, index: number): GasTask {
  const record = toRecord(value);
  return {
    id: typeof record.id === "string" ? record.id : `task-${index}`,
    title: typeof record.title === "string" ? record.title : typeof record.task === "string" ? record.task : `タスク ${index + 1}`,
    status: typeof record.status === "string" ? record.status : null,
    dueDate: typeof record.dueDate === "string" ? record.dueDate : null
  };
}

function toGasFile(value: unknown, index: number): GasFile {
  const record = toRecord(value);
  return {
    id: typeof record.id === "string" ? record.id : `file-${index}`,
    name: typeof record.name === "string" ? record.name : `file-${index + 1}`,
    mimeType: typeof record.mimeType === "string" ? record.mimeType : null,
    url: typeof record.url === "string" ? record.url : null,
    updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : null
  };
}

function unwrapArray(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  const record = toRecord(payload);
  for (const key of keys) {
    if (Array.isArray(record[key])) {
      return record[key] as unknown[];
    }
  }

  return [];
}

export async function fetchCalendar(config: GasConfig, days: number): Promise<CalendarEvent[]> {
  const endpoint = ensureEndpoint(config);
  const url = new URL(endpoint);
  url.searchParams.set("action", "calendar");
  url.searchParams.set("days", String(days));

  const payload = await fetchJson(url);
  return unwrapArray(payload, ["events", "data", "items"]).map(toCalendarEvent);
}

export async function fetchTasks(config: GasConfig): Promise<GasTask[]> {
  const endpoint = ensureEndpoint(config);
  const payload = await fetchJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "tasks" })
  }).catch(() => []);

  return unwrapArray(payload, ["tasks", "data", "items"]).map(toGasTask);
}

export async function addTask(config: GasConfig, task: string): Promise<void> {
  const endpoint = ensureEndpoint(config);
  await fetchJson(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "add_task", task })
  });
}

export async function listFiles(config: GasConfig, folderId?: string): Promise<GasFile[]> {
  const endpoint = ensureEndpoint(config);
  const url = new URL(endpoint);
  url.searchParams.set("action", "list");
  if (folderId) {
    url.searchParams.set("folderId", folderId);
  }

  const payload = await fetchJson(url);
  return unwrapArray(payload, ["files", "data", "items"]).map(toGasFile);
}
