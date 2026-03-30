import { useDocsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatAbsoluteDate, formatRelativeTime, truncateText } from "@/shared/lib/utils";
import type { DocumentRecord } from "@/shared/types/models";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, useState } from "react";

function isMemoryDocument(doc: DocumentRecord) {
  const haystack = [doc.title, doc.category, doc.doc_type, doc.file_path, ...(doc.tags ?? [])].join(" ").toLowerCase();
  return haystack.includes("memory") || /^memory\/\d{4}-\d{2}-\d{2}\.md$/i.test(doc.file_path);
}

function isDailyMemoryDocument(doc: DocumentRecord) {
  return /^memory\/\d{4}-\d{2}-\d{2}\.md$/i.test(doc.file_path);
}

function getMemoryDateLabel(doc: DocumentRecord) {
  const fromPath = doc.file_path.match(/memory\/(\d{4}-\d{2}-\d{2})\.md/i)?.[1];
  if (!fromPath) return formatAbsoluteDate(doc.updated_at);

  const parsed = new Date(`${fromPath}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return fromPath;

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parsed);
}

export function MemoryPage() {
  const docsQuery = useDocsQuery();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<"all" | "documents" | "daily">("all");

  const docs = docsQuery.data ?? [];
  const memoryDocs = useMemo(
    () => docs.filter(isMemoryDocument).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [docs],
  );
  const longTermMemory = useMemo(
    () => memoryDocs.find((doc) => doc.file_path.includes("MEMORY.md") || doc.title.toLowerCase().includes("long-term memory")),
    [memoryDocs],
  );
  const dailyMemory = useMemo(() => memoryDocs.filter(isDailyMemoryDocument), [memoryDocs]);
  const filteredDailyMemory = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return dailyMemory.filter((doc) => {
      if (source === "documents" && !doc.file_path) return false;
      if (source === "daily" && !isDailyMemoryDocument(doc)) return false;
      if (!normalizedSearch) return true;
      return [doc.title, doc.content, doc.file_path, doc.category, ...(doc.tags ?? [])].join(" ").toLowerCase().includes(normalizedSearch);
    });
  }, [dailyMemory, search, source]);

  if (docsQuery.isError) return <ErrorState title="Memory unavailable" description="Memory documents could not be loaded." />;

  const toggle = (id: string) => {
    setOpenIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Memory"
        title="Long-term and daily memory"
        description="Daily memory entries and synced documents from the Command Center knowledge graph."
      />

      {docsQuery.isLoading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-48 rounded-3xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-white">Long-Term Memory</h2>
                  <p className="mt-2 text-sm text-slate-400">Persistent memory synced from MEMORY.md and related records.</p>
                </div>
                <Badge>{longTermMemory ? "Synced" : "Missing"}</Badge>
              </div>

              {longTermMemory ? (
                <>
                  <p className="mt-4 text-sm text-slate-400">Last updated {formatAbsoluteDate(longTermMemory.updated_at)}</p>
                  <div className="prose prose-invert mt-6 max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{longTermMemory.content}</ReactMarkdown>
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm text-slate-500">No long-term memory document has been synced into the documents table yet.</p>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-2xl font-semibold text-white">Memory Coverage</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Memory docs</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{memoryDocs.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Rows matched by memory category, file path, title, or tags.</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Daily entries</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{dailyMemory.length}</p>
                  <p className="mt-2 text-sm text-slate-400">Date-based memory files grouped from synced document records.</p>
                </div>
                <div className="rounded-3xl border border-white/8 bg-white/[0.03] p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Latest update</p>
                  <p className="mt-3 text-lg font-semibold text-white">{memoryDocs[0] ? formatRelativeTime(memoryDocs[0].updated_at) : "—"}</p>
                  <p className="mt-2 text-sm text-slate-400">Most recent memory-related document activity.</p>
                </div>
              </div>
            </Card>
          </div>

          <section className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">Daily Memory Entries</h2>
                <p className="mt-1 text-sm text-slate-400">Search, filter, and expand daily memory records by date.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:w-[420px]">
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search memory entries" />
                <Select value={source} onChange={(event) => setSource(event.target.value as "all" | "documents" | "daily")}>
                  <option value="all">All synced memory</option>
                  <option value="daily">Daily entries only</option>
                  <option value="documents">Documents table matches</option>
                </Select>
              </div>
            </div>

            {memoryDocs.length === 0 ? (
              <Card className="p-6 text-sm text-slate-400">No memory-related documents are available yet. Sync the workspace memory files into the documents table to populate this view.</Card>
            ) : filteredDailyMemory.length === 0 ? (
              <Card className="p-6 text-sm text-slate-400">No daily memory entries match the current filters.</Card>
            ) : (
              <div className="space-y-4">
                {filteredDailyMemory.map((doc) => {
                  const isOpen = openIds.includes(doc.id);
                  return (
                    <Card key={doc.id} className="p-5">
                      <button type="button" className="w-full text-left" onClick={() => toggle(doc.id)}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-lg font-semibold text-white">{getMemoryDateLabel(doc)}</p>
                              <Badge>{doc.category || "memory"}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-slate-400">{doc.title || doc.file_path.split("/").at(-1)} · Updated {formatAbsoluteDate(doc.updated_at)}</p>
                          </div>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{isOpen ? "Collapse" : "Expand"}</p>
                        </div>
                        <p className="mt-4 text-sm text-slate-300">{truncateText(doc.content, 220)}</p>
                      </button>

                      {isOpen ? (
                        <div className="prose prose-invert mt-6 max-w-none border-t border-white/8 pt-5">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
                        </div>
                      ) : null}
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
