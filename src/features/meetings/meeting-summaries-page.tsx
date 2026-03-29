import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ErrorState } from "@/shared/components/error-state";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Circle, Clock, Search, Video } from "lucide-react";
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

function MeetingCard({ meeting }: { meeting: MeetingSummary }) {
  const [expanded, setExpanded] = useState(false);
  const dateDisplay = formatMeetingDate(meeting.meeting_date ?? meeting.date ?? meeting.created_at);
  const duration = formatDuration(meeting.duration);
  const attendees = parseJsonArray(meeting.attendees);
  const actionItems = parseJsonArray(meeting.action_items);
  const summary = meeting.summary ?? "";
  const isLong = summary.length > 200;
  const previewText = isLong && !expanded ? summary.slice(0, 200) + "…" : summary;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition hover:border-white/12">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-start gap-3 text-left"
        >
          <Video className="mt-0.5 size-4 shrink-0 text-sky-400" />
          <h3 className="text-sm font-semibold text-white">{meeting.title || "Untitled Meeting"}</h3>
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

      {/* Summary */}
      {summary && (
        <div className="mt-3 text-sm leading-relaxed text-slate-300">
          <p className="whitespace-pre-wrap">{previewText}</p>
        </div>
      )}

      {/* Action items */}
      {expanded && actionItems.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/6 bg-white/[0.02] p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Action Items
          </p>
          <ul className="space-y-1.5">
            {actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                <Circle className="mt-0.5 size-3.5 shrink-0 text-sky-400/60" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Expand/collapse */}
      {(isLong || actionItems.length > 0) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-slate-300"
        >
          {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          {expanded ? "Collapse" : "Expand details"}
        </button>
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
