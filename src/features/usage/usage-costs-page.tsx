import { supabase } from "@/integrations/supabase/client";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useRealtimeInvalidation } from "@/shared/hooks/use-realtime-invalidation";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
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
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens?: number | null;
  cached_tokens?: number | null;
  image_count?: number | null;
  estimated_cost: number | null;
  created_at: string;
}

type BudgetLevel = "ok" | "warning" | "danger" | "over";
type ApiCategoryKey = "openrouter" | "brave" | "openai-image" | "xai" | "resend";
type TrendDirection = "up" | "down" | "flat";

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

type DailyUsagePoint = {
  dateKey: string;
  dayLabel: string;
  fullDateLabel: string;
  anthropic: number;
  "openai-codex": number;
  totalTokens: number;
  estimatedCost: number;
};

type AgentBreakdownPoint = {
  agent: string;
  label: string;
  tokens: number;
  fill: string;
  percent: number;
};

type WeeklyComparison = {
  currentTokens: number;
  previousTokens: number;
  currentCost: number;
  previousCost: number;
  tokenChangePct: number;
  costChangePct: number;
  tokenDirection: TrendDirection;
  costDirection: TrendDirection;
};

const CHART_COLORS = {
  grid: "rgba(148, 163, 184, 0.14)",
  text: "#cbd5e1",
  muted: "#64748b",
  anthropic: "#f97316",
  openaiCodex: "#22c55e",
  cost: "#38bdf8",
  atlas: "#38bdf8",
  luka: "#22c55e",
  sage: "#a855f7",
  max: "#f59e0b",
  system: "#f43f5e",
  other: "#94a3b8",
} as const;

const SUBSCRIPTION_CAPACITY = {
  anthropic: {
    label: "Claude Max",
    provider: "anthropic",
    dailyCapacityTokens: 40_000_000,
    monthlyCapacityTokens: 1_200_000_000,
    accent: CHART_COLORS.anthropic,
  },
  "openai-codex": {
    label: "GPT Pro",
    provider: "openai-codex",
    dailyCapacityTokens: 20_000_000,
    monthlyCapacityTokens: 600_000_000,
    accent: CHART_COLORS.openaiCodex,
  },
} as const;

const AGENT_CONFIG = {
  atlas: { label: "Atlas", color: CHART_COLORS.atlas },
  luka: { label: "Luka", color: CHART_COLORS.luka },
  sage: { label: "Sage", color: CHART_COLORS.sage },
  max: { label: "Max", color: CHART_COLORS.max },
  system: { label: "System", color: CHART_COLORS.system },
} as const;

const BUDGET_MONTHLY = 100;

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

function startOfTodayLocal(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function startOfMonthLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function startOfWeekLocal(date = new Date()): Date {
  const weekStart = new Date(date);
  weekStart.setHours(0, 0, 0, 0);
  const day = weekStart.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  weekStart.setDate(weekStart.getDate() + diff);
  return weekStart;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
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

function getTokenCount(row: UsageRow): number {
  return row.total_tokens ?? ((row.input_tokens ?? 0) + (row.output_tokens ?? 0));
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

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "0%";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
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

function getChangeDirection(value: number): TrendDirection {
  if (value > 0.001) return "up";
  if (value < -0.001) return "down";
  return "flat";
}

function calculateChangePct(current: number, previous: number): number {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return ((current - previous) / previous) * 100;
}

function renderTooltipCard(label: string, rows: Array<{ name: string; value: number; color?: string; formatter?: (value: number) => string }>) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/95 px-3 py-2 shadow-2xl backdrop-blur">
      <p className="text-xs font-medium text-white">{label}</p>
      <div className="mt-2 space-y-1.5">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center justify-between gap-4 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: row.color ?? "#94a3b8" }} />
              <span>{row.name}</span>
            </div>
            <span className="font-medium text-white">{row.formatter ? row.formatter(row.value) : row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

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
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Monthly capacity</p>
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

function TrendDelta({ label, currentValue, previousValue, changePct, direction, formatter }: {
  label: string;
  currentValue: number;
  previousValue: number;
  changePct: number;
  direction: TrendDirection;
  formatter: (value: number) => string;
}) {
  const tone = direction === "up" ? "text-emerald-300" : direction === "down" ? "text-rose-300" : "text-slate-300";
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : TrendingUp;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
        <div className={cn("flex items-center gap-1 text-xs font-medium", tone)}>
          <Icon className="size-4" />
          <span>{formatPercent(changePct)}</span>
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold text-white">{formatter(currentValue)}</p>
      <p className="mt-1 text-xs text-slate-500">Last week {formatter(previousValue)}</p>
    </div>
  );
}

function WeeklySummaryCard({ comparison }: { comparison: WeeklyComparison }) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Weekly summary</p>
          <h2 className="mt-2 text-xl font-semibold text-white">This week vs last week</h2>
          <p className="mt-2 text-sm text-slate-400">Token burn and cost-equivalent compared against the prior Monday-through-Sunday window.</p>
        </div>
        <Badge tone={comparison.tokenDirection === "down" ? "success" : comparison.tokenDirection === "up" ? "warning" : "default"}>
          {comparison.tokenDirection === "flat" ? "Stable" : comparison.tokenDirection === "up" ? "Burn up" : "Burn down"}
        </Badge>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <TrendDelta
          label="Tokens this week"
          currentValue={comparison.currentTokens}
          previousValue={comparison.previousTokens}
          changePct={comparison.tokenChangePct}
          direction={comparison.tokenDirection}
          formatter={formatTokens}
        />
        <TrendDelta
          label="Cost-equivalent this week"
          currentValue={comparison.currentCost}
          previousValue={comparison.previousCost}
          changePct={comparison.costChangePct}
          direction={comparison.costDirection}
          formatter={formatCost}
        />
      </div>
    </Card>
  );
}

function ChartCard({
  eyebrow,
  title,
  description,
  children,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">{eyebrow}</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
          <p className="mt-2 text-sm text-slate-400">{description}</p>
        </div>
        {action}
      </div>
      <div className="mt-6">{children}</div>
    </Card>
  );
}

function DailyUsageChart({ data }: { data: DailyUsagePoint[] }) {
  return (
    <ChartCard
      eyebrow="Daily burn"
      title="Token usage by day"
      description="Current month token usage split by provider, using total_tokens with fallback to input + output when needed."
      action={<Badge tone="default">Claude orange, GPT green</Badge>}
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="dayLabel" tick={{ fill: CHART_COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatTokens} tick={{ fill: CHART_COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return renderTooltipCard(String(label), [
                  { name: "Claude Max", value: Number(payload.find((item) => item.dataKey === "anthropic")?.value ?? 0), color: CHART_COLORS.anthropic, formatter: formatTokens },
                  { name: "GPT Pro", value: Number(payload.find((item) => item.dataKey === "openai-codex")?.value ?? 0), color: CHART_COLORS.openaiCodex, formatter: formatTokens },
                  { name: "Total", value: Number(payload.find((item) => item.dataKey === "totalTokens")?.payload?.totalTokens ?? 0), color: "#e2e8f0", formatter: formatTokens },
                ]);
              }}
            />
            <Bar dataKey="anthropic" stackId="tokens" fill={CHART_COLORS.anthropic} radius={[6, 6, 0, 0]} />
            <Bar dataKey="openai-codex" stackId="tokens" fill={CHART_COLORS.openaiCodex} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function CostTrendChart({ data }: { data: DailyUsagePoint[] }) {
  return (
    <ChartCard
      eyebrow="Spend trajectory"
      title="Estimated cost-equivalent trend"
      description="Daily estimated_cost for the current month, useful for seeing spend acceleration or flattening."
    >
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="usage-cost-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={CHART_COLORS.cost} stopOpacity={0.4} />
                <stop offset="100%" stopColor={CHART_COLORS.cost} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
            <XAxis dataKey="dayLabel" tick={{ fill: CHART_COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={formatCost} tick={{ fill: CHART_COLORS.muted, fontSize: 12 }} axisLine={false} tickLine={false} width={48} />
            <Tooltip
              cursor={{ stroke: CHART_COLORS.cost, strokeDasharray: "4 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return renderTooltipCard(String(label), [
                  { name: "Estimated cost", value: Number(payload[0]?.value ?? 0), color: CHART_COLORS.cost, formatter: formatCost },
                ]);
              }}
            />
            <Area type="monotone" dataKey="estimatedCost" stroke={CHART_COLORS.cost} fill="url(#usage-cost-fill)" strokeWidth={2.5} />
            <Line type="monotone" dataKey="estimatedCost" stroke={CHART_COLORS.cost} strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

function AgentBreakdownCard({ data }: { data: AgentBreakdownPoint[] }) {
  return (
    <ChartCard
      eyebrow="Agent breakdown"
      title="Who is consuming tokens"
      description="Distribution across Atlas, Luka, Sage, Max, and System for the current month."
      action={<Badge tone="default">Current month</Badge>}
    >
      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)] xl:items-center">
        <div className="mx-auto h-[280px] w-full max-w-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const point = payload[0]?.payload as AgentBreakdownPoint;
                  return renderTooltipCard(point.label, [
                    { name: "Tokens", value: point.tokens, color: point.fill, formatter: formatTokens },
                    { name: "Share", value: point.percent, color: "#e2e8f0", formatter: (value) => `${value.toFixed(1)}%` },
                  ]);
                }}
              />
              <Pie data={data} dataKey="tokens" nameKey="label" innerRadius={72} outerRadius={104} paddingAngle={3} stroke="rgba(15,23,42,0.6)">
                {data.map((entry) => <Cell key={entry.agent} fill={entry.fill} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="space-y-3">
          {data.map((entry) => (
            <div key={entry.agent} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="size-3 rounded-full" style={{ backgroundColor: entry.fill }} />
                  <div>
                    <p className="text-sm font-medium text-white">{entry.label}</p>
                    <p className="text-xs text-slate-500">{entry.percent.toFixed(1)}% of monthly usage</p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-white">{formatTokens(entry.tokens)}</p>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
                <div className="h-full rounded-full" style={{ width: `${Math.max(entry.percent, entry.tokens > 0 ? 2 : 0)}%`, backgroundColor: entry.fill }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </ChartCard>
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
      const providerRows = allRows.filter((row) => row.provider?.toLowerCase() === config.provider.toLowerCase());
      const dailyUsedTokens = providerRows
        .filter((row) => new Date(row.created_at) >= dayStart)
        .reduce((sum, row) => sum + getTokenCount(row), 0);
      const monthlyUsedTokens = providerRows
        .filter((row) => new Date(row.created_at) >= monthStart)
        .reduce((sum, row) => sum + getTokenCount(row), 0);

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

  const dailyUsageData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const points = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1);
      return {
        dateKey: getDateKey(date),
        dayLabel: String(index + 1),
        fullDateLabel: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        anthropic: 0,
        "openai-codex": 0,
        totalTokens: 0,
        estimatedCost: 0,
      } satisfies DailyUsagePoint;
    });

    const pointMap = new Map(points.map((point) => [point.dateKey, point]));

    for (const row of allRows) {
      const dateKey = getDateKey(new Date(row.created_at));
      const point = pointMap.get(dateKey);
      if (!point) continue;
      const tokens = getTokenCount(row);
      const provider = row.provider?.toLowerCase();
      if (provider === "anthropic" || provider === "openai-codex") {
        point[provider] += tokens;
      }
      point.totalTokens += tokens;
      point.estimatedCost += row.estimated_cost ?? 0;
    }

    return points;
  }, [allRows]);

  const weeklySummary = useMemo(() => {
    const currentWeekStart = startOfWeekLocal(new Date());
    const currentWeekEnd = addDays(currentWeekStart, 7);
    const previousWeekStart = addDays(currentWeekStart, -7);

    let currentTokens = 0;
    let previousTokens = 0;
    let currentCost = 0;
    let previousCost = 0;

    for (const row of allRows) {
      const createdAt = new Date(row.created_at);
      const tokens = getTokenCount(row);
      const cost = row.estimated_cost ?? 0;

      if (createdAt >= currentWeekStart && createdAt < currentWeekEnd) {
        currentTokens += tokens;
        currentCost += cost;
      } else if (createdAt >= previousWeekStart && createdAt < currentWeekStart) {
        previousTokens += tokens;
        previousCost += cost;
      }
    }

    const tokenChangePct = calculateChangePct(currentTokens, previousTokens);
    const costChangePct = calculateChangePct(currentCost, previousCost);

    return {
      currentTokens,
      previousTokens,
      currentCost,
      previousCost,
      tokenChangePct,
      costChangePct,
      tokenDirection: getChangeDirection(tokenChangePct),
      costDirection: getChangeDirection(costChangePct),
    } satisfies WeeklyComparison;
  }, [allRows]);

  const agentBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of allRows) {
      const agent = (row.agent_id || "system").toLowerCase();
      totals.set(agent, (totals.get(agent) ?? 0) + getTokenCount(row));
    }

    const grandTotal = Array.from(totals.values()).reduce((sum, value) => sum + value, 0);
    const preferredOrder = ["atlas", "luka", "sage", "max", "system"];
    const data = preferredOrder.map((agent) => {
      const config = AGENT_CONFIG[agent as keyof typeof AGENT_CONFIG];
      const tokens = totals.get(agent) ?? 0;
      return {
        agent,
        label: config.label as string,
        tokens,
        fill: config.color as string,
        percent: grandTotal > 0 ? (tokens / grandTotal) * 100 : 0,
      } satisfies AgentBreakdownPoint;
    });

    for (const [agent, tokens] of totals.entries()) {
      if (preferredOrder.includes(agent)) continue;
      data.push({
        agent,
        label: agent.charAt(0).toUpperCase() + agent.slice(1),
        tokens,
        fill: CHART_COLORS.other,
        percent: grandTotal > 0 ? (tokens / grandTotal) * 100 : 0,
      });
    }

    return data.sort((a, b) => b.tokens - a.tokens);
  }, [allRows]);

  const apiTrackingCards = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dateKeys = Array.from({ length: daysInMonth }, (_, index) => getDateKey(new Date(now.getFullYear(), now.getMonth(), index + 1)));

    return API_CATEGORIES.map((category) => {
      const rows = allRows.filter(category.matches);
      const spend = rows.reduce((sum, row) => sum + (row.estimated_cost ?? 0), 0);
      const requests = rows.length;
      const tokenUnits = rows.reduce((sum, row) => sum + getTokenCount(row), 0);
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
        description="Subscription capacity, daily burn trends, agent consumption, and API spend for the current month."
      />

      <section className="grid gap-4 xl:grid-cols-2">
        {isLoading
          ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[320px] rounded-3xl" />)
          : subscriptionMetrics.map((metric) => <SubscriptionCapacityCard key={metric.key} metric={metric} />)}
      </section>

      <section>
        {isLoading ? <Skeleton className="h-[248px] rounded-3xl" /> : <WeeklySummaryCard comparison={weeklySummary} />}
      </section>

      <section className="grid gap-4 2xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {isLoading ? <Skeleton className="h-[420px] rounded-3xl" /> : <DailyUsageChart data={dailyUsageData} />}
        {isLoading ? <Skeleton className="h-[420px] rounded-3xl" /> : <CostTrendChart data={dailyUsageData} />}
      </section>

      <section>
        {isLoading ? <Skeleton className="h-[440px] rounded-3xl" /> : <AgentBreakdownCard data={agentBreakdown} />}
      </section>

      <section className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">API cost tracking</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Provider cards</h2>
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
          <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Budget summary</p>
          <h2 className="mt-2 text-xl font-semibold text-white">Monthly API budget</h2>
        </div>
        {isLoading ? <Skeleton className="h-64 rounded-3xl" /> : <BudgetSummaryCard monthlySpend={monthlySpend} dailyBurnRate={dailyBurnRate} budget={budget} />}
      </section>
    </div>
  );
}
