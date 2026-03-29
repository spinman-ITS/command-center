import { useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import type { Task } from "@/shared/types/models";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ProjectsListPage() {
  const tasksQuery = useTasksQuery();
  if (tasksQuery.isError) return <ErrorState title="Projects unavailable" description="Task data could not be loaded." />;
  const tasks = tasksQuery.data ?? [];
  const grouped = Array.from(tasks.reduce((acc, task) => { const key = task.source?.trim() || "Uncategorized"; (acc.get(key) ?? acc.set(key, []).get(key))?.push(task); return acc; }, new Map<string, Task[]>()).entries()).sort((a, b) => b[1].length - a[1].length);

  return <div className="space-y-6"><SectionHeader eyebrow="Projects" title="Workstreams by source" description="Each unique task source is treated as a live project." />{tasksQuery.isLoading ? <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-3xl" />)}</div> : <div className="grid gap-4 xl:grid-cols-2">{grouped.map(([source, projectTasks]) => { const counts = { completed: projectTasks.filter((task) => task.status === "completed").length, in_progress: projectTasks.filter((task) => task.status === "in_progress").length, backlog: projectTasks.filter((task) => task.status === "backlog").length, blocked: projectTasks.filter((task) => task.status === "blocked").length }; const progress = projectTasks.length ? (counts.completed / projectTasks.length) * 100 : 0; return <Link key={source} to={`/projects/${encodeURIComponent(source)}`}><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-white/16"><div className="flex items-start justify-between gap-3"><div><h3 className="text-2xl font-semibold text-white">{source}</h3><p className="mt-2 text-sm text-slate-400">{projectTasks.length} total tasks from this source.</p></div><ChevronRight className="size-4 text-slate-500" /></div><div className="mt-6 space-y-3"><div className="flex items-center justify-between text-sm"><span className="text-slate-400">Progress</span><span className="font-medium text-white">{counts.completed}/{projectTasks.length}</span></div><div className="h-2 rounded-full bg-white/8"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" style={{ width: `${progress}%` }} /></div></div><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"><Info label="Completed" value={String(counts.completed)} /><Info label="In Progress" value={String(counts.in_progress)} /><Info label="Backlog" value={String(counts.backlog)} /><Info label="Blocked" value={String(counts.blocked)} /></div></Card></Link>; })}</div>}</div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3"><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p><p className="mt-2 font-medium text-white">{value}</p></div>; }
