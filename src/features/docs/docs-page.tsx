import { useContentDeliverables } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { cn, formatAbsoluteDate, formatRelativeTime } from "@/shared/lib/utils";
import type { ContentDeliverableRecord } from "@/shared/types/models";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CONTENT_TYPE_OPTIONS = ["all", "blog", "social", "newsletter", "email", "image"] as const;
const STATUS_OPTIONS = ["all", "draft", "review", "published", "archived"] as const;
const AGENT_PRIORITY = ["sage", "pixel", "lucy"] as const;
const DEFAULT_CAMPAIGN = "Unassigned";

const CONTENT_TYPE_BADGE_STYLES: Record<string, string> = {
  blog: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  social: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  newsletter: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  email: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  image: "border-pink-400/30 bg-pink-400/10 text-pink-200",
  campaign: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
};

interface CampaignGroup {
  name: string;
  items: ContentDeliverableRecord[];
}

function getContentTypeBadgeClass(type: string) {
  return CONTENT_TYPE_BADGE_STYLES[type] ?? "border-white/15 bg-white/8 text-slate-200";
}

function formatOptionLabel(option: string, allLabel: string) {
  if (option === "all") return allLabel;
  return option.charAt(0).toUpperCase() + option.slice(1);
}

function getAgentOptions(items: ContentDeliverableRecord[]) {
  const dynamicAgents = [...new Set(items.map((item) => item.agent_id).filter(Boolean))].sort((a, b) => {
    const aPriority = AGENT_PRIORITY.indexOf(a as (typeof AGENT_PRIORITY)[number]);
    const bPriority = AGENT_PRIORITY.indexOf(b as (typeof AGENT_PRIORITY)[number]);

    if (aPriority !== -1 || bPriority !== -1) {
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    }

    return a.localeCompare(b);
  });

  return ["all", ...dynamicAgents];
}

function getCampaignGroups(items: ContentDeliverableRecord[]) {
  const groups = new Map<string, ContentDeliverableRecord[]>();

  for (const item of items) {
    const campaignName = item.campaign_title?.trim() || DEFAULT_CAMPAIGN;
    const existing = groups.get(campaignName) ?? [];
    existing.push(item);
    groups.set(campaignName, existing);
  }

  return [...groups.entries()]
    .map(([name, deliverables]) => ({
      name,
      items: [...deliverables].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    }))
    .sort((a, b) => {
      if (a.name === DEFAULT_CAMPAIGN) return 1;
      if (b.name === DEFAULT_CAMPAIGN) return -1;
      return a.name.localeCompare(b.name);
    });
}

function DeliverableListItem({
  item,
  isSelected,
  onSelect,
}: {
  item: ContentDeliverableRecord;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className="w-full text-left" onClick={onSelect}>
      <div
        className={cn(
          "rounded-2xl border p-4 transition",
          isSelected ? "border-white/20 bg-white/10" : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{item.title}</p>
            {item.campaign_title ? <p className="mt-1 truncate text-xs text-slate-400">{item.campaign_title}</p> : null}
          </div>
          <Badge className={cn("shrink-0 border", getContentTypeBadgeClass(item.content_type))}>{item.content_type}</Badge>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge className="border-white/10 bg-white/6 text-slate-200">{item.agent_id}</Badge>
          <Badge className="border-white/10 bg-white/6 capitalize text-slate-300">{item.status}</Badge>
        </div>

        <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(item.updated_at)}</p>
      </div>
    </button>
  );
}

function DeliverableViewer({ item }: { item: ContentDeliverableRecord | undefined }) {
  if (!item) {
    return <div className="flex h-full min-h-[420px] items-center justify-center text-slate-500">No content matches the current filters.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-white/8 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border", getContentTypeBadgeClass(item.content_type))}>{item.content_type}</Badge>
          <Badge className="border-white/10 bg-white/6 text-slate-200">{item.agent_id}</Badge>
          <Badge className="border-white/10 bg-white/6 capitalize text-slate-300">{item.status}</Badge>
          {item.campaign_title ? <Badge className="border-white/10 bg-white/6 text-slate-300">{item.campaign_title}</Badge> : null}
        </div>

        <h2 className="mt-4 text-3xl font-semibold text-white">{item.title}</h2>
        <p className="mt-2 text-sm text-slate-400">Updated {formatRelativeTime(item.updated_at)}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {item.content_type === "image" && item.image_url ? (
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-black/20">
              <img src={item.image_url} alt={item.title} className="h-auto w-full object-cover" />
            </div>
          ) : null}

          <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-white prose-li:text-slate-200 prose-code:text-emerald-200 prose-pre:border prose-pre:border-white/10 prose-pre:bg-slate-950/70">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content || ""}</ReactMarkdown>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-white/8 bg-white/[0.03] p-5">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Metadata</p>
          </div>

          <dl className="space-y-4 text-sm text-slate-300">
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Content type</dt>
              <dd className="mt-1 capitalize text-white">{item.content_type}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Agent</dt>
              <dd className="mt-1 text-white">{item.agent_id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Status</dt>
              <dd className="mt-1 capitalize text-white">{item.status}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Campaign</dt>
              <dd className="mt-1 text-white">{item.campaign_title || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Created</dt>
              <dd className="mt-1 text-white">{formatAbsoluteDate(item.created_at)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Updated</dt>
              <dd className="mt-1 text-white">{formatAbsoluteDate(item.updated_at)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Tags</dt>
              <dd className="mt-2 flex flex-wrap gap-2">
                {item.tags?.length ? item.tags.map((tag) => <Badge key={tag} className="border-white/10 bg-white/6 text-slate-300">{tag}</Badge>) : <span className="text-slate-500">No tags</span>}
              </dd>
            </div>
            {item.image_url ? (
              <div>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Image URL</dt>
                <dd className="mt-1 break-all text-sky-200">{item.image_url}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>
    </div>
  );
}

export function DocsPage() {
  const deliverablesQuery = useContentDeliverables();
  const [search, setSearch] = useState("");
  const [contentType, setContentType] = useState<(typeof CONTENT_TYPE_OPTIONS)[number]>("all");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [agent, setAgent] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsedCampaigns, setCollapsedCampaigns] = useState<Record<string, boolean>>({});

  const deliverables = deliverablesQuery.data ?? [];

  const sortedDeliverables = useMemo(
    () => [...deliverables].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [deliverables],
  );

  const filteredDeliverables = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return sortedDeliverables.filter((item) => {
      const matchesSearch = !normalizedSearch
        || [item.title, item.content, item.campaign_title, item.agent_id, item.content_type, ...(item.tags ?? [])]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesContentType = contentType === "all" || item.content_type === contentType;
      const matchesStatus = status === "all" || item.status === status;
      const matchesAgent = agent === "all" || item.agent_id === agent;

      return matchesSearch && matchesContentType && matchesStatus && matchesAgent;
    });
  }, [agent, contentType, search, sortedDeliverables, status]);

  const campaignGroups = useMemo(() => getCampaignGroups(filteredDeliverables), [filteredDeliverables]);
  const agentOptions = useMemo(() => getAgentOptions(sortedDeliverables), [sortedDeliverables]);

  useEffect(() => {
    if (!selectedId && filteredDeliverables[0]) {
      setSelectedId(filteredDeliverables[0].id);
      return;
    }

    if (selectedId && !filteredDeliverables.some((item) => item.id === selectedId)) {
      setSelectedId(filteredDeliverables[0]?.id ?? null);
    }
  }, [filteredDeliverables, selectedId]);

  useEffect(() => {
    setCollapsedCampaigns((current) => {
      const next = { ...current };
      for (const group of getCampaignGroups(sortedDeliverables)) {
        if (!(group.name in next)) next[group.name] = false;
      }
      return next;
    });
  }, [sortedDeliverables]);

  const selected = filteredDeliverables.find((item) => item.id === selectedId) ?? filteredDeliverables[0];

  if (deliverablesQuery.isError) {
    return <ErrorState title="Content library unavailable" description="Content deliverables could not be loaded." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Content"
        title="Content Library"
        description="Blog posts, social captions, newsletters, and emails created by the agent team."
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="p-5">
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title or content" className="pl-10" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Select value={contentType} onChange={(event) => setContentType(event.target.value as (typeof CONTENT_TYPE_OPTIONS)[number])}>
                {CONTENT_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionLabel(option, "All content types")}
                  </option>
                ))}
              </Select>

              <Select value={status} onChange={(event) => setStatus(event.target.value as (typeof STATUS_OPTIONS)[number])}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {formatOptionLabel(option, "All statuses")}
                  </option>
                ))}
              </Select>

              <Select value={agent} onChange={(event) => setAgent(event.target.value)}>
                {agentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "all" ? "All agents" : option}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            {deliverablesQuery.isLoading
              ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)
              : campaignGroups.map((group: CampaignGroup) => {
                const isCollapsed = collapsedCampaigns[group.name] ?? false;

                return (
                  <div key={group.name} className="rounded-2xl border border-white/8 bg-white/[0.02]">
                    <button
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                      onClick={() => setCollapsedCampaigns((current) => ({ ...current, [group.name]: !isCollapsed }))}
                    >
                      <div>
                        <p className="text-sm font-medium text-white">{group.name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{group.items.length} item{group.items.length === 1 ? "" : "s"}</p>
                      </div>
                      {isCollapsed ? <ChevronRight className="size-4 text-slate-400" /> : <ChevronDown className="size-4 text-slate-400" />}
                    </button>

                    {!isCollapsed ? (
                      <div className="space-y-3 border-t border-white/8 px-3 py-3">
                        {group.items.map((item) => (
                          <DeliverableListItem
                            key={item.id}
                            item={item}
                            isSelected={selected?.id === item.id}
                            onSelect={() => setSelectedId(item.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}

            {!deliverablesQuery.isLoading && campaignGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">
                No deliverables match the current filters.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <DeliverableViewer item={selected} />
        </Card>
      </div>
    </div>
  );
}
