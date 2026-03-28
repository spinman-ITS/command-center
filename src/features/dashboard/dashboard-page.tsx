import { useActivityQuery, useAgentsQuery, useProjectsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { getAgentColor } from "@/shared/lib/agent-colors";
import { formatPercent, formatRelativeTime } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Bolt, ChevronRight, Play, Radar, ShieldCheck, Sparkles } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";

export function DashboardPage() {
  const agentsQuery = useAgentsQuery();
  const tasksQuery = useTasksQuery();
  const activityQuery = useActivityQuery();
  const projectsQuery = useProjectsQuery();

  if (agentsQuery.isError || tasksQuery.isError || activityQuery.isError || projectsQuery.isError) {
    return <ErrorState title="Dashboard unavailable" description="One or more command center data sources failed to load." />;
  }

  const agents = agentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const projects = projectsQuery.data ?? [];

  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const activeAgents = agents.filter((agent) => agent.status !== "offline").length;
  const blockedTasks = tasks.filter((task) => task.status === "blocked").length;
  const avgAccuracy = agents.length
    ? Math.round(agents.reduce((sum, agent) => sum + agent.accuracy, 0) / agents.length)
    : 0;

  const chartData = activity
    .slice(0, 7)
    .reverse()
    .map((_, index) => ({
      name: `T-${7 - index}`,
      events: 18 + index * 6,
      throughput: 75 + index * 4,
    }));

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Mission Control"
        title="Atlas Command Center"
        description="Live operating picture for your AI team with throughput, risks, and dispatch controls in one surface."
        action={
          <div className="flex gap-3">
            <Button variant="secondary">
              <Play className="mr-2 size-4" />
              Trigger Sweep
            </Button>
            <Button>
              <Sparkles className="mr-2 size-4" />
              Launch Routine
            </Button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {agentsQuery.isLoading || tasksQuery.isLoading ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)
        ) : (
          <>
            <StatCard label="Active Agents" value={String(activeAgents)} detail={`${agents.length} agents tracked`} icon={<Radar className="size-5" />} />
            <StatCard label="Completed Today" value={String(completedTasks)} detail={`${tasks.length} total tasks in flow`} icon={<ShieldCheck className="size-5" />} />
            <StatCard label="Blocked Work" value={String(blockedTasks)} detail="Needs human or system intervention" icon={<Bolt className="size-5" />} />
            <StatCard label="Average Accuracy" value={formatPercent(avgAccuracy)} detail="Across live specialist agents" icon={<Sparkles className="size-5" />} />
          </>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.65fr_1fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Signal Throughput</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Event velocity and execution capacity</h2>
            </div>
            <Badge tone="success">Stable cadence</Badge>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="events" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#4dd4ac" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#4dd4ac" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="throughput" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#8ea4ff" stopOpacity={0.34} />
                    <stop offset="95%" stopColor="#8ea4ff" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.08)" />
                <XAxis axisLine={false} dataKey="name" tickLine={false} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(9,13,22,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 16,
                    color: "#fff",
                  }}
                />
                <Area dataKey="events" stroke="#4dd4ac" fill="url(#events)" strokeWidth={2} />
                <Area dataKey="throughput" stroke="#8ea4ff" fill="url(#throughput)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Quick Actions</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Dispatch and control surface</h2>
            </div>
            <Badge>Automations</Badge>
          </div>
          <div className="mt-6 space-y-3">
            {[
              ["Rebalance assignments", "Shift task ownership to keep priority work under 250ms response."],
              ["Refresh doc index", "Run the docs sync and retrieval rebuild pipeline."],
              ["Escalate blocked work", "Bundle blockers into a human review packet."],
            ].map(([title, description]) => (
              <button
                key={title}
                className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-white/5 p-4 text-left transition hover:border-white/16 hover:bg-white/7"
              >
                <div>
                  <p className="font-medium text-white">{title}</p>
                  <p className="mt-1 text-sm text-slate-400">{description}</p>
                </div>
                <ChevronRight className="size-4 text-slate-500" />
              </button>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Agent Status Strip</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Live specialist readiness</h2>
            </div>
            <Badge tone="success">{activeAgents} active</Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {agentsQuery.isLoading
              ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)
              : agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="rounded-3xl border border-white/8 p-4"
                    style={{ background: `linear-gradient(135deg, ${agent.color}16, rgba(255,255,255,0.02))` }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="size-3 rounded-full" style={{ backgroundColor: getAgentColor(agent.color) }} />
                          <p className="text-lg font-semibold text-white">{agent.name}</p>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">{agent.role}</p>
                      </div>
                      <Badge tone={agent.status === "degraded" ? "warning" : "success"}>{agent.status}</Badge>
                    </div>
                    <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
                      <Metric label="Workload" value={formatPercent(agent.workload)} />
                      <Metric label="Accuracy" value={formatPercent(agent.accuracy)} />
                      <Metric label="Latency" value={`${agent.response_time_ms}ms`} />
                    </div>
                  </div>
                ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Realtime Activity</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Latest command events</h2>
            </div>
            <Badge>{projects.length} projects</Badge>
          </div>
          <div className="space-y-4">
            {activityQuery.isLoading
              ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
              : activity.slice(0, 5).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{item.title}</p>
                        <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                      </div>
                      <Badge tone={item.level === "warning" ? "warning" : item.level === "critical" ? "danger" : "success"}>
                        {item.level}
                      </Badge>
                    </div>
                    <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(item.created_at)}</p>
                  </div>
                ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
          <p className="mt-2 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-slate-200">{icon}</div>
      </div>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/10 px-3 py-2">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}
