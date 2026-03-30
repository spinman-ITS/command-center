import { useAgentsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { showToast as toast } from "@/shared/components/ui/toast";
import { cn } from "@/shared/lib/utils";
import { createTask, deleteTask, updateTask, type CreateTaskInput } from "@/shared/lib/data";
import type { Agent, QaResults, Task, TaskStatus } from "@/shared/types/models";
import { useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDroppable } from "@dnd-kit/core";
import {
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  Flag,

  ChevronDown,
  FlaskConical,
  ImageIcon,
  Layers3,
  ListChecks,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";

const columns: Array<{ key: TaskStatus; label: string; dotClassName: string }> = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80" },
  { key: "up_next", label: "Up Next", dotClassName: "bg-violet-400/80" },
  { key: "in_progress", label: "In Progress", dotClassName: "bg-sky-400/80" },
  { key: "qa", label: "QA", dotClassName: "bg-cyan-400/80" },
  { key: "blocked", label: "Blocked", dotClassName: "bg-rose-400/80" },
  { key: "review", label: "Review", dotClassName: "bg-amber-300/80" },
  { key: "completed", label: "Completed", dotClassName: "bg-emerald-300/80" },
];

const STATUS_OPTIONS: TaskStatus[] = ["backlog", "up_next", "in_progress", "qa", "blocked", "review", "completed"];

export function ProjectsBoardPage() {
  const { name } = useParams();
  const tasksQuery = useTasksQuery();
  const agentsQuery = useAgentsQuery();
  const queryClient = useQueryClient();
  const [agentFilter, setAgentFilter] = useState("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const projectName = decodeURIComponent(name ?? "");
  const tasks = tasksQuery.data;
  const agents = agentsQuery.data;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

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

  const activeTask = useMemo(
    () => filteredTasks.find((task) => task.id === activeTaskId) ?? null,
    [filteredTasks, activeTaskId],
  );


  useEffect(() => {
    if (!selectedTaskId) return;
    if (!filteredTasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [filteredTasks, selectedTaskId]);

  const wasDraggingRef = useRef(false);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    wasDraggingRef.current = true;
    setActiveTaskId(event.active.id as string);
  }, []);

  const validStatuses = new Set(columns.map((c) => c.key));

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveTaskId(null);
      setTimeout(() => { wasDraggingRef.current = false; }, 100);
      const { active, over } = event;
      if (!over) return;

      // Resolve the drop target to a column key
      // over.id could be a column key (droppable) or a task id (sortable)
      let newStatus = over.id as string as TaskStatus;
      if (!validStatuses.has(newStatus)) {
        // Dropped on a task card — find which column that task belongs to
        const overTask = filteredTasks.find((t) => t.id === newStatus);
        if (overTask) {
          newStatus = overTask.status;
        } else {
          return; // Unknown drop target
        }
      }

      const taskId = active.id as string;
      const task = filteredTasks.find((t) => t.id === taskId);
      if (!task || task.status === newStatus) return;

      const updates: Partial<Task> = { status: newStatus };
      if (newStatus === "completed") updates.completed_at = new Date().toISOString();
      else if (task.status === "completed") updates.completed_at = null;

      void (async () => {
        try {
          await updateTask(taskId, updates);
          await queryClient.invalidateQueries({ queryKey: ["tasks"] });
          toast(`Moved "${task.title}" to ${formatLabel(newStatus)}`);
        } catch {
          toast("Failed to move task");
        }
      })();
    },
    [filteredTasks, queryClient],
  );

  const handleTaskCreated = useCallback(() => {
    setShowCreateModal(false);
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  const handleTaskUpdated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  const handleTaskDeleted = useCallback(() => {
    setSelectedTaskId(null);
    void queryClient.invalidateQueries({ queryKey: ["tasks"] });
  }, [queryClient]);

  if (tasksQuery.isError || agentsQuery.isError) {
    return <ErrorState title="Kanban unavailable" description="Task or agent data failed to load for this board." />;
  }

  return (
    <>
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Project Board"
          title={projectName || "Project"}
          description="Interactive kanban — drag tasks between columns, create new tasks, and manage your workflow."
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" className="gap-1.5" onClick={() => setShowCreateModal(true)}>
                <Plus className="size-4" />
                New Task
              </Button>
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
          <div className="grid gap-3 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-[520px] rounded-3xl" />
            ))}
          </div>
        ) : (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1600px] grid-cols-7 items-start gap-3">
                {columns.map((column) => {
                  const columnTasks = filteredTasks.filter((task) => task.status === column.key);
                  return (
                    <KanbanColumn
                      key={column.key}
                      column={column}
                      tasks={columnTasks}
                      agents={agents ?? []}
                      onTaskClick={setSelectedTaskId}
                      isOver={activeTaskId !== null}
                    />
                  );
                })}
              </div>
            </div>

            <DragOverlay>
              {activeTask ? (
                <div className="w-[220px] opacity-90">
                  <TaskCard
                    task={activeTask}
                    agent={(agents ?? []).find((a) => a.agent_id === activeTask.assigned_to)}
                    isActive={activeTask.status === "in_progress" || activeTask.status === "qa"}
                    isCompletedColumn={activeTask.status === "completed"}
                    onClick={() => {}}
                    isDragging
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {showCreateModal && (
        <CreateTaskModal
          projectName={projectName}
          agents={agents ?? []}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTaskCreated}
        />
      )}

      <TaskDetailSheet
        task={selectedTask}
        agent={(agents ?? []).find((item) => item.agent_id === selectedTask?.assigned_to)}
        agents={agents ?? []}
        onClose={() => setSelectedTaskId(null)}
        onUpdated={handleTaskUpdated}
        onDeleted={handleTaskDeleted}
      />
    </>
  );
}

/* ── Kanban Column (droppable) ─────────────────────────────────────── */

function KanbanColumn({
  column,
  tasks: columnTasks,
  agents,
  onTaskClick,
  isOver: hasDragActive,
}: {
  column: (typeof columns)[number];
  tasks: Task[];
  agents: Agent[];
  onTaskClick: (id: string) => void;
  isOver: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.key });

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "flex min-h-[520px] min-w-0 flex-col overflow-hidden border-white/8 p-3 transition-colors duration-200",
        isOver && "border-emerald-400/30 bg-emerald-400/[0.04]",
        hasDragActive && !isOver && "border-white/12",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 rounded-full", column.dotClassName)} />
          <p className="truncate text-sm font-semibold text-white">{column.label}</p>
        </div>
        <Badge className="px-2 py-0.5 text-[10px]">{columnTasks.length}</Badge>
      </div>

      {columnTasks.length === 0 ? (
        <div className={cn(
          "flex flex-1 items-center justify-center rounded-xl border border-dashed py-8 text-center text-sm transition-colors",
          isOver ? "border-emerald-400/30 text-emerald-300/60" : "border-transparent text-slate-600",
        )}>
          {isOver ? "Drop here" : "No tasks"}
        </div>
      ) : (
        <div className="space-y-2">
          {columnTasks.map((task) => {
            const agent = agents.find((item) => item.agent_id === task.assigned_to);
            return (
              <DraggableTaskCard
                key={task.id}
                task={task}
                agent={agent}
                isActive={task.status === "in_progress" || task.status === "qa"}
                isCompletedColumn={column.key === "completed"}
                onClick={() => onTaskClick(task.id)}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Draggable Task Card ───────────────────────────────────────────── */

function DraggableTaskCard({
  task,
  agent,
  isActive,
  isCompletedColumn,
  onClick,
}: {
  task: Task;
  agent: Agent | undefined;
  isActive: boolean;
  isCompletedColumn: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <TaskCard task={task} agent={agent} isActive={isActive} isCompletedColumn={isCompletedColumn} onClick={onClick} />
    </div>
  );
}

/* ── Task Card ─────────────────────────────────────────────────────── */

function TaskCard({
  task,
  agent,
  isActive,
  isCompletedColumn,
  onClick,
  isDragging,
}: {
  task: Task;
  agent: Agent | undefined;
  isActive: boolean;
  isCompletedColumn: boolean;
  onClick: () => void;
  isDragging?: boolean;
}) {
  const priorityTone = getPriorityTone(task.priority);
  const completedLabel = task.completed_at
    ? new Date(task.completed_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      className={cn(
        "group w-full rounded-[12px] border border-white/8 bg-white/[0.03] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.06]",
        isDragging && "shadow-2xl ring-2 ring-emerald-400/30",
      )}
    >
      <div className="flex items-start gap-1">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left focus-visible:outline-none">
          <div className="flex items-start justify-between gap-3">
            <p className="line-clamp-2 text-sm font-semibold text-white">{task.title}</p>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <Badge tone={priorityTone} className="px-2 py-0.5 text-[10px]">
              {formatLabel(task.priority)}
            </Badge>
            <span className="truncate" style={{ color: agent?.color ?? "#cbd5e1" }}>
              {agent ? `${agent.emoji} ${agent.name}` : "Unassigned"}
            </span>
            {isActive ? (
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                <span className="relative flex size-2.5 items-center justify-center">
                  <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-emerald-400/60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
                </span>
                Active now
              </span>
            ) : null}
          </div>
          {task.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{task.description}</p> : null}
          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <span className="truncate">{task.source || "No source"}</span>
            {isCompletedColumn && completedLabel ? <span>Completed {completedLabel}</span> : <span>View details</span>}
          </div>
        </button>
      </div>
    </div>
  );
}

/* ── Create Task Modal ─────────────────────────────────────────────── */

function CreateTaskModal({
  projectName,
  agents,
  onClose,
  onCreated,
}: {
  projectName: string;
  agents: Agent[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [source, setSource] = useState(projectName);
  const [status, setStatus] = useState<TaskStatus>("backlog");
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const input: CreateTaskInput = {
      title: title.trim(),
      description: description.trim(),
      priority,
      assigned_to: assignedTo,
      source,
      status,
    };
    void createTask(input)
      .then(() => {
        toast(`Created task "${title.trim()}"`);
        onCreated();
      })
      .catch(() => toast("Failed to create task"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#02040a]/72 backdrop-blur-sm" onClick={onClose} />
      <form
        onSubmit={handleSubmit}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d121e]/98 p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Task</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" required autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Priority</label>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{formatLabel(s)}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Assigned to</label>
              <Select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="">Unassigned</option>
                {agents.map((a) => (
                  <option key={a.id} value={a.agent_id}>{a.emoji} {a.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Project / Source</label>
              <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. MSP Pub" />
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Create Task
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ── Task Detail Sheet (with edit/delete/status change) ────────────── */

function TaskDetailSheet({
  task,
  agent,
  agents,
  onClose,
  onUpdated,
  onDeleted,
}: {
  task: Task | null;
  agent: Agent | undefined;
  agents: Agent[];
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editAssignedTo, setEditAssignedTo] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("backlog");

  // Reset edit state when task changes
  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description ?? "");
      setEditPriority(task.priority);
      setEditAssignedTo(task.assigned_to);
      setEditSource(task.source);
      setEditStatus(task.status);
    }
    setEditing(false);
    setConfirmDelete(false);
  }, [task]);

  useEffect(() => {
    if (!task) return;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (editing) setEditing(false);
        else onClose();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [editing, onClose, task]);

  const handleSave = () => {
    if (!task || !editTitle.trim()) return;
    setSaving(true);
    const updates: Partial<Task> = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      assigned_to: editAssignedTo,
      source: editSource,
      status: editStatus,
    };
    if (editStatus === "completed" && task.status !== "completed") {
      updates.completed_at = new Date().toISOString();
    } else if (editStatus !== "completed" && task.status === "completed") {
      updates.completed_at = null;
    }
    void updateTask(task.id, updates)
      .then(() => { toast(`Updated "${editTitle.trim()}"`); setEditing(false); onUpdated(); })
      .catch(() => toast("Failed to update task"))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    if (!task) return;
    setSaving(true);
    void deleteTask(task.id)
      .then(() => { toast(`Deleted "${task.title}"`); onDeleted(); })
      .catch(() => toast("Failed to delete task"))
      .finally(() => setSaving(false));
  };

  const handleQuickStatusChange = (newStatus: TaskStatus) => {
    if (!task || task.status === newStatus) return;
    setSaving(true);
    const updates: Partial<Task> = { status: newStatus };
    if (newStatus === "completed") updates.completed_at = new Date().toISOString();
    else if (task.status === "completed") updates.completed_at = null;
    void updateTask(task.id, updates)
      .then(() => { toast(`Moved "${task.title}" to ${formatLabel(newStatus)}`); setEditStatus(newStatus); onUpdated(); })
      .catch(() => toast("Failed to update status"))
      .finally(() => setSaving(false));
  };

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
              {editing ? (
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-2 text-lg font-semibold" />
              ) : (
                <h2 className="mt-2 text-2xl font-semibold text-white">{task.title}</h2>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
              >
                <Pencil className="size-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
          {/* Quick Status Change */}
          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Quick Status Change</label>
            <Select
              value={editing ? editStatus : task.status}
              onChange={(e) => {
                const newStatus = e.target.value as TaskStatus;
                if (editing) {
                  setEditStatus(newStatus);
                } else {
                  handleQuickStatusChange(newStatus);
                }
              }}
              disabled={saving}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{formatLabel(s)}</option>
              ))}
            </Select>
          </Card>

          {/* Description */}
          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Description</p>
            {editing ? (
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="mt-3"
                placeholder="Add a description..."
              />
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                {task.description?.trim() ? task.description : "No description has been added for this task yet."}
              </p>
            )}
          </Card>

          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Priority</label>
                <Select value={editPriority} onChange={(e) => setEditPriority(e.target.value)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Assigned to</label>
                <Select value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {agents.map((a) => (
                    <option key={a.id} value={a.agent_id}>{a.emoji} {a.name}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Project / Source</label>
                <Input value={editSource} onChange={(e) => setEditSource(e.target.value)} />
              </div>
            </div>
          ) : (
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
          )}

          {!editing && (
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
          )}

          {/* Testing Instructions */}
          {!editing && task.testing_instructions && <TestingInstructionsSection text={task.testing_instructions} />}

          {/* QA Results */}
          {!editing && task.qa_results && <QaResultsSection qa={task.qa_results} />}

          {/* Action buttons */}
          {editing ? (
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !editTitle.trim()}>
                {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : null}
                Save Changes
              </Button>
            </div>
          ) : (
            <div className="pt-2">
              {confirmDelete ? (
                <div className="flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/5 p-3">
                  <p className="flex-1 text-sm text-rose-200">Delete this task permanently?</p>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={saving} className="text-xs">
                    Cancel
                  </Button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={saving}
                    className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20"
                  >
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Delete
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-rose-300"
                >
                  <Trash2 className="size-3.5" />
                  Delete task
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Testing Instructions Section ─────────────────────────────────── */

function TestingInstructionsSection({ text }: { text: string }) {
  const [open, setOpen] = useState(true);

  // Simple markdown-ish rendering: headers, lists, bold, inline code
  const rendered = text
    .split("\n")
    .map((line, i) => {
      if (/^###\s/.test(line)) return <p key={i} className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-300">{line.replace(/^###\s*/, "")}</p>;
      if (/^##\s/.test(line)) return <p key={i} className="mt-3 mb-1 text-sm font-semibold text-slate-200">{line.replace(/^##\s*/, "")}</p>;
      if (/^#\s/.test(line)) return <p key={i} className="mt-3 mb-1 text-base font-bold text-white">{line.replace(/^#\s*/, "")}</p>;
      if (/^[-*]\s/.test(line)) return <p key={i} className="pl-3 before:content-['•'] before:mr-2 before:text-slate-500">{line.replace(/^[-*]\s*/, "")}</p>;
      if (/^\d+\.\s/.test(line)) return <p key={i} className="pl-3">{line}</p>;
      if (line.trim() === "") return <div key={i} className="h-2" />;
      return <p key={i}>{line}</p>;
    });

  return (
    <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <ListChecks className="size-4 text-slate-400" />
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Testing Instructions</p>
        </div>
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 font-mono text-xs leading-relaxed text-slate-300">
          {rendered}
        </div>
      )}
    </Card>
  );
}

/* ── QA Results Section ────────────────────────────────────────────── */

function QaResultsSection({ qa }: { qa: QaResults }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lightboxCaption, setLightboxCaption] = useState("");

  const statusColor = qa.status === "pass" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
    : qa.status === "fail" ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
    : "text-amber-400 bg-amber-400/10 border-amber-400/20";

  const screenshotsWithTests = qa.tests.filter((t) => t.screenshot);

  return (
    <>
      <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FlaskConical className="size-4 text-slate-400" />
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">QA Results</p>
          </div>
          <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", statusColor)}>
            {qa.status}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
          <span>Tested by <span className="font-medium text-slate-300">{qa.tested_by}</span></span>
          <span>·</span>
          <span>{formatDateTime(qa.tested_at)}</span>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">{qa.summary}</p>

        {/* Test list */}
        <div className="mt-4 space-y-2">
          {qa.tests.map((test, i) => {
            const pass = test.status === "pass";
            return (
              <div key={i} className="rounded-xl border border-white/6 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{test.name}</span>
                  <span className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                    pass ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" : "text-rose-400 bg-rose-400/10 border-rose-400/20",
                  )}>
                    {test.status}
                  </span>
                </div>
                {test.notes && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{test.notes}</p>}
                {test.screenshot && (
                  <button
                    type="button"
                    className="mt-2 overflow-hidden rounded-lg border border-white/8 transition hover:border-white/20"
                    onClick={() => { setLightboxUrl(test.screenshot!); setLightboxCaption(test.name); }}
                  >
                    <img src={test.screenshot} alt={test.name} className="h-[80px] w-[120px] object-cover" loading="lazy" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Screenshot gallery */}
        {screenshotsWithTests.length > 1 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="size-3.5 text-slate-500" />
              <p className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Screenshots</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {screenshotsWithTests.map((test, i) => (
                <button
                  key={i}
                  type="button"
                  className="group relative overflow-hidden rounded-lg border border-white/8 transition hover:border-white/20"
                  onClick={() => { setLightboxUrl(test.screenshot!); setLightboxCaption(test.name); }}
                >
                  <img src={test.screenshot} alt={test.name} className="h-[80px] w-[120px] object-cover" loading="lazy" />
                  <span className="absolute inset-x-0 bottom-0 bg-black/60 px-1.5 py-0.5 text-[9px] text-slate-300 opacity-0 transition group-hover:opacity-100">
                    {test.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              className="absolute -right-3 -top-3 z-10 inline-flex size-8 items-center justify-center rounded-full border border-white/20 bg-black/80 text-white transition hover:bg-black"
            >
              <X className="size-4" />
            </button>
            <img src={lightboxUrl} alt={lightboxCaption} className="max-h-[85vh] max-w-[85vw] rounded-lg" />
            {lightboxCaption && (
              <p className="mt-2 text-center text-sm text-slate-300">{lightboxCaption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Shared helpers ────────────────────────────────────────────────── */

function FilterPill({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
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

function DetailTile({ icon: Icon, label, value, accentColor }: { icon: typeof CircleAlert; label: string; value: string; accentColor?: string }) {
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
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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
