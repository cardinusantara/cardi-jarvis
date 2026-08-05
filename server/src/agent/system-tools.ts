import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import si from "systeminformation";

const round = (n: number, digits = 1) => Number(n.toFixed(digits));
const gb = (bytes: number) => round(bytes / 1024 ** 3, 2);

async function snapshot() {
  const [cpu, load, mem, os, time] = await Promise.all([
    si.cpu(),
    si.currentLoad(),
    si.mem(),
    si.osInfo(),
    si.time(),
  ]);

  return {
    cpu: {
      model: `${cpu.manufacturer} ${cpu.brand}`.trim(),
      speedGHz: cpu.speed,
      physicalCores: cpu.physicalCores,
      logicalCores: cpu.cores,
      loadPercent: round(load.currentLoad),
      userPercent: round(load.currentLoadUser),
      systemPercent: round(load.currentLoadSystem),
      perCorePercent: load.cpus.map((c) => round(c.load)),
    },
    memory: {
      totalGB: gb(mem.total),
      usedGB: gb(mem.active),
      freeGB: gb(mem.available),
      usedPercent: round((mem.active / mem.total) * 100),
      swapTotalGB: gb(mem.swaptotal),
      swapUsedGB: gb(mem.swapused),
    },
    os: {
      platform: os.platform,
      distro: os.distro,
      release: os.release,
      arch: os.arch,
      hostname: os.hostname,
      uptimeHours: round(time.uptime / 3600),
    },
  };
}

async function detail() {
  const [disks, nets, procs, temp] = await Promise.all([
    si.fsSize(),
    si.networkStats(),
    si.processes(),
    si.cpuTemperature().catch(() => null),
  ]);

  const byCpu = [...procs.list].sort((a, b) => b.cpu - a.cpu).slice(0, 8);
  const byMem = [...procs.list].sort((a, b) => b.memRss - a.memRss).slice(0, 8);

  return {
    disks: disks
      .filter((d) => d.size > 0)
      .map((d) => ({
        mount: d.mount,
        fs: d.fs,
        totalGB: gb(d.size),
        usedGB: gb(d.used),
        usedPercent: round(d.use),
      })),
    network: nets.map((n) => ({
      iface: n.iface,
      rxKBps: round(Math.max(0, n.rx_sec ?? 0) / 1024),
      txKBps: round(Math.max(0, n.tx_sec ?? 0) / 1024),
      rxTotalGB: gb(n.rx_bytes),
      txTotalGB: gb(n.tx_bytes),
    })),
    processes: {
      total: procs.all,
      topByCpu: byCpu.map((p) => ({ pid: p.pid, name: p.name, cpuPercent: round(p.cpu), memMB: round(p.memRss / 1024, 0) })),
      topByMemory: byMem.map((p) => ({ pid: p.pid, name: p.name, cpuPercent: round(p.cpu), memMB: round(p.memRss / 1024, 0) })),
    },
    cpuTemperatureC: temp?.main && temp.main > 0 ? round(temp.main) : null,
  };
}

/**
 * Claude *can* answer CPU/RAM questions through Bash, but on Windows that means
 * parsing wmic/PowerShell output — slow and brittle. One dedicated tool returns
 * structured numbers that drop straight into a chart spec.
 */
export function createSystemServer() {
  return createSdkMcpServer({
    name: "system",
    version: "1.0.0",
    instructions: "Metrik mesin lokal. Pakai ini, bukan perintah shell, untuk pertanyaan soal CPU/RAM/disk/proses.",
    tools: [
      tool(
        "system_metrics",
        "Baca kondisi mesin lokal: CPU (total dan per core), RAM, disk, jaringan, dan proses teratas. " +
          "Set sample_seconds > 0 untuk merekam deret waktu — pakai itu kalau user minta grafik tren " +
          "atau monitoring. Set include_detail=false kalau cuma butuh CPU dan RAM (jauh lebih cepat).",
        {
          sample_seconds: z
            .number()
            .min(0)
            .max(120)
            .default(0)
            .describe("Rekam CPU dan RAM tiap detik selama sekian detik. 0 = satu snapshot saja."),
          include_detail: z
            .boolean()
            .default(true)
            .describe("Sertakan disk, jaringan, dan daftar proses teratas."),
        },
        async ({ sample_seconds, include_detail }) => {
          const now = await snapshot();
          const extra = include_detail ? await detail() : {};

          let samples: Array<{ t: string; cpuPercent: number; memPercent: number; memUsedGB: number }> | undefined;
          if (sample_seconds > 0) {
            samples = [];
            const started = Date.now();
            for (let i = 0; i < sample_seconds; i++) {
              const [load, mem] = await Promise.all([si.currentLoad(), si.mem()]);
              samples.push({
                t: new Date().toISOString().slice(11, 19),
                cpuPercent: round(load.currentLoad),
                memPercent: round((mem.active / mem.total) * 100),
                memUsedGB: gb(mem.active),
              });
              const nextTick = started + (i + 1) * 1000;
              await new Promise((r) => setTimeout(r, Math.max(0, nextTick - Date.now())));
            }
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({ ...now, ...extra, ...(samples ? { samples } : {}) }, null, 2),
              },
            ],
          };
        },
        { annotations: { readOnlyHint: true, openWorldHint: false } },
      ),
    ],
  });
}
