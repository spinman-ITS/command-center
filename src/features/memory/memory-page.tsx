import { useDocsQuery } from "@/shared/hooks/use-command-center-data";
import { ErrorState } from "@/shared/components/error-state";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { SectionHeader } from "@/shared/components/ui/section-header";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { formatRelativeTime } from "@/shared/lib/utils";
import type { DocumentRecord } from "@/shared/types/models";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useCallback, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Search,
  X,
  Menu,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TreeNode {
  name: string;
  label: string;
  path: string;
  children: TreeNode[];
  doc: DocumentRecord | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers – classify docs into virtual folders                       */
/* ------------------------------------------------------------------ */

function classifyDoc(doc: DocumentRecord): { folder: string; subPath: string } {
  const fp = doc.file_path;

  // Top-level workspace files (MEMORY.md, working-context.md, mistakes.md, decisions-log.md)
  if (!fp.includes("/")) {
    return { folder: "Atlas", subPath: fp };
  }

  // Agent-shared files
  if (fp.startsWith("agent-shared/")) {
    return { folder: "Agent-Shared", subPath: fp.replace("agent-shared/", "") };
  }

  // Daily logs – memory/YYYY-MM-DD*.md
  if (/^memory\/\d{4}-\d{2}-\d{2}/.test(fp)) {
    return { folder: "Daily Logs", subPath: fp.replace("memory/", "") };
  }

  // Memory sub-folders (maintenance, meetings, etc.)
  if (fp.startsWith("memory/")) {
    const rest = fp.replace("memory/", "");
    const parts = rest.split("/");
    if (parts.length > 1) {
      return { folder: "Daily Logs", subPath: rest };
    }
    return { folder: "Daily Logs", subPath: rest };
  }

  // Projects
  if (fp.startsWith("projects/")) {
    return { folder: "Projects", subPath: fp.replace("projects/", "") };
  }

  // Docs / Research
  if (fp.startsWith("docs/")) {
    return { folder: "Research", subPath: fp.replace("docs/", "") };
  }

  // Fallback
  return { folder: "Other", subPath: fp };
}

function buildTree(docs: DocumentRecord[]): TreeNode[] {
  const rootMap = new Map<string, TreeNode>();

  const folderOrder = ["Atlas", "Agent-Shared", "Daily Logs", "Projects", "Research", "Other"];

  for (const doc of docs) {
    const { folder, subPath } = classifyDoc(doc);

    if (!rootMap.has(folder)) {
      rootMap.set(folder, {
        name: folder,
        label: folder,
        path: folder,
        children: [],
        doc: null,
      });
    }

    const rootNode = rootMap.get(folder)!;
    const parts = subPath.replace(/\.md$/i, "").split("/");

    let current = rootNode;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i] ?? "";
      const isLast = i === parts.length - 1;
      const fullPath = `${folder}/${parts.slice(0, i + 1).join("/")}`;

      if (isLast) {
        // Leaf node – doc
        current.children.push({
          name: part,
          label: prettifyName(part, doc),
          path: fullPath,
          children: [],
          doc,
        });
      } else {
        // Intermediate folder
        const existing = current.children.find((c) => c.name === part && !c.doc);
        if (existing) {
          current = existing;
        } else {
          const newFolder: TreeNode = {
            name: part,
            label: prettifyFolderName(part),
            path: fullPath,
            children: [],
            doc: null,
          };
          current.children.push(newFolder);
          current = newFolder;
        }
      }
    }
  }

  // Sort folders in preferred order
  const result: TreeNode[] = [];
  for (const key of folderOrder) {
    const node = rootMap.get(key);
    if (node) {
      sortChildren(node);
      result.push(node);
    }
  }

  return result;
}

function sortChildren(node: TreeNode) {
  // Folders first, then files. Daily logs sorted newest first.
  node.children.sort((a, b) => {
    const aIsFolder = a.children.length > 0 && !a.doc;
    const bIsFolder = b.children.length > 0 && !b.doc;
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;

    // For daily logs, sort newest first
    const aDate = a.name.match(/^\d{4}-\d{2}-\d{2}/);
    const bDate = b.name.match(/^\d{4}-\d{2}-\d{2}/);
    if (aDate && bDate) return bDate[0].localeCompare(aDate[0]);

    return a.name.localeCompare(b.name);
  });

  for (const child of node.children) {
    if (child.children.length > 0) sortChildren(child);
  }
}

function prettifyName(name: string, doc: DocumentRecord): string {
  // Use doc title if it's short enough, otherwise clean filename
  if (doc.title && doc.title.length < 60) return doc.title;
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function prettifyFolderName(name: string): string {
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function countDocs(node: TreeNode): number {
  if (node.doc) return 1;
  return node.children.reduce((sum, c) => sum + countDocs(c), 0);
}

function matchesSearch(doc: DocumentRecord, term: string): boolean {
  if (!term.trim()) return true;
  const haystack = [doc.title, doc.content, doc.category, doc.doc_type, doc.file_path, ...(doc.tags ?? [])].join(" ").toLowerCase();
  return haystack.includes(term.trim().toLowerCase());
}

function filterTree(node: TreeNode, matchIds: Set<string>): TreeNode | null {
  if (node.doc) {
    return matchIds.has(node.doc.id) ? node : null;
  }

  const filteredChildren = node.children
    .map((child) => filterTree(child, matchIds))
    .filter(Boolean) as TreeNode[];

  if (filteredChildren.length === 0) return null;

  return { ...node, children: filteredChildren };
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb                                                         */
/* ------------------------------------------------------------------ */

function getBreadcrumb(doc: DocumentRecord): string[] {
  const { folder, subPath } = classifyDoc(doc);
  const parts = subPath.replace(/\.md$/i, "").split("/");
  return [folder, ...parts];
}

/* ------------------------------------------------------------------ */
/*  Sidebar Tree Component                                             */
/* ------------------------------------------------------------------ */

function TreeItem({
  node,
  depth,
  selectedId,
  expandedPaths,
  onSelect,
  onToggleExpand,
}: {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  expandedPaths: Set<string>;
  onSelect: (doc: DocumentRecord) => void;
  onToggleExpand: (path: string) => void;
}) {
  const isFolder = !node.doc && node.children.length > 0;
  const isExpanded = expandedPaths.has(node.path);
  const isSelected = node.doc?.id === selectedId;
  const docCount = isFolder ? countDocs(node) : 0;

  if (isFolder) {
    return (
      <div>
        <button
          type="button"
          onClick={() => onToggleExpand(node.path)}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-slate-300 hover:bg-slate-800/60 hover:text-white transition-colors"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          )}
          {isExpanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-emerald-400" />
          ) : (
            <Folder className="h-4 w-4 shrink-0 text-emerald-400/70" />
          )}
          <span className="truncate font-medium">{node.label}</span>
          <span className="ml-auto shrink-0 text-xs text-slate-500">{docCount}</span>
        </button>
        {isExpanded && (
          <div>
            {node.children.map((child) => (
              <TreeItem
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                expandedPaths={expandedPaths}
                onSelect={onSelect}
                onToggleExpand={onToggleExpand}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Leaf node
  return (
    <button
      type="button"
      onClick={() => node.doc && onSelect(node.doc)}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
        isSelected
          ? "bg-emerald-500/10 text-emerald-300 border-l-2 border-emerald-400"
          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
      }`}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
    >
      <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-emerald-400" : "text-slate-500"}`} />
      <span className="truncate">{node.label}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export function MemoryPage() {
  const docsQuery = useDocsQuery();
  const [search, setSearch] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<DocumentRecord | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["Atlas", "Daily Logs"]));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const docs = docsQuery.data ?? [];

  const tree = useMemo(() => buildTree(docs), [docs]);

  const filteredTree = useMemo(() => {
    if (!search.trim()) return tree;
    const matchIds = new Set(docs.filter((d) => matchesSearch(d, search)).map((d) => d.id));
    return tree.map((root) => filterTree(root, matchIds)).filter(Boolean) as TreeNode[];
  }, [tree, docs, search]);

  const uniqueCategories = useMemo(() => new Set(docs.map((d) => d.category)).size, [docs]);
  const lastUpdated = useMemo(() => {
    if (docs.length === 0) return null;
    const first = docs[0];
    if (!first) return null;
    return docs.reduce((latest, d) => (d.updated_at > latest ? d.updated_at : latest), first.updated_at);
  }, [docs]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const handleSelect = useCallback((doc: DocumentRecord) => {
    setSelectedDoc(doc);
    setSidebarOpen(false);
  }, []);

  if (docsQuery.isError) return <ErrorState title="Memory unavailable" description="Memory documents could not be loaded." />;

  const breadcrumb = selectedDoc ? getBreadcrumb(selectedDoc) : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Memory"
        title="Atlas memory dashboard"
        description="Browse workspace files, daily notes, projects, and research in an Obsidian-style layout."
      />

      {/* Loading state */}
      {docsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-[600px] rounded-2xl" />
        </div>
      ) : (
        <>
          {/* Stats bar */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Total Files</p>
              <p className="mt-3 text-4xl font-semibold text-white">{docs.length}</p>
              <p className="mt-2 text-sm text-slate-400">All synced documents across the workspace.</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Categories</p>
              <p className="mt-3 text-4xl font-semibold text-white">{uniqueCategories}</p>
              <p className="mt-2 text-sm text-slate-400">Unique document categories in the vault.</p>
            </Card>
            <Card className="p-5">
              <p className="text-xs uppercase tracking-[0.28em] text-slate-500">Last Sync</p>
              <p className="mt-3 text-4xl font-semibold text-white">{lastUpdated ? formatRelativeTime(lastUpdated) : "—"}</p>
              <p className="mt-2 text-sm text-slate-400">Most recent document activity.</p>
            </Card>
          </div>

          {/* Mobile sidebar toggle */}
          <div className="md:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <Menu className="h-4 w-4" />
              {sidebarOpen ? "Hide file tree" : "Show file tree"}
            </button>
          </div>

          {/* Two-panel layout */}
          <div className="flex min-h-[600px] overflow-hidden rounded-2xl border border-white/[0.06]">
            {/* Sidebar */}
            <div
              className={`${
                sidebarOpen ? "block" : "hidden"
              } md:block w-full md:w-[280px] shrink-0 border-r border-white/[0.06] bg-slate-950/80`}
            >
              {/* Search */}
              <div className="border-b border-white/[0.06] p-3">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter files…"
                    className="h-8 bg-slate-900/60 pl-8 text-sm placeholder:text-slate-600 border-slate-700/50 focus:border-emerald-500/50"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Tree */}
              <div className="overflow-y-auto p-2" style={{ maxHeight: "calc(100vh - 420px)" }}>
                {filteredTree.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-slate-500">No files match your filter.</p>
                ) : (
                  filteredTree.map((rootNode) => (
                    <TreeItem
                      key={rootNode.path}
                      node={rootNode}
                      depth={0}
                      selectedId={selectedDoc?.id ?? null}
                      expandedPaths={expandedPaths}
                      onSelect={handleSelect}
                      onToggleExpand={toggleExpand}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Content viewer */}
            <div className="flex-1 overflow-y-auto bg-slate-900/50 p-6 md:p-8" style={{ maxHeight: "calc(100vh - 300px)", minHeight: "600px" }}>
              {selectedDoc ? (
                <div className="mx-auto max-w-3xl space-y-6">
                  {/* Breadcrumb */}
                  <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
                    {breadcrumb.map((segment, i) => (
                      <span key={`${segment}-${i}`} className="flex items-center gap-1">
                        {i > 0 && <span className="text-slate-600">/</span>}
                        <span className={i === breadcrumb.length - 1 ? "text-emerald-400" : ""}>{segment}</span>
                      </span>
                    ))}
                  </div>

                  {/* Title */}
                  <h1 className="text-2xl font-bold text-white leading-tight">
                    {selectedDoc.title || selectedDoc.file_path.split("/").pop()?.replace(/\.md$/i, "") || "Untitled"}
                  </h1>

                  {/* Metadata */}
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedDoc.doc_type && (
                      <Badge tone="default">{selectedDoc.doc_type}</Badge>
                    )}
                    {selectedDoc.category && (
                      <Badge tone="success">{selectedDoc.category}</Badge>
                    )}
                    {selectedDoc.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="inline-block rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400"
                      >
                        {tag}
                      </span>
                    ))}
                    <span className="text-xs text-slate-500">
                      Updated {formatRelativeTime(selectedDoc.updated_at)}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="border-t border-white/[0.06]" />

                  {/* Markdown content */}
                  <div className="prose prose-invert max-w-none prose-headings:text-emerald-300 prose-h1:text-emerald-300 prose-h2:text-emerald-300 prose-h3:text-emerald-300 prose-p:text-slate-300 prose-strong:text-white prose-li:text-slate-300 prose-code:text-emerald-200 prose-code:bg-slate-800/60 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-pre:bg-slate-950 prose-pre:border prose-pre:border-white/[0.06] prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline prose-blockquote:border-emerald-500/40 prose-blockquote:text-slate-400 prose-th:text-slate-300 prose-td:text-slate-400 prose-hr:border-white/[0.06]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedDoc.content}</ReactMarkdown>
                  </div>
                </div>
              ) : (
                /* Empty state */
                <div className="flex h-full items-center justify-center">
                  <div className="text-center space-y-3">
                    <FileText className="mx-auto h-12 w-12 text-slate-600" />
                    <h2 className="text-lg font-medium text-slate-400">Select a file from the sidebar</h2>
                    <p className="text-sm text-slate-500">Browse the file tree to view document contents.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
