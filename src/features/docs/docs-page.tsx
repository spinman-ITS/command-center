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
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const CONTENT_TYPE_OPTIONS = ["all", "blog", "social", "newsletter", "email", "image"] as const;
const STATUS_OPTIONS = ["all", "draft", "review", "published", "archived"] as const;
const AGENT_PRIORITY = ["sage", "pixel", "lucy"] as const;
const DEFAULT_CAMPAIGN = "Unassigned";
const DELIVERABLE_TABS = ["blog", "linkedin_personal", "linkedin_business", "facebook", "email"] as const;

type DeliverableTabKey = (typeof DELIVERABLE_TABS)[number];

interface CampaignGroup {
  name: string;
  items: ContentDeliverableRecord[];
  latestUpdatedAt: string;
}

const CONTENT_TYPE_BADGE_STYLES: Record<string, string> = {
  blog: "border-sky-400/30 bg-sky-400/10 text-sky-200",
  social: "border-violet-400/30 bg-violet-400/10 text-violet-200",
  newsletter: "border-amber-400/30 bg-amber-400/10 text-amber-200",
  email: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200",
  image: "border-pink-400/30 bg-pink-400/10 text-pink-200",
  campaign: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
};

const TAB_LABELS: Record<DeliverableTabKey, string> = {
  blog: "Blog",
  linkedin_personal: "LinkedIn Personal",
  linkedin_business: "LinkedIn Business",
  facebook: "Facebook",
  email: "Email",
};

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
    .map(([name, deliverables]) => {
      const sortedItems = [...deliverables].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

      return {
        name,
        items: sortedItems,
        latestUpdatedAt: sortedItems[0]?.updated_at ?? new Date(0).toISOString(),
      } satisfies CampaignGroup;
    })
    .sort((a, b) => {
      if (a.name === DEFAULT_CAMPAIGN) return 1;
      if (b.name === DEFAULT_CAMPAIGN) return -1;
      return new Date(b.latestUpdatedAt).getTime() - new Date(a.latestUpdatedAt).getTime();
    });
}

function getDeliverableTab(item: ContentDeliverableRecord): DeliverableTabKey | null {
  if (item.content_type === "blog") return "blog";
  if (item.content_type === "email" || item.content_type === "newsletter") return "email";

  if (item.content_type === "social") {
    const tags = item.tags ?? [];

    if (tags.includes("linkedin_personal")) return "linkedin_personal";
    if (tags.includes("linkedin_business")) return "linkedin_business";
    if (tags.includes("facebook")) return "facebook";
  }

  return null;
}

function getCampaignTabMap(items: ContentDeliverableRecord[]) {
  return items.reduce<Partial<Record<DeliverableTabKey, ContentDeliverableRecord>>>((accumulator, item) => {
    const tab = getDeliverableTab(item);
    if (!tab || accumulator[tab]) return accumulator;
    accumulator[tab] = item;
    return accumulator;
  }, {});
}

function getDefaultTab(tabMap: Partial<Record<DeliverableTabKey, ContentDeliverableRecord>>) {
  if (tabMap.blog) return "blog" satisfies DeliverableTabKey;
  return DELIVERABLE_TABS.find((tab) => tabMap[tab]) ?? null;
}

function CampaignListItem({
  campaign,
  isSelected,
  onSelect,
}: {
  campaign: CampaignGroup;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button className="w-full text-left" onClick={onSelect}>
      <div
        className={cn(
          "rounded-2xl border px-4 py-3 transition",
          isSelected
            ? "border-white/20 bg-white/10"
            : "border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{campaign.name}</p>
            <p className="mt-1 text-xs text-slate-500">Updated {formatRelativeTime(campaign.latestUpdatedAt)}</p>
          </div>

          <Badge className="shrink-0 border-white/10 bg-white/6 text-slate-300">
            {campaign.items.length} piece{campaign.items.length === 1 ? "" : "s"}
          </Badge>
        </div>
      </div>
    </button>
  );
}

function DeliverableViewer({
  campaign,
  activeTab,
  onTabChange,
}: {
  campaign: CampaignGroup | undefined;
  activeTab: DeliverableTabKey | null;
  onTabChange: (tab: DeliverableTabKey) => void;
}) {
  if (!campaign) {
    return <div className="flex h-full min-h-[420px] items-center justify-center text-slate-500">No campaigns match the current filters.</div>;
  }

  const tabMap = getCampaignTabMap(campaign.items);
  const availableTabs = DELIVERABLE_TABS.filter((tab) => tabMap[tab]);
  const selectedTab = activeTab && tabMap[activeTab] ? activeTab : getDefaultTab(tabMap);
  const item = selectedTab ? tabMap[selectedTab] : undefined;

  if (!item || !selectedTab) {
    return <div className="flex h-full min-h-[420px] items-center justify-center text-slate-500">This campaign has no deliverables for the current filters.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-white/8 pb-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border", getContentTypeBadgeClass("campaign"))}>{campaign.name}</Badge>
          <Badge className="border-white/10 bg-white/6 text-slate-300">{campaign.items.length} piece{campaign.items.length === 1 ? "" : "s"}</Badge>
        </div>

        <h2 className="mt-4 text-3xl font-semibold text-white">{campaign.name}</h2>
        <p className="mt-2 text-sm text-slate-400">Updated {formatRelativeTime(campaign.latestUpdatedAt)}</p>

        <div className="mt-6 flex flex-wrap gap-6 border-b border-white/8">
          {availableTabs.map((tab) => (
            <button
              key={tab}
              className={cn(
                "-mb-px border-b-2 pb-3 text-sm font-medium transition",
                selectedTab === tab ? "border-sky-400 text-white" : "border-transparent text-slate-500 hover:text-slate-300",
              )}
              onClick={() => onTabChange(tab)}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {item.image_url ? (
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
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Deliverable</dt>
              <dd className="mt-1 text-white">{item.title}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">Tab</dt>
              <dd className="mt-1 text-white">{TAB_LABELS[selectedTab]}</dd>
            </div>
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
                {item.tags?.length ? (
                  item.tags.map((tag) => (
                    <Badge key={tag} className="border-white/10 bg-white/6 text-slate-300">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-slate-500">No tags</span>
                )}
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
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DeliverableTabKey | null>(null);

  const deliverables = useMemo(() => deliverablesQuery.data ?? [], [deliverablesQuery.data]);

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
    if (!selectedCampaign && campaignGroups[0]) {
      setSelectedCampaign(campaignGroups[0].name);
      return;
    }

    if (selectedCampaign && !campaignGroups.some((campaign) => campaign.name === selectedCampaign)) {
      setSelectedCampaign(campaignGroups[0]?.name ?? null);
    }
  }, [campaignGroups, selectedCampaign]);

  const selected = campaignGroups.find((campaign) => campaign.name === selectedCampaign) ?? campaignGroups[0];
  const selectedTabMap = useMemo(() => getCampaignTabMap(selected?.items ?? []), [selected]);

  useEffect(() => {
    const defaultTab = getDefaultTab(selectedTabMap);

    if (!defaultTab) {
      setActiveTab(null);
      return;
    }

    if (!activeTab || !selectedTabMap[activeTab]) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, selectedTabMap, selectedCampaign]);

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
              ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-2xl" />)
              : campaignGroups.map((campaign) => (
                  <CampaignListItem
                    key={campaign.name}
                    campaign={campaign}
                    isSelected={selected?.name === campaign.name}
                    onSelect={() => {
                      setSelectedCampaign(campaign.name);
                      setActiveTab(getDefaultTab(getCampaignTabMap(campaign.items)));
                    }}
                  />
                ))}

            {!deliverablesQuery.isLoading && campaignGroups.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-slate-500">
                No deliverables match the current filters.
              </div>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <DeliverableViewer campaign={selected} activeTab={activeTab} onTabChange={setActiveTab} />
        </Card>
      </div>
    </div>
  );
}
