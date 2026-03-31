import { useAutomationsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn } from "@/shared/lib/utils";
import type { AutomationRecord } from "@/shared/types/models";
import { Bot, Cable, Cpu, RadioTower, Search } from "lucide-react";
import { useMemo, useState } from "react";

const columns = [
  { key: "backlog", label: "Backlog", dotClassName: "bg-slate-400/80" },
  { key: "design", label: "Design", dotClassName: "bg-violet-400/80" },
  { key: "building", label: "Building", dotClassName: "bg-sky-400/80" },
  { key: "testing", label: "Testing", dotClassName: "bg-cyan-400/80" },
  { key: "live", label: "Live", dotClassName: "bg-emerald-300/80" },
  { key: "paused", label: "Paused", dotClassName: "bg-amber-300/80" },
  { key: "retired", label: "Retired", dotClassName: "bg-rose-400/80" },
] as const;

type AutomationStatus = (typeof columns)[number]["key"];
type AutomationTypeFilter = "all" | "AI Agent" | "n8n" | "Hybrid" | "Script";
type AgentFilter = "all" | "atlas" | "max" | "lucy" | "dash";

const AGENT_STYLES: Record<string, { label: string; color: string; border: string; background: string }> = {
  atlas: { label: "Atlas", color: "#16a34a", border: "rgba(22,163,74,0.26)", background: "rgba(22,163,74,0.14)" },
  "atlas/main": { label: "Atlas/Main", color: "#16a34a", border: "rgba(22,163,74,0.26)", background: "rgba(22,163,74,0.14)" },
  lucy: { label: "Lucy", color: "#7c3aed", border: "rgba(124,58,237,0.28)", background: "rgba(124,58,237,0.14)" },
  max: { label: "Max", color: "#ef4444", border: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.14)" },
  dash: { label: "Dash", color: "#0ea5e9", border: "rgba(14,165,233,0.28)", background: "rgba(14,165,233,0.14)" },
};

const TYPE_STYLES: Record<string, { label: string; className: string }> = {
  "ai agent": { label: "AI Agent", className: "border-emerald-400/25 bg-emerald-400/10 text-emerald-300" },
  n8n: { label: "n8n", className: "border-orange-400/25 bg-orange-400/10 text-orange-300" },
  hybrid: { label: "Hybrid", className: "border-violet-400/25 bg-violet-400/10 text-violet-300" },
  script: { label: "Script", className: "border-slate-400/20 bg-slate-400/10 text-slate-300" },
};

const PRIORITY_BORDER_CLASS: Record<string, string> = {
  high: "border-l-rose-400",
  medium: "border-l-amber-300",
  low: "border-l-slate-500",
};

export function AutomationsPage() {
  const automationsQuery = useAutomationsQuery();
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AutomationTypeFilter>("all");
  const [search, setSearch] = useState("");

  const automations = useMemo(() => automationsQuery.data ?? [], [automationsQuery.data]);

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
        || (automation.notes ?? "").toLowerCase().includes(needle);

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

    return ["atlas", "max", "lucy", "dash"].map((key) => ({
      key,
      count: counts[key] ?? 0,
      style: AGENT_STYLES[key],
    }));
  }, [filteredAutomations]);

  if (automationsQuery.isError) {
    return <ErrorState title="Automations unavailable" description="Automation data failed to load from Supabase." />;
  }

  return (
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

          <Card className="border-white/8 bg-[#0b1018]/95 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="grid gap-3 lg:grid-cols-[220px_220px_minmax(0,1fr)]">
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.22em] text-slate-500">Agent</label>
                <Select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as AgentFilter)}>
                  <option value="all">All agents</option>
                  <option value="atlas">Atlas</option>
                  <option value="max">Max</option>
                  <option value="lucy">Lucy</option>
                  <option value="dash">Dash</option>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs uppercase tracking-[0.22em] text-slate-500">Type</label>
                <Select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as AutomationTypeFilter)}>
                  <option value="all">All types</option>
                  <option value="AI Agent">AI Agent</option>
                  <option value="n8n">n8n</option>
                  <option value="Hybrid">Hybrid</option>
                  <option value="Script">Script</option>
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
                return <KanbanColumn key={column.key} column={column} items={columnAutomations} />;
              })}
            </div>
          </div>
        </>
      )}
    </div>
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
}: {
  column: (typeof columns)[number];
  items: AutomationRecord[];
}) {
  return (
    <Card className="flex min-h-[520px] min-w-0 flex-col overflow-hidden border-white/8 p-3">
      <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.03] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("size-2.5 rounded-full", column.dotClassName)} />
          <p className="truncate text-sm font-semibold text-white">{column.label}</p>
        </div>
        <Badge className="px-2 py-0.5 text-[10px]">{items.length}</Badge>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-transparent py-8 text-center text-sm text-slate-600">
          No automations
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <AutomationCard key={item.id} automation={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AutomationCard({ automation }: { automation: AutomationRecord }) {
  const typeKey = normalizeTypeKey(automation.type);
  const typeStyle = TYPE_STYLES[typeKey] ?? { label: automation.type || "Unknown", className: "border-white/10 bg-white/5 text-slate-300" };
  const agentKey = normalizeAgentKey(automation.assigned_to);
  const agentStyle = agentKey ? AGENT_STYLES[agentKey] : undefined;
  const priorityClassName = PRIORITY_BORDER_CLASS[normalizePriority(automation.priority)] ?? PRIORITY_BORDER_CLASS.low;
  const isLive = normalizeStatus(automation.status) === "live";
  const integrations = Array.isArray(automation.integrations) ? automation.integrations.filter(Boolean) : [];

  return (
    <div className={cn("rounded-[12px] border border-white/8 border-l-4 bg-white/[0.03] p-3 transition hover:border-white/16 hover:bg-white/[0.06]", priorityClassName)}>
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
          style={agentStyle ? { color: agentStyle.color, borderColor: agentStyle.border, backgroundColor: agentStyle.background } : undefined}
        >
          {agentStyle?.label ?? (automation.assigned_to?.trim() || "Unassigned")}
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
    </div>
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
  return TYPE_STYLES[value]?.label ?? value;
}

function normalizeAgentKey(value: string | null | undefined): AgentFilter | "unassigned" {
  const normalized = value?.trim().toLowerCase() ?? "";
  if (!normalized) return "unassigned";
  if (normalized === "atlas/main") return "atlas";
  if (normalized.includes("atlas")) return "atlas";
  if (normalized.includes("max")) return "max";
  if (normalized.includes("lucy")) return "lucy";
  if (normalized.includes("dash")) return "dash";
  return "unassigned";
}

function normalizePriority(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "low";
  if (normalized === "high" || normalized === "medium" || normalized === "low") return normalized;
  return "low";
}
