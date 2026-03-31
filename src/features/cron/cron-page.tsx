import { useCronJobsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import type { CronJob } from "@/shared/types/models";
import { AlertTriangle, Clock3, Workflow } from "lucide-react";
import { useMemo, useState } from "react";

const DAY_COLUMNS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

type CronStatus = "ok" | "error" | "disabled";

interface ParsedSchedule {
  days: number[];
  timeLabel: string;
  sortMinutes: number;
}

function getCronStatus(job: CronJob): CronStatus {
  const status = (job.last_status ?? job.status ?? "").toLowerCase();
  if (["disabled", "paused", "inactive"].includes(status)) return "disabled";
  if (["error", "failed", "failing"].includes(status)) return "error";
  if (job.error) return "error";
  return "ok";
}

function getStatusTone(status: CronStatus) {
  if (status === "ok") return "success" as const;
  if (status === "error") return "danger" as const;
  return "default" as const;
}

function parseDayField(dayField: string): number[] {
  if (!dayField || dayField === "*") return [0, 1, 2, 3, 4, 5, 6];

  const days = new Set<number>();
  const normalized = dayField.replace(/7/g, "0");

  for (const segment of normalized.split(",").map((part) => part.trim()).filter(Boolean)) {
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

    const day = Number.parseInt(segment, 10);
    if (!Number.isNaN(day)) days.add(day);
  }

  return Array.from(days).sort((a, b) => a - b);
}

function parseTimeField(minuteField: string, hourField: string): { timeLabel: string; sortMinutes: number } {
  const hour = Number.parseInt(hourField, 10);
  const minute = Number.parseInt(minuteField, 10);

  if (!Number.isNaN(hour) && !Number.isNaN(minute)) {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return {
      timeLabel: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
      sortMinutes: hour * 60 + minute,
    };
  }

  if (hourField === "*" && /^\*\/\d+$/.test(minuteField)) {
    const interval = minuteField.slice(2);
    return {
      timeLabel: `Every ${interval}m`,
      sortMinutes: 0,
    };
  }

  return {
    timeLabel: "All day",
    sortMinutes: Number.MAX_SAFE_INTEGER,
  };
}

function parseSchedule(schedule: string | null | undefined): ParsedSchedule {
  const normalized = schedule?.trim().toLowerCase() ?? "";

  if (!normalized) {
    return {
      days: [0, 1, 2, 3, 4, 5, 6],
      timeLabel: "Unknown",
      sortMinutes: Number.MAX_SAFE_INTEGER,
    };
  }

  const everyMatch = normalized.match(/^every\s+(\d+)([mh])$/i);
  if (everyMatch) {
    const intervalValue = everyMatch[1] ?? "";
    const intervalUnit = everyMatch[2]?.toLowerCase() ?? "m";
    return {
      days: [0, 1, 2, 3, 4, 5, 6],
      timeLabel: `Every ${intervalValue}${intervalUnit}`,
      sortMinutes: 0,
    };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length >= 5) {
    const [minuteField, hourField, , , dayField] = parts;
    const { timeLabel, sortMinutes } = parseTimeField(minuteField ?? "", hourField ?? "");
    return {
      days: parseDayField(dayField ?? "*"),
      timeLabel,
      sortMinutes,
    };
  }

  return {
    days: [0, 1, 2, 3, 4, 5, 6],
    timeLabel: schedule ?? "Unknown",
    sortMinutes: Number.MAX_SAFE_INTEGER,
  };
}

export function CronPage() {
  const cronQuery = useCronJobsQuery();
  const [search, setSearch] = useState("");

  const jobs = cronQuery.data ?? [];
  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return jobs.filter((job) =>
      [job.name, job.schedule, job.agent_id ?? "", job.status ?? "", job.last_status ?? "", job.error ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [jobs, search]);

  const jobsByDay = useMemo(() => {
    const scheduleMap = new Map<string, ParsedSchedule>();
    const columns = DAY_COLUMNS.map((label, dayIndex) => ({
      label,
      dayIndex,
      jobs: [] as Array<{ job: CronJob; parsed: ParsedSchedule; status: CronStatus }>,
    }));

    for (const job of filteredJobs) {
      const parsed = parseSchedule(job.schedule);
      scheduleMap.set(job.id, parsed);
      const status = getCronStatus(job);

      for (const day of parsed.days) {
        columns[day]?.jobs.push({ job, parsed, status });
      }
    }

    for (const column of columns) {
      column.jobs.sort((a, b) => {
        if (a.parsed.sortMinutes !== b.parsed.sortMinutes) {
          return a.parsed.sortMinutes - b.parsed.sortMinutes;
        }
        return a.job.name.localeCompare(b.job.name);
      });
    }

    return { columns, scheduleMap };
  }, [filteredJobs]);

  if (cronQuery.isError) {
    return <ErrorState title="Cron monitor unavailable" description="Scheduled job data could not be loaded from Supabase." />;
  }

  const okCount = jobs.filter((job) => getCronStatus(job) === "ok").length;
  const errorCount = jobs.filter((job) => getCronStatus(job) === "error").length;
  const disabledCount = jobs.filter((job) => getCronStatus(job) === "disabled").length;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Automation"
        title="Cron jobs monitor"
        description="Live visibility into scheduled agents, run windows, and automation failures."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Workflow className="size-5 text-emerald-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Healthy jobs</p>
              <p className="mt-2 text-3xl font-semibold text-white">{okCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="size-5 text-rose-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Errors</p>
              <p className="mt-2 text-3xl font-semibold text-white">{errorCount}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <Clock3 className="size-5 text-slate-300" />
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Disabled</p>
              <p className="mt-2 text-3xl font-semibold text-white">{disabledCount}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Weekly schedule</h2>
            <p className="mt-1 text-sm text-slate-400">Cron jobs grouped by run day, sorted by execution time inside each daily lane.</p>
          </div>
          <div className="w-full xl:w-[320px]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cron jobs" />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>Showing {filteredJobs.length} jobs</span>
          <span className="text-slate-700">•</span>
          <span>Recurring expressions like daily and every-15m are expanded across the week.</span>
        </div>

        <div className="mt-6 overflow-x-auto pb-2">
          <div className="grid min-w-[1120px] gap-4 lg:grid-cols-7">
            {cronQuery.isLoading
              ? DAY_COLUMNS.map((day) => (
                  <Card key={day} className="border-white/8 bg-white/[0.02] p-4">
                    <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{day}</h3>
                      <Skeleton className="h-5 w-8 rounded-full" />
                    </div>
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={`${day}-${index}`} className="h-24 rounded-2xl" />
                      ))}
                    </div>
                  </Card>
                ))
              : jobsByDay.columns.map((column) => (
                  <Card key={column.label} className="border-white/8 bg-white/[0.02] p-4">
                    <div className="mb-4 flex items-center justify-between border-b border-white/8 pb-3">
                      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300">{column.label}</h3>
                      <Badge tone="default" className="border-white/10 bg-white/5 text-slate-300">
                        {column.jobs.length}
                      </Badge>
                    </div>

                    {column.jobs.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-xs text-slate-500">
                        No scheduled jobs
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {column.jobs.map(({ job, parsed, status }) => (
                          <div key={`${column.label}-${job.id}`} className="rounded-2xl border border-white/8 bg-slate-950/60 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{job.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{job.agent_id || "Unassigned agent"}</p>
                              </div>
                              <span
                                className={cn(
                                  "mt-1 inline-flex size-2.5 shrink-0 rounded-full",
                                  status === "ok" && "bg-emerald-400",
                                  status === "error" && "bg-rose-400",
                                  status === "disabled" && "bg-slate-500",
                                )}
                                aria-label={`Status: ${status}`}
                                title={`Status: ${status}`}
                              />
                            </div>

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <p className="text-sm font-medium text-sky-300">{parsed.timeLabel}</p>
                              <Badge tone={getStatusTone(status)} className={cn(status === "disabled" && "border-slate-500/20 bg-slate-400/10 text-slate-300")}>
                                {status}
                              </Badge>
                            </div>

                            <div className="mt-3 space-y-1 text-xs text-slate-500">
                              <p className="truncate">{job.schedule || "No schedule"}</p>
                              <p>Updated {formatRelativeTime(job.updated_at)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                ))}
          </div>

          {!cronQuery.isLoading && filteredJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No cron jobs match the current search.</div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
