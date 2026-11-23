import { useState } from "react";
import { copyText } from "../lib/browser";

interface TreeViewProps {
  value: unknown;
  onCopied: (message: string) => void;
}

export function TreeView({ value, onCopied }: TreeViewProps) {
  const [generation, setGeneration] = useState(0);
  const [initial, setInitial] = useState<"default" | "open" | "closed">("default");
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();

  async function copyPath(path: string) {
    const ok = await copyText(path);
    onCopied(ok ? `Copied ${path}` : "Could not copy the path.");
  }

  return (
    <div className="tree-wrap">
      <div className="tree-tools">
        <label className="search">
          <span className="sr-only">Filter the tree</span>
          <input
            type="search"
            value={query}
            placeholder="Filter keys and values"
            onChange={(event) => setQuery(event.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setInitial("open");
            setGeneration((current) => current + 1);
          }}
        >
          Expand all
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setInitial("closed");
            setGeneration((current) => current + 1);
          }}
        >
          Collapse all
        </button>
      </div>
      <div className="tree" key={generation}>
        <TreeNode
          name={null}
          value={value}
          depth={0}
          path="$"
          initial={initial}
          query={needle}
          onCopy={(path) => void copyPath(path)}
        />
      </div>
    </div>
  );
}

function TreeNode({
  name,
  value,
  depth,
  path,
  initial,
  query,
  onCopy,
}: {
  name: string | null;
  value: unknown;
  depth: number;
  path: string;
  initial: "default" | "open" | "closed";
  query: string;
  onCopy: (path: string) => void;
}) {
  const [localOpen, setLocalOpen] = useState(initial === "open" || (initial === "default" && depth < 2));
  const [limit, setLimit] = useState(40);
  const [full, setFull] = useState(false);
  const complex = value !== null && typeof value === "object";
  const visible = query.length === 0 || subtreeHas(value, query, name);
  if (!visible) return null;
  const open = query.length > 0 ? true : localOpen;

  const entries: Array<{ key: string; child: unknown; path: string }> = [];
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      entries.push({ key: String(index), child, path: `${path}[${index}]` });
    });
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      entries.push({ key, child, path: joinPath(path, key) });
    }
  }
  const shown = entries.slice(0, limit);

  return (
    <div className="tree-node">
      <div className="tree-row">
        {complex ? (
          <button
            type="button"
            className="twist"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${name ?? "root"}`}
            onClick={() => setLocalOpen((current) => !current)}
          >
            {open ? "▾" : "▸"}
          </button>
        ) : (
          <span className="twist-spacer" aria-hidden="true" />
        )}
        {name !== null && <span className="tree-key">{name}</span>}
        {name !== null && <span className="tree-colon">:</span>}
        <ValueText value={value} open={open} count={entries.length} full={full} onToggle={() => setFull((c) => !c)} />
        <button type="button" className="path-btn" onClick={() => onCopy(path)} title={`Copy path ${path}`}>
          Copy path
        </button>
      </div>
      {complex && open && (
        <div className="tree-children">
          {shown.map((entry) => (
            <TreeNode
              key={entry.path}
              name={entry.key}
              value={entry.child}
              depth={depth + 1}
              path={entry.path}
              initial={initial}
              query={query}
              onCopy={onCopy}
            />
          ))}
          {entries.length > shown.length && (
            <button type="button" className="btn btn-tiny" onClick={() => setLimit((current) => current + 40)}>
              Show {Math.min(40, entries.length - shown.length)} more of {entries.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ValueText({
  value,
  open,
  count,
  full,
  onToggle,
}: {
  value: unknown;
  open: boolean;
  count: number;
  full: boolean;
  onToggle: () => void;
}) {
  if (Array.isArray(value)) {
    return <span className="tree-meta">{open ? `Array · ${count}` : `[…] ${count}`}</span>;
  }
  if (value && typeof value === "object") {
    return <span className="tree-meta">{open ? `Object · ${count}` : `{…} ${count}`}</span>;
  }
  if (typeof value === "string") {
    const text = full || value.length <= 180 ? value : `${value.slice(0, 180)}…`;
    return (
      <span className="tree-string">
        {JSON.stringify(text)}
        {value.length > 180 && (
          <button type="button" className="btn btn-tiny" onClick={onToggle}>
            {full ? "Show less" : "Show all"}
          </button>
        )}
      </span>
    );
  }
  if (typeof value === "number") return <span className="tree-number">{String(value)}</span>;
  if (typeof value === "boolean") return <span className="tree-literal">{String(value)}</span>;
  if (value === null) return <span className="tree-literal">null</span>;
  return <span className="tree-meta">empty</span>;
}

function subtreeHas(value: unknown, query: string, name: string | null): boolean {
  if (name && name.toLowerCase().includes(query)) return true;
  if (value === null) return "null".includes(query);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase().includes(query);
  }
  if (Array.isArray(value)) return value.some((item, index) => subtreeHas(item, query, String(index)));
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).some(([key, child]) => subtreeHas(child, query, key));
  }
  return false;
}

function joinPath(parent: string, key: string): string {
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key)) return `${parent}.${key}`;
  return `${parent}[${JSON.stringify(key)}]`;
}
