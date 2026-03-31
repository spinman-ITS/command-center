import { useDocsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatAbsoluteDate, formatRelativeTime, truncateText } from "@/shared/lib/utils";
import type { DocumentRecord } from "@/shared/types/models";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useEffect, useMemo, useState } from "react";

type MemorySource = "all" | "daily" | "meetings" | "maintenance" | "reports";
type MemoryKind = "long-term" | "daily" | "maintenance" | "meeting" | "report";

const DAILY_PATH_REGEX = /^memory\/(\d{4}-\d{2}-\d{2})\.md$/i;
const MAINTENANCE_PATH_REGEX = /^memory\/maintenance\/(\d{4}-\d{2}-\d{2})\.md$/i;
const MEETING_PATH_REGEX = /^memory\/meetings\/(.+)\.md$/i;

function isMemoryDocument(doc: DocumentRecord) {
  const filePath = doc.file_path.trim();
  const haystack = [doc.title, doc.category, doc.doc_type, filePath, ...(doc.tags ?? [])].join(" ").toLowerCase();
  return filePath === "MEMORY.md" || filePath.toLowerCase().startsWith("memory/") || haystack.includes("memory");
}

function getMemoryKind(doc: DocumentRecord): MemoryKind {
  if (doc.file_path === "MEMORY.md") return "long-term";
  if (DAILY_PATH_REGEX.test(doc.file_path)) return "daily";
  if (MAINTENANCE_PATH_REGEX.test(doc.file_path)) return "maintenance";
  if (MEETING_PATH_REGEX.test(doc.file_path)) return "meeting";
  return "report";
}

function getDateFromPath(doc: DocumentRecord) {
  const dateMatch =
    doc.file_path.match(DAILY_PATH_REGEX)?.[1] ??
    doc.file_path.match(MAINTENANCE_PATH_REGEX)?.[1] ??
    doc.file_path.match(/(\d{4}-\d{2}-\d{2})/i)?.[1];

  if (!dateMatch) return null;

  const parsed = new Date(`${dateMatch}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed;
}

function formatReadableDate(date: Date | null, fallback: string) {
  if (!date) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getEntryLabel(doc: DocumentRecord) {
  const pathDate = getDateFromPath(doc);
  if (pathDate) return formatReadableDate(pathDate, doc.title || doc.file_path);
  return doc.title || doc.file_path.split("/").at(-1) || "Untitled memory";
}

function getMeetingTitle(doc: DocumentRecord) {
  if (doc.title?.trim()) return doc.title;

  const rawName = doc.file_path.match(MEETING_PATH_REGEX)?.[1] ?? doc.file_path.split("/").at(-1)?.replace(/\.md$/i, "") ?? "Meeting note";
  return rawName
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function matchesSearch(doc: DocumentRecord, search: string) {
  if (!search.trim()) return true;
  const haystack = [doc.title, doc.content, doc.category, doc.doc_type, doc.file_path, ...(doc.tags ?? [])].join(" ").toLowerCase();
  return haystack.includes(search.trim().toLowerCase());
}

function matchesSource(doc: DocumentRecord, source: MemorySource) {
  if (source === "all") return true;
  const kind = getMemoryKind(doc);
  if (source === "daily") return kind === "daily";
  if (source === "meetings") return kind === "meeting";
  if (source === "maintenance") return kind === "maintenance";
  return kind === "report";
}

function getCategoryTone(kind: MemoryKind): "default" | "success" | "warning" {
  if (kind === "daily") return "success";
  if (kind === "maintenance") return "warning";
  return "default";
}

function getKindLabel(kind: MemoryKind) {
  if (kind === "long-term") return "Long-Term";
  if (kind === "daily") return "Daily";
  if (kind === "maintenance") return "Maintenance";
  if (kind === "meeting") return "Meeting";
  return "Report";
}

function getLocalDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderMarkdown(content: string) {
  return (
    <div className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-slate-200 prose-strong:text-white prose-li:text-slate-200 prose-code:text-emerald-200">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

export function MemoryPage() {
  const docsQuery = useDocsQuery();
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<MemorySource>("all");
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [didSeedOpenState, setDidSeedOpenState] = useState(false);

  const docs = docsQuery.data ?? [];
  const todayKey = getLocalDateKey();

  const memoryDocs = useMemo(
    () => docs.filter(isMemoryDocument).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [docs],
  );

  const longTermMemory = useMemo(() => memoryDocs.find((doc) => doc.file_path === "MEMORY.md"), [memoryDocs]);
  const dailyEntries = useMemo(() => memoryDocs.filter((doc) => getMemoryKind(doc) === "daily"), [memoryDocs]);
  const maintenanceEntries = useMemo(() => memoryDocs.filter((doc) => getMemoryKind(doc) === "maintenance"), [memoryDocs]);
  const meetingEntries = useMemo(() => memoryDocs.filter((doc) => getMemoryKind(doc) === "meeting"), [memoryDocs]);
  const specialReports = useMemo(() => memoryDocs.filter((doc) => getMemoryKind(doc) === "report"), [memoryDocs]);

  const todayDaily = useMemo(() => dailyEntries.find((doc) => doc.file_path.includes(`/${todayKey}.md`)), [dailyEntries, todayKey]);
  const todayMaintenance = useMemo(
    () => maintenanceEntries.find((doc) => doc.file_path.includes(`/${todayKey}.md`)),
    [maintenanceEntries, todayKey],
  );

  useEffect(() => {
    if (didSeedOpenState) return;

    const initialOpenIds = [todayDaily?.id, todayMaintenance?.id].filter(Boolean) as string[];
    if (initialOpenIds.length > 0) {
      setOpenIds(initialOpenIds);
    }
    setDidSeedOpenState(true);
  }, [didSeedOpenState, todayDaily?.id, todayMaintenance?.id]);

  const filteredDocs = useMemo(
    () => memoryDocs.filter((doc) => matchesSearch(doc, search) && matchesSource(doc, source)),
    [memoryDocs, search, source],
  );

  const filteredLookup = useMemo(() => new Set(filteredDocs.map((doc) => doc.id)), [filteredDocs]);

  const filteredLongTermMemory = longTermMemory && filteredLookup.has(longTermMemory.id) ? longTermMemory : null;
  const filteredTodayDaily = todayDaily && filteredLookup.has(todayDaily.id) ? todayDaily : null;
  const filteredTodayMaintenance = todayMaintenance && filteredLookup.has(todayMaintenance.id) ? todayMaintenance : null;

  const recentDailyEntries = useMemo(
    () => dailyEntries.filter((doc) => doc.id !== todayDaily?.id && filteredLookup.has(doc.id)).slice(0, 7),
    [dailyEntries, filteredLookup, todayDaily?.id],
  );

  const filteredMeetings = useMemo(() => meetingEntries.filter((doc) => filteredLookup.has(doc.id)), [meetingEntries, filteredLookup]);
  const filteredSpecialReports = useMemo(() => specialReports.filter((doc) => filteredLookup.has(doc.id)), [specialReports, filteredLookup]);

  const lastUpdated = memoryDocs[0]?.updated_at;

  if (docsQuery.isError) return <ErrorState title="Memory unavailable" description="Memory documents could not be loaded." />;

  const toggle = (id: string) => {
    setOpenIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  const renderCollapsibleCard = (doc: DocumentRecord, options?: { title?: string; previewLength?: number; badgeLabel?: string; meta?: string }) => {
    const isOpen = openIds.includes(doc.id);
    const kind = getMemoryKind(doc);

    return (
      <Card key={doc.id} className="overflow-hidden p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{options?.title ?? doc.title ?? doc.file_path.split("/").at(-1)}</h3>
              <Badge tone={getCategoryTone(kind)}>{options?.badgeLabel ?? getKindLabel(kind)}</Badge>
              {doc.category ? <Badge>{doc.category}</Badge> : null}
            </div>
            <p className="text-sm text-slate-400">{options?.meta ?? `Updated ${formatAbsoluteDate(doc.updated_at)}`}</p>
          </div>
          <Button variant="ghost" onClick={() => toggle(doc.id)}>
            {isOpen ? "Collapse" : "Expand"}
          </Button>
        </div>

        <div className="mt-4 border-t border-white/8 pt-4">
          {!isOpen ? <p className="text-sm leading-6 text-slate-300">{truncateText(doc.content, options?.previewLength ?? 200)}</p> : renderMarkdown(doc.content)}
        </div>
      </Card>
    );
  };

  const showEmptyState = !docsQuery.isLoading && filteredDocs.length === 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Memory"
        title="Atlas memory dashboard"
        description="Long-term context, daily notes, meetings, and reports organized for quick scanning."
      />

      {docsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-32 rounded-2xl" />
            ))}
          </div>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Total Memory Files</p>
              <p className="mt-3 text-4xl font-semibold text-white">{memoryDocs.length}</p>
              <p className="mt-2 text-sm text-slate-400">All synced memory documents across long-term, daily, meetings, and reports.</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Daily Entries</p>
              <p className="mt-3 text-4xl font-semibold text-white">{dailyEntries.length}</p>
              <p className="mt-2 text-sm text-slate-400">Date-based memory journals captured from the workspace.</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Last Updated</p>
              <p className="mt-3 text-4xl font-semibold text-white">{lastUpdated ? formatRelativeTime(lastUpdated) : "—"}</p>
              <p className="mt-2 text-sm text-slate-400">Most recent memory activity from the synced document set.</p>
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Search & Filter</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Scan memory by source</h2>
                <p className="mt-1 text-sm text-slate-400">Search across content, titles, file paths, categories, and tags.</p>
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:w-[460px]">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memory…" />
                <Select value={source} onChange={(event) => setSource(event.target.value as MemorySource)}>
                  <option value="all">All</option>
                  <option value="daily">Daily</option>
                  <option value="meetings">Meetings</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="reports">Reports</option>
                </Select>
              </div>
            </div>
          </Card>

          {showEmptyState ? (
            <Card className="p-6 text-sm text-slate-400">No memory documents match the current search and source filters.</Card>
          ) : (
            <div className="space-y-8">
              <section className="space-y-4">
                <SectionHeader
                  eyebrow="Section 1"
                  title="Atlas Long-Term Memory"
                  description="Curated persistent memory from MEMORY.md."
                />
                <Card className="p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-2xl font-semibold text-white">Long-Term Memory</h2>
                        <Badge tone={filteredLongTermMemory ? "success" : "danger"}>{filteredLongTermMemory ? "Synced" : "Missing"}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">
                        {filteredLongTermMemory ? `Last updated ${formatAbsoluteDate(filteredLongTermMemory.updated_at)}` : "No MEMORY.md document is currently available in the synced records."}
                      </p>
                    </div>
                    {filteredLongTermMemory ? (
                      <Button variant="ghost" onClick={() => toggle(filteredLongTermMemory.id)}>
                        {openIds.includes(filteredLongTermMemory.id) ? "Collapse" : "Expand"}
                      </Button>
                    ) : null}
                  </div>

                  {filteredLongTermMemory ? (
                    <div className="mt-5 border-t border-white/8 pt-5">
                      {openIds.includes(filteredLongTermMemory.id) ? renderMarkdown(filteredLongTermMemory.content) : <p className="text-sm leading-6 text-slate-300">{truncateText(filteredLongTermMemory.content, 300)}</p>}
                    </div>
                  ) : (
                    <p className="mt-5 text-sm text-slate-500">Try clearing filters if MEMORY.md exists but is currently hidden.</p>
                  )}
                </Card>
              </section>

              <section className="space-y-4">
                <SectionHeader
                  eyebrow="Section 2"
                  title="Today’s Activity"
                  description="Today’s journal and maintenance notes surfaced first for quick review."
                />
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredTodayDaily ? (
                    renderCollapsibleCard(filteredTodayDaily, {
                      title: "Today’s Daily Memory",
                      previewLength: 240,
                      badgeLabel: "Daily",
                      meta: `${getEntryLabel(filteredTodayDaily)} · Updated ${formatAbsoluteDate(filteredTodayDaily.updated_at)}`,
                    })
                  ) : (
                    <Card className="p-5 text-sm text-slate-400">No daily memory entry for today matches the current filters.</Card>
                  )}

                  {filteredTodayMaintenance ? (
                    renderCollapsibleCard(filteredTodayMaintenance, {
                      title: "Today’s Maintenance Report",
                      previewLength: 240,
                      badgeLabel: "Maintenance",
                      meta: `${getEntryLabel(filteredTodayMaintenance)} · Updated ${formatAbsoluteDate(filteredTodayMaintenance.updated_at)}`,
                    })
                  ) : (
                    <Card className="p-5 text-sm text-slate-400">No maintenance report for today matches the current filters.</Card>
                  )}
                </div>
              </section>

              <section className="space-y-4">
                <SectionHeader
                  eyebrow="Section 3"
                  title="Recent Daily Entries"
                  description="The last seven daily notes, excluding today, with quick previews and full markdown on demand."
                />
                {recentDailyEntries.length === 0 ? (
                  <Card className="p-5 text-sm text-slate-400">No recent daily entries match the current filters.</Card>
                ) : (
                  <div className="space-y-4">
                    {recentDailyEntries.map((doc) =>
                      renderCollapsibleCard(doc, {
                        title: getEntryLabel(doc),
                        previewLength: 200,
                        meta: `${doc.title || "Daily memory"} · Updated ${formatAbsoluteDate(doc.updated_at)}`,
                      }),
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <SectionHeader
                  eyebrow="Section 4"
                  title="Meeting Notes"
                  description="Fathom meeting summaries grouped separately for faster recall."
                />
                {filteredMeetings.length === 0 ? (
                  <Card className="p-5 text-sm text-slate-400">No meeting notes match the current filters.</Card>
                ) : (
                  <div className="space-y-4">
                    {filteredMeetings.map((doc) =>
                      renderCollapsibleCard(doc, {
                        title: getMeetingTitle(doc),
                        previewLength: 220,
                        meta: `${formatReadableDate(getDateFromPath(doc), "Meeting note")} · Updated ${formatAbsoluteDate(doc.updated_at)}`,
                      }),
                    )}
                  </div>
                )}
              </section>

              <section className="space-y-4">
                <SectionHeader
                  eyebrow="Section 5"
                  title="Special Reports"
                  description="Topic reviews and other non-daily memory artifacts that deserve their own lane."
                />
                {filteredSpecialReports.length === 0 ? (
                  <Card className="p-5 text-sm text-slate-400">No special reports match the current filters.</Card>
                ) : (
                  <div className="space-y-4">
                    {filteredSpecialReports.map((doc) =>
                      renderCollapsibleCard(doc, {
                        title: doc.title || getMeetingTitle(doc),
                        previewLength: 220,
                        meta: `${doc.file_path} · Updated ${formatAbsoluteDate(doc.updated_at)}`,
                      }),
                    )}
                  </div>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
