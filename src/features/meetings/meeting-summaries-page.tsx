import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, ChevronDown, ChevronUp, Clock, ExternalLink, Lightbulb, Search, Video } from "lucide-react";
import { useMemo, useState } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeetingSummary {
  id: string;
  title: string;
  summary: string | null;
  action_items: string[] | string | null;
  attendees: unknown;
  meeting_date: string | null;
  date: string | null;
  duration: string | number | null;
  created_at: string;
  recording_url?: string | null;
  transcript_length?: number | null;
  key_takeaways?: string | null;
  topics?: unknown;
  notes?: string | null;
  [key: string]: unknown;
}

type DateFilter = "today" | "yesterday" | "week" | "month" | "all";

// ─── Data fetching ───────────────────────────────────────────────────────────

function useMeetingSummaries() {
  return useQuery<MeetingSummary[]>({
    queryKey: ["meeting-summaries"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase
        .from("meeting_summaries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as MeetingSummary[];
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toName(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "name" in item)
    return String((item as Record<string, unknown>).name);
  return String(item);
}

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(toName);
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.map(toName);
    } catch {
      /* not JSON */
    }
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

function parseActionItems(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(toName).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(toName).filter(Boolean);
    } catch {
      /* not JSON */
    }
    return trimmed
      .split("\n")
      .map((s) =>
        s
          .trim()
          .replace(/^[-*•]\s*/, "")
          .replace(/^\d+[.)]\s*/, "")
          .trim(),
      )
      .filter(Boolean);
  }
  return [];
}

function getMeetingDate(m: MeetingSummary): Date {
  return new Date(m.meeting_date ?? m.date ?? m.created_at);
}

function formatDuration(duration: string | number | null): string | null {
  if (!duration) return null;
  if (typeof duration === "number") {
    if (duration < 60) return `${duration}m`;
    return `${Math.floor(duration / 60)}h ${duration % 60}m`;
  }
  return String(duration);
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
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

// ─── Date filtering ──────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const r = startOfDay(d);
  const day = r.getDay();
  const diff = day === 0 ? 6 : day - 1;
  r.setDate(r.getDate() - diff);
  return r;
}

function filterByDate(meetings: MeetingSummary[], filter: DateFilter): MeetingSummary[] {
  if (filter === "all") return meetings;

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

  return meetings.filter((m) => {
    const d = getMeetingDate(m);
    return d >= start && d < end;
  });
}

// ─── Grouping ────────────────────────────────────────────────────────────────

interface DateGroup {
  key: string;
  date: Date;
  label: string;
  meetings: MeetingSummary[];
}

function groupByDate(meetings: MeetingSummary[]): DateGroup[] {
  const map = new Map<string, { date: Date; meetings: MeetingSummary[] }>();

  for (const m of meetings) {
    const d = getMeetingDate(m);
    const key = dateLabelKey(d);
    const existing = map.get(key);
    if (existing) {
      existing.meetings.push(m);
    } else {
      map.set(key, { date: startOfDay(d), meetings: [m] });
    }
  }

  // Sort groups newest first, meetings within group by time descending
  return Array.from(map.entries())
    .sort(([, a], [, b]) => b.date.getTime() - a.date.getTime())
    .map(([key, { date, meetings: groupMeetings }]) => ({
      key,
      date,
      label: formatGroupDate(date),
      meetings: groupMeetings.sort(
        (a, b) => getMeetingDate(b).getTime() - getMeetingDate(a).getTime(),
      ),
    }));
}

// ─── Formatted content components ────────────────────────────────────────────

function InlineFormat({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return (
            <span key={i} className="font-semibold text-white">
              {part.slice(2, -2)}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    if (/^#{1,3}\s+/.test(trimmed)) {
      elements.push(
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          {trimmed.replace(/^#{1,3}\s+/, "")}
        </p>,
      );
      continue;
    }

    if (/^\*\*[^*]+\*\*: ?\s*$/.test(trimmed)) {
      elements.push(
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          {trimmed.replace(/\*\*/g, "").replace(/:$/, "")}
        </p>,
      );
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      elements.push(
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-sky-400/60" />
          <span className="text-sm leading-relaxed text-slate-300">
            <InlineFormat text={trimmed.replace(/^[-*]\s+/, "")} />
          </span>
        </div>,
      );
      continue;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)[.)]\s+/)?.[1] ?? "";
      elements.push(
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-medium text-sky-400/60">
            {num}.
          </span>
          <span className="text-sm leading-relaxed text-slate-300">
            <InlineFormat text={trimmed.replace(/^\d+[.)]\s+/, "")} />
          </span>
        </div>,
      );
      continue;
    }

    elements.push(
      <p key={i} className="text-sm leading-relaxed text-slate-300">
        <InlineFormat text={trimmed} />
      </p>,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// ─── Filter bar ──────────────────────────────────────────────────────────────

const FILTERS: { key: DateFilter; label: string }[] = [
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
      {FILTERS.map((f) => {
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
                ({count} {count === 1 ? "meeting" : "meetings"})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Meeting card (collapsed by default) ─────────────────────────────────────

function SectionDivider() {
  return <div className="border-t border-white/6" />;
}

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  const [expanded, setExpanded] = useState(false);
  const duration = formatDuration(meeting.duration);
  const attendees = parseJsonArray(meeting.attendees);
  const actionItems = parseActionItems(meeting.action_items);
  const summary = meeting.summary ?? "";
  const keyTakeaways = typeof meeting.key_takeaways === "string" ? meeting.key_takeaways : null;
  const topics = parseJsonArray(meeting.topics);
  const notes = typeof meeting.notes === "string" ? meeting.notes : null;
  const hasExtra = actionItems.length > 0 || keyTakeaways || topics.length > 0 || notes || summary.length > 100;
  const time = formatTime(meeting.meeting_date ?? meeting.date ?? meeting.created_at);
  const recordingUrl = typeof meeting.recording_url === "string" ? meeting.recording_url : null;
  const transcriptLength = typeof meeting.transcript_length === "number" ? meeting.transcript_length : null;

  // Preview: first 100 chars of summary
  const preview = summary.length > 100 ? summary.slice(0, 100).replace(/\s+\S*$/, "") + "…" : summary;

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] transition hover:border-white/12">
      {/* Collapsed view — always visible */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <Video className="mt-0.5 size-4 shrink-0 text-sky-400" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <h3 className="truncate text-sm font-semibold text-white">
              {meeting.title || "Untitled Meeting"}
            </h3>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-500">
              <span>{time}</span>
              {duration && (
                <>
                  <span className="text-slate-700">·</span>
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="size-2.5" />
                    {duration}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Attendee pills */}
          {attendees.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {attendees.map((name) => (
                <span
                  key={name}
                  className="rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-white/8"
                >
                  {name}
                </span>
              ))}
            </div>
          )}

          {/* Summary preview (collapsed only) */}
          {!expanded && preview && (
            <p className="mt-1.5 line-clamp-1 text-xs leading-relaxed text-slate-500">
              {preview}
            </p>
          )}

          {recordingUrl && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                className="h-8 px-3 py-1.5 text-xs"
                onClick={(event) => {
                  event.stopPropagation();
                  window.open(recordingUrl, "_blank", "noopener,noreferrer");
                }}
              >
                <ExternalLink className="mr-1.5 size-3.5" />
                View in Fathom
              </Button>
              {transcriptLength !== null && (
                <Badge tone="default" className="border-white/10 bg-white/5 text-slate-300">
                  {transcriptLength} {transcriptLength === 1 ? "segment" : "segments"}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Expand indicator */}
        {hasExtra && (
          <div className="mt-0.5 shrink-0 text-slate-600">
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        )}
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="space-y-4 border-t border-white/6 px-4 pb-4 pt-3">
          {summary && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                Summary
              </p>
              <FormattedContent text={summary} />
            </div>
          )}

          {actionItems.length > 0 && (
            <>
              <SectionDivider />
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <CheckSquare className="size-3.5 text-sky-400/70" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Action Items
                  </p>
                </div>
                <ul className="space-y-1.5 pl-1">
                  {actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <div className="mt-1 size-3.5 shrink-0 rounded border border-white/15 bg-white/5" />
                      <span className="text-sm leading-relaxed text-slate-300">
                        <InlineFormat text={item} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {keyTakeaways && (
            <>
              <SectionDivider />
              <div>
                <div className="mb-1.5 flex items-center gap-2">
                  <Lightbulb className="size-3.5 text-amber-400/70" />
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Key Takeaways
                  </p>
                </div>
                <FormattedContent text={keyTakeaways} />
              </div>
            </>
          )}

          {topics.length > 0 && (
            <>
              <SectionDivider />
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Topics
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {topics.map((topic) => (
                    <span
                      key={topic}
                      className="rounded-lg bg-sky-400/10 px-2.5 py-1 text-xs font-medium text-sky-300"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </>
          )}

          {notes && (
            <>
              <SectionDivider />
              <div>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
                  Notes
                </p>
                <FormattedContent text={notes} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function MeetingSummariesPage() {
  const { data, isLoading, isError } = useMeetingSummaries();
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("week");

  const filtered = useMemo(() => {
    let items = data ?? [];

    // Date filter first
    items = filterByDate(items, dateFilter);

    // Then search
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        (m) =>
          (m.title ?? "").toLowerCase().includes(q) ||
          (m.summary ?? "").toLowerCase().includes(q),
      );
    }

    return items;
  }, [data, search, dateFilter]);

  const groups = useMemo(() => groupByDate(filtered), [filtered]);

  if (isError)
    return (
      <ErrorState
        title="Meetings unavailable"
        description="Could not load meeting summaries from the database."
      />
    );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Meetings"
        title="Meeting Summaries"
        description="Fathom meeting transcripts and action items."
        action={
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search meetings…"
              className="h-9 rounded-xl border border-white/10 bg-white/5 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-white/10"
            />
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
            <Video className="size-8 text-slate-600" />
            <p className="text-sm font-medium text-slate-400">
              {search
                ? "No meetings match your search"
                : `No meetings ${dateFilter === "all" ? "yet" : "in this period"}`}
            </p>
            <p className="text-xs text-slate-600">
              {search
                ? "Try a different search term or change the date filter."
                : dateFilter === "all"
                  ? "Meeting summaries will appear here once Fathom sync is active."
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
                  {group.meetings.length}
                </span>
              </div>

              {/* Meeting cards */}
              <div className="space-y-2">
                {group.meetings.map((meeting) => (
                  <MeetingCard key={meeting.id} meeting={meeting} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
