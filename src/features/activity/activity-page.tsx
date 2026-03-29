import { useActivityQuery, useAgentsQuery } from "@/shared/hooks/use-command-center-data";
import { formatAbsoluteDate } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMemo, useState } from "react";

export function ActivityPage() {
  const agentsQuery = useAgentsQuery();
  const activityQuery = useActivityQuery(50);
  const [agentId, setAgentId] = useState("all");
  const agents = agentsQuery.data ?? [];
  const activity = activityQuery.data;
  const filteredActivity = useMemo(() => (activity ?? []).filter((item) => agentId === "all" || item.agent_id === agentId), [activity, agentId]);
  if (agentsQuery.isError || activityQuery.isError) return <ErrorState title="Activity unavailable" description="Timeline data could not be loaded." />;
  return <div className="space-y-6"><SectionHeader eyebrow="Activity" title="Realtime event timeline" description="Last 50 agent_activity rows, filterable by agent." action={<Select value={agentId} onChange={(event) => setAgentId(event.target.value)} className="sm:w-52"><option value="all">All agents</option>{agents.map((agent) => <option key={agent.id} value={agent.agent_id}>{agent.name}</option>)}</Select>} /><Card className="p-6"><div className="space-y-4">{activityQuery.isLoading ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />) : filteredActivity.map((item) => { const agent = agents.find((candidate) => candidate.agent_id === item.agent_id); return <div key={item.id} className="grid gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 md:grid-cols-[210px_1fr] md:items-start"><div><p className="text-xs uppercase tracking-[0.22em] text-slate-500">{formatAbsoluteDate(item.created_at)}</p><p className="mt-2 text-sm" style={{ color: agent?.color ?? "#cbd5e1" }}>{agent ? `${agent.emoji} ${agent.name}` : item.agent_id}</p></div><div><p className="font-medium text-white">{item.action}</p><p className="mt-2 text-sm text-slate-400">{item.details || "No additional details."}</p></div></div>; })}{!activityQuery.isLoading && filteredActivity.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">No events match the selected filters.</p>}</div></Card></div>;
}
