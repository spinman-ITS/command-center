import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { ErrorState } from "@/shared/components/error-state";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  Gauge,
  Mail,
  Search,
  Sparkles,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";

interface UsageRow {
  id: string;
  agent_id: string;
  provider: string;
  model: string;
  task_type: string | null;
  task_name: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens?: number | null;
  image_count?: number | null;
  estimated_cost: number;
  created_at: string;
}

type BudgetLevel = "ok" | "warning" | "danger" | "over";
type ApiCategoryKey = "openrouter" | "brave" | "openai-image" | "xai" | "resend";

type ApiCategory = {
  key: ApiCategoryKey;
  title: string;
  description: string;
  unitLabel: string;
  accent: string;
  icon: ReactNode;
  matches: (row: UsageRow) => boolean;
};

type ApiCardMetric = {
  key: ApiCategoryKey;
  title: string;
  description: string;
  accent: string;
  icon: ReactNode;
  spend: number;
  requests: number;
  units: number;
  unitLabel: string;
  costPerUnit: number;
  trend: number[];
};

function startOfTodayLocal(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function useUsageTrackingThisMonth() {
  useRealtimeInvalidation([{ table: "usage_tracking", queryKey: "usage-tracking-month" }]);

  return useQuery({
    queryKey: ["usage-tracking-month"],
    queryFn: async () => {
      if (!supabase) return [] as UsageRow[];
      const { data, error } = await supabase
        .from("usage_tracking")
        .select("*")
        .gte("created_at", startOfMonthLocal().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });
}

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

function formatCount(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
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

function getBudgetStatus(cost: number): { level: BudgetLevel; pct: number } {
  const pct = cost / BUDGET_MONTHLY;
  if (pct >= 1) return { level: "over", pct };
  if (pct >= 0.9) return { level: "danger", pct };
  if (pct >= 0.7) return { level: "warning", pct };
  return { level: "ok", pct };
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

const BUDGET_MONTHLY = 100;

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

const API_CATEGORIES: ApiCategory[] = [
  {
    key: "openrouter",
    title: "OpenRouter",
    description: "Lucy / Qwen usage",
    unitLabel: "token",
    accent: "#a855f7",
    icon: <Zap className="size-4" />,
    matches: (row) => row.provider?.toLowerCase() === "openrouter",
  },
  {
    key: "brave",
    title: "Brave Search API",
    description: "Per-request cost",
    unitLabel: "request",
    accent: "#f59e0b",
    icon: <Search className="size-4" />,
    matches: (row) => {
      const haystack = `${row.provider} ${row.model} ${row.task_type ?? ""} ${row.task_name ?? ""}`.toLowerCase();
      return haystack.includes("brave");
    },
  },
  {
    key: "openai-image",
    title: "OpenAI Image API",
    description: "Pixel image generation",
    unitLabel: "image",
    accent: "#22c55e",
    icon: <Sparkles className="size-4" />,
    matches: (row) => {
      const provider = row.provider?.toLowerCase() ?? "";
      return (provider === "openai" || provider === "openai-codex") && ((row.image_count ?? 0) > 0 || row.agent_id?.toLowerCase() === "pixel");
    },
  },
  {
    key: "xai",
    title: "xAI",
    description: "X search / Grok",
    unitLabel: "request",
    accent: "#94a3b8",
    icon: <TrendingUp className="size-4" />,
    matches: (row) => {
      const haystack = `${row.provider} ${row.model} ${row.task_type ?? ""} ${row.task_name ?? ""}`.toLowerCase();
      return row.provider?.toLowerCase() === "xai" || haystack.includes("grok") || haystack.includes("x-search");
    },
  },
  {
    key: "resend",
    title: "Resend",
    description: "MSP Pub invite emails",
    unitLabel: "email",
    accent: "#ef4444",
    icon: <Mail className="size-4" />,
    matches: (row) => {
      const haystack = `${row.provider} ${row.model} ${row.task_type ?? ""} ${row.task_name ?? ""}`.toLowerCase();
      return haystack.includes("resend") || (haystack.includes("invite") && haystack.includes("email"));
    },
  },
];

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
        <MiniMetric icon={<DollarSign className="size-4" />} label="Time to day cap" value={metric.projectedTimeToDailyCap} />
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

function ApiTrackingCard({ metric }: { metric: ApiCardMetric }) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">API cost tracking</p>
          <h3 className="mt-2 text-lg font-semibold text-white">{metric.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{metric.description}</p>
        </div>
        <div className="flex size-10 items-center justify-center rounded-2xl bg-white/6 text-white" style={{ boxShadow: `inset 0 0 0 1px ${metric.accent}33` }}>
          <span style={{ color: metric.accent }}>{metric.icon}</span>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-semibold text-white">{formatCost(metric.spend)}</p>
          <p className="mt-1 text-xs text-slate-500">Current month spend</p>
        </div>
        <MiniTrend bars={metric.trend} accent={metric.accent} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric icon={<DollarSign className="size-4" />} label="Spend" value={formatCost(metric.spend)} />
        <MiniMetric icon={<Zap className="size-4" />} label="Requests" value={formatCount(metric.requests)} />
        <MiniMetric
          icon={<Gauge className="size-4" />}
          label={`Cost / ${metric.unitLabel}`}
          value={metric.units > 0 ? formatCost(metric.costPerUnit) : "—"}
        />
      </div>
    </Card>
  );
}

function MiniTrend({ bars, accent }: { bars: number[]; accent: string }) {
  const max = Math.max(...bars, 0);

  return (
    <div className="flex h-14 items-end gap-1">
      {bars.map((value, index) => {
        const height = max > 0 ? Math.max((value / max) * 100, value > 0 ? 10 : 6) : 6;
        return (
          <div
            key={`${index}-${value}`}
            className="w-2 rounded-full bg-white/10"
            style={{ height: `${height}%`, backgroundColor: value > 0 ? accent : "rgba(255,255,255,0.08)" }}
          />
        );
      })}
    </div>
  );
}

function BudgetSummaryCard({
  monthlySpend,
  dailyBurnRate,
  budget,
}: {
  monthlySpend: number;
  dailyBurnRate: number;
  budget: { level: BudgetLevel; pct: number };
}) {
  const progressTone =
    budget.level === "over" || budget.level === "danger"
      ? "bg-rose-400"
      : budget.level === "warning"
        ? "bg-amber-400"
        : "bg-emerald-400";

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Cost summary</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Monthly API budget</h2>
          <p className="mt-2 text-sm text-slate-400">Rollup of paid API usage tracked this month.</p>
        </div>
        <Badge tone={budget.level === "ok" ? "success" : budget.level === "warning" ? "warning" : "danger"}>
          {(budget.pct * 100).toFixed(0)}%
        </Badge>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <MiniMetric icon={<DollarSign className="size-4" />} label="Total monthly API spend" value={formatCost(monthlySpend)} />
        <MiniMetric icon={<TrendingUp className="size-4" />} label="Daily average burn" value={formatCost(dailyBurnRate)} />
        <MiniMetric icon={<Gauge className="size-4" />} label="Budget target" value={`${formatCost(BUDGET_MONTHLY)} / mo`} />
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between text-sm">
          <p className="text-slate-300">Budget progress</p>
          <p className="text-slate-400">{formatCost(monthlySpend)} of {formatCost(BUDGET_MONTHLY)}</p>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-white/8">
          <div className={cn("h-full rounded-full transition-all duration-500", progressTone)} style={{ width: `${Math.min(budget.pct * 100, 100)}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {budget.pct >= 1
            ? `Over budget by ${formatCost(monthlySpend - BUDGET_MONTHLY)}.`
            : `${formatCost(BUDGET_MONTHLY - monthlySpend)} remaining at current target.`}
        </p>
      </div>
    </Card>
  );
}

export function UsageCostsPage() {
  const usageQuery = useUsageTrackingThisMonth();

  if (usageQuery.isError) {
    return (
      <ErrorState
        title="Usage data unavailable"
        description="Failed to load usage tracking data from Supabase."
      />
    );
  }

  const allRows = usageQuery.data ?? [];
  const isLoading = usageQuery.isLoading;

  const subscriptionMetrics = useMemo(() => {
    const now = new Date();
    const dayStart = startOfTodayLocal();
    const monthStart = startOfMonthLocal();
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

  const apiTrackingCards = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dateKeys = Array.from({ length: daysInMonth }, (_, index) => getDateKey(new Date(now.getFullYear(), now.getMonth(), index + 1)));

    return API_CATEGORIES.map((category) => {
      const rows = allRows.filter(category.matches);
      const spend = rows.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0);
      const requests = rows.length;
      const tokenUnits = rows.reduce((sum, row) => sum + (row.total_tokens ?? row.input_tokens + row.output_tokens), 0);
      const imageUnits = rows.reduce((sum, row) => sum + (row.image_count ?? 0), 0);
      const units = category.key === "openrouter"
        ? tokenUnits
        : category.key === "openai-image"
          ? imageUnits
          : requests;
      const costPerUnit = units > 0 ? spend / units : 0;

      const spendByDay = new Map<string, number>();
      for (const row of rows) {
        const dateKey = getDateKey(new Date(row.created_at));
        spendByDay.set(dateKey, (spendByDay.get(dateKey) ?? 0) + (row.estimated_cost ?? 0));
      }

      const trend = dateKeys.slice(-10).map((dateKey) => spendByDay.get(dateKey) ?? 0);

      return {
        key: category.key,
        title: category.title,
        description: category.description,
        accent: category.accent,
        icon: category.icon,
        spend,
        requests,
        units,
        unitLabel: category.unitLabel,
        costPerUnit,
        trend,
      } satisfies ApiCardMetric;
    });
  }, [allRows]);

  const monthlySpend = useMemo(
    () => apiTrackingCards.reduce((sum, card) => sum + card.spend, 0),
    [apiTrackingCards],
  );

  const dailyBurnRate = useMemo(() => {
    const now = new Date();
    return monthlySpend / getElapsedMonthFraction(now) / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  }, [monthlySpend]);

  const budget = getBudgetStatus(monthlySpend);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Analytics"
        title="Usage & Costs"
        description="Subscription capacity and paid API spend for the current month."
      />

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

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Section 2</p>
          <h2 className="mt-2 text-xl font-semibold text-white">API Cost Tracking</h2>
          <p className="mt-2 text-sm text-slate-400">Current month spend, request volume, unit economics, and recent trend by API.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-3xl" />)
            : apiTrackingCards.map((card) => <ApiTrackingCard key={card.key} metric={card} />)}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Section 3</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Cost Summary</h2>
        </div>
        {isLoading ? <Skeleton className="h-64 rounded-3xl" /> : <BudgetSummaryCard monthlySpend={monthlySpend} dailyBurnRate={dailyBurnRate} budget={budget} />}
      </section>
    </div>
  );
}
