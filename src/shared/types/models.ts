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
  testing_instructions: string | null;
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
  job_id?: string;
  name: string;
  schedule: string;
  agent_id?: string | null;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status?: string | null;
  last_duration_ms?: number | null;
  error?: string | null;
  consecutive_errors?: number | null;
  created_at?: string;
  updated_at?: string;
  status?: string | null;
}

export interface AutomationRecord {
  id: string;
  name: string;
  description: string | null;
  type: string | null;
  platform: string | null;
  status: string;
  assigned_to: string | null;
  trigger_type: string | null;
  frequency: string | null;
  integrations: string[] | null;
  priority: string | null;
  systems_requirements: string | null;
  expected_behavior: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}
