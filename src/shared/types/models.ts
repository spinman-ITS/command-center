export type TaskStatus = "backlog" | "up_next" | "in_progress" | "qa" | "blocked" | "review" | "completed";

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  role: string;
  model: string;
  color: string;
  emoji: string;
  workspace: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityItem {
  id: string;
  agent_id: string;
  action: string;
  details: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QaTestResult {
  name: string;
  status: 'pass' | 'fail';
  screenshot?: string;
  notes?: string;
}

export interface QaResults {
  status: 'pass' | 'fail' | 'partial';
  tested_at: string;
  tested_by: string;
  summary: string;
  tests: QaTestResult[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: string;
  assigned_to: string;
  source: string;
  source_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  qa_results: QaResults | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  content: string;
  doc_type: string;
  category: string;
  tags: string[];
  file_path: string;
  created_at: string;
  updated_at: string;
}

export interface IntegrationRecord {
  id: string;
  name: string;
  status: "connected" | "degraded" | "disconnected";
  description: string;
  latency_ms: number;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status?: string | null;
  status?: "healthy" | "paused" | "failing";
}
