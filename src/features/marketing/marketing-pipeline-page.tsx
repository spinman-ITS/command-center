import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  ExternalLink,
  ImageIcon,
  Loader2,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  UserRound,
  X,
  FileText,
  ChevronDown,
} from "lucide-react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/* ── Types ─────────────────────────────────────────────────────────── */

type ContentStatus = "backlog" | "up_next" | "research" | "writing" | "design" | "review" | "published";

interface ContentItem {
  id: string;
  title: string;
  description: string | null;
  topic_url: string | null;
  content_type: string | null;
  status: ContentStatus;
  assigned_to: string | null;
  ghl_draft_id: string | null;
  ghl_draft_url: string | null;
  blog_url: string | null;
  social_draft_ids: unknown;
  image_urls: string[] | null;
  research_notes: string | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;
}

/* ── Constants ─────────────────────────────────────────────────────── */

const columns: Array<{ key: ContentStatus; label: string; dotClassName: string }> = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80" },
  { key: "up_next", label: "Up Next", dotClassName: "bg-violet-400/80" },
  { key: "research", label: "Research", dotClassName: "bg-cyan-400/80" },
  { key: "writing", label: "Writing", dotClassName: "bg-sky-400/80" },
  { key: "design", label: "Design", dotClassName: "bg-pink-400/80" },
  { key: "review", label: "Review", dotClassName: "bg-amber-300/80" },
  { key: "published", label: "Published", dotClassName: "bg-emerald-300/80" },
];

const STATUS_OPTIONS: ContentStatus[] = ["backlog", "up_next", "research", "writing", "design", "review", "published"];

type ContentType = "blog" | "social" | "newsletter" | "email";

const CONTENT_TYPE_STYLES: Record<ContentType, { label: string; tone: "warning" | "default" | "danger" | "success" }> = {
  blog: { label: "Blog", tone: "warning" },
  social: { label: "Social", tone: "default" },
  newsletter: { label: "Newsletter", tone: "danger" },
  email: { label: "Email", tone: "success" },
};

const AGENT_MAP: Record<string, { name: string; emoji: string; color: string }> = {
  lucy: { name: "Lucy", emoji: "🔍", color: "#a78bfa" },
  sage: { name: "Sage", emoji: "✍️", color: "#38bdf8" },
  pixel: { name: "Pixel", emoji: "🎨", color: "#f472b6" },
  atlas: { name: "Atlas", emoji: "🤖", color: "#4ade80" },
  sean: { name: "Sean", emoji: "👤", color: "#f59e0b" },
};

/* ── Data hooks ────────────────────────────────────────────────────── */

function useContentPipeline() {
  useRealtimeInvalidation([{ table: "content_pipeline_items", queryKey: "content-pipeline" }]);
  return useQuery({
    queryKey: ["content-pipeline"],
    queryFn: async () => {
      if (!supabase) return [] as ContentItem[];
      const { data, error } = await supabase
        .from("content_pipeline_items")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ContentItem[];
    },
  });
}

async function createContentItem(input: { title: string; description?: string; topic_url?: string; content_type?: string }): Promise<ContentItem | null> {
  if (!supabase) return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase
    .from("content_pipeline_items")
    .insert({
      title: input.title,
      description: input.description ?? "",
      topic_url: input.topic_url ?? null,
      content_type: input.content_type ?? "blog",
      status: "backlog",
    })
    .select()
    .single();
  if (error) throw error;
  return data as ContentItem;
}

async function updateContentItem(id: string, updates: Partial<ContentItem>): Promise<ContentItem | null> {
  if (!supabase) return null;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { data, error } = await supabase.from("content_pipeline_items").update(updates).eq("id", id).select().single();
  if (error) throw error;
  return data as ContentItem;
}

async function deleteContentItem(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from("content_pipeline_items").delete().eq("id", id);
  if (error) throw error;
}

/* ── Main Page ─────────────────────────────────────────────────────── */

export function MarketingPipelinePage() {
  const contentQuery = useContentPipeline();
  const queryClient = useQueryClient();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const items = useMemo(() => contentQuery.data ?? [], [contentQuery.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const selectedItem = useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);
  const activeItem = useMemo(() => items.find((i) => i.id === activeItemId) ?? null, [items, activeItemId]);

  useEffect(() => {
    if (selectedItemId && !items.some((i) => i.id === selectedItemId)) setSelectedItemId(null);
  }, [items, selectedItemId]);

  const wasDraggingRef = useRef(false);
  const validStatuses = useMemo(() => new Set(columns.map((c) => c.key)), []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    wasDraggingRef.current = true;
    setActiveItemId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItemId(null);
      setTimeout(() => { wasDraggingRef.current = false; }, 100);
      const { active, over } = event;
      if (!over) return;

      let newStatus = over.id as string as ContentStatus;
      if (!validStatuses.has(newStatus)) {
        const overItem = items.find((i) => i.id === newStatus);
        if (overItem) newStatus = overItem.status;
        else return;
      }

      const itemId = active.id as string;
      const item = items.find((i) => i.id === itemId);
      if (!item || item.status === newStatus) return;

      const updates: Partial<ContentItem> = { status: newStatus };
      if (newStatus === "published") updates.published_at = new Date().toISOString();
      else if (item.status === "published") updates.published_at = null;

      // Auto-assign agents based on stage
      if (newStatus === "research") updates.assigned_to = "lucy";
      else if (newStatus === "writing") updates.assigned_to = "sage";
      else if (newStatus === "design") updates.assigned_to = "pixel";
      else if (newStatus === "review") updates.assigned_to = "atlas";

      void (async () => {
        try {
          await updateContentItem(itemId, updates);
          await queryClient.invalidateQueries({ queryKey: ["content-pipeline"] });
          toast(`Moved "${item.title}" to ${formatLabel(newStatus)}`);
        } catch {
          toast("Failed to move item");
        }
      })();
    },
    [items, queryClient, validStatuses],
  );

  const handleCreated = useCallback(() => {
    setShowCreateModal(false);
    void queryClient.invalidateQueries({ queryKey: ["content-pipeline"] });
  }, [queryClient]);

  const handleUpdated = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["content-pipeline"] });
  }, [queryClient]);

  const handleDeleted = useCallback(() => {
    setSelectedItemId(null);
    void queryClient.invalidateQueries({ queryKey: ["content-pipeline"] });
  }, [queryClient]);

  // Mobile: status dropdown filter
  const [mobileStatus, setMobileStatus] = useState<ContentStatus>("backlog");

  if (contentQuery.isError) {
    return <ErrorState title="Pipeline unavailable" description="Content pipeline data failed to load." />;
  }
  const mobileItems = items.filter((i) => i.status === mobileStatus);

  return (
    <>
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Content Production"
          title="Marketing Pipeline"
          description="Drag content through production stages — from idea to published."
          action={
            <Button variant="primary" className="gap-1.5" onClick={() => setShowCreateModal(true)}>
              <Plus className="size-4" />
              New Content
            </Button>
          }
        />

        {contentQuery.isLoading ? (
          <div className="grid gap-3 xl:grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-[520px] rounded-3xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Mobile view */}
            <div className="lg:hidden space-y-3">
              <Select value={mobileStatus} onChange={(e) => setMobileStatus(e.target.value as ContentStatus)}>
                {columns.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.label} ({items.filter((i) => i.status === col.key).length})
                  </option>
                ))}
              </Select>
              <div className="space-y-2">
                {mobileItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-600">No items</p>
                ) : (
                  mobileItems.map((item) => (
                    <ContentCard key={item.id} item={item} onClick={() => setSelectedItemId(item.id)} />
                  ))
                )}
              </div>
            </div>

            {/* Desktop kanban */}
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <div className="hidden lg:block overflow-x-auto pb-2">
                <div className="grid min-w-[1600px] grid-cols-7 items-start gap-3">
                  {columns.map((column) => {
                    const colItems = items.filter((i) => i.status === column.key);
                    return (
                      <KanbanColumn
                        key={column.key}
                        column={column}
                        items={colItems}
                        onItemClick={setSelectedItemId}
                        hasDragActive={activeItemId !== null}
                      />
                    );
                  })}
                </div>
              </div>

              <DragOverlay>
                {activeItem ? (
                  <div className="w-[220px] opacity-90">
                    <ContentCard item={activeItem} onClick={() => {}} isDragging />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </>
        )}
      </div>

      {showCreateModal && (
        <CreateContentModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />
      )}

      <ContentDetailSheet
        item={selectedItem}
        onClose={() => setSelectedItemId(null)}
        onUpdated={handleUpdated}
        onDeleted={handleDeleted}
      />
    </>
  );
}

/* ── Kanban Column ─────────────────────────────────────────────────── */

function KanbanColumn({
  column,
  items,
  onItemClick,
  hasDragActive,
}: {
  column: (typeof columns)[number];
  items: ContentItem[];
  onItemClick: (id: string) => void;
  hasDragActive: boolean;
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
        <Badge className="px-2 py-0.5 text-[10px]">{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <div className={cn(
          "flex flex-1 items-center justify-center rounded-xl border border-dashed py-8 text-center text-sm transition-colors",
          isOver ? "border-emerald-400/30 text-emerald-300/60" : "border-transparent text-slate-600",
        )}>
          {isOver ? "Drop here" : "No items"}
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <DraggableContentCard key={item.id} item={item} onClick={() => onItemClick(item.id)} />
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Draggable Content Card ────────────────────────────────────────── */

function DraggableContentCard({ item, onClick }: { item: ContentItem; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    data: { type: "content", item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <ContentCard item={item} onClick={onClick} />
    </div>
  );
}

/* ── Content Card ──────────────────────────────────────────────────── */

function ContentCard({ item, onClick, isDragging }: { item: ContentItem; onClick: () => void; isDragging?: boolean }) {
  const contentType = (item.content_type ?? "blog") as ContentType;
  const typeStyle = CONTENT_TYPE_STYLES[contentType] ?? CONTENT_TYPE_STYLES.blog;
  const agent = item.assigned_to ? AGENT_MAP[item.assigned_to] : null;
  const hasImages = Array.isArray(item.image_urls) && item.image_urls.length > 0;

  return (
    <div
      className={cn(
        "group w-full rounded-[12px] border border-white/8 bg-white/[0.03] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.06]",
        isDragging && "shadow-2xl ring-2 ring-emerald-400/30",
      )}
    >
      <button type="button" onClick={onClick} className="w-full min-w-0 text-left focus-visible:outline-none">
        <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <Badge tone={typeStyle.tone} className="px-2 py-0.5 text-[10px]">{typeStyle.label}</Badge>
          {agent && (
            <span className="truncate" style={{ color: agent.color }}>
              {agent.emoji} {agent.name}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
          {item.topic_url && <ExternalLink className="size-3" />}
          {item.ghl_draft_url && <span className="text-emerald-400/70">Draft</span>}
          {hasImages && <ImageIcon className="size-3" />}
        </div>
      </button>
    </div>
  );
}

/* ── Create Content Modal ──────────────────────────────────────────── */

function CreateContentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [topicUrl, setTopicUrl] = useState("");
  const [contentType, setContentType] = useState("blog");
  const [saving, setSaving] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    void createContentItem({
      title: title.trim(),
      description: description.trim() || undefined,
      topic_url: topicUrl.trim() || undefined,
      content_type: contentType,
    })
      .then(() => { toast(`Created "${title.trim()}"`); onCreated(); })
      .catch(() => toast("Failed to create content item"))
      .finally(() => setSaving(false));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#02040a]/72 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d121e]/98 p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">New Content</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white"><X className="size-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Title *</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Content topic or idea" required autoFocus />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Details about this content piece" rows={3} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Topic URL</label>
            <Input value={topicUrl} onChange={(e) => setTopicUrl(e.target.value)} placeholder="https://inspiration-link.com" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Content Type</label>
            <Select value={contentType} onChange={(e) => setContentType(e.target.value)}>
              <option value="blog">Blog</option>
              <option value="social">Social</option>
              <option value="newsletter">Newsletter</option>
              <option value="email">Email</option>
            </Select>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Plus className="mr-1.5 size-4" />}
            Create
          </Button>
        </div>
      </form>
    </div>
  );
}

/* ── Content Detail Sheet ──────────────────────────────────────────── */

function ContentDetailSheet({
  item,
  onClose,
  onUpdated,
  onDeleted,
}: {
  item: ContentItem | null;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editTopicUrl, setEditTopicUrl] = useState("");
  const [editContentType, setEditContentType] = useState("blog");
  const [editStatus, setEditStatus] = useState<ContentStatus>("backlog");
  const [editAssignedTo, setEditAssignedTo] = useState("");

  useEffect(() => {
    if (item) {
      setEditTitle(item.title);
      setEditDescription(item.description ?? "");
      setEditTopicUrl(item.topic_url ?? "");
      setEditContentType(item.content_type ?? "blog");
      setEditStatus(item.status);
      setEditAssignedTo(item.assigned_to ?? "");
    }
    setEditing(false);
    setConfirmDelete(false);
  }, [item]);

  useEffect(() => {
    if (!item) return;
    const prev = document.body.style.overflow;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (editing) setEditing(false); else onClose(); }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [editing, onClose, item]);

  const handleSave = () => {
    if (!item || !editTitle.trim()) return;
    setSaving(true);
    const updates: Partial<ContentItem> = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      topic_url: editTopicUrl.trim() || null,
      content_type: editContentType,
      status: editStatus,
      assigned_to: editAssignedTo || null,
    };
    if (editStatus === "published" && item.status !== "published") updates.published_at = new Date().toISOString();
    else if (editStatus !== "published" && item.status === "published") updates.published_at = null;
    void updateContentItem(item.id, updates)
      .then(() => { toast(`Updated "${editTitle.trim()}"`); setEditing(false); onUpdated(); })
      .catch(() => toast("Failed to update"))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    if (!item) return;
    setSaving(true);
    void deleteContentItem(item.id)
      .then(() => { toast(`Deleted "${item.title}"`); onDeleted(); })
      .catch(() => toast("Failed to delete"))
      .finally(() => setSaving(false));
  };

  const handleQuickStatusChange = (newStatus: ContentStatus) => {
    if (!item || item.status === newStatus) return;
    setSaving(true);
    const updates: Partial<ContentItem> = { status: newStatus };
    if (newStatus === "published") updates.published_at = new Date().toISOString();
    else if (item.status === "published") updates.published_at = null;
    if (newStatus === "research") updates.assigned_to = "lucy";
    else if (newStatus === "writing") updates.assigned_to = "sage";
    else if (newStatus === "design") updates.assigned_to = "pixel";
    else if (newStatus === "review") updates.assigned_to = "atlas";
    void updateContentItem(item.id, updates)
      .then(() => { toast(`Moved "${item.title}" to ${formatLabel(newStatus)}`); setEditStatus(newStatus); onUpdated(); })
      .catch(() => toast("Failed to update status"))
      .finally(() => setSaving(false));
  };

  if (!item) return null;

  const contentType = (item.content_type ?? "blog") as ContentType;
  const typeStyle = CONTENT_TYPE_STYLES[contentType] ?? CONTENT_TYPE_STYLES.blog;
  const agent = item.assigned_to ? AGENT_MAP[item.assigned_to] : null;
  const hasImages = Array.isArray(item.image_urls) && item.image_urls.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-[#02040a]/72 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-[540px] flex-col border-l border-white/10 bg-[linear-gradient(180deg,rgba(13,18,30,0.98),rgba(7,10,18,0.99))] shadow-[-30px_0_80px_rgba(0,0,0,0.45)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-5 md:px-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={getStatusTone(item.status)}>{formatLabel(item.status)}</Badge>
              <Badge tone={typeStyle.tone}>{typeStyle.label}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Content details</p>
              {editing ? (
                <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="mt-2 text-lg font-semibold" />
              ) : (
                <h2 className="mt-2 text-2xl font-semibold text-white">{item.title}</h2>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white">
                <Pencil className="size-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-slate-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 md:px-6 md:py-6">
          {/* Quick Status */}
          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <label className="mb-2 block text-xs uppercase tracking-[0.24em] text-slate-500">Quick Status Change</label>
            <Select
              value={editing ? editStatus : item.status}
              onChange={(e) => {
                const ns = e.target.value as ContentStatus;
                if (editing) setEditStatus(ns);
                else handleQuickStatusChange(ns);
              }}
              disabled={saving}
            >
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{formatLabel(s)}</option>)}
            </Select>
          </Card>

          {/* Description */}
          <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Description</p>
            {editing ? (
              <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={4} className="mt-3" placeholder="Add a description..." />
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-200">
                {item.description?.trim() || "No description yet."}
              </p>
            )}
          </Card>

          {editing ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Content Type</label>
                <Select value={editContentType} onChange={(e) => setEditContentType(e.target.value)}>
                  <option value="blog">Blog</option>
                  <option value="social">Social</option>
                  <option value="newsletter">Newsletter</option>
                  <option value="email">Email</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Assigned to</label>
                <Select value={editAssignedTo} onChange={(e) => setEditAssignedTo(e.target.value)}>
                  <option value="">Unassigned</option>
                  {Object.entries(AGENT_MAP).map(([id, a]) => (
                    <option key={id} value={id}>{a.emoji} {a.name}</option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs uppercase tracking-wider text-slate-500">Topic URL</label>
                <Input value={editTopicUrl} onChange={(e) => setEditTopicUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailTile icon={Megaphone} label="Content Type" value={typeStyle.label} />
                <DetailTile icon={UserRound} label="Assigned to" value={agent ? `${agent.emoji} ${agent.name}` : "Unassigned"} accentColor={agent?.color} />
                <DetailTile icon={CalendarDays} label="Created" value={formatDateTime(item.created_at)} />
                <DetailTile icon={CalendarDays} label="Published" value={item.published_at ? formatDateTime(item.published_at) : "Not published"} />
              </div>

              {/* Topic URL */}
              {item.topic_url && (
                <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="size-4 text-slate-400" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Topic URL</p>
                  </div>
                  <a href={item.topic_url} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-sm text-sky-400 hover:underline">
                    {item.topic_url}
                  </a>
                </Card>
              )}

              {/* GHL Draft */}
              {item.ghl_draft_url && (
                <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
                  <div className="flex items-center gap-2">
                    <FileText className="size-4 text-emerald-400" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">GHL Draft</p>
                  </div>
                  <a href={item.ghl_draft_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:underline">
                    View Draft <ExternalLink className="size-3" />
                  </a>
                </Card>
              )}

              {/* Images */}
              {hasImages && (
                <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
                  <div className="flex items-center gap-2 mb-3">
                    <ImageIcon className="size-4 text-slate-400" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Images</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(item.image_urls ?? []).map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border border-white/8 transition hover:border-white/20">
                        <img src={url} alt={`Content image ${i + 1}`} className="h-[80px] w-[120px] object-cover" loading="lazy" />
                      </a>
                    ))}
                  </div>
                </Card>
              )}

              {/* Research Notes */}
              {item.research_notes && (
                <ResearchNotesSection text={item.research_notes} />
              )}

              {/* Blog URL */}
              {item.blog_url && (
                <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
                  <div className="flex items-center gap-2">
                    <ExternalLink className="size-4 text-sky-400" />
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Published Blog</p>
                  </div>
                  <a href={item.blog_url} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate text-sm text-sky-400 hover:underline">
                    {item.blog_url}
                  </a>
                </Card>
              )}
            </>
          )}

          {/* Actions */}
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
                  <p className="flex-1 text-sm text-rose-200">Delete permanently?</p>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={saving} className="text-xs">Cancel</Button>
                  <button type="button" onClick={handleDelete} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20">
                    {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                    Delete
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-rose-300">
                  <Trash2 className="size-3.5" /> Delete item
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Research Notes Section ────────────────────────────────────────── */

function ResearchNotesSection({ text }: { text: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-slate-400" />
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Research Notes</p>
        </div>
        <ChevronDown className={cn("size-4 text-slate-500 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] p-3 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">
          {text}
        </div>
      )}
    </Card>
  );
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function DetailTile({ icon: Icon, label, value, accentColor }: { icon: typeof CalendarDays; label: string; value: string; accentColor?: string }) {
  return (
    <Card className="border-white/8 bg-white/[0.03] p-4 shadow-none">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon className="size-4" style={accentColor ? { color: accentColor } : undefined} />
        <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
      </div>
      <p className="mt-3 text-sm font-medium text-white" style={accentColor ? { color: accentColor } : undefined}>{value}</p>
    </Card>
  );
}

function formatLabel(value: string) {
  return value.split("_").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function getStatusTone(status: string): "default" | "success" | "warning" | "danger" {
  if (status === "published") return "success";
  if (status === "review") return "warning";
  return "default";
}
