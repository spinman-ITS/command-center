import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Textarea } from "@/shared/components/ui/textarea";
import { showToast } from "@/shared/components/ui/toast";
import { useAutomationsQuery } from "@/shared/hooks/use-command-center-data";
import { createAutomation, deleteAutomation, type AutomationInput, updateAutomation } from "@/shared/lib/data";
import { cn } from "@/shared/lib/utils";
import type { AutomationRecord } from "@/shared/types/models";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Cable, Cpu, RadioTower, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const columns = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80", collapsible: false },
  { key: "design", label: "Design", dotClassName: "bg-violet-400/80", collapsible: false },
  { key: "building", label: "Building", dotClassName: "bg-sky-400/80", collapsible: false },
  { key: "testing", label: "Testing", dotClassName: "bg-cyan-400/80", collapsible: false },
  { key: "paused", label: "Paused", dotClassName: "bg-amber-300/80", collapsible: false },
  { key: "live", label: "Live", dotClassName: "bg-emerald-300/80", collapsible: true },
  { key: "retired", label: "Retired", dotClassName: "bg-rose-400/80", collapsible: false },
] as const;

const typeOptions = ["AI Agent", "n8n", "Hybrid", "Script", "Other"] as const;
const platformOptions = ["OpenClaw", "n8n", "Zapier", "Custom Script", "Other"] as const;
const statusOptions = ["Backlog", "Design", "Building", "Testing", "Live", "Paused", "Retired"] as const;
const assigneeOptions = ["atlas", "max", "lucy", "dash", "luka", "sage", "pixel", "scout", "unassigned"] as const;
const triggerOptions = ["Cron", "Interval", "Webhook", "Manual", "Event"] as const;
const priorityOptions = ["High", "Medium", "Low"] as const;

type AutomationStatus = (typeof columns)[number]["key"];
type AutomationTypeFilter = "all" | "AI Agent" | "n8n" | "Hybrid" | "Script" | "Other";
type AgentFilter = "all" | "atlas" | "max" | "lucy" | "dash" | "luka" | "sage" | "pixel" | "scout";

interface AutomationFormValues {
  name: string;
  description: string;
  type: string;
  platform: string;
  status: string;
  assigned_to: string;
  trigger_type: string;
  frequency: string;
  integrations: string;
  priority: string;
  systems_requirements: string;
  expected_behavior: string;
  notes: string;
}

const DEFAULT_FORM_VALUES: AutomationFormValues = {
  name: "",
  description: "",
  type: "AI Agent",
  platform: "OpenClaw",
  status: "Backlog",
  assigned_to: "unassigned",
  trigger_type: "Manual",
  frequency: "",
  integrations: "",
  priority: "Medium",
  systems_requirements: "",
  expected_behavior: "",
  notes: "",
};

const AGENT_STYLES: Record<string, { label: string; color: string; border: string; background: string }> = {
  atlas: { label: "Atlas", color: "#16a34a", border: "rgba(22,163,74,0.26)", background: "rgba(22,163,74,0.14)" },
  "atlas/main": { label: "Atlas/Main", color: "#16a34a", border: "rgba(22,163,74,0.26)", background: "rgba(22,163,74,0.14)" },
  lucy: { label: "Lucy", color: "#7c3aed", border: "rgba(124,58,237,0.28)", background: "rgba(124,58,237,0.14)" },
  max: { label: "Max", color: "#ef4444", border: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.14)" },
  dash: { label: "Dash", color: "#0ea5e9", border: "rgba(14,165,233,0.28)", background: "rgba(14,165,233,0.14)" },
  luka: { label: "Luka", color: "#f97316", border: "rgba(249,115,22,0.28)", background: "rgba(249,115,22,0.14)" },
  sage: { label: "Sage", color: "#14b8a6", border: "rgba(20,184,166,0.28)", background: "rgba(20,184,166,0.14)" },
  pixel: { label: "Pixel", color: "#ec4899", border: "rgba(236,72,153,0.28)", background: "rgba(236,72,153,0.14)" },
  scout: { label: "Scout", color: "#eab308", border: "rgba(234,179,8,0.28)", background: "rgba(234,179,8,0.14)" },
  unassigned: { label: "Unassigned", color: "#94a3b8", border: "rgba(148,163,184,0.22)", background: "rgba(148,163,184,0.1)" },
};

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  "ai agent": { label: "AI Agent", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  n8n: { label: "n8n", className: "border-orange-400/25 bg-orange-400/10 text-orange-300" },
  hybrid: { label: "Hybrid", className: "border-violet-400/25 bg-violet-400/10 text-violet-300" },
  script: { label: "Script", className: "border-slate-400/20 bg-slate-400/10 text-slate-300" },
  other: { label: "Other", className: "border-sky-400/25 bg-sky-400/10 text-sky-300" },
};

const PRIORITY_BORDER_CLASS: Record<string, string> = {
  high: "border-l-rose-400",
  medium: "border-l-amber-300",
  low: "border-l-slate-500",
};

export function AutomationsPage() {
  const automationsQuery = useAutomationsQuery();
  const queryClient = useQueryClient();
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AutomationTypeFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedAutomation, setSelectedAutomation] = useState<AutomationRecord | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [formValues, setFormValues] = useState<AutomationFormValues>(DEFAULT_FORM_VALUES);

  const automations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);

  useEffect(() => {
    if (!isPanelOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPanelOpen(false);
        setSelectedAutomation(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPanelOpen]);

  const invalidateAutomations = async () => {
    await queryClient.invalidateQueries({ queryKey: ["automations"] });
  };

  const createMutation = useMutation({
    mutationFn: (input: AutomationInput) => createAutomation(input),
    onSuccess: async () => {
      await invalidateAutomations();
      closePanel();
      showToast("Automation created");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<Omit<AutomationRecord, "id" | "created_at" | "updated_at">> }) => updateAutomation(id, input),
    onSuccess: async () => {
      await invalidateAutomations();
      closePanel();
      showToast("Automation updated");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAutomation(id),
    onSuccess: async () => {
      await invalidateAutomations();
      closePanel();
      showToast("Automation deleted");
    },
  });

  const isSaving = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const filteredAutomations = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return automations.filter((automation) => {
      const normalizedAgent = normalizeAgentKey(automation.assigned_to);
      const normalizedType = normalizeTypeKey(automation.type);

      const matchesAgent = agentFilter === "all" || normalizedAgent === agentFilter;
      const matchesType = typeFilter === "all" || getTypeLabel(normalizedType) === typeFilter;
      const matchesSearch =
        needle.length === 0
        || automation.name.toLowerCase().includes(needle)
        || (automation.description ?? "").toLowerCase().includes(needle)
        || (automation.platform ?? "").toLowerCase().includes(needle)
        || (automation.notes ?? "").toLowerCase().includes(needle)
        || (automation.expected_behavior ?? "").toLowerCase().includes(needle)
        || (automation.systems_requirements ?? "").toLowerCase().includes(needle);

      return matchesAgent && matchesType && matchesSearch;
    });
  }, [agentFilter, automations, search, typeFilter]);

  const totalCount = filteredAutomations.length;
  const liveCount = filteredAutomations.filter((item) => normalizeStatus(item.status) === "live").length;
  const buildingCount = filteredAutomations.filter((item) => {
    const status = normalizeStatus(item.status);
    return status === "backlog" || status === "building";
  }).length;

  const agentBreakdown = useMemo(() => {
    const counts = filteredAutomations.reduce<Record<string, number>>((acc, item) => {
      const key = normalizeAgentKey(item.assigned_to) || "unassigned";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});

    return ["atlas", "max", "lucy", "dash", "luka", "sage", "pixel", "scout", "unassigned"].map((key) => ({
      key,
      count: counts[key] ?? 0,
      style: AGENT_STYLES[key],
    }));
  }, [filteredAutomations]);

  function closePanel() {
    setIsPanelOpen(false);
    setSelectedAutomation(null);
    setFormValues(DEFAULT_FORM_VALUES);
  }

  function openCreatePanel() {
    setSelectedAutomation(null);
    setFormValues(DEFAULT_FORM_VALUES);
    setIsPanelOpen(true);
  }

  function openEditPanel(automation: AutomationRecord) {
    setSelectedAutomation(automation);
    setFormValues({
      name: automation.name ?? "",
      description: automation.description ?? "",
      type: automation.type ?? "AI Agent",
      platform: automation.platform ?? "OpenClaw",
      status: toTitleCaseStatus(normalizeStatus(automation.status)),
      assigned_to: automation.assigned_to?.trim() || "unassigned",
      trigger_type: automation.trigger_type ?? "Manual",
      frequency: automation.frequency ?? "",
      integrations: Array.isArray(automation.integrations) ? automation.integrations.join(", ") : "",
      priority: toTitleCasePriority(normalizePriority(automation.priority)),
      systems_requirements: automation.systems_requirements ?? "",
      expected_behavior: automation.expected_behavior ?? "",
      notes: automation.notes ?? "",
    });
    setIsPanelOpen(true);
  }

  function handleFieldChange<K extends keyof AutomationFormValues>(key: K, value: AutomationFormValues[K]) {
    setFormValues((prev) => ({ ...prev, [key]: value }));
  }

  function toPayload(values: AutomationFormValues): AutomationInput {
    return {
      name: values.name.trim(),
      description: values.description.trim(),
      type: values.type.trim(),
      platform: values.platform.trim(),
      status: values.status.trim().toLowerCase(),
      assigned_to: values.assigned_to.trim().toLowerCase(),
      trigger_type: values.trigger_type.trim(),
      frequency: values.frequency.trim(),
      integrations: values.integrations.split(",").map((item) => item.trim()).filter(Boolean),
      priority: values.priority.trim().toLowerCase(),
      systems_requirements: values.systems_requirements.trim(),
      expected_behavior: values.expected_behavior.trim(),
      notes: values.notes.trim(),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!formValues.name.trim() || !formValues.description.trim()) {
      showToast("Name and description are required");
      return;
    }

    const payload = toPayload(formValues);

    try {
      if (selectedAutomation) {
        await updateMutation.mutateAsync({ id: selectedAutomation.id, input: payload });
      } else {
        await createMutation.mutateAsync(payload);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save automation");
    }
  }

  async function handleDelete() {
    if (!selectedAutomation) return;
    const confirmed = window.confirm(`Delete automation "${selectedAutomation.name}"?`);
    if (!confirmed) return;

    try {
      await deleteMutation.mutateAsync(selectedAutomation.id);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to delete automation");
    }
  }

  if (automationsQuery.isError) {
    return <ErrorState title="Automations unavailable" description="Automation data failed to load from Supabase." />;
  }

  return (
    <>
      <div className="space-y-5">
        <SectionHeader
          eyebrow="Automation"
          title="Automations & Workflows"
          description="AI agents, cron jobs, and n8n workflows"
        />

        {automationsQuery.isLoading ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 rounded-3xl" />
              ))}
            </div>
            <div className="grid gap-3 xl:grid-cols-7">
              {Array.from({ length: 7 }).map((_, index) => (
                <Skeleton key={index} className="h-[520px] rounded-3xl" />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch xl:justify-between">
              <div className="grid flex-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <StatCard icon={Cpu} label="Total Automations" value={String(totalCount)} tone="default" />
                <StatCard icon={RadioTower} label="Live" value={String(liveCount)} tone="success" />
                <StatCard icon={Bot} label="Backlog + Building" value={String(buildingCount)} tone="warning" />
                <Card className="border-white/8 bg-[#0b1018]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
                  <div className="flex items-start gap-3">
                    <div className="flex size-10 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">
                      <Cable className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Agent Breakdown</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {agentBreakdown.map((agent) => {
                          const style = agent.style ?? {
                            label: agent.key,
                            color: "#cbd5e1",
                            border: "rgba(148,163,184,0.18)",
                            background: "rgba(148,163,184,0.08)",
                          };

                          return (
                            <span
                              key={agent.key}
                              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
                              style={{
                                color: style.color,
                                borderColor: style.border,
                                backgroundColor: style.background,
                              }}
                            >
                              <span className="text-white/90">{style.label}</span>
                              <span className="text-white/45">•</span>
                              <span>{agent.count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Card>
              </div>

              <Card className="border-white/8 bg-[#0b1018]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)] xl:w-[220px]">
                <div className="flex h-full flex-col justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Actions</p>
                    <p className="mt-2 text-sm text-slate-400">Create a new automation and place it directly into the right kanban lane.</p>
                  </div>
                  <Button onClick={openCreatePanel} className="w-full">+ New Automation</Button>
                </div>
              </Card>
            </div>

            <Card className="border-white/8 bg-[#0b1018]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
              <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.22em] text-slate-500">Agent</label>
                  <Select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as AgentFilter)}>
                    <option value="all">All agents</option>
                    {assigneeOptions.filter((value) => value !== "unassigned").map((value) => (
                      <option key={value} value={value}>{toDisplayName(value)}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.22em] text-slate-500">Type</label>
                  <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AutomationTypeFilter)}>
                    <option value="all">All types</option>
                    {typeOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs uppercase tracking-[0.22em] text-slate-500">Search</label>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by automation name" className="pl-9" />
                  </div>
                </div>
              </div>
            </Card>

            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1600px] grid-cols-7 items-start gap-3">
                {columns.map((column) => {
                  const columnAutomations = filteredAutomations.filter((item) => normalizeStatus(item.status) === column.key);
                  return <KanbanColumn key={column.key} column={column} items={columnAutomations} onSelect={openEditPanel} />;
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {isPanelOpen ? (
        <AutomationFormPanel
          automation={selectedAutomation}
          formValues={formValues}
          isSaving={isSaving}
          onChange={handleFieldChange}
          onClose={closePanel}
          onDelete={handleDelete}
          onSubmit={handleSubmit}
        />
      ) : null}
    </>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  tone: "default" | "success" | "warning";
}) {
  const iconClassName =
    tone === "success"
      ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
      : tone === "warning"
        ? "border-amber-300/20 bg-amber-300/10 text-amber-200"
        : "border-white/10 bg-white/5 text-slate-200";

  return (
    <Card className="border-white/8 bg-[#0b1018]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="flex items-start gap-3">
        <div className={cn("flex size-10 items-center justify-center rounded-2xl border", iconClassName)}>
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
      </div>
    </Card>
  );
}

function KanbanColumn({
  column,
  items,
  onSelect,
}: {
  column: (typeof columns)[number];
  items: AutomationRecord[];
  onSelect: (automation: AutomationRecord) => void;
}) {
  const [collapsed, setCollapsed] = useState(column.collapsible === true);

  return (
    <Card className="flex min-h-[520px] min-w-0 flex-col overflow-hidden border-white/8 p-3">
      <button
        type="button"
        className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2 text-left"
        onClick={() => { if (column.collapsible) setCollapsed((prev) => !prev); }}
        style={{ cursor: column.collapsible ? "pointer" : "default" }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 rounded-full", column.dotClassName)} />
          <p className="truncate text-sm font-semibold text-white">{column.label}</p>
          {column.collapsible && (
            <span className="text-xs text-slate-500">{collapsed ? "▸" : "▾"}</span>
          )}
        </div>
        <Badge className="px-2 py-0.5 text-[10px]">{items.length}</Badge>
      </button>

      {collapsed ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-transparent py-8 text-center text-sm text-slate-500">
          {items.length} automation{items.length !== 1 ? "s" : ""} — click to expand
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-transparent py-8 text-center text-sm text-slate-600">
          No automations
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <AutomationCard key={item.id} automation={item} onClick={() => onSelect(item)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AutomationCard({ automation, onClick }: { automation: AutomationRecord; onClick: () => void }) {
  const typeKey = normalizeTypeKey(automation.type);
  const typeStyle = TYPE_STYLES[typeKey] ?? { label: automation.type || "Unknown", className: "border-white/10 bg-white/5 text-slate-300" };
  const agentKey = normalizeAgentKey(automation.assigned_to);
  const agentStyle = AGENT_STYLES[agentKey] ?? AGENT_STYLES.unassigned ?? {
    label: "Unassigned",
    color: "#94a3b8",
    border: "rgba(148,163,184,0.22)",
    background: "rgba(148,163,184,0.1)",
  };
  const priorityClassName = PRIORITY_BORDER_CLASS[normalizePriority(automation.priority)] ?? PRIORITY_BORDER_CLASS.low;
  const isLive = normalizeStatus(automation.status) === "live";
  const integrations = Array.isArray(automation.integrations) ? automation.integrations.filter(Boolean) : [];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full rounded-[12px] border border-white/8 border-l-4 bg-white/[0.03] p-3 text-left transition hover:border-white/16 hover:bg-white/[0.06]",
        priorityClassName,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="line-clamp-2 text-sm font-semibold text-white">{automation.name}</p>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="absolute inline-flex size-2.5 animate-ping rounded-full bg-emerald-400/60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(74,222,128,0.9)]" />
            </span>
            Live
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium", typeStyle.className)}>
          {typeStyle.label}
        </span>
        <span
          className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{ color: agentStyle.color, borderColor: agentStyle.border, backgroundColor: agentStyle.background }}
        >
          {agentStyle.label}
        </span>
      </div>

      {automation.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{automation.description}</p> : null}

      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500">
          <span className="truncate">{automation.platform || "Unknown platform"}</span>
          <span className="truncate text-right text-slate-400">{automation.frequency || "No schedule"}</span>
        </div>

        {integrations.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {integrations.map((integration) => (
              <span key={integration} className="inline-flex items-center rounded-full border border-white/8 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                {integration}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </button>
  );
}

function AutomationFormPanel({
  automation,
  formValues,
  isSaving,
  onChange,
  onClose,
  onDelete,
  onSubmit,
}: {
  automation: AutomationRecord | null;
  formValues: AutomationFormValues;
  isSaving: boolean;
  onChange: <K extends keyof AutomationFormValues>(key: K, value: AutomationFormValues[K]) => void;
  onClose: () => void;
  onDelete: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
      <button type="button" aria-label="Close panel" className="flex-1 cursor-default" onClick={onClose} />
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/10 bg-[#081019] shadow-[-24px_0_80px_rgba(0,0,0,0.45)]">
        <div className="sticky top-0 z-10 border-b border-white/10 bg-[#081019]/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{automation ? "Edit automation" : "Create automation"}</p>
              <h2 className="mt-2 text-xl font-semibold text-white">{automation ? automation.name : "New Automation"}</h2>
              <p className="mt-1 text-sm text-slate-400">Capture platform details, trigger rules, systems, and expected behavior in one place.</p>
            </div>
            <Button type="button" variant="ghost" onClick={onClose} className="px-3 text-slate-300">
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-6 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Name" required>
              <Input value={formValues.name} onChange={(event) => onChange("name", event.target.value)} placeholder="Automation name" required />
            </Field>
            <Field label="Frequency">
              <Input value={formValues.frequency} onChange={(event) => onChange("frequency", event.target.value)} placeholder="Every 15 minutes" />
            </Field>
          </div>

          <Field label="Description" required hint="What does this automation do? What are the expectations?">
            <Textarea value={formValues.description} onChange={(event) => onChange("description", event.target.value)} rows={4} required />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Type">
              <Select value={formValues.type} onChange={(event) => onChange("type", event.target.value)}>
                {typeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Field label="Platform">
              <Select value={formValues.platform} onChange={(event) => onChange("platform", event.target.value)}>
                {platformOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={formValues.status} onChange={(event) => onChange("status", event.target.value)}>
                {statusOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Field label="Assigned To">
              <Select value={formValues.assigned_to} onChange={(event) => onChange("assigned_to", event.target.value)}>
                {assigneeOptions.map((option) => <option key={option} value={option}>{toDisplayName(option)}</option>)}
              </Select>
            </Field>
            <Field label="Trigger Type">
              <Select value={formValues.trigger_type} onChange={(event) => onChange("trigger_type", event.target.value)}>
                {triggerOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
            <Field label="Priority">
              <Select value={formValues.priority} onChange={(event) => onChange("priority", event.target.value)}>
                {priorityOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Integrations" hint="Comma-separated integrations like Slack, Notion, Supabase, Microsoft Graph">
            <Input value={formValues.integrations} onChange={(event) => onChange("integrations", event.target.value)} placeholder="Syncro, Huntress, Slack" />
          </Field>

          <Field label="Systems & Requirements" hint="What APIs, credentials, and systems are needed?">
            <Textarea value={formValues.systems_requirements} onChange={(event) => onChange("systems_requirements", event.target.value)} rows={4} />
          </Field>

          <Field label="Expected Behavior" hint="What should this automation do step by step? What's the expected output?">
            <Textarea value={formValues.expected_behavior} onChange={(event) => onChange("expected_behavior", event.target.value)} rows={5} />
          </Field>

          <Field label="Notes" hint="Additional context">
            <Textarea value={formValues.notes} onChange={(event) => onChange("notes", event.target.value)} rows={4} />
          </Field>

          <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              {automation ? (
                <Button type="button" variant="secondary" onClick={onDelete} disabled={isSaving} className="border-rose-400/20 bg-rose-400/10 text-rose-200 hover:border-rose-400/40 hover:bg-rose-400/15">
                  {isSaving ? "Working..." : "Delete"}
                </Button>
              ) : null}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
              <Button type="submit" disabled={isSaving}>{isSaving ? "Saving..." : automation ? "Save Changes" : "Create Automation"}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: React.PropsWithChildren<{ label: string; required?: boolean; hint?: string }>) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs uppercase tracking-[0.22em] text-slate-500">
        {label}
        {required ? <span className="ml-1 text-rose-300">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs leading-5 text-slate-500">{hint}</span> : null}
    </label>
  );
}

function normalizeStatus(value: string | null | undefined): AutomationStatus {
  const normalized = value?.trim().toLowerCase() ?? "backlog";
  if (columns.some((column) => column.key === normalized)) return normalized as AutomationStatus;
  return "backlog";
}

function normalizeTypeKey(value: string | null | undefined) {
  return (value?.trim().toLowerCase() ?? "script").replace(/\s+/g, " ");
}

function getTypeLabel(value: string) {
  return TYPE_STYLES[value]?.label ?? toDisplayName(value);
}

function normalizeAgentKey(value: string | null | undefined): Exclude<AgentFilter, "all"> | "unassigned" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "unassigned";
  if (normalized === "atlas/main") return "atlas";
  if (normalized.includes("atlas")) return "atlas";
  if (normalized.includes("max")) return "max";
  if (normalized.includes("lucy")) return "lucy";
  if (normalized.includes("dash")) return "dash";
  if (normalized.includes("luka")) return "luka";
  if (normalized.includes("sage")) return "sage";
  if (normalized.includes("pixel")) return "pixel";
  if (normalized.includes("scout")) return "scout";
  return "unassigned";
}

function normalizePriority(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "low";
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "low";
}

function toDisplayName(value: string) {
  return value
    .split(/[\s/_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toTitleCaseStatus(value: AutomationStatus) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function toTitleCasePriority(value: "high" | "medium" | "low") {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
