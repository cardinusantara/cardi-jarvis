import { query, type Query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { AGENT_CWD, MODEL } from "../config.js";
import { CANVAS_RULES } from "./prompt.js";
import { createUiServer } from "./ui-tools.js";
import { createSystemServer } from "./system-tools.js";
import { SentenceBuffer } from "./sentences.js";
import { describeTool } from "./tool-labels.js";
import type { AgentServerMessage, CanvasCard } from "@shared/protocol.js";

type Emit = (msg: AgentServerMessage) => void;

/**
 * A live agent session backed by streaming input mode.
 *
 * The generator never returns, so the underlying query stays open across turns:
 * that is what gives us queued messages, persistent context, and `interrupt()`.
 */
export class AgentSession {
  #queue: SDKUserMessage[] = [];
  #wake: (() => void) | null = null;
  #query: Query | null = null;
  #emit: Emit;
  #sentences: SentenceBuffer;
  #openTools = new Map<string, string>();
  #closed = false;
  #speaking = false;

  constructor(emit: Emit) {
    this.#emit = emit;
    this.#sentences = new SentenceBuffer((sentence) => emit({ kind: "speak", text: sentence }));
  }

  async *#input(): AsyncGenerator<SDKUserMessage> {
    while (!this.#closed) {
      const next = this.#queue.shift();
      if (next) {
        yield next;
        continue;
      }
      await new Promise<void>((resolve) => (this.#wake = resolve));
    }
  }

  start() {
    const card = (c: CanvasCard) => this.#emit({ kind: "render", card: c });
    const clear = () => this.#emit({ kind: "canvas_clear" });

    this.#query = query({
      prompt: this.#input(),
      options: {
        model: MODEL,
        cwd: AGENT_CWD,
        permissionMode: "bypassPermissions",
        // Required by the SDK whenever bypassPermissions is used — an explicit
        // acknowledgement that nothing will ask before it runs.
        allowDangerouslySkipPermissions: true,
        includePartialMessages: true,
        // Isolation mode: our system prompt is the only instruction source. Without
        // this the agent would inherit ~/.claude/CLAUDE.md and project settings.
        settingSources: [],
        systemPrompt: { type: "preset", preset: "claude_code", append: CANVAS_RULES },
        mcpServers: {
          canvas: createUiServer(card, clear),
          system: createSystemServer(),
        },
      },
    });

    void this.#pump();
  }

  send(text: string) {
    if (this.#closed) return;
    this.#queue.push({
      type: "user",
      message: { role: "user", content: text },
      parent_tool_use_id: null,
    });
    this.#wake?.();
    this.#wake = null;
  }

  async interrupt() {
    this.#sentences.discard();
    this.#speaking = false;
    try {
      await this.#query?.interrupt();
    } catch {
      // Nothing was running — interrupting an idle session is a no-op, not an error.
    }
  }

  close() {
    this.#closed = true;
    this.#wake?.();
    this.#wake = null;
    try {
      this.#query?.close();
    } catch {
      /* already gone */
    }
  }

  async #pump() {
    if (!this.#query) return;
    try {
      for await (const message of this.#query) {
        switch (message.type) {
          case "system":
            if (message.subtype === "init") {
              this.#emit({
                kind: "ready",
                sessionId: message.session_id,
                model: message.model,
                cwd: message.cwd,
              });
            }
            break;

          case "stream_event": {
            // Subagent chatter has a parent tool id; keep it out of the main transcript.
            if (message.parent_tool_use_id !== null) break;
            const event = message.event;

            if (event.type === "content_block_start" && event.content_block.type === "text") {
              if (!this.#speaking) {
                this.#speaking = true;
                this.#emit({ kind: "turn_start" });
              }
            }

            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              if (!this.#speaking) {
                this.#speaking = true;
                this.#emit({ kind: "turn_start" });
              }
              this.#emit({ kind: "assistant_delta", text: event.delta.text });
              this.#sentences.push(event.delta.text);
            }
            break;
          }

          case "assistant": {
            if (message.parent_tool_use_id !== null) break;
            for (const block of message.message.content) {
              if (block.type === "tool_use") {
                const label = describeTool(block.name, block.input);
                this.#openTools.set(block.id, label.name);
                this.#emit({ kind: "tool_start", id: block.id, name: label.name, summary: label.summary });
              }
            }
            break;
          }

          case "user": {
            const content = message.message.content;
            if (typeof content === "string") break;
            for (const block of content) {
              if (block.type !== "tool_result") continue;
              if (!this.#openTools.has(block.tool_use_id)) continue;
              this.#openTools.delete(block.tool_use_id);
              this.#emit({
                kind: "tool_end",
                id: block.tool_use_id,
                status: block.is_error ? "error" : "ok",
                preview: previewOf(block.content),
              });
            }
            break;
          }

          case "result": {
            this.#sentences.flush();
            this.#speaking = false;
            this.#emit({ kind: "turn_end" });
            this.#emit({
              kind: "result",
              ok: message.subtype === "success",
              costUsd: message.total_cost_usd,
              durationMs: message.duration_ms,
            });
            if (message.subtype !== "success") {
              this.#emit({ kind: "error", message: describeFailure(message.subtype) });
            }
            break;
          }
        }
      }
    } catch (error) {
      if (this.#closed) return;
      this.#emit({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  }
}

function previewOf(content: unknown): string | undefined {
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((b) => (typeof b === "object" && b && "text" in b ? String((b as { text: unknown }).text) : ""))
            .join(" ")
        : "";
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (!trimmed) return undefined;
  return trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;
}

function describeFailure(subtype: string): string {
  if (subtype === "error_max_turns") return "Batas jumlah giliran tercapai.";
  if (subtype === "error_during_execution") return "Terjadi error saat menjalankan tugas.";
  return `Sesi berakhir: ${subtype}`;
}
