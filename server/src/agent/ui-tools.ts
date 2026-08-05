import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import { z } from "zod";
import { ComponentSpec } from "@shared/spec.js";
import type { CanvasCard } from "@shared/protocol.js";

const ok = (text: string) => ({ content: [{ type: "text" as const, text }] });

/**
 * The whole trick behind "Claude draws on the website": these tools run
 * in-process, so the handler can push straight down the browser's socket and
 * return a one-line receipt to Claude. No message bus, no polling.
 */
export function createUiServer(emit: (card: CanvasCard) => void, clear: () => void) {
  return createSdkMcpServer({
    name: "canvas",
    version: "1.0.0",
    instructions:
      "Menggambar di canvas yang dilihat user. Panggil tool ini alih-alih membacakan data lewat teks.",
    tools: [
      tool(
        "render_component",
        "Tampilkan komponen visual di canvas user: chart, tabel, kartu metrik, timeline, markdown, atau kode. " +
          "Pakai ini setiap kali data lebih enak dilihat daripada didengar. " +
          "Kembalikan id-nya supaya bisa diperbarui nanti lewat update_component.",
        {
          spec: ComponentSpec,
          id: z
            .string()
            .optional()
            .describe("Id sendiri. Kosongkan untuk kartu baru; isi untuk menimpa kartu yang ada."),
        },
        async ({ spec, id }) => {
          const cardId = id ?? nanoid(8);
          emit({ id: cardId, kind: "component", spec });
          return ok(`Ditampilkan di canvas sebagai "${cardId}".`);
        },
        { annotations: { readOnlyHint: false, openWorldHint: false } },
      ),

      tool(
        "update_component",
        "Perbarui kartu canvas yang sudah ada, di tempat. Pakai ini untuk data yang bergerak " +
          "(monitoring, polling, progres) supaya tidak menumpuk kartu baru terus.",
        {
          id: z.string().describe("Id kartu yang dikembalikan render_component"),
          spec: ComponentSpec,
        },
        async ({ id, spec }) => {
          emit({ id, kind: "component", spec });
          return ok(`Kartu "${id}" diperbarui.`);
        },
        { annotations: { readOnlyHint: false, openWorldHint: false } },
      ),

      tool(
        "render_html",
        "Tampilkan HTML mentah di iframe sandbox. Pakai HANYA kalau tidak ada komponen registry " +
          "yang muat — misalnya widget interaktif, diagram custom, atau tata letak khusus. " +
          "Untuk chart biasa pakai render_component. HTML harus mandiri: CSS inline, tanpa " +
          "resource eksternal. Latar transparan; gaya halaman gelap.",
        {
          html: z.string().describe("Fragmen HTML lengkap. <style> dan <script> inline diperbolehkan."),
          title: z.string().optional(),
          height: z.number().min(80).max(1200).optional().describe("Tinggi frame dalam pixel, default 360"),
          id: z.string().optional(),
        },
        async ({ html, title, height, id }) => {
          const cardId = id ?? nanoid(8);
          emit({ id: cardId, kind: "html", html, title, height });
          return ok(`HTML ditampilkan di canvas sebagai "${cardId}".`);
        },
        { annotations: { readOnlyHint: false, openWorldHint: false } },
      ),

      tool(
        "clear_canvas",
        "Kosongkan seluruh canvas. Pakai saat user berganti topik dan kartu lama jadi tidak relevan.",
        {},
        async () => {
          clear();
          return ok("Canvas dikosongkan.");
        },
        { annotations: { readOnlyHint: false, openWorldHint: false } },
      ),
    ],
  });
}
