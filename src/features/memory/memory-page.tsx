import { useDocsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Card } from "@/shared/components/ui/card";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatAbsoluteDate, truncateText } from "@/shared/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useMemo, useState } from "react";

export function MemoryPage() {
  const docsQuery = useDocsQuery();
  const [openIds, setOpenIds] = useState<string[]>([]);
  const docs = docsQuery.data;
  const longTermMemory = (docs ?? []).find((doc) => doc.file_path.includes("MEMORY.md"));
  const dailyMemory = useMemo(
    () => (docs ?? []).filter((doc) => /^memory\/2026-03-.*\.md$/i.test(doc.file_path)).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()),
    [docs],
  );
  if (docsQuery.isError) return <ErrorState title="Memory unavailable" description="Memory documents could not be loaded." />;
  const toggle = (id: string) => setOpenIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  return <div className="space-y-6"><SectionHeader eyebrow="Memory" title="Long-term and daily memory" description="Rendered memory docs synced into the documents table." />{docsQuery.isLoading ? <div className="grid gap-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48 rounded-3xl" />)}</div> : <><Card className="p-6"><h2 className="text-2xl font-semibold text-white">Long-Term Memory</h2>{longTermMemory ? <><p className="mt-2 text-sm text-slate-400">Last updated {formatAbsoluteDate(longTermMemory.updated_at)}</p><div className="prose prose-invert mt-6 max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{longTermMemory.content}</ReactMarkdown></div></> : <p className="mt-4 text-sm text-slate-500">No MEMORY.md document has been synced yet.</p>}</Card><section className="space-y-4"><h2 className="text-2xl font-semibold text-white">Daily Memory Files</h2>{dailyMemory.length === 0 ? <Card className="p-6 text-sm text-slate-400">Daily memory files sync from the workspace. Check back after the next sync cycle.</Card> : <div className="space-y-4">{dailyMemory.map((doc) => { const isOpen = openIds.includes(doc.id); return <Card key={doc.id} className="p-5"><button className="w-full text-left" onClick={() => toggle(doc.id)}><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-semibold text-white">{doc.title || doc.file_path.split("/").at(-1)}</p><p className="mt-1 text-sm text-slate-400">{formatAbsoluteDate(doc.updated_at)}</p></div><p className="text-xs uppercase tracking-[0.2em] text-slate-500">{isOpen ? "Collapse" : "Expand"}</p></div><p className="mt-4 text-sm text-slate-300">{truncateText(doc.content, 200)}</p></button>{isOpen ? <div className="prose prose-invert mt-6 max-w-none border-t border-white/8 pt-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown></div> : null}</Card>; })}</div>}</section></>}</div>;
}
