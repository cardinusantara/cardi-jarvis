/**
 * Turns a raw tool call into something worth showing in the activity rail.
 * The rail is what makes the app feel trustworthy — "Bash: git status" reads
 * very differently from a spinner.
 */

const MCP_PREFIX = /^mcp__([^_]+(?:_[^_]+)*?)__(.+)$/;

const shorten = (value: unknown, max = 72): string => {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

const basename = (p: unknown) => {
  const s = typeof p === "string" ? p : "";
  return s.split(/[\\/]/).filter(Boolean).pop() ?? s;
};

export function describeTool(rawName: string, input: unknown): { name: string; summary: string } {
  const args = (input ?? {}) as Record<string, unknown>;
  const mcp = MCP_PREFIX.exec(rawName);
  const name = mcp ? `${mcp[1]}.${mcp[2]}` : rawName;

  switch (rawName) {
    case "Bash":
      return { name: "Bash", summary: shorten(args.command) };
    case "Read":
      return { name: "Read", summary: basename(args.file_path) };
    case "Write":
      return { name: "Write", summary: basename(args.file_path) };
    case "Edit":
      return { name: "Edit", summary: basename(args.file_path) };
    case "Glob":
      return { name: "Glob", summary: shorten(args.pattern) };
    case "Grep":
      return { name: "Grep", summary: shorten(args.pattern) };
    case "WebSearch":
      return { name: "WebSearch", summary: shorten(args.query) };
    case "WebFetch":
      return { name: "WebFetch", summary: shorten(args.url) };
    case "Task":
      return { name: "Subagent", summary: shorten(args.description) };
  }

  if (mcp?.[1] === "canvas") {
    const spec = args.spec as { type?: string; title?: string } | undefined;
    const label = spec?.title ?? spec?.type ?? (args.title as string) ?? "";
    return { name: `canvas.${mcp[2]}`, summary: shorten(label) };
  }

  if (mcp?.[1] === "system") {
    const seconds = Number(args.sample_seconds ?? 0);
    return { name: "system.metrics", summary: seconds > 0 ? `sampling ${seconds}s` : "snapshot" };
  }

  return { name, summary: shorten(args) };
}
