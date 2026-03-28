import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
import {
  getActivity,
  getAgents,
  getCronJobs,
  getDocs,
  getIntegrations,
  getProjects,
  getSystemInfo,
  getTasks,
} from "@/shared/lib/data";
import { useQuery } from "@tanstack/react-query";

export function useAgentsQuery() {
  useRealtimeInvalidation([{ table: "agent_team", queryKey: "agents" }]);
  return useQuery({ queryKey: ["agents"], queryFn: getAgents });
}

export function useProjectsQuery() {
  useRealtimeInvalidation([{ table: "tasks", queryKey: "projects" }]);
  return useQuery({ queryKey: ["projects"], queryFn: getProjects });
}

export function useTasksQuery() {
  useRealtimeInvalidation([{ table: "tasks", queryKey: "tasks" }]);
  return useQuery({ queryKey: ["tasks"], queryFn: getTasks });
}

export function useActivityQuery() {
  useRealtimeInvalidation([{ table: "agent_activity", queryKey: "activity" }]);
  return useQuery({ queryKey: ["activity"], queryFn: getActivity });
}

export function useDocsQuery() {
  useRealtimeInvalidation([{ table: "documents", queryKey: "docs" }]);
  return useQuery({ queryKey: ["docs"], queryFn: getDocs });
}

export function useIntegrationsQuery() {
  return useQuery({ queryKey: ["integrations"], queryFn: getIntegrations });
}

export function useCronJobsQuery() {
  return useQuery({ queryKey: ["cron-jobs"], queryFn: getCronJobs });
}

export function useSystemInfoQuery() {
  return useQuery({ queryKey: ["system-info"], queryFn: getSystemInfo });
}
