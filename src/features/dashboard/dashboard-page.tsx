import { useActivityQuery, useAgentsQuery, useCronJobsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/utils";
import { CheckCircle2, ListTodo, ShieldCheck, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";

export function DashboardPage() {
  const agentsQuery = useAgentsQuery();
  const tasksQuery = useTasksQuery();
  const activityQuery = useActivityQuery(20);
  const cronQuery = useCronJobsQuery();

  if (agentsQuery.isError || tasksQuery.isError || activityQuery.isError || cronQuery.isError) {
    return <ErrorState title="Dashboard unavailable" description="One or more command center data sources failed to load." />;
  }

  const agents = agentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const cronJobs = cronQuery.data ?? [];
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activeTasks = tasks.filter((task) => task.status === "in_progress").length;
  const completedThisWeek = tasks.filter((task) => task.completed_at && new Date(task.completed_at).getTime() >= sevenDaysAgo).length;
  const healthyCronJobs = cronJobs.filter((job) => job.last_status === "ok").length;
  const latestActivityByAgent = new Map(activity.map((item) => [item.agent_id, item]));

  return (
    <div className="space-y-6">
      <SectionHeader eyebrow="Mission Control" title="Atlas Command Center" description="Live operating picture built from Supabase agents, tasks, cron jobs, docs, and activity." action={<div className="flex gap-3"><Link to="/projects"><Button variant="secondary">View Projects</Button></Link><Link to="/team"><Button>View Team</Button></Link></div>} />
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {agentsQuery.isLoading || tasksQuery.isLoading || cronQuery.isLoading ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />) : <><StatCard label="Total Agents" value={String(agents.length)} detail="Rows from agent_team" icon={<UsersRound className="size-5" />} /><StatCard label="Active Tasks" value={String(activeTasks)} detail="Tasks in progress" icon={<ListTodo className="size-5" />} /><StatCard label="Completed This Week" value={String(completedThisWeek)} detail="Finished in the last 7 days" icon={<CheckCircle2 className="size-5" />} /><StatCard label="Cron Health" value={`${healthyCronJobs}/${cronJobs.length}`} detail="Jobs reporting last_status = ok" icon={<ShieldCheck className="size-5" />} /></>}
      </section>
      <section className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.28em] text-slate-500">Agent Status Strip</p><h2 className="mt-2 text-xl font-semibold text-white">Latest activity per agent</h2></div><Badge tone="success">{agents.length} tracked</Badge></div>
          <div className="grid gap-3 lg:grid-cols-2">{agentsQuery.isLoading || activityQuery.isLoading ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-3xl" />) : agents.map((agent) => { const latest = latestActivityByAgent.get(agent.agent_id); return <div key={agent.id} className="rounded-3xl border border-white/8 p-4" style={{ background: `linear-gradient(140deg, ${agent.color}20, rgba(255,255,255,0.02))` }}><div className="flex items-start justify-between gap-3"><div><p className="text-lg font-semibold" style={{ color: agent.color }}><span className="mr-2">{agent.emoji}</span>{agent.name}</p><p className="mt-1 text-sm text-slate-400">{agent.role}</p></div><Badge tone={agent.status === "active" ? "success" : "default"}>{agent.status}</Badge></div><p className="mt-4 text-sm text-slate-200">{latest?.action ?? "No recent activity recorded."}</p><p className="mt-2 text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(latest?.created_at)}</p></div>; })}</div>
        </Card>
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.28em] text-slate-500">Activity Feed</p><h2 className="mt-2 text-xl font-semibold text-white">Last 20 agent events</h2></div><Badge>{activity.length} events</Badge></div>
          <div className="space-y-3">{activityQuery.isLoading ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />) : activity.map((item) => { const agent = agents.find((candidate) => candidate.agent_id === item.agent_id); return <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-medium text-white"><span className="mr-2">{agent?.emoji ?? "🤖"}</span><span style={{ color: agent?.color ?? "#fff" }}>{agent?.name ?? item.agent_id}</span> · {item.action}</p><p className="mt-1 text-sm text-slate-400">{item.details || "No additional details."}</p></div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(item.created_at)}</p></div></div>; })}</div>
        </Card>
      </section>
    </div>
  );
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return <Card className="relative overflow-hidden p-5"><div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" /><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-semibold text-white">{value}</p><p className="mt-2 text-sm text-slate-400">{detail}</p></div><div className="rounded-2xl border border-white/10 bg-white/6 p-3 text-slate-200">{icon}</div></div></Card>;
}
