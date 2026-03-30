import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useActivityQuery, useAgentsQuery, useCronJobsQuery, useTasksQuery } from "@/shared/hooks/use-command-center-data";
import { cn, formatRelativeTime } from "@/shared/lib/utils";
import type { ActivityItem, Agent, CronJob } from "@/shared/types/models";
import { Check, Clock3, GitBranch, Sparkles, UserRound } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

const departments = [
  { name: "Engineering", icon: "⚙️", agents: ["luka", "dash"] },
  { name: "Operations", icon: "⚡", agents: ["jett", "max", "scout"] },
  { name: "Content & Research", icon: "🧠", agents: ["lucy", "sage", "pixel"] },
] as const;

const agentCapabilities: Record<string, string[]> = {
  atlas: ["Agent coordination & management", "Morning & EOD briefs", "Integration management", "Sprint planning", "Task orchestration"],
  jett: ["Operations dispatch", "Queue triage", "Cross-agent handoffs", "Command routing", "Runbook execution"],
  luka: ["MSP Pub development", "Frontend implementation", "Supabase integration", "UI systems", "Feature shipping"],
  dash: ["Command Center dashboard", "Real-time Supabase subscriptions", "Charts & data visualization", "Dark mode UI design", "Frontend polish"],
  scout: ["QA coverage", "Regression testing", "Release verification", "Bug reproduction", "Acceptance validation"],
  max: ["L3 technical support", "Escalation handling", "Incident triage", "System troubleshooting", "Support intelligence"],
  lucy: ["Research briefs", "Trend analysis", "Competitive intelligence", "AI tooling research", "Strategic synthesis"],
  sage: ["Content strategy", "Messaging frameworks", "Campaign copy", "Editorial planning", "SEO content"],
  pixel: ["Image design", "Visual concepts", "Marketing creative", "Brand aesthetics", "Graphic production"],
};

const founder = {
  name: "Sean Inman",
  company: "Inman Technologies",
  title: "Founder & CEO",
};

const atlasFallback: Agent = {
  id: "atlas-fallback",
  agent_id: "atlas",
  name: "Atlas",
  role: "Chief of Staff",
  model: "Claude Opus 4",
  color: "#16a34a",
  emoji: "🏛️",
  workspace: "",
  status: "ACTIVE",
  created_at: "",
  updated_at: "",
};

export function TeamPage() {
  const agentsQuery = useAgentsQuery();
  const activityQuery = useActivityQuery(50);
  const tasksQuery = useTasksQuery();
  const cronJobsQuery = useCronJobsQuery();

  if (agentsQuery.isError || activityQuery.isError || tasksQuery.isError || cronJobsQuery.isError) {
    return <ErrorState title="Team unavailable" description="Agent, activity, task, or cron data could not be loaded." />;
  }

  const isLoading = agentsQuery.isLoading || activityQuery.isLoading || tasksQuery.isLoading || cronJobsQuery.isLoading;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SectionHeader eyebrow="Team" title="Agent org chart" description="Leadership, departments, live status, and capabilities across the Atlas team." />
        <div className="space-y-6">
          <Skeleton className="mx-auto h-52 max-w-md rounded-[28px]" />
          <Skeleton className="mx-auto h-60 max-w-lg rounded-[28px]" />
          <div className="grid gap-5 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-[620px] rounded-[28px]" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const agents = agentsQuery.data ?? [];
  const activity = activityQuery.data ?? [];
  const cronJobs = cronJobsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];

  const latestByAgent = getLatestActivityMap(activity);
  const atlas = agents.find((agent) => agent.agent_id.toLowerCase() === "atlas") ?? atlasFallback;

  const departmentModels = departments.map((department) => ({
    ...department,
    members: department.agents
      .map((agentId) => agents.find((agent) => agent.agent_id.toLowerCase() === agentId))
      .filter((agent): agent is Agent => Boolean(agent))
      .map((agent) => ({
        agent,
        latestActivity: latestByAgent.get(agent.agent_id.toLowerCase()),
        taskCount: tasks.filter((task) => task.assigned_to.toLowerCase() === agent.agent_id.toLowerCase()).length,
        cronCount: getCronCountForAgent(agent, cronJobs),
        capabilities: agentCapabilities[agent.agent_id.toLowerCase()] ?? [],
      })),
  }));

  const atlasDetails = {
    agent: atlas,
    latestActivity: latestByAgent.get("atlas"),
    taskCount: tasks.filter((task) => task.assigned_to.toLowerCase() === "atlas").length,
    cronCount: getCronCountForAgent(atlas, cronJobs),
    capabilities: agentCapabilities.atlas ?? [],
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Team"
        title="Agent org chart"
        description="Founder, Chief of Staff, and department specialists with live activity, automation coverage, and role capabilities."
      />

      <div className="rounded-[32px] border border-white/8 bg-zinc-950/70 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.45)] sm:p-6 xl:p-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center">
          <div className="w-full max-w-md">
            <ExecutiveCard />
          </div>

          <ConnectorLine heightClass="h-12" />

          <div className="w-full max-w-lg">
            <ChiefOfStaffCard {...atlasDetails} />
          </div>

          <div className="hidden w-full xl:block">
            <div className="relative mx-auto mt-6 h-24 max-w-6xl">
              <div className="absolute left-1/2 top-0 h-10 w-px -translate-x-1/2 border-l border-dashed border-indigo-400/60" />
              <div className="absolute left-1/2 top-10 size-3 -translate-x-1/2 rounded-full bg-indigo-400/80 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
              <div className="absolute left-[16.666%] right-[16.666%] top-10 border-t border-dashed border-indigo-400/60" />
              <div className="absolute left-[16.666%] top-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/80" />
              <div className="absolute left-1/2 top-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/80" />
              <div className="absolute left-[83.333%] top-10 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-400/80" />
              <div className="absolute left-[16.666%] top-10 h-14 w-px -translate-x-1/2 border-l border-dashed border-indigo-400/60" />
              <div className="absolute left-1/2 top-10 h-14 w-px -translate-x-1/2 border-l border-dashed border-indigo-400/60" />
              <div className="absolute left-[83.333%] top-10 h-14 w-px -translate-x-1/2 border-l border-dashed border-indigo-400/60" />
            </div>
          </div>

          <div className="mt-6 grid w-full gap-5 xl:grid-cols-3 xl:gap-6">
            {departmentModels.map((department) => (
              <DepartmentCard key={department.name} department={department} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutiveCard() {
  return (
    <Card className="relative overflow-hidden rounded-[28px] border-amber-300/20 bg-[linear-gradient(180deg,rgba(39,28,10,0.92),rgba(11,10,14,0.98))] p-6 shadow-[0_0_0_1px_rgba(251,191,36,0.08),0_18px_80px_rgba(0,0,0,0.4)]">
      <Glow color="rgba(251,191,36,0.22)" />
      <RoleLabel>{founder.title}</RoleLabel>
      <div className="mt-5 flex items-start gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center rounded-[20px] border border-amber-300/20 bg-amber-300/10 text-3xl text-amber-100">
          <UserRound className="size-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-white">{founder.name}</h2>
          <p className="text-sm text-zinc-300">{founder.company}</p>
          <StatusPill status="ACTIVE" />
        </div>
      </div>
    </Card>
  );
}

function ChiefOfStaffCard({ agent, latestActivity, cronCount, taskCount, capabilities }: AgentSnapshot) {
  return (
    <Card className="relative overflow-hidden rounded-[28px] border-white/10 p-6 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_30px_100px_rgba(0,0,0,0.48)]" style={agentCardStyle(agent.color)}>
      <Glow color={toRgba(agent.color, 0.2)} />
      <RoleLabel>Chief of Staff</RoleLabel>
      <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <EmojiAvatar emoji={agent.emoji || "🏛️"} color={agent.color} />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold text-white">{agent.name || "Atlas"}</h2>
              <StatusPill status={agent.status} />
            </div>
            <p className="text-sm text-zinc-300">Chief of Staff</p>
            <p className="font-mono text-sm text-zinc-400">{agent.model || "Claude Opus 4"}</p>
            <LastSeen value={latestActivity?.created_at} />
          </div>
        </div>
        <StatsColumn cronCount={cronCount} taskCount={taskCount} />
      </div>
      <CapabilitiesList capabilities={capabilities} className="mt-5" />
    </Card>
  );
}

type DepartmentModel = {
  name: string;
  icon: string;
  agents: readonly string[];
  members: AgentSnapshot[];
};

type AgentSnapshot = {
  agent: Agent;
  latestActivity?: ActivityItem;
  taskCount: number;
  cronCount: number;
  capabilities: string[];
};

function DepartmentCard({ department }: { department: DepartmentModel }) {
  const activeCount = department.members.filter((member) => isActiveStatus(member.agent.status)).length;
  const borderColor = department.members[0]?.agent.color ?? "#818cf8";

  return (
    <div className="flex flex-col xl:pt-0">
      <div className="mb-3 flex justify-center xl:hidden">
        <div className="flex h-10 items-end">
          <div className="h-full w-px border-l border-dashed border-indigo-400/60" />
        </div>
      </div>

      <Card className="relative h-full overflow-hidden rounded-[28px] p-5 sm:p-6" style={agentCardStyle(borderColor)}>
        <Glow color={toRgba(borderColor, 0.18)} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 pb-4">
          <div className="flex items-center gap-3">
            <RoleLabel>{department.name}</RoleLabel>
            <div className="text-2xl">{department.icon}</div>
          </div>
          <Badge tone="success" className="gap-2 border-emerald-400/20 bg-emerald-400/12 px-3 py-1 text-emerald-100">
            <span className="size-2 rounded-full bg-emerald-300" />
            {activeCount} active
          </Badge>
        </div>

        <div className="mt-5 space-y-4">
          {department.members.map((member) => (
            <AgentProfileCard key={member.agent.id} snapshot={member} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function AgentProfileCard({ snapshot }: { snapshot: AgentSnapshot }) {
  const { agent, latestActivity, cronCount, taskCount, capabilities } = snapshot;

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <EmojiAvatar emoji={agent.emoji || "🤖"} color={agent.color} small />
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{agent.name}</h3>
              <StatusPill status={agent.status} compact />
            </div>
            <p className="text-sm text-zinc-300">{agent.role}</p>
            <p className="font-mono text-xs text-zinc-500">{agent.model || "—"}</p>
            <LastSeen value={latestActivity?.created_at} />
          </div>
        </div>

        <StatsColumn cronCount={cronCount} taskCount={taskCount} compact />
      </div>

      <CapabilitiesList capabilities={capabilities} className="mt-4" />
    </div>
  );
}

function CapabilitiesList({ capabilities, className }: { capabilities: string[]; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-500">
        <Sparkles className="size-3.5 text-emerald-300" />
        Capabilities
      </div>
      <ul className="space-y-2">
        {capabilities.map((capability) => (
          <li key={capability} className="flex items-start gap-2 text-sm text-zinc-200">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/12 text-emerald-300">
              <Check className="size-3.5" />
            </span>
            <span>{capability}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatsColumn({ cronCount, taskCount, compact = false }: { cronCount: number; taskCount: number; compact?: boolean }) {
  return (
    <div className={cn("grid gap-2", compact ? "sm:min-w-32" : "sm:min-w-40")}>
      <StatChip icon={<Clock3 className="size-3.5" />} label={`${cronCount} cron`} value={cronCount === 1 ? "automation" : "automations"} compact={compact} />
      <StatChip icon={<GitBranch className="size-3.5" />} label={`${taskCount} task${taskCount === 1 ? "" : "s"}`} value="assigned" compact={compact} />
    </div>
  );
}

function StatChip({ icon, label, value, compact = false }: { icon: ReactNode; label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-white/8 bg-white/[0.03] text-zinc-200", compact ? "px-3 py-2" : "px-4 py-3")}>
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-zinc-500">{icon}{label}</div>
      <p className="mt-1 text-sm text-zinc-300">{value}</p>
    </div>
  );
}

function StatusPill({ status, compact = false }: { status: string; compact?: boolean }) {
  const normalized = status.toUpperCase();
  const active = isActiveStatus(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border font-medium uppercase tracking-[0.18em]",
        compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]",
        active
          ? "border-emerald-400/20 bg-emerald-400/12 text-emerald-100"
          : "border-amber-300/25 bg-amber-300/14 text-amber-100",
      )}
    >
      <span className={cn("rounded-full", compact ? "size-1.5" : "size-2", active ? "bg-emerald-300" : "bg-amber-300")} />
      {normalized}
    </span>
  );
}

function LastSeen({ value }: { value?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-400">
      <span className="text-zinc-500">○</span>
      <span>{formatRelativeTime(value)}</span>
    </div>
  );
}

function ConnectorLine({ heightClass }: { heightClass: string }) {
  return (
    <div className={cn("relative my-1 flex items-center justify-center", heightClass)}>
      <div className="h-full w-px border-l border-dashed border-indigo-400/60" />
      <div className="absolute bottom-0 size-3 rounded-full bg-indigo-400/80 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
    </div>
  );
}

function EmojiAvatar({ emoji, color, small = false }: { emoji: string; color: string; small?: boolean }) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[20px] border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        small ? "size-14 text-2xl" : "size-16 text-3xl",
      )}
      style={{ backgroundColor: toRgba(color, 0.12), color }}
    >
      <span>{emoji}</span>
    </div>
  );
}

function RoleLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-950">
      {children}
    </span>
  );
}

function Glow({ color }: { color: string }) {
  return <div aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-20 rounded-full blur-3xl" style={{ background: `linear-gradient(180deg, ${color}, transparent)` }} />;
}

function getLatestActivityMap(activity: ActivityItem[]) {
  const map = new Map<string, ActivityItem>();

  activity.forEach((item) => {
    const key = item.agent_id.toLowerCase();
    const current = map.get(key);
    if (!current) {
      map.set(key, item);
      return;
    }

    if (new Date(item.created_at).getTime() > new Date(current.created_at).getTime()) {
      map.set(key, item);
    }
  });

  return map;
}

function getCronCountForAgent(agent: Agent, cronJobs: CronJob[]) {
  const id = agent.agent_id.toLowerCase();
  const name = agent.name.toLowerCase();

  return cronJobs.filter((job) => {
    const haystack = `${job.name} ${job.schedule}`.toLowerCase();
    return haystack.includes(id) || haystack.includes(name);
  }).length;
}

function isActiveStatus(status: string) {
  return status.toLowerCase() === "active";
}

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return `rgba(129, 140, 248, ${alpha})`;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function agentCardStyle(color: string): CSSProperties {
  return {
    borderColor: toRgba(color, 0.22),
    boxShadow: `0 0 0 1px ${toRgba(color, 0.08)}, 0 24px 90px rgba(0, 0, 0, 0.42)`,
  };
}
