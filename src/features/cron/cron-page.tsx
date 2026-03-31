import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useCronJobsQuery } from "@/shared/hooks/use-command-center-data";
import { cn } from "@/shared/lib/utils";
import type { CronJob } from "@/shared/types/models";
import { AlertTriangle, CheckCircle2, Clock3, TriangleAlert, Zap } from "lucide-react";
import { useMemo } from "react";

const DAY_COLUMNS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const TODAY_INDEX = new Date().getDay();

type AgentTheme = { color: string; background: string; border: string };

const AGENT_THEME: Record<string, AgentTheme> = {
  "atlas/main": { color: "#16a34a", background: "rgba(22,163,74,0.18)", border: "rgba(22,163,74,0.34)" },
  lucy: { color: "#7c3aed", background: "rgba(124,58,237,0.18)", border: "rgba(124,58,237,0.34)" },
  max: { color: "#ef4444", background: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.34)" },
  dash: { color: "#0ea5e9", background: "rgba(14,165,233,0.18)", border: "rgba(14,165,233,0.34)" },
  luka: { color: "#ea580c", background: "rgba(234,88,12,0.18)", border: "rgba(234,88,12,0.34)" },
  sage: { color: "#06b6d4", background: "rgba(6,182,212,0.18)", border: "rgba(6,182,212,0.34)" },
  pixel: { color: "#f472b6", background: "rgba(244,114,182,0.18)", border: "rgba(244,114,182,0.34)" },
  scout: { color: "#f59e0b", background: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.34)" },
  default: { color: "#94a3b8", background: "rgba(148,163,184,0.14)", border: "rgba(148,163,184,0.24)" },
};

type CronStatus = "ok" | "error" | "warning" | "disabled";

interface ScheduleOccurrence {
  day: number;
  timeLabel: string;
  sortMinutes: number;
}

interface ParsedSchedule {
  isAlwaysRunning: boolean;
  frequencyLabel: string | null;
  occurrences: ScheduleOccurrence[];
}

interface ColumnJob {
  job: CronJob;
  occurrence: ScheduleOccurrence;
  status: CronStatus;
}

function getAgentTheme(agentId: string | null | undefined): AgentTheme {
  const fallbackTheme = AGENT_THEME.default as AgentTheme;
  if (!agentId) return fallbackTheme;
  return AGENT_THEME[agentId.toLowerCase()] ?? fallbackTheme;
}

function getCronStatus(job: CronJob): CronStatus {
  const normalizedStatus = (job.last_status ?? job.status ?? "").toLowerCase();

  if (["disabled", "paused", "inactive"].includes(normalizedStatus)) return "disabled";
  if ((job.consecutive_errors ?? 0) > 0) return "warning";
  if (["error", "failed", "failing"].includes(normalizedStatus) || job.error) return "error";
  return "ok";
}

function parseDayField(dayField: string): number[] {
  if (!dayField || dayField === "*") return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();
  const normalized = dayField.replace(/7/g, "0");

  for (const segment of normalized.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (segment.includes("-")) {
      const [startValue, endValue] = segment.split("-");
      const start = Number.parseInt(startValue ?? "", 10);
      const end = Number.parseInt(endValue ?? "", 10);

      if (Number.isNaN(start) || Number.isNaN(end)) continue;

      if (start <= end) {
        for (let day = start; day <= end; day += 1) days.add(day);
      } else {
        for (let day = start; day <= 6; day += 1) days.add(day);
        for (let day = 0; day <= end; day += 1) days.add(day);
      }
      continue;
    }

    const parsed = Number.parseInt(segment, 10);
    if (!Number.isNaN(parsed)) days.add(parsed);
  }

  return Array.from(days).sort((left, right) => left - right);
}

function parseNumberList(field: string, min: number, max: number): number[] {
  if (!field || field === "*") {
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }

  const values = new Set<number>();

  for (const segment of field.split(",").map((value) => value.trim()).filter(Boolean)) {
    if (segment.includes("/")) {
      const [base, stepValue] = segment.split("/");
      const step = Number.parseInt(stepValue ?? "", 10);
      if (Number.isNaN(step) || step <= 0) continue;

      const rangeMin = !base || base === "*" ? min : Number.parseInt(base, 10);
      if (Number.isNaN(rangeMin)) continue;

      for (let value = rangeMin; value <= max; value += step) {
        if (value >= min && value <= max) values.add(value);
      }
      continue;
    }

    if (segment.includes("-")) {
      const [startValue, endValue] = segment.split("-");
      const start = Number.parseInt(startValue ?? "", 10);
      const end = Number.parseInt(endValue ?? "", 10);
      if (Number.isNaN(start) || Number.isNaN(end)) continue;
      for (let value = start; value <= end; value += 1) {
        if (value >= min && value <= max) values.add(value);
      }
      continue;
    }

    const parsed = Number.parseInt(segment, 10);
    if (!Number.isNaN(parsed) && parsed >= min && parsed <= max) values.add(parsed);
  }

  return Array.from(values).sort((left, right) => left - right);
}

function formatTime(hour: number, minute: number) {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseSchedule(schedule: string | null | undefined): ParsedSchedule {
  const normalized = schedule?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return {
      isAlwaysRunning: false,
      frequencyLabel: null,
      occurrences: [],
    };
  }

  const everyMatch = normalized.match(/^every\s+(\d+)\s*([mh])$/i);
  if (everyMatch) {
    const intervalValue = everyMatch[1] ?? "";
    const intervalUnit = (everyMatch[2] ?? "m").toLowerCase();
    const label = `Every ${intervalValue}${intervalUnit}`;

    return {
      isAlwaysRunning: true,
      frequencyLabel: label,
      occurrences: [],
    };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length < 5) {
    return {
      isAlwaysRunning: false,
      frequencyLabel: null,
      occurrences: [],
    };
  }

  const [minuteField, hourField, , , dayField] = parts;
  const days = parseDayField(dayField ?? "*");
  const minutes = parseNumberList(minuteField ?? "0", 0, 59);
  const hours = parseNumberList(hourField ?? "0", 0, 23);

  const occurrences: ScheduleOccurrence[] = [];
  for (const day of days) {
    for (const hour of hours) {
      for (const minute of minutes) {
        occurrences.push({
          day,
          timeLabel: formatTime(hour, minute),
          sortMinutes: hour * 60 + minute,
        });
      }
    }
  }

  occurrences.sort((left, right) => left.sortMinutes - right.sortMinutes);

  return {
    isAlwaysRunning: false,
    frequencyLabel: null,
    occurrences,
  };
}

function StatusIndicator({ status }: { status: CronStatus }) {
  if (status === "warning") {
    return <TriangleAlert className="size-3.5 text-amber-300" aria-label="Warning status" />;
  }

  if (status === "error") {
    return <span className="size-2.5 rounded-full bg-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.55)]" aria-label="Error status" />;
  }

  if (status === "disabled") {
    return <span className="size-2.5 rounded-full bg-slate-500" aria-label="Disabled status" />;
  }

  return <span className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.5)]" aria-label="OK status" />;
}

function EmptyDayState() {
  return (
    <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-3 py-6 text-center text-[11px] text-slate-500">
      No tasks
    </div>
  );
}

export function CronPage() {
  const cronQuery = useCronJobsQuery();
  const jobs = cronQuery.data ?? [];

  const scheduleData = useMemo(() => {
    const alwaysRunning: Array<{ job: CronJob; parsed: ParsedSchedule; status: CronStatus }> = [];
    const columns = DAY_COLUMNS.map((label, dayIndex) => ({ label, dayIndex, jobs: [] as ColumnJob[] }));

    for (const job of jobs) {
      const parsed = parseSchedule(job.schedule);
      const status = getCronStatus(job);

      if (parsed.isAlwaysRunning) {
        alwaysRunning.push({ job, parsed, status });
        continue;
      }

      for (const occurrence of parsed.occurrences) {
        columns[occurrence.day]?.jobs.push({ job, occurrence, status });
      }
    }

    for (const column of columns) {
      column.jobs.sort((left, right) => {
        if (left.occurrence.sortMinutes !== right.occurrence.sortMinutes) {
          return left.occurrence.sortMinutes - right.occurrence.sortMinutes;
        }
        return left.job.name.localeCompare(right.job.name);
      });
    }

    alwaysRunning.sort((left, right) => left.job.name.localeCompare(right.job.name));

    return { alwaysRunning, columns };
  }, [jobs]);

  if (cronQuery.isError) {
    return <ErrorState title="Scheduled tasks unavailable" description="Scheduled job data could not be loaded from Supabase." />;
  }

  const okCount = jobs.filter((job) => getCronStatus(job) === "ok").length;
  const issueCount = jobs.filter((job) => ["error", "warning"].includes(getCronStatus(job))).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Automation</p>
        <h1 className="text-3xl font-semibold tracking-tight text-white">Scheduled Tasks</h1>
        <p className="text-sm text-slate-400">Atlas&apos;s automated routines</p>
      </div>

      <Card className="overflow-hidden border-white/8 bg-[#0b1018]/95 p-0 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="border-b border-white/8 bg-gradient-to-r from-amber-500/10 via-transparent to-transparent px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300">
              <Zap className="size-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.22em] text-white">Always Running</h2>
              <p className="mt-1 text-xs text-slate-400">Interval-based jobs that stay in motion throughout the day.</p>
            </div>
          </div>
        </div>

        <div className="px-5 py-4">
          {cronQuery.isLoading ? (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-52 rounded-full" />
              ))}
            </div>
          ) : scheduleData.alwaysRunning.length > 0 ? (
            <div className="flex flex-wrap gap-2.5">
              {scheduleData.alwaysRunning.map(({ job, parsed, status }) => {
                const theme = getAgentTheme(job.agent_id);
                return (
                  <div
                    key={job.id}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm"
                    style={{
                      color: theme.color,
                      backgroundColor: theme.background,
                      borderColor: theme.border,
                    }}
                  >
                    <StatusIndicator status={status} />
                    <span className="font-medium text-white/95">{job.name}</span>
                    <span className="text-white/40">•</span>
                    <span>{parsed.frequencyLabel ?? "Every interval"}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/8 bg-white/[0.02] px-4 py-5 text-sm text-slate-500">
              No interval-based tasks found.
            </div>
          )}
        </div>
      </Card>

      <Card className="border-white/8 bg-[#0b1018]/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Weekly Calendar</h2>
            <p className="mt-1 text-sm text-slate-400">Jobs are grouped by day and ordered from earliest to latest.</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              <CheckCircle2 className="size-3.5 text-emerald-400" />
              <span>{okCount} healthy</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              <AlertTriangle className="size-3.5 text-amber-300" />
              <span>{issueCount} needs attention</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5">
              <Clock3 className="size-3.5 text-sky-300" />
              <span>{jobs.length} total</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="grid min-w-[1120px] grid-cols-7 gap-3">
            {cronQuery.isLoading
              ? DAY_COLUMNS.map((day) => (
                  <div key={day} className="rounded-[24px] border border-white/8 bg-[#0d131d] p-3">
                    <Skeleton className="mb-4 h-6 w-14 rounded-full" />
                    <div className="space-y-2.5">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <Skeleton key={`${day}-${index}`} className="h-16 rounded-2xl" />
                      ))}
                    </div>
                  </div>
                ))
              : scheduleData.columns.map((column) => {
                  const isToday = column.dayIndex === TODAY_INDEX;
                  return (
                    <div
                      key={column.label}
                      className={cn(
                        "rounded-[24px] border bg-[#0d131d] p-3 transition-colors",
                        isToday ? "border-amber-400/30 bg-[#111827] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]" : "border-white/8",
                      )}
                    >
                      <div className="mb-3 flex items-center justify-between border-b border-white/8 pb-3">
                        <span className={cn("text-sm font-medium", isToday ? "text-amber-300" : "text-slate-300")}>{column.label}</span>
                        <Badge tone="default" className={cn("border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]", isToday ? "border-amber-400/20 bg-amber-400/10 text-amber-200" : "border-white/8 bg-white/[0.03] text-slate-500")}>
                          {column.jobs.length}
                        </Badge>
                      </div>

                      <div className="space-y-2.5">
                        {column.jobs.length === 0 ? (
                          <EmptyDayState />
                        ) : (
                          column.jobs.map(({ job, occurrence, status }, index) => {
                            const theme = getAgentTheme(job.agent_id);
                            return (
                              <div
                                key={`${job.id}-${column.dayIndex}-${occurrence.sortMinutes}-${index}`}
                                className="rounded-2xl border px-3 py-2.5"
                                style={{
                                  backgroundColor: theme.background,
                                  borderColor: theme.border,
                                  color: theme.color,
                                }}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="min-w-0 truncate text-[13px] font-semibold leading-5">{job.name}</p>
                                  <StatusIndicator status={status} />
                                </div>
                                <div className="mt-1 flex items-center gap-2 text-[11px] font-medium opacity-90">
                                  <span>{occurrence.timeLabel}</span>
                                  {(job.consecutive_errors ?? 0) > 0 ? <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-200">{job.consecutive_errors}x</span> : null}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </Card>
    </div>
  );
}
