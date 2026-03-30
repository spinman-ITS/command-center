import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Newspaper, Search } from "lucide-react";
import { useMemo, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type BriefType = "morning" | "eod";
type DateFilter = "today" | "yesterday" | "week" | "month" | "all";
type TypeFilter = "all" | BriefType;

interface DailyBrief {
  id: string;
  type: BriefType;
  brief_type: string;
  brief_date: string | null;
  content: string;
  created_at: string;
  [key: string]: unknown;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeBriefType(raw: string): BriefType {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("eod") || lower.includes("end")) return "eod";
  return "morning";
}

function getBriefDate(b: DailyBrief): Date {
  return new Date(b.brief_date ?? b.created_at);
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function getMonday(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  const diff = day === 0 ? 6 : day - 1;
  r.setDate(r.getDate() - diff);
  return r;
}

function dateLabelKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatGroupDate(d: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(d);
  const diff = today.getTime() - target.getTime();
  const dayMs = 86400000;
  const formatted = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  if (diff < dayMs && diff >= 0) return `Today, ${formatted}`;
  if (diff < dayMs * 2 && diff >= dayMs) return `Yesterday, ${formatted}`;
  return formatted;
}

function formatBriefDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// ─── Data fetching ───────────────────────────────────────────────────────────

function useDailyBriefs() {
  return useQuery<DailyBrief[]>({
    queryKey: ["daily-briefs"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase
        .from("daily_briefs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        type: normalizeBriefType(typeof row.brief_type === "string" ? row.brief_type : ""),
      })) as DailyBrief[];
    },
  });
}

// ─── Date filtering ──────────────────────────────────────────────────────────

function filterByDate(briefs: DailyBrief[], filter: DateFilter): DailyBrief[] {
  if (filter === "all") return briefs;

  const now = new Date();
  const today = startOfDay(now);
  const dayMs = 86400000;

  let start: Date;
  let end: Date;

  switch (filter) {
    case "today":
      start = today;
      end = new Date(today.getTime() + dayMs);
      break;
    case "yesterday":
      start = new Date(today.getTime() - dayMs);
      end = today;
      break;
    case "week":
      start = getMonday(now);
      end = new Date(start.getTime() + 7 * dayMs);
      break;
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
  }

  return briefs.filter((b) => {
    const d = getBriefDate(b);
    return d >= start && d < end;
  });
}

// ─── Grouping ────────────────────────────────────────────────────────────────

interface DateGroup {
  key: string;
  date: Date;
  label: string;
  briefs: DailyBrief[];
}

function groupByDate(briefs: DailyBrief[]): DateGroup[] {
  const map = new Map<string, { date: Date; briefs: DailyBrief[] }>();

  for (const b of briefs) {
    const d = getBriefDate(b);
    const key = dateLabelKey(d);
    const existing = map.get(key);
    if (existing) {
      existing.briefs.push(b);
    } else {
      map.set(key, { date: startOfDay(d), briefs: [b] });
    }
  }

  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
    .map(([key, { date, briefs: groupBriefs }]) => ({
      key,
      date,
      label: formatGroupDate(date),
      briefs: groupBriefs.sort(
        (a, b) => getBriefDate(b).getTime() - getBriefDate(a).getTime(),
      ),
    }));
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<BriefType, { label: string; bg: string; text: string; dot: string }> = {
  morning: { label: "Morning", bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  eod: { label: "EOD", bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
};

// ─── Markdown renderer ──────────────────────────────────────────────────────

function renderMarkdown(text: string): string {
  return text
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold text-white mt-3 mb-1">$1</h4>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-semibold text-white mt-4 mb-1">$1</h3>')
    .replace(/^# (.+)$/gm, '<h2 class="text-lg font-bold text-white mt-4 mb-2">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 underline hover:text-sky-300">$1</a>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>')
    .replace(/\n/g, "<br />");
}

// ─── Date filter bar ─────────────────────────────────────────────────────────

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "all", label: "All" },
];

function DateFilterBar({
  active,
  onChange,
  count,
}: {
  active: DateFilter;
  onChange: (f: DateFilter) => void;
  count: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {DATE_FILTERS.map((f) => {
        const isActive = f.key === active;
        return (
          <button
            key={f.key}
            type="button"
            onClick={() => onChange(f.key)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              isActive
                ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-500/30"
                : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
            }`}
          >
            {f.label}
            {isActive && (
              <span className="ml-1.5 text-[10px] text-sky-400/70">
                ({count} {count === 1 ? "brief" : "briefs"})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Brief card (collapsed by default) ──────────────────────────────────────

function BriefCard({ brief }: { brief: DailyBrief }) {
  const [expanded, setExpanded] = useState(false);
  const style = TYPE_STYLES[brief.type] ?? TYPE_STYLES.morning;
  const dateDisplay = formatBriefDate(brief.brief_date ?? brief.created_at);
  const content = brief.content ?? "";
  const preview = content.length > 100 ? content.slice(0, 100).replace(/\s+\S*$/, "") + "…" : content;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] transition hover:border-white/12">
      {/* Collapsed header — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Newspaper className="mt-0.5 size-4 shrink-0 text-slate-500" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                style.bg,
                style.text,
              )}
            >
              <span className={cn("size-1.5 rounded-full", style.dot)} />
              {style.label}
            </span>
            <span className="text-[11px] text-slate-500">{dateDisplay}</span>
          </div>

          {/* Preview when collapsed */}
          {!expanded && preview && (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-1">
              {preview}
            </p>
          )}
        </div>

        <div className="mt-0.5 shrink-0 text-slate-600">
          {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-white/6 px-4 pb-4 pt-3">
          <div className="text-sm leading-relaxed text-slate-300">
            <div dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function DailyBriefsPage() {
  const { data, isLoading, isError } = useDailyBriefs();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let items = data ?? [];

    // Date filter
    items = filterByDate(items, dateFilter);

    // Type filter
    if (typeFilter !== "all") {
      items = items.filter((b) => b.type === typeFilter);
    }

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((b) => (b.content ?? "").toLowerCase().includes(q));
    }

    return items;
  }, [data, typeFilter, dateFilter, search]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  if (isError)
    return (
      <ErrorState
        title="Briefs unavailable"
        description="Could not load daily briefs from the database."
      />
    );

  const typeFilters: { value: TypeFilter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "morning", label: "Morning" },
    { value: "eod", label: "EOD" },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Briefs"
        title="Daily Briefs"
        description="Morning and end-of-day operational summaries."
        action={
          <div className="flex max-w-full flex-col gap-3 md:items-end">
            {/* Type filter pills */}
            <div className="flex max-w-full flex-wrap gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              {typeFilters.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setTypeFilter(f.value)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition",
                    typeFilter === f.value
                      ? "bg-sky-500/20 text-sky-300 shadow-sm ring-1 ring-sky-500/40"
                      : "text-slate-400 hover:text-white",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full max-w-full md:w-64">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search briefs…"
                className="h-9 w-full max-w-full rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
              />
            </div>
          </div>
        }
      />

      {/* Date filter bar */}
      <DateFilterBar active={dateFilter} onChange={setDateFilter} count={filtered.length} />

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/10 p-12 text-center">
            <Newspaper className="size-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">
              {search
                ? "No briefs match your search"
                : `No briefs ${dateFilter === "all" ? "yet" : "in this period"}`}
            </p>
            <p className="text-xs text-slate-600">
              {search
                ? "Try a different search term or change the date filter."
                : dateFilter === "all"
                  ? "Morning briefs are generated at 8 AM and EOD briefs at 5 PM."
                  : "Try a wider date range or check back later."}
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.key}>
              {/* Date group header */}
              <div className="mb-3 flex items-center gap-3">
                <h2 className="shrink-0 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {group.label}
                </h2>
                <div className="h-px flex-1 bg-white/6" />
                <span className="shrink-0 text-[10px] text-slate-600">
                  {group.briefs.length}
                </span>
              </div>

              {/* Brief cards */}
              <div className="space-y-2">
                {group.briefs.map((brief) => (
                  <BriefCard key={brief.id} brief={brief} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
