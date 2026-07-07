"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { HighlightedCode } from "@/components/HighlightedCode";
import type { SourceMapEntry } from "@/lib/course-views";
import type { Locale } from "@/lib/types";

interface FileNode {
  name: string;
  path: string;
  children: Map<string, FileNode>;
  entry?: SourceMapEntry;
}

export function SourceMapExplorer({
  entries,
  locale,
  repoId,
}: {
  entries: SourceMapEntry[];
  locale: Locale;
  repoId: string;
}) {
  const [activeFile, setActiveFile] = useState(entries[0]?.file ?? "");
  const [activeSnippetIndex, setActiveSnippetIndex] = useState(0);
  const tree = useMemo(() => buildTree(entries), [entries]);
  const activeEntry = entries.find((entry) => entry.file === activeFile) ?? entries[0];
  const preview = activeEntry?.snippets[activeSnippetIndex] ?? activeEntry?.snippets[0];

  function selectFile(file: string) {
    setActiveFile(file);
    setActiveSnippetIndex(0);
  }

  if (!entries.length) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="grid min-h-[28rem] lg:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.55fr)]">
        <div className="border-b border-line bg-bg-subtle/60 dark:border-zinc-800 dark:bg-zinc-950 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-line px-4 py-3 dark:border-zinc-800">
            <div className="text-[11px] font-semibold uppercase text-ink-faint dark:text-zinc-500">Files</div>
            <div className="font-mono text-[11px] text-ink-faint dark:text-zinc-500">{entries.length}</div>
          </div>
          <div className="max-h-[31rem] overflow-auto px-2 py-2 text-[12px]">
            {tree.childrenArray.map((node) => (
              <TreeNode
                key={node.path}
                node={node}
                activeFile={activeEntry?.file ?? ""}
                onSelect={selectFile}
              />
            ))}
          </div>
        </div>

        <div className="min-w-0 bg-zinc-950 text-zinc-200">
          {activeEntry ? (
            <div className="flex h-full min-h-[28rem] flex-col">
              <div className="border-b border-zinc-800 px-4 py-3">
                <div className="break-all font-mono text-[12px] leading-relaxed text-zinc-100">{activeEntry.file}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {activeEntry.lessons.map((lesson) => (
                    <Link
                      key={lesson.id}
                      href={`/${locale}/c/${repoId}/lessons/${lesson.id}`}
                      className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[11px] text-zinc-300 transition hover:bg-brand hover:text-white"
                    >
                      {lesson.id}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-auto p-4">
                {preview ? (
                  <div>
                    <div className="mb-3 border-l-2 border-brand pl-3">
                      <div className="text-[11px] font-semibold uppercase text-zinc-500">{preview.lesson.id}{preview.symbol ? ` / ${preview.symbol}` : ""}</div>
                      <div className="mt-1 text-sm font-semibold text-zinc-100">{preview.title}</div>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{preview.desc}</p>
                    </div>
                    <HighlightedCode
                      code={preview.snippet}
                      language={preview.language}
                      highlightedLines={preview.highlightLines}
                      className="source-preview-code overflow-x-auto whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-[11px] leading-5 text-zinc-300 sm:text-[12px]"
                    />
                    {activeEntry.snippets.length > 1 && (
                      <div className="mt-4 space-y-2">
                        <div className="text-[11px] font-semibold uppercase text-zinc-500">References in this file</div>
                        <div className="grid gap-2">
                          {activeEntry.snippets.map((snippet, idx) => (
                            <button
                              key={`${snippet.lesson.id}-${idx}`}
                              type="button"
                              onClick={() => setActiveSnippetIndex(idx)}
                              className={`rounded-lg border px-3 py-2 text-left text-xs transition ${
                                snippet === preview
                                  ? "border-brand bg-brand/10 text-zinc-100"
                                  : "border-zinc-800 text-zinc-400 hover:border-brand hover:text-zinc-100"
                              }`}
                            >
                              <span className="font-mono text-brand">{snippet.lesson.id}</span>
                              <span className="mx-2 text-zinc-600">/</span>
                              <span className="font-medium text-zinc-200">{snippet.title}</span>
                            </button>
                          ))}
                        </div>
                        <Link
                          href={`/${locale}/c/${repoId}/lessons/${preview.lesson.id}`}
                          className="inline-flex rounded-md border border-zinc-800 px-2 py-1 text-[11px] font-medium text-zinc-400 transition hover:border-brand hover:text-zinc-100"
                        >
                          Open lesson
                        </Link>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid min-h-[16rem] place-items-center rounded-lg border border-dashed border-zinc-800 px-6 text-center text-sm text-zinc-500">
                    This file is referenced by the outline, but no focused code snippet was generated for it yet.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TreeNode({
  node,
  activeFile,
  onSelect,
  depth = 0,
}: {
  node: FileNode;
  activeFile: string;
  onSelect: (file: string) => void;
  depth?: number;
}) {
  const children = childrenArray(node);
  const isFile = Boolean(node.entry);
  const isActive = node.entry?.file === activeFile;
  const rowClass = `grid w-full grid-cols-[1rem_minmax(0,1fr)_auto] items-center gap-1.5 rounded-md px-2 py-1.5 text-left font-mono transition ${
    isActive
      ? "bg-brand text-white"
      : isFile
        ? "text-ink-soft hover:bg-white hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
        : "text-ink-faint dark:text-zinc-500"
  }`;
  const rowStyle = { paddingLeft: `${0.5 + depth * 0.85}rem` };
  const rowContent = (
    <>
      <span className="text-[11px]">{isFile ? "-" : children.length ? ">" : ""}</span>
      <span className="truncate text-[12px]">{node.name}</span>
      {node.entry && <span className={isActive ? "text-[10px] text-white/75" : "text-[10px] text-ink-faint dark:text-zinc-600"}>{node.entry.lessons.length}</span>}
    </>
  );
  return (
    <div>
      {isFile ? (
        <button type="button" onClick={() => node.entry && onSelect(node.entry.file)} className={rowClass} style={rowStyle}>
          {rowContent}
        </button>
      ) : (
        <div className={rowClass} style={rowStyle}>{rowContent}</div>
      )}
      {children.map((child) => (
        <TreeNode key={child.path} node={child} activeFile={activeFile} onSelect={onSelect} depth={depth + 1} />
      ))}
    </div>
  );
}

function buildTree(entries: SourceMapEntry[]) {
  const root: FileNode = { name: "", path: "", children: new Map() };
  for (const entry of entries) {
    const parts = entry.file.split("/").filter(Boolean);
    let cursor = root;
    parts.forEach((part, idx) => {
      const path = parts.slice(0, idx + 1).join("/");
      let next = cursor.children.get(part);
      if (!next) {
        next = { name: part, path, children: new Map() };
        cursor.children.set(part, next);
      }
      cursor = next;
    });
    cursor.entry = entry;
  }
  return { ...root, childrenArray: childrenArray(root) };
}

function childrenArray(node: FileNode): FileNode[] {
  return [...node.children.values()].sort((a, b) => {
    const aFile = a.entry ? 1 : 0;
    const bFile = b.entry ? 1 : 0;
    return aFile - bFile || a.name.localeCompare(b.name);
  });
}
