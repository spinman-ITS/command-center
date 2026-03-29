import { supabase } from "@/integrations/supabase/client";
import type { ActivityItem, Agent, CronJob, DocumentRecord, IntegrationRecord, Task } from "@/shared/types/models";

async function selectOrFallback<T extends object>(table: string, orderColumn?: string): Promise<T[]> {
  if (!supabase) return [];
  const query = supabase.from(table).select("*");
  const response = orderColumn ? await query.order(orderColumn, { ascending: false }) : await query;
  if (response.error || !response.data?.length) return [];
  return response.data as T[];
}

export function getAgents() {
  return selectOrFallback<Agent>("agent_team", "updated_at");
}

export function getTasks() {
  return selectOrFallback<Task>("tasks", "updated_at");
}

export async function getActivity(limit = 50) {
  if (!supabase) return [] as ActivityItem[];
  const response = await supabase.from("agent_activity").select("*").order("created_at", { ascending: false }).limit(limit);
  if (response.error || !response.data?.length) return [];
  return response.data as ActivityItem[];
}

export function getDocs() {
  return selectOrFallback<DocumentRecord>("documents", "updated_at");
}

export function getIntegrations() {
  return selectOrFallback<IntegrationRecord>("integrations");
}

export function getCronJobs() {
  return selectOrFallback<CronJob>("cron_jobs");
}

// ── Task mutations ──────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  assigned_to?: string;
  source?: string;
  status?: string;
}

export async function createTask(input: CreateTaskInput): Promise<Task | null> {
  if (!supabase) return null;
  const response = await supabase
    .from("tasks")
    .insert({
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "medium",
      assigned_to: input.assigned_to ?? "",
      source: input.source ?? "",
      status: input.status ?? "backlog",
    })
    .select()
    .single();
  if (response.error) throw response.error;
  return response.data as Task;
}

export async function updateTask(id: string, updates: Partial<Omit<Task, "id" | "created_at">>): Promise<Task | null> {
  if (!supabase) return null;
  const response = await supabase.from("tasks").update(updates).eq("id", id).select().single();
  if (response.error) throw response.error;
  return response.data as Task;
}

export async function deleteTask(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
