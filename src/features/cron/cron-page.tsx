import { useCronJobsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatAbsoluteDate, formatRelativeTime } from "@/shared/lib/utils";
import { cn } from "@/shared/lib/utils";
import type { CronJob } from "@/shared/types/models";
import { AlertTriangle, Clock3, Workflow } from "lucide-react";
import { useMemo, useState } from "react";

function getCronStatus(job: CronJob): "ok" | "error" | "disabled" {
  const status = (job.last_status ?? job.status ?? "").toLowerCase();
  if (["disabled", "paused", "inactive"].includes(status)) return "disabled";
  if (["error", "failed", "failing"].includes(status)) return "error";
  if (job.error) return "error";
  return "ok";
}

function getStatusTone(status: "ok" | "error" | "disabled") {
  if (status === "ok") return "success" as const;
  if (status === "error") return "danger" as const;
  return "default" as const;
}

export function CronPage() {
  const cronQuery = useCronJobsQuery();
  const [search, setSearch] = useState("");

  const jobs = cronQuery.data ?? [];
  const filteredJobs = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return jobs
      .filter((job) => [job.name, job.schedule, job.agent_id ?? "", job.status ?? "", job.last_status ?? "", job.error ?? ""].join(" ").toLowerCase().includes(normalizedSearch))
      .sort((a, b) => {
        const nextA = a.next_run_at ? new Date(a.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
        const nextB = b.next_run_at ? new Date(b.next_run_at).getTime() : Number.MAX_SAFE_INTEGER;
        return nextA - nextB;
      });
  }, [jobs, search]);

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
            <h2 className="text-2xl font-semibold text-white">Scheduled jobs</h2>
            <p className="mt-1 text-sm text-slate-400">Every cron job in the Supabase cron_jobs table, with agent assignment and recent failures.</p>
          </div>
          <div className="w-full xl:w-[320px]">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cron jobs" />
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/8 text-slate-500">
                <th className="pb-3 font-medium">Job</th>
                <th className="pb-3 font-medium">Schedule</th>
                <th className="pb-3 font-medium">Agent</th>
                <th className="pb-3 font-medium">Last run</th>
                <th className="pb-3 font-medium">Next run</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Last error</th>
              </tr>
            </thead>
            <tbody>
              {cronQuery.isLoading
                ? Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td className="py-3" colSpan={7}>
                        <Skeleton className="h-14 rounded-2xl" />
                      </td>
                    </tr>
                  ))
                : filteredJobs.map((job) => {
                    const status = getCronStatus(job);
                    return (
                      <tr key={job.id} className="border-b border-white/6 align-top">
                        <td className="py-4 pr-4">
                          <div>
                            <p className="font-medium text-white">{job.name}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">Updated {formatRelativeTime(job.updated_at)}</p>
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-slate-300">{job.schedule || "—"}</td>
                        <td className="py-4 pr-4 text-slate-300">{job.agent_id || "—"}</td>
                        <td className="py-4 pr-4 text-slate-300">
                          <div>{job.last_run_at ? formatRelativeTime(job.last_run_at) : "Never"}</div>
                          <div className="mt-1 text-xs text-slate-500">{job.last_run_at ? formatAbsoluteDate(job.last_run_at) : "No runs recorded"}</div>
                        </td>
                        <td className="py-4 pr-4 text-slate-300">
                          <div>{job.next_run_at ? formatRelativeTime(job.next_run_at) : "Not scheduled"}</div>
                          <div className="mt-1 text-xs text-slate-500">{job.next_run_at ? formatAbsoluteDate(job.next_run_at) : "Awaiting scheduler update"}</div>
                        </td>
                        <td className="py-4 pr-4">
                          <Badge tone={getStatusTone(status)} className={cn(status === "disabled" && "border-slate-500/20 bg-slate-400/10 text-slate-300")}>
                            {status}
                          </Badge>
                        </td>
                        <td className="py-4 text-slate-300">
                          {status === "error" && job.error ? (
                            <div className="max-w-md rounded-2xl border border-rose-400/15 bg-rose-400/8 px-3 py-2 text-sm text-rose-100">{job.error}</div>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>

          {!cronQuery.isLoading && filteredJobs.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">No cron jobs match the current search.</div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
