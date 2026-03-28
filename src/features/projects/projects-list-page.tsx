import { useProjectsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatPercent, formatRelativeTime } from "@/shared/lib/utils";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

export function ProjectsListPage() {
  const projectsQuery = useProjectsQuery();
  const tasksQuery = useTasksQuery();

  if (projectsQuery.isError || tasksQuery.isError) {
    return <ErrorState title="Projects unavailable" description="Project or task data could not be loaded." />;
  }

  const projects = projectsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const groupedProjects = projects.reduce<Record<string, typeof projects>>((acc, project) => {
    const sourceProjects = acc[project.source] ?? [];
    sourceProjects.push(project);
    acc[project.source] = sourceProjects;
    return acc;
  }, {});

  const grouped = Object.entries(groupedProjects);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Projects"
        title="Workstreams by source"
        description="Track project health and delivery progress grouped by task origin."
      />

      {projectsQuery.isLoading || tasksQuery.isLoading ? (
        <div className="grid gap-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-44 rounded-3xl" />)}</div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([source, sourceProjects]) => (
            <section key={source} className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">{source}</p>
                  <h2 className="mt-1 text-xl font-semibold text-white">{sourceProjects.length} active programs</h2>
                </div>
                <Badge>{sourceProjects.reduce((sum, project) => sum + tasks.filter((task) => task.project_name === project.name).length, 0)} tasks</Badge>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                {sourceProjects.map((project) => {
                  const projectTasks = tasks.filter((task) => task.project_name === project.name);
                  const progress = projectTasks.length
                    ? projectTasks.reduce((sum, task) => sum + task.progress, 0) / projectTasks.length
                    : 0;
                  const completed = projectTasks.filter((task) => task.status === "completed").length;

                  return (
                    <Link key={project.id} to={`/projects/${encodeURIComponent(project.name)}`}>
                      <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:border-white/16">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                              <Badge
                                tone={
                                  project.health === "healthy"
                                    ? "success"
                                    : project.health === "watch"
                                      ? "warning"
                                      : "danger"
                                }
                              >
                                {project.health}
                              </Badge>
                            </div>
                            <p className="mt-2 text-sm text-slate-400">{project.summary}</p>
                          </div>
                          <ChevronRight className="size-4 text-slate-500" />
                        </div>
                        <div className="mt-6 space-y-3">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-400">Progress</span>
                            <span className="font-medium text-white">{formatPercent(progress)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-white/8">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-sky-300" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
                          <Info label="Tasks" value={String(projectTasks.length)} />
                          <Info label="Done" value={String(completed)} />
                          <Info label="Updated" value={formatRelativeTime(project.updated_at)} />
                        </div>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-3">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 font-medium text-white">{value}</p>
    </div>
  );
}
