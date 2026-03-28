import { useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { TaskStatus } from "@/shared/types/models";
import { Funnel } from "lucide-react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const columns: Array<{ key: TaskStatus; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "in_progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "review", label: "Review" },
  { key: "completed", label: "Completed" },
];

export function ProjectsBoardPage() {
  const { name } = useParams();
  const tasksQuery = useTasksQuery();
  const agentsQuery = useAgentsQuery();
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("all");

  const projectName = decodeURIComponent(name ?? "");
  const tasks = tasksQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  const filteredTasks = useMemo(
    () =>
      tasks.filter((task) => {
        const matchesProject = task.project_name === projectName;
        const matchesSearch = [task.title, ...(task.tags ?? [])].join(" ").toLowerCase().includes(search.toLowerCase());
        const matchesPriority = priority === "all" || task.priority === priority;
        return matchesProject && matchesSearch && matchesPriority;
      }),
    [priority, projectName, search, tasks],
  );

  if (tasksQuery.isError || agentsQuery.isError) {
    return <ErrorState title="Kanban unavailable" description="Task or agent data failed to load for this board." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Project Board"
        title={projectName || "Project"}
        description="Kanban view with source-aware filters and agent ownership."
        action={
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks or tags" className="sm:w-64" />
            <div className="relative">
              <Funnel className="pointer-events-none absolute left-3 top-3 size-4 text-slate-500" />
              <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="pl-10 sm:w-44">
                <option value="all">All priorities</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
          </div>
        }
      />

      {tasksQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-5">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-[420px] rounded-3xl" />)}</div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-5">
          {columns.map((column) => {
            const columnTasks = filteredTasks.filter((task) => task.status === column.key);
            return (
              <Card key={column.key} className="flex min-h-[520px] flex-col p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{column.label}</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{columnTasks.length}</p>
                  </div>
                  <Badge>{column.key.replace("_", " ")}</Badge>
                </div>
                <div className="space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">No tasks match the current filters.</div>
                  ) : (
                    columnTasks.map((task) => {
                      const agent = agents.find((item) => item.id === task.assignee_agent_id);
                      return (
                        <div key={task.id} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <p className="font-medium text-white">{task.title}</p>
                            <Badge tone={task.priority === "urgent" ? "danger" : task.priority === "high" ? "warning" : "default"}>
                              {task.priority}
                            </Badge>
                          </div>
                          <div className="mt-4 h-2 rounded-full bg-white/8">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-300 to-emerald-300" style={{ width: `${task.progress}%` }} />
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
                            <span>{agent?.name ?? "Unassigned"}</span>
                            <span>{formatRelativeTime(task.updated_at)}</span>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(task.tags ?? []).map((tag) => (
                              <Badge key={tag}>{tag}</Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
