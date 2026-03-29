import { useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { Agent, Task, TaskStatus } from "@/shared/types/models";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const columns: Array<{ key: TaskStatus; label: string; dotClassName: string }> = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80" },
  { key: "in_progress", label: "In Progress", dotClassName: "bg-sky-400/80" },
  { key: "blocked", label: "Blocked", dotClassName: "bg-rose-400/80" },
  { key: "review", label: "Review", dotClassName: "bg-amber-300/80" },
  { key: "completed", label: "Completed", dotClassName: "bg-emerald-300/80" },
];

export function ProjectsBoardPage() {
  const { name } = useParams();
  const tasksQuery = useTasksQuery();
  const agentsQuery = useAgentsQuery();
  const [agentFilter, setAgentFilter] = useState("all");
  const projectName = decodeURIComponent(name ?? "");
  const tasks = tasksQuery.data;
  const agents = agentsQuery.data;

  const filteredTasks = useMemo(
    () =>
      (tasks ?? []).filter(
        (task) => task.source === projectName && (agentFilter === "all" || task.assigned_to === agentFilter),
      ),
    [agentFilter, projectName, tasks],
  );

  const projectAgents = useMemo(
    () => (agents ?? []).filter((agent) => filteredTasks.some((task) => task.assigned_to === agent.agent_id)),
    [agents, filteredTasks],
  );

  if (tasksQuery.isError || agentsQuery.isError) {
    return <ErrorState title="Kanban unavailable" description="Task or agent data failed to load for this board." />;
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        eyebrow="Project Board"
        title={projectName || "Project"}
        description="Real task kanban grouped by task status. Compact mode keeps focus on what needs movement."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={agentFilter === "all"} onClick={() => setAgentFilter("all")}>
              All agents
            </FilterPill>
            {projectAgents.map((agent) => (
              <FilterPill key={agent.id} active={agentFilter === agent.agent_id} onClick={() => setAgentFilter(agent.agent_id)}>
                <span className="mr-1">{agent.emoji}</span>
                <span style={{ color: agent.color }}>{agent.name}</span>
              </FilterPill>
            ))}
          </div>
        }
      />

      {tasksQuery.isLoading ? (
        <div className="grid gap-3 lg:grid-cols-3 2xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-[420px] rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-full items-start gap-3">
            {columns.map((column) => {
              const columnTasks = filteredTasks.filter((task) => task.status === column.key);
              const isEmpty = columnTasks.length === 0;

              return (
                <Card
                  key={column.key}
                  className={cn(
                    "flex min-h-[520px] flex-col overflow-hidden border-white/8",
                    isEmpty ? "w-[84px] min-w-[84px] p-2" : "min-w-[280px] flex-1 p-3",
                  )}
                >
                  {isEmpty ? (
                    <div className="flex h-full min-h-[500px] flex-col items-center justify-between py-2 text-center">
                      <div className={cn("h-2.5 w-10 rounded-full", column.dotClassName)} />
                      <div className="flex flex-1 items-center justify-center">
                        <div className="flex -rotate-180 items-center gap-2 [writing-mode:vertical-rl]">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">{column.label}</span>
                          <Badge className="px-2 py-0.5 text-[10px]">0</Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className={cn("size-2.5 rounded-full", column.dotClassName)} />
                          <p className="truncate text-sm font-semibold text-white">{column.label}</p>
                        </div>
                        <Badge className="px-2 py-0.5 text-[10px]">{columnTasks.length}</Badge>
                      </div>

                      <div className="space-y-2">
                        {columnTasks.map((task) => {
                          const agent = (agents ?? []).find((item) => item.agent_id === task.assigned_to);
                          return <TaskCard key={task.id} task={task} agent={agent} isCompletedColumn={column.key === "completed"} />;
                        })}
                      </div>
                    </>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-[0.12em] transition",
        active ? "border-white/20 bg-white/10 text-white" : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/8",
      )}
    >
      {children}
    </button>
  );
}

function TaskCard({ task, agent, isCompletedColumn }: { task: Task; agent: Agent | undefined; isCompletedColumn: boolean }) {
  const tone = task.priority === "high" ? "danger" : task.priority === "medium" ? "warning" : "default";
  const completedLabel = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      className="rounded-[12px] border border-white/8 bg-white/[0.03] p-3 transition hover:border-white/14 hover:bg-white/[0.05]"
      title={task.description || undefined}
    >
      <p className="truncate text-sm font-semibold text-white">{task.title}</p>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <Badge tone={tone} className="px-2 py-0.5 text-[10px]">
          {task.priority}
        </Badge>
        <span className="truncate" style={{ color: agent?.color ?? "#cbd5e1" }}>
          {agent ? `${agent.emoji} ${agent.name}` : "Unassigned"}
        </span>
      </div>
      {isCompletedColumn && completedLabel ? <p className="mt-2 text-[11px] text-slate-500">Completed {completedLabel}</p> : null}
    </div>
  );
}
