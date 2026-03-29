import { useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { Agent, Task, TaskStatus } from "@/shared/types/models";
import { CalendarDays, CheckCircle2, CircleAlert, ClipboardList, Flag, Layers3, UserRound, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

const columns: Array<{ key: TaskStatus; label: string; dotClassName: string }> = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80" },
  { key: "up_next", label: "Up Next", dotClassName: "bg-violet-400/80" },
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
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

  const selectedTask = useMemo(
    () => filteredTasks.find((task) => task.id === selectedTaskId) ?? null,
    [filteredTasks, selectedTaskId],
  );

  useEffect(() => {
    if (!selectedTaskId) return;
    if (!filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [filteredTasks, selectedTaskId]);

  if (tasksQuery.isError || agentsQuery.isError) {
    return <ErrorState title="Kanban unavailable" description="Task or agent data failed to load for this board." />;
  }

  return (
    <>
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
          <div className="grid gap-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-[520px] rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1400px] grid-cols-6 items-start gap-3">
              {columns.map((column) => {
                const columnTasks = filteredTasks.filter((task) => task.status === column.key);

                return (
                  <Card key={column.key} className="flex min-h-[520px] min-w-0 flex-col overflow-hidden border-white/8 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={cn("size-2.5 rounded-full", column.dotClassName)} />
                        <p className="truncate text-sm font-semibold text-white">{column.label}</p>
                      </div>
                      <Badge className="px-2 py-0.5 text-[10px]">{columnTasks.length}</Badge>
                    </div>

                    {columnTasks.length === 0 ? (
                      <div className="flex flex-1 items-center justify-center py-8 text-center text-sm text-slate-600">No tasks</div>
                    ) : (
                      <div className="space-y-2">
                        {columnTasks.map((task) => {
                          const agent = (agents ?? []).find((item) => item.agent_id === task.assigned_to);
                          return (
                            <TaskCard
                              key={task.id}
                              task={task}
                              agent={agent}
                              isCompletedColumn={column.key === "completed"}
                              onClick={() => setSelectedTaskId(task.id)}
                            />
                          );
                        })}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <TaskDetailSheet
        task={selectedTask}
        agent={(agents ?? []).find((item) => item.agent_id === selectedTask?.assigned_to)}
        onClose={() => setSelectedTaskId(null)}
      />
    </>
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

function TaskCard({
  task,
  agent,
  isCompletedColumn,
  onClick,
}: {
  task: Task;
  agent: Agent | undefined;
  isCompletedColumn: boolean;
  onClick: () => void;
}) {
  const priorityTone = getPriorityTone(task.priority);
  const completedLabel = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[12px] border border-white/8 bg-white/[0.03] p-3 text-left transition hover:translate-y-[-1px] hover:cursor-pointer hover:border-white/16 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60"
      title={task.description || undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">{task.title}</p>
        <span className="mt-0.5 shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-slate-400">
          Open
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <Badge tone={priorityTone} className="px-2 py-0.5 text-[10px]">
          {formatLabel(task.priority)}
        </Badge>
        <span className="truncate" style={{ color: agent?.color ?? "#cbd5e1" }}>
          {agent ? `${agent.emoji} ${agent.name}` : "Unassigned"}
        </span>
      </div>
      {task.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{task.description}</p> : null}
      <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
        <span className="truncate">{task.source || "No source"}</span>
        {isCompletedColumn && completedLabel ? <span>Completed {completedLabel}</span> : <span>View details</span>}
      </div>
    </button>
  );
}

function TaskDetailSheet({ task, agent, onClose }: { task: Task | null; agent: Agent | undefined; onClose: () => void }) {
  useEffect(() => {
    if (!task) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, task]);

  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close task details" className="absolute inset-0 bg-[#02040a]/72 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-[540px] flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(13,18,30,0.98),rgba(7,10,18,0.99))] shadow-[-30px_0_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 md:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={getStatusTone(task.status)}>{formatLabel(task.status)}</Badge>
              <Badge tone={getPriorityTone(task.priority)}>{formatLabel(task.priority)}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Task details</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{task.title}</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Description</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
              {task.description?.trim() ? task.description : "No description has been added for this task yet."}
            </p>
          </Card>

          <div className="grid gap-3 sm:grid-cols-2">
            <DetailTile icon={CircleAlert} label="Status" value={formatLabel(task.status)} />
            <DetailTile icon={Flag} label="Priority" value={formatLabel(task.priority)} />
            <DetailTile
              icon={UserRound}
              label="Assigned to"
              value={agent ? `${agent.emoji} ${agent.name}` : "Unassigned"}
              accentColor={agent?.color}
            />
            <DetailTile icon={Layers3} label="Project / source" value={task.source || "Unknown"} />
            <DetailTile icon={CalendarDays} label="Created" value={formatDateTime(task.created_at)} />
            <DetailTile icon={CheckCircle2} label="Completed" value={task.completed_at ? formatDateTime(task.completed_at) : "Not completed"} />
          </div>

          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-slate-400" />
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Overview</p>
            </div>
            <div className="mt-4 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Task ID</p>
                <p className="mt-2 break-all font-medium text-white">{task.id}</p>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Source ID</p>
                <p className="mt-2 break-all font-medium text-white">{task.source_id ?? "None"}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function DetailTile({
  icon: Icon,
  label,
  value,
  accentColor,
}: {
  icon: typeof CircleAlert;
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4" style={accentColor ? { color: accentColor } : undefined} />
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-white" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </p>
    </Card>
  );
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getPriorityTone(priority: string): "default" | "warning" | "danger" {
  if (priority === "high") return "danger";
  if (priority === "medium") return "warning";
  return "default";
}

function getStatusTone(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "completed") return "success";
  if (status === "blocked") return "danger";
  if (status === "review") return "warning";
  return "default";
}
