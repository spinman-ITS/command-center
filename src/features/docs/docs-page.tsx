import { useDocsQuery } from "@/shared/hooks/use-command-center-data";
import { formatRelativeTime } from "@/shared/lib/utils";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Select } from "@/shared/components/ui/select";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useEffect, useMemo, useState } from "react";

export function DocsPage() {
  const docsQuery = useDocsQuery();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [type, setType] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const docs = docsQuery.data ?? [];

  const sortedDocs = useMemo(
    () => [...docs].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [docs],
  );

  const filteredDocs = useMemo(
    () =>
      sortedDocs.filter((doc) => {
        const matchesSearch = [doc.title, doc.content, doc.category, doc.type].join(" ").toLowerCase().includes(search.toLowerCase());
        const matchesCategory = category === "all" || doc.category === category;
        const matchesType = type === "all" || doc.type === type;
        return matchesSearch && matchesCategory && matchesType;
      }),
    [category, search, sortedDocs, type],
  );

  useEffect(() => {
    if (!selectedId && filteredDocs[0]) {
      setSelectedId(filteredDocs[0].id);
    }
    if (selectedId && !filteredDocs.some((doc) => doc.id === selectedId)) {
      setSelectedId(filteredDocs[0]?.id ?? null);
    }
  }, [filteredDocs, selectedId]);

  const selected = filteredDocs.find((doc) => doc.id === selectedId) ?? filteredDocs[0];

  if (docsQuery.isError) {
    return <ErrorState title="Docs unavailable" description="Documentation records could not be loaded." />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Docs"
        title="Searchable reference vault"
        description="Two-panel knowledge viewer with filters, recency awareness, and markdown-style rendering."
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="p-5">
          <div className="space-y-3">
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search docs" />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <Select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="all">All categories</option>
                {[...new Set(sortedDocs.map((doc) => doc.category))].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
              <Select value={type} onChange={(event) => setType(event.target.value)}>
                <option value="all">All types</option>
                {[...new Set(sortedDocs.map((doc) => doc.type))].map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {docsQuery.isLoading
              ? Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)
              : filteredDocs.map((doc) => (
                  <button key={doc.id} className="w-full text-left" onClick={() => setSelectedId(doc.id)}>
                    <div
                      className={`rounded-2xl border p-4 transition ${
                        selected?.id === doc.id ? "border-white/20 bg-white/10" : "border-white/8 bg-white/[0.03] hover:border-white/14"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium text-white">{doc.title}</p>
                        <Badge>{doc.type}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{doc.category}</p>
                      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500">{formatRelativeTime(doc.updated_at)}</p>
                    </div>
                  </button>
                ))}
          </div>
        </Card>

        <Card className="p-6">
          {!selected ? (
            <div className="flex h-full items-center justify-center text-slate-500">No documents match the current filters.</div>
          ) : (
            <div className="space-y-6">
              <div className="border-b border-white/8 pb-5">
                <div className="flex items-center gap-3">
                  <Badge>{selected.category}</Badge>
                  <Badge>{selected.type}</Badge>
                </div>
                <h2 className="mt-4 text-3xl font-semibold text-white">{selected.title}</h2>
                <p className="mt-2 text-sm text-slate-400">Updated {formatRelativeTime(selected.updated_at)}</p>
              </div>
              <article className="prose prose-invert max-w-none whitespace-pre-wrap text-slate-200">
                {selected.content}
              </article>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
