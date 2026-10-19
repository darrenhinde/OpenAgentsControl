// Sandbox self-tests (plan §4.4). QUARANTINED (P1.2 U3): the orchestrator has no dependency
// that runs them, and their Boolean results may not mint verified capability evidence. Their
// own runIsolated launches are declared host-check, so the funnel gate refuses them too.
// Kept for P3, which replaces them with evidence-producing probes.
import { existsSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import { ENV_ALLOWLIST, OPENCODE_SERVICE_PORT, isoEnv, makeIsoDirs, runIsolated, sandboxMode } from "./env.ts";

export interface SelfTest {
  name: string;
  ok: boolean;
  detail: string;
}

const SENSITIVE = /^(ANTHROPIC_(?!API_KEY$|BASE_URL$)|OPENAI_|CLAUDE_(?!CONFIG_DIR$|CODE_DISABLE_NONESSENTIAL_TRAFFIC$)|OPENCODE_(?!DISABLE_)|AWS_|GH_|GITHUB_|NPM_|SSH_)/;

export async function runSelfTests(repo: string, tmpRoot: string, runId: string): Promise<SelfTest[]> {
  const d = makeIsoDirs(tmpRoot, "sandbox-selftest");
  const env = isoEnv(d, "/usr/bin:/bin:/usr/sbin:/sbin", { ANTHROPIC_API_KEY: `sk-ant-dummy-${runId}` });
  const target = { repo, repoDeny: repo, launch: { checkId: "sandbox/selftest", workload: "host-check" as const } };
  const realHome = homedir();
  const out: SelfTest[] = [];
  const seatbelt = sandboxMode() === "seatbelt";
  const run = (argv: string[]): ReturnType<typeof runIsolated> => runIsolated({ dirs: d, env, argv, target, timeoutMs: 15_000, stdoutOnly: true });

  // 1. env scrub: only allowlisted names reach the process.
  {
    const r = await run(["/usr/bin/env"]);
    const names = r.out.split("\n").map((l) => l.split("=")[0] ?? "").filter(Boolean);
    const bad = names.filter((n) => !ENV_ALLOWLIST.has(n) || SENSITIVE.test(n));
    out.push({ name: "env-scrub", ok: r.code === 0 && bad.length === 0, detail: bad.length ? `unexpected env: ${bad.join(",")}` : `${names.length} names, all allowlisted` });
  }
  // 2. egress: the internet is unreachable.
  {
    const r = await run(["/usr/bin/curl", "-sS", "-m", "3", "-o", "/dev/null", "https://example.com"]);
    out.push({ name: "egress", ok: r.code !== 0 || !seatbelt, detail: r.code !== 0 ? "external HTTPS blocked" : seatbelt ? "EXTERNAL HTTPS REACHABLE" : "not enforced (iso mode)" });
  }
  // 3. loopback works (the fake model must be reachable).
  {
    const srv = createServer((_q, s) => s.end("ok"));
    await new Promise<void>((res) => srv.listen(0, "127.0.0.1", res));
    const port = (srv.address() as AddressInfo).port;
    const r = await run(["/usr/bin/curl", "-sS", "-m", "3", `http://127.0.0.1:${port}/`]);
    srv.close();
    out.push({ name: "loopback", ok: r.code === 0 && r.out.includes("ok"), detail: r.code === 0 ? "fake-model port reachable" : `loopback blocked (rc ${r.code})` });
  }
  // 4. writes under $HOME are blocked.
  {
    const probe = join(realHome, `.oac-sandbox-probe-${runId}`);
    const r = await run(["/usr/bin/touch", probe]);
    const leaked = existsSync(probe);
    if (leaked) rmSync(probe, { force: true });
    out.push({ name: "outside-write", ok: !leaked || !seatbelt, detail: leaked ? (seatbelt ? "WROTE UNDER $HOME" : "not enforced (iso mode)") : `blocked (rc ${r.code})` });
  }
  // 5. real host config is unreadable. Output is discarded and never logged.
  for (const p of [".claude", ".config/opencode", ".ssh"]) {
    const full = join(realHome, p);
    if (!existsSync(full)) continue;
    const r = await run(["/bin/ls", full]);
    out.push({ name: `read-${p}`, ok: r.code !== 0 || !seatbelt, detail: r.code !== 0 ? "blocked" : seatbelt ? "READABLE" : "not enforced (iso mode)" });
  }
  // 6. the repo under test is unreadable to agents (they only ever see copies).
  {
    const r = await run(["/bin/ls", repo]);
    out.push({ name: "read-repo", ok: r.code !== 0 || !seatbelt, detail: r.code !== 0 ? "blocked" : seatbelt ? "READABLE" : "not enforced (iso mode)" });
  }
  // 7. the user's OpenCode managed service port is unreachable.
  {
    const r = await run(["/usr/bin/nc", "-z", "-w", "1", "127.0.0.1", OPENCODE_SERVICE_PORT]);
    out.push({ name: "service-port", ok: r.code !== 0 || !seatbelt, detail: r.code !== 0 ? `:${OPENCODE_SERVICE_PORT} blocked` : seatbelt ? `:${OPENCODE_SERVICE_PORT} REACHABLE` : "not enforced (iso mode)" });
  }
  return out;
}
