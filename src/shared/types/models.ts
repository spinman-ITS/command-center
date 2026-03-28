export type AgentStatus = "online" | "focus" | "offline" | "degraded";
export type TaskStatus = "backlog" | "in_progress" | "blocked" | "review" | "completed";
export type ActivityLevel = "info" | "warning" | "critical" | "success";

export interface Agent {
  id: string;
  name: string;
  role: string;
  status: AgentStatus;
  color: string;
  avatar_url: string | null;
  workload: number;
  throughput: number;
  accuracy: number;
  projects_count: number;
  response_time_ms: number;
  last_seen_at: string;
  specialty: string;
}

export interface Project {
  id: string;
  name: string;
  summary: string;
  source: string;
  health: "healthy" | "watch" | "risk";
  owner_agent_id: string | null;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  project_name: string;
  source: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high" | "urgent";
  assignee_agent_id: string | null;
  progress: number;
  due_at: string | null;
  tags: string[] | null;
  updated_at: string;
}

export interface ActivityItem {
  id: string;
  agent_id: string | null;
  project_name: string | null;
  title: string;
  description: string;
  level: ActivityLevel;
  created_at: string;
  type: string;
}

export interface DocumentRecord {
  id: string;
  title: string;
  category: string;
  type: string;
  content: string;
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
  status: "healthy" | "paused" | "failing";
}

export interface SystemInfo {
  id: string;
  region: string;
  version: string;
  uptime_hours: number;
  queue_depth: number;
  throughput_per_hour: number;
}
