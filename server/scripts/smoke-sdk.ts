/**
 * Isolates the Agent SDK from our socket plumbing. Run: npm run smoke -w server
 */
import { query, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

const prompt = process.argv[2] ?? "Reply with exactly: pong";

async function* input(): AsyncGenerator<SDKUserMessage> {
  yield { type: "user", message: { role: "user", content: prompt }, parent_tool_use_id: null };
  // Keep the generator alive so the session stays in streaming mode.
  await new Promise(() => {});
}

const q = query({
  prompt: input(),
  options: {
    model: process.env.MODEL ?? "claude-opus-5",
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    settingSources: [],
    includePartialMessages: true,
    stderr: (data) => process.stderr.write(`[cc] ${data}`),
  },
});

const timer = setTimeout(() => {
  console.error("\n[TIMEOUT 120s]");
  process.exit(1);
}, 120_000);

try {
  for await (const m of q) {
    if (m.type === "system" && m.subtype === "init") {
      console.log(`[init] model=${m.model} tools=${m.tools.length} mcp=${JSON.stringify(m.mcp_servers)}`);
    } else if (m.type === "stream_event" && m.event.type === "content_block_delta" && m.event.delta.type === "text_delta") {
      process.stdout.write(m.event.delta.text);
    } else if (m.type === "result") {
      console.log(`\n[result] ${m.subtype} cost=$${m.total_cost_usd?.toFixed(4)}`);
      clearTimeout(timer);
      q.close();
      process.exit(0);
    }
  }
} catch (error) {
  console.error("\n[threw]", error);
  process.exit(1);
}
