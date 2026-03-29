import { useActivityQuery, useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/utils";
import { Bot, Building2, UserRound } from "lucide-react";

const reportingOrder = ["atlas", "luka", "dash", "lucy", "max", "sage", "pixel"];

export function TeamPage() {
  const agentsQuery = useAgentsQuery();
  const activityQuery = useActivityQuery(50);
  const tasksQuery = useTasksQuery();
  if (agentsQuery.isError || activityQuery.isError || tasksQuery.isError) return <ErrorState title="Team unavailable" description="Agent, activity, or task data could not be loaded." />;
  const agents = agentsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const latestByAgent = new Map(activity.map((item) => [item.agent_id, item]));
  const atlas = agents.find((agent) => agent.agent_id.toLowerCase() === "atlas");
  const reports = reportingOrder.map((id) => agents.find((agent) => agent.agent_id.toLowerCase() === id)).filter((agent): agent is NonNullable<typeof agent> => Boolean(agent) && agent?.agent_id.toLowerCase() !== "atlas");

  return <div className="space-y-6"><SectionHeader eyebrow="Team" title="Agent org chart" description="Owner → Chief of Staff → specialist agents, with live task counts and latest activity." />{agentsQuery.isLoading || activityQuery.isLoading || tasksQuery.isLoading ? <div className="grid gap-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-3xl" />)}</div> : <div className="space-y-8"><div className="flex justify-center"><div className="w-full max-w-sm"><HumanCard title="Sean Inman" subtitle="Owner" icon={<UserRound className="size-8" />} /></div></div><div className="mx-auto h-10 w-px bg-white/10" />{atlas ? <div className="flex justify-center"><div className="w-full max-w-md"><AgentCard name={atlas.name} emoji="🏛️" role="Chief of Staff" model={atlas.model} color={atlas.color} status={atlas.status} taskCount={tasks.filter((task) => task.assigned_to === atlas.agent_id).length} currentTask={latestByAgent.get(atlas.agent_id)?.action ?? "No recent activity"} time={latestByAgent.get(atlas.agent_id)?.created_at} /></div></div> : null}<div className="mx-auto h-10 w-px bg-white/10" /><div className="relative"><div className="absolute left-1/2 right-1/2 top-0 hidden h-px -translate-x-1/2 bg-white/10 xl:block xl:w-[78%]" /><div className="grid gap-4 xl:grid-cols-3 2xl:grid-cols-6">{reports.map((agent) => <AgentCard key={agent.id} name={agent.name} emoji={agent.emoji} role={agent.role} model={agent.model} color={agent.color} status={agent.status} taskCount={tasks.filter((task) => task.assigned_to === agent.agent_id).length} currentTask={latestByAgent.get(agent.agent_id)?.action ?? "No recent activity"} time={latestByAgent.get(agent.agent_id)?.created_at} />)}</div></div></div>}</div>;
}

function HumanCard({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) { return <Card className="relative overflow-hidden p-6"><div className="absolute inset-y-0 left-0 w-1 bg-slate-300" /><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center rounded-3xl border border-white/10 bg-white/5 text-slate-100">{icon}</div><div><p className="text-2xl font-semibold text-white">{title}</p><p className="text-sm text-slate-400">{subtitle}</p></div></div></Card>; }

function AgentCard({ name, emoji, role, model, color, status, taskCount, currentTask, time }: { name: string; emoji: string; role: string; model: string; color: string; status: string; taskCount: number; currentTask: string; time?: string; }) { return <Card className="relative overflow-hidden p-6"><div className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: color }} /><div className="mb-5 flex items-start justify-between gap-3"><div className="flex items-center gap-4"><div className="flex size-16 items-center justify-center rounded-3xl border border-white/10 text-3xl" style={{ backgroundColor: `${color}20`, color }}><span>{emoji || <Bot className="size-8" />}</span></div><div><p className="text-2xl font-semibold" style={{ color }}>{name}</p><p className="text-sm text-slate-400">{role}</p></div></div><div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-emerald-200"><span className="size-2 rounded-full bg-emerald-300" />{status}</div></div><div className="grid gap-3 text-sm"><Row label="Model" value={model || "—"} icon={<Building2 className="size-4" />} /><Row label="Current task" value={currentTask} icon={<Bot className="size-4" />} /><Row label="Task count" value={String(taskCount)} icon={<Bot className="size-4" />} /><Row label="Updated" value={formatRelativeTime(time)} icon={<Bot className="size-4" />} /></div></Card>; }

function Row({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"><div className="mb-1 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-slate-500">{icon}{label}</div><p className="text-sm text-white">{value}</p></div>; }
