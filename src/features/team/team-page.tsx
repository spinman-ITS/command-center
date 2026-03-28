import { useActivityQuery, useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { getAgentColor } from "@/shared/lib/agent-colors";
import { formatPercent, formatRelativeTime } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useState } from "react";

export function TeamPage() {
  const agentsQuery = useAgentsQuery();
  const activityQuery = useActivityQuery();
  const tasksQuery = useTasksQuery();
  const agents = agentsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (agentsQuery.isError || activityQuery.isError || tasksQuery.isError) {
    return <ErrorState title="Team unavailable" description="Agent, activity, or task data could not be loaded." />;
  }

  const selectedAgent = agents.find((agent) => agent.id === (selectedId ?? agents[0]?.id)) ?? agents[0];
  const tasks = (tasksQuery.data ?? []).filter((task) => task.assignee_agent_id === selectedAgent?.id);
  const activity = (activityQuery.data ?? []).filter((item) => item.agent_id === selectedAgent?.id);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Team"
        title="Agent roster"
        description="Grid view plus a live detail panel for specialist performance, workload, and recent execution."
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.95fr]">
        <div className="grid gap-4 md:grid-cols-2">
          {agentsQuery.isLoading
            ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-56 rounded-3xl" />)
            : agents.map((agent) => (
                <button key={agent.id} className="text-left" onClick={() => setSelectedId(agent.id)}>
                  <Card
                    className="h-full p-5 transition hover:-translate-y-0.5 hover:border-white/16"
                    style={{
                      background:
                        selectedAgent?.id === agent.id
                          ? `linear-gradient(140deg, ${agent.color}24, rgba(11,15,25,0.96))`
                          : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex size-12 items-center justify-center rounded-2xl text-sm font-semibold text-slate-950" style={{ backgroundColor: getAgentColor(agent.color) }}>
                          {agent.name.slice(0, 2)}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
                          <p className="text-sm text-slate-400">{agent.role}</p>
                        </div>
                      </div>
                      <Badge tone={agent.status === "degraded" ? "warning" : "success"}>{agent.status}</Badge>
                    </div>
                    <p className="mt-4 text-sm text-slate-400">{agent.specialty}</p>
                    <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                      <MiniStat label="Workload" value={formatPercent(agent.workload)} />
                      <MiniStat label="Accuracy" value={formatPercent(agent.accuracy)} />
                      <MiniStat label="Projects" value={String(agent.projects_count)} />
                    </div>
                  </Card>
                </button>
              ))}
        </div>

        <Card className="p-6">
          {!selectedAgent ? (
            <Skeleton className="h-80 rounded-3xl" />
          ) : (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Selected Agent</p>
                  <h2 className="mt-2 text-3xl font-semibold text-white">{selectedAgent.name}</h2>
                  <p className="mt-1 text-sm text-slate-400">{selectedAgent.role}</p>
                </div>
                <div className="rounded-3xl px-4 py-3 text-right" style={{ backgroundColor: `${selectedAgent.color}22` }}>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Last seen</p>
                  <p className="mt-1 text-sm text-white">{formatRelativeTime(selectedAgent.last_seen_at)}</p>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <MiniStat label="Throughput/hr" value={String(selectedAgent.throughput)} />
                <MiniStat label="Response" value={`${selectedAgent.response_time_ms}ms`} />
                <MiniStat label="Assigned" value={String(tasks.length)} />
                <MiniStat label="Accuracy" value={formatPercent(selectedAgent.accuracy)} />
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Assigned Tasks</p>
                  <div className="mt-3 space-y-3">
                    {tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <p className="font-medium text-white">{task.title}</p>
                          <Badge>{task.status.replace("_", " ")}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-slate-400">{task.project_name}</p>
                      </div>
                    ))}
                    {tasks.length === 0 && <p className="text-sm text-slate-500">No assigned tasks.</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent Activity</p>
                  <div className="mt-3 space-y-3">
                    {activity.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      </div>
                    ))}
                    {activity.length === 0 && <p className="text-sm text-slate-500">No recent activity for this agent.</p>}
                  </div>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}
