import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { CheckSquare, ChevronDown, ChevronUp, Clock, Lightbulb, Search, Video } from "lucide-react";
import { useMemo, useState } from "react";

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
  [key: string]: unknown;
}

function useMeetingSummaries() {
  return useQuery<MeetingSummary[]>({
    queryKey: ["meeting-summaries"],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase
        .from("meeting_summaries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data ?? []) as MeetingSummary[];
    },
  });
}

function toName(item: unknown): string {
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && "name" in item) return String((item as Record<string, unknown>).name);
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
      // not JSON
    }
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// parseAttendees consolidated into parseJsonArray

function formatMeetingDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDuration(duration: string | number | null): string | null {
  if (!duration) return null;
  if (typeof duration === "number") {
    if (duration < 60) return `${duration}m`;
    return `${Math.floor(duration / 60)}h ${duration % 60}m`;
  }
  return String(duration);
}

/** Render markdown-like text into formatted JSX */
function FormattedContent({ text }: { text: string }) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const trimmed = line.trim();

    // Blank line → spacer
    if (!trimmed) {
      elements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Headers: ## or ### or **Title:**
    if (/^#{1,3}\s+/.test(trimmed)) {
      const headerText = trimmed.replace(/^#{1,3}\s+/, "");
      elements.push(
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          {headerText}
        </p>,
      );
      continue;
    }

    // Bold-only line (acts as section header): **Some Title**
    if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) {
      const headerText = trimmed.replace(/\*\*/g, "").replace(/:$/, "");
      elements.push(
        <p key={i} className="mt-3 mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">
          {headerText}
        </p>,
      );
      continue;
    }

    // Bullet items: - item or * item
    if (/^[-*]\s+/.test(trimmed)) {
      const content = trimmed.replace(/^[-*]\s+/, "");
      elements.push(
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-2 size-1 shrink-0 rounded-full bg-sky-400/60" />
          <span className="text-sm leading-relaxed text-slate-300">
            <InlineFormat text={content} />
          </span>
        </div>,
      );
      continue;
    }

    // Numbered items: 1. item
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)[.)]\s+/)?.[1] ?? "";
      const content = trimmed.replace(/^\d+[.)]\s+/, "");
      elements.push(
        <div key={i} className="flex items-start gap-2 pl-1">
          <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-medium text-sky-400/60">
            {num}.
          </span>
          <span className="text-sm leading-relaxed text-slate-300">
            <InlineFormat text={content} />
          </span>
        </div>,
      );
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={i} className="text-sm leading-relaxed text-slate-300">
        <InlineFormat text={trimmed} />
      </p>,
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

/** Render inline formatting: **bold** */
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

/** Parse action items from various formats */
function parseActionItems(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(toName).filter(Boolean);
  if (typeof value === "string") {
    const trimmed = value.trim();
    // Try JSON array
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(toName).filter(Boolean);
    } catch {
      // not JSON
    }
    // Split on newlines, strip bullets/numbers
    return trimmed
      .split("\n")
      .map((s) => s.trim().replace(/^[-*•]\s*/, "").replace(/^\d+[.)]\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

function SectionDivider() {
  return <div className="border-t border-white/6" />;
}

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  const [expanded, setExpanded] = useState(false);
  const dateDisplay = formatMeetingDate(meeting.meeting_date ?? meeting.date ?? meeting.created_at);
  const duration = formatDuration(meeting.duration);
  const attendees = parseJsonArray(meeting.attendees);
  const actionItems = parseActionItems(meeting.action_items);
  const summary = meeting.summary ?? "";
  const keyTakeaways = typeof meeting.key_takeaways === "string" ? meeting.key_takeaways : null;
  const topics = parseJsonArray(meeting.topics);
  const notes = typeof meeting.notes === "string" ? meeting.notes : null;
  const hasExtra = actionItems.length > 0 || keyTakeaways || topics.length > 0 || notes;
  const isLong = summary.length > 300;
  const previewText = isLong && !expanded ? summary.slice(0, 280) + "…" : summary;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] transition hover:border-white/12">
      {/* Header */}
      <div className="p-5 pb-0">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-start gap-3 text-left"
          >
            <Video className="mt-0.5 size-4 shrink-0 text-sky-400" />
            <h3 className={`font-semibold text-white ${expanded ? "text-base" : "text-sm"}`}>
              {meeting.title || "Untitled Meeting"}
            </h3>
          </button>
          <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
            <span>{dateDisplay}</span>
            {duration && (
              <>
                <span className="text-slate-700">·</span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3" />
                  {duration}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Attendees */}
        {attendees.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {attendees.map((name) => (
              <span
                key={name}
                className="rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-medium text-slate-400 ring-1 ring-white/8"
              >
                {name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5 pt-3 space-y-4">
        {/* Summary */}
        {summary && (
          <div>
            {expanded && (
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                Summary
              </p>
            )}
            {expanded ? (
              <FormattedContent text={summary} />
            ) : (
              <p className="text-sm leading-relaxed text-slate-300">
                <InlineFormat text={previewText} />
              </p>
            )}
          </div>
        )}

        {/* Expanded sections */}
        {expanded && (
          <>
            {/* Action Items */}
            {actionItems.length > 0 && (
              <>
                <SectionDivider />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <CheckSquare className="size-3.5 text-sky-400/70" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Action Items
                    </p>
                  </div>
                  <ul className="space-y-2 pl-1">
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

            {/* Key Takeaways */}
            {keyTakeaways && (
              <>
                <SectionDivider />
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <Lightbulb className="size-3.5 text-amber-400/70" />
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Key Takeaways
                    </p>
                  </div>
                  <FormattedContent text={keyTakeaways} />
                </div>
              </>
            )}

            {/* Topics */}
            {topics.length > 0 && (
              <>
                <SectionDivider />
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
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

            {/* Notes */}
            {notes && (
              <>
                <SectionDivider />
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    Notes
                  </p>
                  <FormattedContent text={notes} />
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Expand/collapse */}
      {(isLong || hasExtra) && (
        <div className="border-t border-white/6 px-5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? "Collapse" : "Expand details"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MeetingSummariesPage() {
  const { data, isLoading, isError } = useMeetingSummaries();
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const items = data ?? [];
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (m) =>
        (m.title ?? "").toLowerCase().includes(q) ||
        (m.summary ?? "").toLowerCase().includes(q),
    );
  }, [data, search]);

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

      <Card className="p-6">
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 p-12 text-center">
              <Video className="size-8 text-slate-600" />
              <p className="text-sm font-medium text-slate-400">
                {search ? "No meetings match your search" : "No meeting summaries yet"}
              </p>
              <p className="text-xs text-slate-600">
                {search
                  ? "Try a different search term."
                  : "Meeting summaries will appear here once Fathom sync is active."}
              </p>
            </div>
          ) : (
            filtered.map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} />
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
