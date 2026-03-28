import { useActivityQuery, useAgentsQuery } from "@/shared/hooks/use-command-center-data";
import { formatRelativeTime } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMemo, useState } from "react";

export function ActivityPage() {
  const agentsQuery = useAgentsQuery();
  const activityQuery = useActivityQuery();
  const [agentId, setAgentId] = useState("all");
  const [windowHours, setWindowHours] = useState("24");

  const agents = agentsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  const filteredActivity = useMemo(() => {
    const threshold = Date.now() - Number(windowHours) * 60 * 60 * 1000;
    return activity.filter((item) => {
      const matchesAgent = agentId === "all" || item.agent_id === agentId;
      const matchesDate = new Date(item.created_at).getTime() >= threshold;
      return matchesAgent && matchesDate;
    });
  }, [activity, agentId, windowHours]);

  if (agentsQuery.isError || activityQuery.isError) {
    return <ErrorState title="Activity unavailable" description="Timeline data could not be loaded." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Activity"
        title="Realtime event timeline"
        description="Live chronology with agent and time filtering, backed by Supabase invalidation subscriptions."
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="sm:w-44">
              <option value="all">All agents</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </Select>
            <Select value={windowHours} onChange={(event) => setWindowHours(event.target.value)} className="sm:w-40">
              <option value="6">Last 6 hours</option>
              <option value="24">Last 24 hours</option>
              <option value="72">Last 72 hours</option>
            </Select>
          </div>
        }
      />

      <Card className="p-6">
        <div className="space-y-4">
          {activityQuery.isLoading
            ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
            : filteredActivity.map((item) => {
                const agent = agents.find((candidate) => candidate.id === item.agent_id);
                return (
                  <div key={item.id} className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[160px_1fr_auto] md:items-start">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(item.created_at)}</p>
                      <p className="mt-2 text-sm text-slate-300">{agent?.name ?? "System"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-white">{item.title}</p>
                      <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge>{item.type}</Badge>
                      <Badge tone={item.level === "warning" ? "warning" : item.level === "critical" ? "danger" : "success"}>
                        {item.level}
                      </Badge>
                    </div>
                  </div>
                );
              })}
          {!activityQuery.isLoading && filteredActivity.length === 0 && (
            <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No events match the selected filters.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
