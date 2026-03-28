import { supabase } from "@/integrations/supabase/client";
import {
  mockActivity,
  mockAgents,
  mockCronJobs,
  mockDocs,
  mockIntegrations,
  mockProjects,
  mockSystemInfo,
  mockTasks,
} from "@/shared/lib/mock-data";
import type {
  ActivityItem,
  Agent,
  CronJob,
  DocumentRecord,
  IntegrationRecord,
  Project,
  SystemInfo,
  Task,
} from "@/shared/types/models";

async function selectOrFallback<T extends object>(table: string, fallback: T[], orderColumn?: string) {
  if (!supabase) return fallback;

  const query = supabase.from(table).select("*");
  const response = orderColumn ? await query.order(orderColumn, { ascending: false }) : await query;

  if (response.error || !response.data?.length) {
    return fallback;
  }

  return response.data as T[];
}

export function getAgents() {
  return selectOrFallback<Agent>("agent_team", mockAgents);
}

export function getProjects() {
  return selectOrFallback<Project>("projects", mockProjects, "updated_at");
}

export function getTasks() {
  return selectOrFallback<Task>("tasks", mockTasks, "updated_at");
}

export function getActivity() {
  return selectOrFallback<ActivityItem>("agent_activity", mockActivity, "created_at");
}

export function getDocs() {
  return selectOrFallback<DocumentRecord>("documents", mockDocs, "updated_at");
}

export function getIntegrations() {
  return selectOrFallback<IntegrationRecord>("integrations", mockIntegrations);
}

export function getCronJobs() {
  return selectOrFallback<CronJob>("cron_jobs", mockCronJobs);
}

export function getSystemInfo() {
  return selectOrFallback<SystemInfo>("system_info", mockSystemInfo);
}
