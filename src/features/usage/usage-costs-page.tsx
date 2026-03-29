import { supabase } from "@/integrations/supabase/client";
import { useAgentsQuery } from "@/shared/hooks/use-command-center-data";
import { Card } from "@/shared/components/ui/card";
import { ErrorState } from "@/shared/components/error-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn, formatRelativeTime } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Zap, Cpu, Bot } from "lucide-react";
import { useState } from "react";

// ── Types ───────────────────────────────────────────────────────────

interface UsageRow {
  id: string;
  agent_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  estimated_cost: number;
  created_at: string;
}

// ── Date helpers ────────────────────────────────────────────────────

type TimeRange = "today" | "week" | "month" | "all";

function getRangeStart(range: TimeRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
  } else if (range === "week") {
    now.setDate(now.getDate() - 7);
  } else {
    now.setDate(now.getDate() - 30);
  }
  return now.toISOString();
}

// ── Data hook ───────────────────────────────────────────────────────

function useUsageTracking(range: TimeRange) {
  return useQuery({
    queryKey: ["usage-tracking", range],
    queryFn: async () => {
      if (!supabase) return [] as UsageRow[];
      let query = supabase
        .from("usage_tracking")
        .select("*")
        .order("created_at", { ascending: false });
      const rangeStart = getRangeStart(range);
      if (rangeStart) {
        query = query.gte("created_at", rangeStart);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });
}

// ── Formatting helpers ──────────────────────────────────────────────

function formatCost(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(2)}`;
  return `$${value.toFixed(4)}`;
}

function formatTokens(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

// ── Stat card ───────────────────────────────────────────────────────

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-white/6 text-slate-300">{icon}</div>
      </div>
    </Card>
  );
}

// ── Page ────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

export function UsageCostsPage() {
  const [range, setRange] = useState<TimeRange>("month");
  const usageQuery = useUsageTracking(range);
  const agentsQuery = useAgentsQuery();

  if (usageQuery.isError) {
    return <ErrorState title="Usage data unavailable" description="Failed to load usage tracking data from Supabase." />;
  }

  const rows = usageQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  // ── Computed aggregates ─────────────────────────────────────────

  const totalCost = rows.reduce((sum, r) => sum + (r.estimated_cost ?? 0), 0);
  const totalTokens = rows.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0);

  // Most used model
  const modelCounts = new Map<string, number>();
  for (const r of rows) {
    modelCounts.set(r.model, (modelCounts.get(r.model) ?? 0) + 1);
  }
  const mostUsedModel = [...modelCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

  // Most active agent
  const agentCounts = new Map<string, number>();
  for (const r of rows) {
    agentCounts.set(r.agent_id, (agentCounts.get(r.agent_id) ?? 0) + 1);
  }
  const mostActiveAgentId = [...agentCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const mostActiveAgent = agents.find((a) => a.agent_id === mostActiveAgentId);

  // Per-agent breakdown
  const agentMap = new Map<string, { tokens: number; estimated_cost: number; model: string; lastActive: string }>();
  for (const r of rows) {
    const prev = agentMap.get(r.agent_id);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (!prev) {
      agentMap.set(r.agent_id, { tokens, cost: r.estimated_cost ?? 0, model: r.model, lastActive: r.created_at });
    } else {
      prev.tokens += tokens;
      prev.cost += r.estimated_cost ?? 0;
      if (r.created_at > prev.lastActive) {
        prev.lastActive = r.created_at;
        prev.model = r.model;
      }
    }
  }

  // Per-model breakdown
  const modelMap = new Map<string, { tokens: number; estimated_cost: number; requests: number }>();
  for (const r of rows) {
    const prev = modelMap.get(r.model);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (!prev) {
      modelMap.set(r.model, { tokens, cost: r.estimated_cost ?? 0, requests: 1 });
    } else {
      prev.tokens += tokens;
      prev.cost += r.estimated_cost ?? 0;
      prev.requests += 1;
    }
  }
  const sortedModels = [...modelMap.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const sortedAgents = [...agentMap.entries()].sort((a, b) => b[1].cost - a[1].cost);

  const isLoading = usageQuery.isLoading;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Analytics"
        title="Usage & Costs"
        description="Model usage tracking and cost breakdown"
        action={
          <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/5 p-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs uppercase tracking-[0.2em] transition",
                  range === opt.value
                    ? "bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)
        ) : (
          <>
            <StatCard label="Total Cost" value={formatCost(totalCost)} detail={`${rows.length} requests`} icon={<DollarSign className="size-5" />} />
            <StatCard label="Total Tokens" value={formatTokens(totalTokens)} detail="Input + output" icon={<Zap className="size-5" />} />
            <StatCard label="Most Used Model" value={mostUsedModel.split("/").pop() ?? mostUsedModel} detail={`${modelCounts.get(mostUsedModel) ?? 0} requests`} icon={<Cpu className="size-5" />} />
            <StatCard
              label="Most Active Agent"
              value={mostActiveAgent ? `${mostActiveAgent.emoji} ${mostActiveAgent.name}` : mostActiveAgentId ?? "—"}
              detail={`${agentCounts.get(mostActiveAgentId ?? "") ?? 0} requests`}
              icon={<Bot className="size-5" />}
            />
          </>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Per-Agent Breakdown */}
        <Card className="p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Per-Agent Breakdown</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Spend by agent</h2>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            ) : sortedAgents.length === 0 ? (
              <p className="text-sm text-slate-500">No usage data found for this period.</p>
            ) : (
              sortedAgents.map(([agentId, data]) => {
                const agent = agents.find((a) => a.agent_id === agentId);
                return (
                  <div
                    key={agentId}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                    style={agent?.color ? { borderLeftColor: agent.color, borderLeftWidth: 3 } : undefined}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">
                          <span className="mr-2">{agent?.emoji ?? "🤖"}</span>
                          <span style={{ color: agent?.color }}>{agent?.name ?? agentId}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {data.model.split("/").pop()} · {formatTokens(data.tokens)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-white">{formatCost(data.cost)}</p>
                        <p className="text-xs text-slate-500">{formatRelativeTime(data.lastActive)}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* Per-Model Breakdown */}
        <Card className="p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Per-Model Breakdown</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Spend by model</h2>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
            ) : sortedModels.length === 0 ? (
              <p className="text-sm text-slate-500">No usage data found for this period.</p>
            ) : (
              sortedModels.map(([model, data]) => {
                const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
                return (
                  <div key={model} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-white">{model}</p>
                        <p className="mt-1 text-sm text-slate-400">
                          {data.requests} requests · {formatTokens(data.tokens)} tokens
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full rounded-full bg-sky-400/70 transition-all" style={{ width: `${Math.max(pct, 1)}%` }} />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold text-white">{formatCost(data.cost)}</p>
                        <p className="text-xs text-slate-500">{pct.toFixed(1)}%</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
