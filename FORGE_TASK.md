# Forge タスク: KAISHA 実装改善

## 1. アダプター修正

### claude-code.ts の問題点と修正
- ✅ `-p` (--print) フラグは正しい
- ✅ `--output-format json` は正しい
- ✅ `--model` は正しい
- ✅ `--permission-mode` は正しい
- 追加: `--max-budget-usd` オプション対応（budget_monthly_cents から計算）
- 追加: `--dangerously-skip-permissions` オプション（permissionModeがskipの場合）
- 修正: spawnのshellオプション追加（Windows対応: shell: true）
  - Windowsでは `claude.exe` のパスが `C:\Users\coli8\.local\bin\claude.exe`
  - spawn で shell: true にすればPATH経由で解決

### codex.ts の問題点と修正
- ✅ `exec` サブコマンドは正しい
- ✅ `--model` は正しい  
- ❌ `--approval-mode` は間違い → 正しくは `-a` または `--approval` (never|on-request|...)
- ❌ `--cwd` フラグは存在しない → codex exec は cwd を spawn の cwd オプションで制御
- 追加: `--full-auto` フラグ対応（approval: "full-auto" の場合は --full-auto をつけてapproval引数を省く）
- 追加: `--yolo` フラグ対応（sandbox なし）
- 修正: spawnにshell: true 追加（Windows対応）

### shell.ts
- shell: true をデフォルトにする（Windows PowerShell対応）

### 新規: openclaw.ts アダプター追加
OpenClaw Gateway に REST で接続するアダプター。
```typescript
// POST http://localhost:18789/api/sessions
// body: { task: "プロンプト", runtime: "subagent", mode: "run" }
// レスポンスからsessionKeyを取得
// → ポーリングで完了を待つ or SSE
```
OpenClawのGateway APIフォーマット:
- URL: `http://localhost:18789` (デフォルト) 
- 実際のエンドポイントは調査が必要なのでまずはHTTPアダプターをベースに

### 新規: http.ts アダプター追加
汎用HTTP POST アダプター。任意のWebhookにタスクを送信。

## 2. エージェント削除のUI対応

### packages/ui/src/pages/agents.tsx
- エージェント一覧のカードに「削除」ボタン追加（ゴミ箱アイコン）
- 確認ダイアログ:「[エージェント名]を解雇しますか？」
- DELETE /api/agents/:id を呼んで一覧をrefetch
- サーバー側のDELETE APIは既に実装済み

## 3. GAS接続の事前コード

### packages/server/src/services/gas.ts を改修
GASのエンドポイントURLを設定ファイルから読み込み:
- カレンダー取得: GET ?action=calendar&days=7
- タスク一覧: GET ?action=list
- ファイルダウンロード: GET ?fileId=XXX
- ファイルアップロード: POST (JSON body)
- タスク追加: POST action=add_task

```typescript
export interface GasConfig {
  calendarUrl: string;   // GAS endpoint for calendar/tasks
  projectUrl: string;    // GAS endpoint for project folder
}

export class GasService {
  constructor(private config: GasConfig) {}
  
  async getCalendar(days: number): Promise<CalendarEvent[]> {
    const res = await fetch(`${this.config.calendarUrl}?action=calendar&days=${days}`);
    // redirect follow (-L相当)は fetchがデフォルトで対応
    const data = await res.json();
    return data.events;
  }
  
  async listFiles(folderId?: string): Promise<FileItem[]> { ... }
  async downloadFile(fileId: string): Promise<string> { ... }
  async uploadFile(fileName: string, content: string, mimeType: string, folderName?: string): Promise<void> { ... }
  async addTask(task: string): Promise<void> { ... }
  
  // Project folder GAS
  async getProjectTree(maxDepth?: number): Promise<any> { ... }
  async readSheet(fileId: string): Promise<any> { ... }
  async readDoc(fileId: string): Promise<string> { ... }
}
```

### packages/server/src/routes/gas.ts — GAS APIルート
```
GET  /api/gas/calendar?days=7
GET  /api/gas/files?folderId=XXX
POST /api/gas/upload
POST /api/gas/task
GET  /api/gas/project/tree
```

### packages/ui/src/pages/settings.tsx にGAS設定フォーム追加
- GASカレンダーURL入力欄
- GASプロジェクトURL入力欄
- 接続テストボタン
- SQLiteのsettingsテーブルに保存

### packages/server/src/db/ にsettingsテーブル追加
```sql
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);
```

## 4. 起動確認

タスク完了後:
1. npm install が通ること
2. npm run dev:server が起動すること（ポート4000）
3. npm run dev:ui が起動すること（ポート5173）
4. ブラウザで http://localhost:5173 が表示されること

## 制約
- 既存コードの構造を維持
- Hono + Drizzle + shadcn/ui のスタックを維持
- 全UIテキスト日本語
- Windows環境で動くこと（shell: true）
