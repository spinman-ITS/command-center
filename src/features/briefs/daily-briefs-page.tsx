import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { cn } from "@/shared/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Newspaper } from "lucide-react";
import { useMemo, useState } from "react";

type BriefType = "morning" | "eod";

interface DailyBrief {
  id: string;
  type: BriefType;
  content: string;
  created_at: string;
  date?: string;
  [key: string]: unknown;
}

/** Normalize raw type strings from DB (e.g. "Morning Brief", "EOD Brief") to our union. */
function normalizeBriefType(raw: string): BriefType {
  const lower = (raw ?? "").toLowerCase();
  if (lower.includes("eod") || lower.includes("end")) return "eod";
  return "morning";
}

function useDailyBriefs() {
  return useQuery<DailyBrief[]>({
    queryKey: ["daily-briefs"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase
        .from("daily_briefs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        type: normalizeBriefType(typeof row.brief_type === "string" ? row.brief_type : ""),
      })) as DailyBrief[];
    },
  });
}

const TYPE_STYLES: Record<BriefType, { label: string; bg: string; text: string; dot: string }> = {
  morning: { label: "Morning", bg: "bg-amber-500/15", text: "text-amber-400", dot: "bg-amber-400" },
  eod: { label: "EOD", bg: "bg-blue-500/15", text: "text-blue-400", dot: "bg-blue-400" },
};

function formatBriefDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** Minimal markdown-ish renderer: headers, bold, lists, links */
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

function BriefCard({ brief }: { brief: DailyBrief }) {
  const [expanded, setExpanded] = useState(false);
  const style = TYPE_STYLES[brief.type] ?? TYPE_STYLES.morning;
  const dateDisplay = formatBriefDate(brief.created_at);
  const isLong = (brief.content?.length ?? 0) > 400;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/12">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs uppercase tracking-[0.22em] text-slate-400">{dateDisplay}</p>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider", style.bg, style.text)}>
          <span className={cn("size-1.5 rounded-full", style.dot)} />
          {style.label}
        </span>
      </div>

      <div className={cn("relative mt-3 text-sm leading-relaxed text-slate-300", !expanded && isLong && "max-h-[200px] overflow-hidden")}>
        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(brief.content ?? "") }} />
        {!expanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0a0e18] to-transparent" />
        )}
      </div>

      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-slate-400 transition hover:text-slate-200"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? "Collapse" : "Read more"}
        </button>
      )}
    </div>
  );
}

type Filter = "all" | BriefType;

export function DailyBriefsPage() {
  const { data, isLoading, isError } = useDailyBriefs();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (data ?? []).filter((b) => filter === "all" || b.type === filter),
    [data, filter],
  );

  if (isError) return <ErrorState title="Briefs unavailable" description="Could not load daily briefs from the database." />;

  const filters: { value: Filter; label: string }[] = [
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
          <div className="flex gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
            {filters.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition",
                  filter === f.value
                    ? "bg-sky-500/20 text-sky-300 shadow-sm ring-1 ring-sky-500/40"
                    : "text-slate-400 hover:text-white",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      />

      <Card className="p-6">
        <div className="space-y-4">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)
            : filtered.length === 0
              ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-12 text-center">
                  <Newspaper className="size-8 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">No briefs yet</p>
                  <p className="text-xs text-slate-600">Morning briefs are generated at 8 AM and EOD briefs at 5 PM.</p>
                </div>
              )
              : filtered.map((brief) => <BriefCard key={brief.id} brief={brief} />)}
        </div>
      </Card>
    </div>
  );
}
