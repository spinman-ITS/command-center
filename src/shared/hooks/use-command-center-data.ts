import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
import { getActivity, getAgents, getAutomations, getContentDeliverables, getCronJobs, getDocs, getIntegrations, getTasks } from "@/shared/lib/data";
import { useQuery } from "@tanstack/react-query";

export function useAgentsQuery() {
  useRealtimeInvalidation([{ table: "agent_team", queryKey: "agents" }]);
  return useQuery({ queryKey: ["agents"], queryFn: getAgents });
}

export function useTasksQuery() {
  useRealtimeInvalidation([{ table: "tasks", queryKey: "tasks" }]);
  return useQuery({ queryKey: ["tasks"], queryFn: getTasks });
}

export function useActivityQuery(limit = 50) {
  useRealtimeInvalidation([{ table: "agent_activity", queryKey: "activity", exactKey: ["activity", limit] }]);
  return useQuery({ queryKey: ["activity", limit], queryFn: () => getActivity(limit) });
}

export function useDocsQuery() {
  useRealtimeInvalidation([{ table: "documents", queryKey: "docs" }]);
  return useQuery({ queryKey: ["docs"], queryFn: getDocs });
}

export function useContentDeliverables() {
  useRealtimeInvalidation([{ table: "content_deliverables", queryKey: "content-deliverables" }]);
  return useQuery({ queryKey: ["content-deliverables"], queryFn: getContentDeliverables });
}

export function useIntegrationsQuery() {
  return useQuery({ queryKey: ["integrations"], queryFn: getIntegrations });
}

export function useCronJobsQuery() {
  useRealtimeInvalidation([{ table: "cron_jobs", queryKey: "cron-jobs" }]);
  return useQuery({ queryKey: ["cron-jobs"], queryFn: getCronJobs });
}

export function useAutomationsQuery() {
  useRealtimeInvalidation([{ table: "automations", queryKey: "automations" }]);
  return useQuery({ queryKey: ["automations"], queryFn: getAutomations });
}
