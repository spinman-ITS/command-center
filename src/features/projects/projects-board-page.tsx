import { useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { TaskStatus } from "@/shared/types/models";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const columns: Array<{ key: TaskStatus; label: string }> = [{ key: "backlog", label: "Backlog" }, { key: "in_progress", label: "In Progress" }, { key: "blocked", label: "Blocked" }, { key: "review", label: "Review" }, { key: "completed", label: "Completed" }];

export function ProjectsBoardPage() {
  const { name } = useParams();
  const tasksQuery = useTasksQuery();
  const agentsQuery = useAgentsQuery();
  const [agentFilter, setAgentFilter] = useState("all");
  const projectName = decodeURIComponent(name ?? "");
  const tasks = tasksQuery.data;
  const agents = agentsQuery.data;
  const filteredTasks = useMemo(
    () => (tasks ?? []).filter((task) => task.source === projectName && (agentFilter === "all" || task.assigned_to === agentFilter)),
    [agentFilter, projectName, tasks],
  );
  const projectAgents = (agents ?? []).filter((agent) => filteredTasks.some((task) => task.assigned_to === agent.agent_id));
  if (tasksQuery.isError || agentsQuery.isError) return <ErrorState title="Kanban unavailable" description="Task or agent data failed to load for this board." />;

  return <div className="space-y-6"><SectionHeader eyebrow="Project Board" title={projectName || "Project"} description="Real task kanban grouped by task status." action={<div className="flex flex-wrap gap-2"> <button onClick={() => setAgentFilter("all")} className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${agentFilter === "all" ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-400"}`}>All agents</button>{projectAgents.map((agent) => <button key={agent.id} onClick={() => setAgentFilter(agent.agent_id)} className={`rounded-full border px-3 py-1.5 text-xs uppercase tracking-[0.18em] ${agentFilter === agent.agent_id ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-400"}`}>{agent.emoji} {agent.name}</button>)}</div>} />{tasksQuery.isLoading ? <div className="grid gap-4 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[420px] rounded-3xl" />)}</div> : <div className="grid gap-4 xl:grid-cols-5">{columns.map((column) => { const columnTasks = filteredTasks.filter((task) => task.status === column.key); return <Card key={column.key} className="flex min-h-[520px] flex-col p-4"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs uppercase tracking-[0.24em] text-slate-500">{column.label}</p><p className="mt-1 text-2xl font-semibold text-white">{columnTasks.length}</p></div><Badge>{column.key.replace("_", " ")}</Badge></div><div className="space-y-3">{columnTasks.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No tasks in this column.</div> : columnTasks.map((task) => { const agent = agents.find((item) => item.agent_id === task.assigned_to); const tone = task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "default"; return <div key={task.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"><div className="flex items-start justify-between gap-3"><p className="font-medium text-white">{task.title}</p><Badge tone={tone}>{task.priority}</Badge></div><p className="mt-2 line-clamp-2 text-sm text-slate-400">{task.description || "No description provided."}</p><div className="mt-4 text-sm"><span style={{ color: agent?.color ?? "#cbd5e1" }}>{agent ? `${agent.emoji} ${agent.name}` : "Unassigned"}</span></div></div>; })}</div></Card>; })}</div>}</div>;
}
