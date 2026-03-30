import { supabase } from "@/integrations/supabase/client";
import { useAgentsQuery } from "@/shared/hooks/use-command-center-data";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { ErrorState } from "@/shared/components/error-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
import { cn, formatRelativeTime } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Zap,
  Bot,
  TrendingUp,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Gauge,
  TimerReset,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {

  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

// ── Types ───────────────────────────────────────────────────────────

interface UsageRow {
  id: string;
  agent_id: string;
  provider: string;
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
  useRealtimeInvalidation([{ table: "usage_tracking", queryKey: "usage-tracking" }]);

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
  return String(Math.round(value));
}

function getElapsedDayFraction(now: Date) {
  return Math.max((now.getHours() * 60 + now.getMinutes()) / (24 * 60), 1 / (24 * 60));
}

function getElapsedMonthFraction(now: Date) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(((now.getDate() - 1) + getElapsedDayFraction(now)) / daysInMonth, 1 / daysInMonth);
}

function getThresholdLevel(percent: number): "ok" | "warning" | "danger" {
  if (percent >= 90) return "danger";
  if (percent >= 70) return "warning";
  return "ok";
}

function formatDurationFromDays(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "Cap imminent";
  if (days < 1) return `${Math.max(Math.round(days * 24), 1)}h`;
  if (days < 30) return `${Math.round(days)}d`;
  return `${(days / 30).toFixed(1)}mo`;
}

// ── Provider config ─────────────────────────────────────────────────

const PROVIDER_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  anthropic: { color: "#f97316", label: "Anthropic", icon: "🅰️" },
  openai: { color: "#22c55e", label: "OpenAI", icon: "🟢" },
  "openai-codex": { color: "#22c55e", label: "OpenAI Codex", icon: "🟢" },
  google: { color: "#3b82f6", label: "Google", icon: "🔵" },
  gemini: { color: "#3b82f6", label: "Google", icon: "🔵" },
  xai: { color: "#a3a3a3", label: "xAI", icon: "✖️" },
  openrouter: { color: "#a855f7", label: "OpenRouter", icon: "🔀" },
};

function getProviderConfig(name: string) {
  return (
    PROVIDER_CONFIG[name.toLowerCase()] ?? {
      color: "#6b7280",
      label: name,
      icon: "⬜",
    }
  );
}

const SUBSCRIPTION_CAPACITY = {
  anthropic: {
    label: "Claude Max",
    provider: "anthropic",
    dailyCapacityTokens: 40_000_000,
    monthlyCapacityTokens: 1_200_000_000,
    accent: "#f97316",
  },
  "openai-codex": {
    label: "GPT Pro",
    provider: "openai-codex",
    dailyCapacityTokens: 20_000_000,
    monthlyCapacityTokens: 600_000_000,
    accent: "#22c55e",
  },
} as const;

type SubscriptionMetric = {
  key: keyof typeof SUBSCRIPTION_CAPACITY;
  label: string;
  provider: string;
  accent: string;
  dailyUsedTokens: number;
  monthlyUsedTokens: number;
  dailyCapacityTokens: number;
  monthlyCapacityTokens: number;
  dailyUsedPercent: number;
  monthlyUsedPercent: number;
  dailyBurnRateTokens: number;
  monthlyBurnRateTokens: number;
  projectedDailyTokens: number;
  projectedMonthlyTokens: number;
  projectedTimeToDailyCap: string;
  projectedTimeToMonthlyCap: string;
  threshold: "ok" | "warning" | "danger";
};

function SubscriptionCapacityCard({ metric }: { metric: SubscriptionMetric }) {
  const gaugeTone = metric.threshold === "danger"
    ? "bg-rose-400"
    : metric.threshold === "warning"
      ? "bg-amber-400"
      : "bg-emerald-400";

  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Subscription capacity</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{metric.label}</h3>
          <p className="mt-1 text-sm text-slate-400">Provider: {metric.provider}</p>
        </div>
        <Badge tone={metric.threshold === "danger" ? "danger" : metric.threshold === "warning" ? "warning" : "success"}>
          {Math.max(metric.dailyUsedPercent, metric.monthlyUsedPercent).toFixed(0)}%
        </Badge>
      </div>

      <div className="mt-5 space-y-4">
        <GaugeBar
          label="Daily capacity"
          value={metric.dailyUsedTokens}
          capacity={metric.dailyCapacityTokens}
          percent={metric.dailyUsedPercent}
          accent={metric.accent}
          toneClassName={gaugeTone}
        />
        <GaugeBar
          label="Monthly capacity"
          value={metric.monthlyUsedTokens}
          capacity={metric.monthlyCapacityTokens}
          percent={metric.monthlyUsedPercent}
          accent={metric.accent}
          toneClassName={gaugeTone}
        />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric icon={<Zap className="size-4" />} label="Burn rate / day" value={`${formatTokens(metric.dailyBurnRateTokens)} tok`} />
        <MiniMetric icon={<TrendingUp className="size-4" />} label="Projected month" value={`${formatTokens(metric.projectedMonthlyTokens)} tok`} />
        <MiniMetric icon={<TimerReset className="size-4" />} label="Time to day cap" value={metric.projectedTimeToDailyCap} />
        <MiniMetric icon={<Gauge className="size-4" />} label="Time to month cap" value={metric.projectedTimeToMonthlyCap} />
      </div>
    </Card>
  );
}

function GaugeBar({
  label,
  value,
  capacity,
  percent,
  accent,
  toneClassName,
}: {
  label: string;
  value: number;
  capacity: number;
  percent: number;
  accent: string;
  toneClassName: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <p className="text-slate-300">{label}</p>
        <p className="text-slate-400">{formatTokens(value)} / {formatTokens(capacity)} tokens</p>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/8">
        <div className="absolute inset-y-0 left-[70%] w-px bg-amber-300/70" />
        <div className="absolute inset-y-0 left-[90%] w-px bg-rose-300/80" />
        <div
          className={cn("h-full rounded-full transition-all duration-500", toneClassName)}
          style={{ width: `${Math.min(percent, 100)}%`, boxShadow: `0 0 20px ${accent}55` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{percent.toFixed(1)}% used</span>
        <span>Warn at 70% / 90%</span>
      </div>
    </div>
  );
}

function MiniMetric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p>
      </div>
      <p className="mt-2 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

// ── Budget thresholds ───────────────────────────────────────────────

const BUDGET_MONTHLY = 100; // $100/month budget
const BUDGET_WARN = 0.7; // 70% = warning
const BUDGET_DANGER = 0.9; // 90% = danger

function getBudgetStatus(cost: number): { level: "ok" | "warning" | "danger" | "over"; pct: number } {
  const pct = cost / BUDGET_MONTHLY;
  if (pct >= 1) return { level: "over", pct };
  if (pct >= BUDGET_DANGER) return { level: "danger", pct };
  if (pct >= BUDGET_WARN) return { level: "warning", pct };
  return { level: "ok", pct };
}

// ── Stat card ───────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  detail,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            {label}
          </p>
          <p className={cn("mt-2 text-2xl font-semibold", accent ?? "text-white")}>
            {value}
          </p>
          <p className="mt-1 text-sm text-slate-400">{detail}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-white/6 text-slate-300">
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ── Custom chart tooltip ────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-slate-900/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-sm font-semibold text-white">{formatCost(payload?.[0]?.value ?? 0)}</p>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "7 Days" },
  { value: "month", label: "30 Days" },
  { value: "all", label: "All Time" },
];

export function UsageCostsPage() {
  const [range, setRange] = useState<TimeRange>("month");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const usageQuery = useUsageTracking(range);
  const agentsQuery = useAgentsQuery();

  if (usageQuery.isError) {
    return (
      <ErrorState
        title="Usage data unavailable"
        description="Failed to load usage tracking data from Supabase."
      />
    );
  }

  const allRows = usageQuery.data ?? [];
  const agents = agentsQuery.data ?? [];

  // Apply provider filter
  const rows =
    providerFilter === "all"
      ? allRows
      : allRows.filter(
          (r) => r.provider.toLowerCase() === providerFilter.toLowerCase(),
        );

  // Unique providers for filter dropdown
  const uniqueProviders = useMemo(() => {
    const set = new Set(allRows.map((r) => r.provider));
    return [...set].sort();
  }, [allRows]);

  // ── Computed aggregates ─────────────────────────────────────────

  const totalCost = rows.reduce(
    (sum, r) => sum + (r.estimated_cost ?? 0),
    0,
  );
  const totalTokens = rows.reduce(
    (sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0),
    0,
  );
  const totalInputTokens = rows.reduce(
    (sum, r) => sum + (r.input_tokens ?? 0),
    0,
  );
  const totalOutputTokens = rows.reduce(
    (sum, r) => sum + (r.output_tokens ?? 0),
    0,
  );

  // Budget status (based on unfiltered monthly data for accuracy)
  const monthlyTotalCost = allRows.reduce(
    (sum, r) => sum + (r.estimated_cost ?? 0),
    0,
  );
  const budget = getBudgetStatus(range === "month" ? monthlyTotalCost : totalCost);

  // Per-provider breakdown
  const providerMap = new Map<
    string,
    {
      tokens: number;
      cost: number;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      topModel: string;
      modelCounts: Map<string, number>;
    }
  >();
  for (const r of allRows) {
    const prev = providerMap.get(r.provider);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (!prev) {
      providerMap.set(r.provider, {
        tokens,
        cost: r.estimated_cost ?? 0,
        requests: 1,
        inputTokens: r.input_tokens ?? 0,
        outputTokens: r.output_tokens ?? 0,
        topModel: r.model,
        modelCounts: new Map([[r.model, 1]]),
      });
    } else {
      prev.tokens += tokens;
      prev.cost += r.estimated_cost ?? 0;
      prev.requests += 1;
      prev.inputTokens += r.input_tokens ?? 0;
      prev.outputTokens += r.output_tokens ?? 0;
      prev.modelCounts.set(
        r.model,
        (prev.modelCounts.get(r.model) ?? 0) + 1,
      );
      if (
        (prev.modelCounts.get(r.model) ?? 0) >
        (prev.modelCounts.get(prev.topModel) ?? 0)
      ) {
        prev.topModel = r.model;
      }
    }
  }
  const sortedProviders = [...providerMap.entries()].sort(
    (a, b) => b[1].cost - a[1].cost,
  );

  // Most active agent
  const agentCounts = new Map<string, number>();
  for (const r of rows) {
    agentCounts.set(r.agent_id, (agentCounts.get(r.agent_id) ?? 0) + 1);
  }
  const mostActiveAgentId = [...agentCounts.entries()].sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0] ?? '';
  const mostActiveAgent = agents?.find(
    (a) => a.agent_id === mostActiveAgentId,
  );

  // Per-agent breakdown
  const agentMap = new Map<
    string,
    { tokens: number; cost: number; model: string; lastActive: string; requests: number }
  >();
  for (const r of rows) {
    const prev = agentMap.get(r.agent_id);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (!prev) {
      agentMap.set(r.agent_id, {
        tokens,
        cost: r.estimated_cost ?? 0,
        model: r.model,
        lastActive: r.created_at,
        requests: 1,
      });
    } else {
      prev.tokens += tokens;
      prev.cost += r.estimated_cost ?? 0;
      prev.requests += 1;
      if (r.created_at > prev.lastActive) {
        prev.lastActive = r.created_at;
        prev.model = r.model;
      }
    }
  }

  // Per-model breakdown
  const modelMap = new Map<
    string,
    { tokens: number; cost: number; requests: number; provider: string }
  >();
  for (const r of rows) {
    const prev = modelMap.get(r.model);
    const tokens = (r.input_tokens ?? 0) + (r.output_tokens ?? 0);
    if (!prev) {
      modelMap.set(r.model, {
        tokens,
        cost: r.estimated_cost ?? 0,
        requests: 1,
        provider: r.provider,
      });
    } else {
      prev.tokens += tokens;
      prev.cost += r.estimated_cost ?? 0;
      prev.requests += 1;
    }
  }
  const sortedModels = [...modelMap.entries()].sort(
    (a, b) => b[1].cost - a[1].cost,
  );
  const sortedAgents = [...agentMap.entries()].sort(
    (a, b) => b[1].cost - a[1].cost,
  );

  // Daily cost breakdown for chart
  const dailyChartData = useMemo(() => {
    const dailyCosts = new Map<string, { total: number; byProvider: Record<string, number> }>();
    for (const r of rows) {
      const date = new Date(r.created_at).toISOString().split("T")[0] ?? "";
      const entry = dailyCosts.get(date) ?? { total: 0, byProvider: {} as Record<string, number> };
      entry.total += r.estimated_cost ?? 0;
      const prov = r.provider ?? 'unknown';
      entry.byProvider[prov] =
        (entry.byProvider[prov] ?? 0) + (r.estimated_cost ?? 0);
      dailyCosts.set(date, entry);
    }

    // Fill in missing days for smoother chart
    const sorted = [...dailyCosts.keys()].sort();
    if (sorted.length < 2) {
      return sorted.map((date) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        total: dailyCosts.get(date)!.total,
        ...dailyCosts.get(date)!.byProvider,
      }));
    }

    const result: Array<Record<string, unknown>> = [];
    const start = new Date((sorted[0] ?? '') + "T12:00:00");
    const end = new Date((sorted[sorted.length - 1] ?? '') + "T12:00:00");

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().split("T")[0] ?? "";
      const entry = dailyCosts.get(key);
      result.push({
        date: key,
        label: d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        total: entry?.total ?? 0,
        ...(entry?.byProvider ?? {}),
      });
    }

    return result;
  }, [rows]);

  // Average daily cost
  const avgDailyCost =
    dailyChartData.length > 0
      ? dailyChartData.reduce((s, d) => s + (d.total as number), 0) /
        dailyChartData.length
      : 0;

  const subscriptionMetrics = useMemo(() => {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const dayElapsed = getElapsedDayFraction(now);
    const monthElapsed = getElapsedMonthFraction(now);

    return Object.entries(SUBSCRIPTION_CAPACITY).map(([key, config]) => {
      const providerRows = allRows.filter((row) => row.provider.toLowerCase() === config.provider.toLowerCase());
      const dailyUsedTokens = providerRows
        .filter((row) => new Date(row.created_at) >= dayStart)
        .reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0);
      const monthlyUsedTokens = providerRows
        .filter((row) => new Date(row.created_at) >= monthStart)
        .reduce((sum, row) => sum + (row.input_tokens ?? 0) + (row.output_tokens ?? 0), 0);

      const dailyBurnRateTokens = dailyUsedTokens / dayElapsed;
      const monthlyBurnRateTokens = monthlyUsedTokens / monthElapsed;
      const dailyUsedPercent = (dailyUsedTokens / config.dailyCapacityTokens) * 100;
      const monthlyUsedPercent = (monthlyUsedTokens / config.monthlyCapacityTokens) * 100;
      const projectedTimeToDailyCap = dailyBurnRateTokens > 0
        ? formatDurationFromDays((config.dailyCapacityTokens - dailyUsedTokens) / dailyBurnRateTokens)
        : "No burn yet";
      const projectedTimeToMonthlyCap = monthlyBurnRateTokens > 0
        ? formatDurationFromDays((config.monthlyCapacityTokens - monthlyUsedTokens) / monthlyBurnRateTokens)
        : "No burn yet";

      return {
        key: key as keyof typeof SUBSCRIPTION_CAPACITY,
        label: config.label,
        provider: config.provider,
        accent: config.accent,
        dailyUsedTokens,
        monthlyUsedTokens,
        dailyCapacityTokens: config.dailyCapacityTokens,
        monthlyCapacityTokens: config.monthlyCapacityTokens,
        dailyUsedPercent,
        monthlyUsedPercent,
        dailyBurnRateTokens,
        monthlyBurnRateTokens,
        projectedDailyTokens: dailyBurnRateTokens,
        projectedMonthlyTokens: monthlyBurnRateTokens,
        projectedTimeToDailyCap,
        projectedTimeToMonthlyCap,
        threshold: getThresholdLevel(Math.max(dailyUsedPercent, monthlyUsedPercent)),
      } satisfies SubscriptionMetric;
    });
  }, [allRows]);

  const isLoading = usageQuery.isLoading;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Analytics"
        title="Usage & Costs"
        description="Model usage tracking, cost breakdown, and budget monitoring"
        action={
          <div className="flex items-center gap-3">
            {/* Provider filter */}
            {uniqueProviders.length > 1 && (
              <div className="flex items-center gap-2">
                <Filter className="size-3.5 text-slate-500" />
                <select
                  value={providerFilter}
                  onChange={(e) => setProviderFilter(e.target.value)}
                  className="appearance-none rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs uppercase tracking-[0.15em] text-slate-300 outline-none transition focus:border-sky-400/50"
                >
                  <option value="all">All Providers</option>
                  {uniqueProviders.map((p) => (
                    <option key={p} value={p}>
                      {getProviderConfig(p).label}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {/* Time range toggle */}
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
          </div>
        }
      />

      {/* Subscription capacity */}
      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Subscription tracking</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Claude Max & GPT Pro capacity</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Estimated token envelopes from <code className="rounded bg-white/5 px-1.5 py-0.5 text-slate-300">usage_tracking</code>, with daily/monthly burn rate and projected time to cap.
          </p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[320px] rounded-3xl" />)
            : subscriptionMetrics.map((metric) => <SubscriptionCapacityCard key={metric.key} metric={metric} />)}
        </div>
      </section>

      {/* Budget warning banner */}
      {range === "month" && budget.level !== "ok" && (
        <BudgetBanner level={budget.level} pct={budget.pct} cost={monthlyTotalCost} />
      )}

      {/* Summary cards */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Spend"
              value={formatCost(totalCost)}
              detail={`${rows.length} requests`}
              icon={<DollarSign className="size-5" />}
              accent={
                budget.level === "danger" || budget.level === "over"
                  ? "text-rose-400"
                  : budget.level === "warning"
                    ? "text-amber-300"
                    : "text-white"
              }
            />
            <StatCard
              label="Total Tokens"
              value={formatTokens(totalTokens)}
              detail={`${formatTokens(totalInputTokens)} in · ${formatTokens(totalOutputTokens)} out`}
              icon={<Zap className="size-5" />}
            />
            <StatCard
              label="Avg Daily Cost"
              value={formatCost(avgDailyCost)}
              detail={`${dailyChartData.length} days tracked`}
              icon={<TrendingUp className="size-5" />}
            />
            <StatCard
              label="Most Active Agent"
              value={
                mostActiveAgent
                  ? `${mostActiveAgent?.emoji ?? ''} ${mostActiveAgent?.name ?? ''}`
                  : (mostActiveAgentId || "—") as string
              }
              detail={`${agentCounts.get(mostActiveAgentId ?? "") ?? 0} requests`}
              icon={<Bot className="size-5" />}
            />
          </>
        )}
      </section>

      {/* Budget gauge (for month view) */}
      {range === "month" && !isLoading && rows.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
                Monthly Budget
              </p>
              <p className="mt-1 text-sm text-slate-400">
                {formatCost(monthlyTotalCost)} of {formatCost(BUDGET_MONTHLY)} used
              </p>
            </div>
            <Badge
              tone={
                budget.level === "ok"
                  ? "success"
                  : budget.level === "warning"
                    ? "warning"
                    : "danger"
              }
            >
              {(budget.pct * 100).toFixed(0)}%
            </Badge>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                budget.level === "ok" && "bg-emerald-400",
                budget.level === "warning" && "bg-amber-400",
                (budget.level === "danger" || budget.level === "over") &&
                  "bg-rose-400",
              )}
              style={{ width: `${Math.min(budget.pct * 100, 100)}%` }}
            />
          </div>
          {budget.pct < 1 && (
            <p className="mt-2 text-xs text-slate-500">
              ~{formatCost(BUDGET_MONTHLY - monthlyTotalCost)} remaining · projected{" "}
              {formatCost(avgDailyCost * 30)} /month at current rate
            </p>
          )}
        </Card>
      )}

      {/* Provider cards */}
      <section>
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Spend Overview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Spend by Provider
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-36 rounded-3xl" />
            ))
          ) : sortedProviders.length === 0 ? (
            <p className="text-sm text-slate-500">
              No usage data found for this period.
            </p>
          ) : (
            sortedProviders.map(([providerName, data]) => {
              const config = getProviderConfig(providerName);
              const costPct =
                monthlyTotalCost > 0
                  ? (data.cost / monthlyTotalCost) * 100
                  : 0;
              return (
                <Card
                  key={providerName}
                  className={cn(
                    "relative overflow-hidden p-5 transition-all hover:border-white/15",
                    providerFilter === providerName.toLowerCase() &&
                      "ring-1 ring-sky-400/40",
                  )}
                  onClick={() =>
                    setProviderFilter(
                      providerFilter === providerName.toLowerCase()
                        ? "all"
                        : providerName.toLowerCase(),
                    )
                  }
                  style={{ cursor: "pointer" }}
                >
                  {/* Color accent bar */}
                  <div
                    className="absolute left-0 top-0 h-full w-1 rounded-l-2xl"
                    style={{ backgroundColor: config.color }}
                  />
                  <div className="flex items-start justify-between">
                    <div className="pl-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{config.icon}</span>
                        <p className="text-sm font-medium text-white">
                          {config.label}
                        </p>
                      </div>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatCost(data.cost)}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {data.requests} requests · {formatTokens(data.tokens)}{" "}
                        tokens
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge tone="default">{costPct.toFixed(0)}%</Badge>
                    </div>
                  </div>
                  {/* Mini bar */}
                  <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/8">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(costPct, 2)}%`,
                        backgroundColor: config.color,
                      }}
                    />
                  </div>
                  <p className="mt-2 truncate text-[11px] text-slate-500">
                    Top model: {data.topModel.split("/").pop()}
                  </p>
                </Card>
              );
            })
          )}
        </div>
      </section>

      {/* Daily cost area chart */}
      <section>
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
            Daily Overview
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">
            Daily Spend Trend
          </h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-64 rounded-3xl" />
        ) : dailyChartData.length === 0 ? (
          <Card className="flex h-48 items-center justify-center">
            <p className="text-sm text-slate-500">
              No usage data found for this period.
            </p>
          </Card>
        ) : (
          <Card className="p-6">
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart
                data={dailyChartData}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="costGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#0ea5e9"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="100%"
                      stopColor="#0ea5e9"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${v.toFixed(v >= 1 ? 0 : 2)}`}
                  width={50}
                />
                <RechartsTooltip
                  content={<ChartTooltip />}
                  cursor={{ stroke: "rgba(255,255,255,0.1)" }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: "#0ea5e9",
                    stroke: "#0c4a6e",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
            {/* Summary row below chart */}
            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Peak Day
                  </p>
                  <p className="text-sm font-medium text-white">
                    {formatCost(
                      Math.max(
                        ...dailyChartData.map((d) => d.total as number),
                        0,
                      ),
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Average
                  </p>
                  <p className="text-sm font-medium text-white">
                    {formatCost(avgDailyCost)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
                    Period Total
                  </p>
                  <p className="text-sm font-medium text-white">
                    {formatCost(totalCost)}
                  </p>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                {dailyChartData.length} days
              </p>
            </div>
          </Card>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Per-Agent Breakdown */}
        <Card className="p-6">
          <div className="mb-5">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Per-Agent Breakdown
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Spend by Agent
            </h2>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))
            ) : sortedAgents.length === 0 ? (
              <p className="text-sm text-slate-500">
                No usage data found for this period.
              </p>
            ) : (
              sortedAgents.map(([agentId, data]) => {
                const agent = agents.find((a) => a.agent_id === agentId);
                const pct =
                  totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
                return (
                  <div
                    key={agentId}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                    style={
                      agent?.color
                        ? {
                            borderLeftColor: agent.color,
                            borderLeftWidth: 3,
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-white">
                          <span className="mr-2">
                            {agent?.emoji ?? "🤖"}
                          </span>
                          <span style={{ color: agent?.color }}>
                            {agent?.name ?? agentId}
                          </span>
                        </p>
                        <p className="mt-1 text-sm text-slate-400">
                          {data.model.split("/").pop()} ·{" "}
                          {data.requests} req ·{" "}
                          {formatTokens(data.tokens)} tokens
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: agent?.color ?? "#4dd4ac",
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold text-white">
                          {formatCost(data.cost)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatRelativeTime(data.lastActive)}
                        </p>
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
            <p className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Per-Model Breakdown
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Spend by Model
            </h2>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-2xl" />
              ))
            ) : sortedModels.length === 0 ? (
              <p className="text-sm text-slate-500">
                No usage data found for this period.
              </p>
            ) : (
              sortedModels.map(([model, data]) => {
                const pct =
                  totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
                const providerConfig = getProviderConfig(data.provider);
                return (
                  <div
                    key={model}
                    className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="size-2 rounded-full"
                            style={{
                              backgroundColor: providerConfig.color,
                            }}
                          />
                          <p className="truncate font-medium text-white">
                            {model}
                          </p>
                        </div>
                        <p className="mt-1 text-sm text-slate-400">
                          {data.requests} requests ·{" "}
                          {formatTokens(data.tokens)} tokens
                        </p>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(pct, 1)}%`,
                              backgroundColor: providerConfig.color,
                            }}
                          />
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-lg font-semibold text-white">
                          {formatCost(data.cost)}
                        </p>
                        <p className="text-xs text-slate-500">
                          {pct.toFixed(1)}%
                        </p>
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

// ── Budget banner component ─────────────────────────────────────────

function BudgetBanner({
  level,
  pct,
  cost,
}: {
  level: "warning" | "danger" | "over";
  pct: number;
  cost: number;
}) {
  if (level === "over") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        <ShieldAlert className="size-5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium">Budget exceeded!</p>
          <p className="text-rose-300/80">
            Monthly spend is at {formatCost(cost)} — {(pct * 100).toFixed(0)}%
            of ${BUDGET_MONTHLY} budget.
          </p>
        </div>
      </div>
    );
  }
  if (level === "danger") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
        <AlertTriangle className="size-5 shrink-0 text-rose-400" />
        <div>
          <p className="font-medium">Approaching budget limit</p>
          <p className="text-rose-300/80">
            {formatCost(cost)} spent — {(pct * 100).toFixed(0)}% of $
            {BUDGET_MONTHLY} monthly budget.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
      <AlertTriangle className="size-5 shrink-0 text-amber-400" />
      <div>
        <p className="font-medium">Budget warning</p>
        <p className="text-amber-200/80">
          {formatCost(cost)} spent — {(pct * 100).toFixed(0)}% of $
          {BUDGET_MONTHLY} monthly budget.
        </p>
      </div>
    </div>
  );
}
