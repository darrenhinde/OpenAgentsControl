// Pure interpretation of boundary-probe observations (P3-lite U1, component-p3-lite.md).
// Each function maps one probe's (exit code, output, supervisor facts) to a verdict:
// "pass" = the expected boundary or positive control was observed; "fail" = a boundary was
// observed breached; anything ambiguous (control failed, missing binary, timeout, an
// unrecognized signal) is "inconclusive" and can never mint verified evidence.
import { ENV_ALLOWLIST, OPENCODE_SERVICE_PORT, SCRUB_CANARY } from "./policy.ts";
import type { HostPath, ProbeContext, ProbeExec, ProbeFacts, ProbeResult, Verdict } from "./probes.ts";

/** Seatbelt denials surface as EPERM; a firewall, proxy or closed port never says this. */
const SEATBELT_DENIAL = /Operation not permitted/;

const SENSITIVE = /^(ANTHROPIC_(?!API_KEY$|BASE_URL$)|OPENAI_|CLAUDE_(?!CONFIG_DIR$|CODE_DISABLE_NONESSENTIAL_TRAFFIC$)|OPENCODE_(?!DISABLE_)|AWS_|GH_|GITHUB_|NPM_|SSH_)/;

const verdict = (result: ProbeResult, ...observations: string[]): Verdict => ({ result, observations });

/** fail > inconclusive > pass. */
export function worst(results: readonly ProbeResult[]): ProbeResult {
  if (results.includes("fail")) return "fail";
  return results.includes("inconclusive") ? "inconclusive" : "pass";
}

/** The first nonblank output line, truncated, for honest "what we saw" observations. */
export function firstLine(out: string): string {
  return (out.split("\n").find((l) => l.trim()) ?? "").trim().slice(0, 120) || "(no output)";
}

// --- env-scrub --------------------------------------------------------------------------

/** Names only (never values). HOME and PATH visible is the positive control. */
export function interpretEnvNames(e: ProbeExec): Verdict {
  if (e.timedOut || e.code !== 0) return verdict("inconclusive", `env did not run cleanly (rc ${e.code})`);
  const names = [...new Set(e.out.split("\n").map((l) => l.split("=")[0] ?? "").filter(Boolean))].sort();
  if (!names.includes("HOME") || !names.includes("PATH")) {
    return verdict("inconclusive", "positive control failed: HOME/PATH not visible, so the listing proves nothing");
  }
  const bad = names.filter((n) => !ENV_ALLOWLIST.has(n) || SENSITIVE.test(n));
  if (bad.length) return verdict("fail", `unexpected env names: ${bad.join(", ")}`);
  return verdict("pass", `${names.length} names, all allowlisted: ${names.join(", ")}`, `scrub canary ${SCRUB_CANARY} absent`);
}

// --- network ----------------------------------------------------------------------------

export const EXTERNAL_URL = "https://example.com";
/** curl's "couldn't connect"; it only counts with the Seatbelt denial text alongside. */
const CURL_CONNECT_FAILED = 7;

/** What the supervisor's loopback listener answers, so a reply proves it reached that listener. */
export const loopbackToken = (runId: string): string => `oac-loopback-${runId}`;

export function interpretLoopback(e: ProbeExec, ctx: ProbeContext): Verdict {
  if (!e.timedOut && e.code === 0 && e.out.includes(loopbackToken(ctx.runId))) {
    return verdict("pass", `loopback 127.0.0.1:${ctx.loopbackPort} reachable (supervisor listener answered)`);
  }
  return verdict("inconclusive", `positive control failed: loopback listener not reached (rc ${e.code}): ${firstLine(e.out)}`);
}

/**
 * Only a connect failure WITH the Seatbelt denial text counts. A bare connect failure, DNS
 * failure (6) or timeout (28) could be a firewall, a proxy or an offline host.
 */
export function interpretExternal(e: ProbeExec): Verdict {
  if (e.timedOut) return verdict("inconclusive", `external probe timed out (rc ${e.code})`);
  if (e.code === 0) return verdict("fail", `external HTTPS REACHABLE: ${EXTERNAL_URL}`);
  if (e.code === CURL_CONNECT_FAILED && SEATBELT_DENIAL.test(e.out)) {
    return verdict("pass", `external HTTPS blocked: ${EXTERNAL_URL} (curl rc 7, connect denied: Operation not permitted)`);
  }
  return verdict("inconclusive", `external probe not attributable to the sandbox (curl rc ${e.code}, no Seatbelt denial text): ${firstLine(e.out)}`);
}

function releaseNote(facts: ProbeFacts, port: string): string {
  if (facts.serviceHold === "occupied") return `${port} held by another listener (the user's service); not ours to release`;
  return facts.serviceReleased ? `our hold on ${port} released (re-bind succeeded)` : `our hold on ${port}: release could not be verified`;
}

/**
 * A refusal only means something while a listener holds the port (ours, held only around this
 * probe, or the user's service), and only the Seatbelt denial text attributes it to the sandbox.
 */
export function interpretServicePort(e: ProbeExec, facts: ProbeFacts): Verdict {
  const port = `127.0.0.1:${OPENCODE_SERVICE_PORT}`;
  if (facts.serviceHold !== "ours" && facts.serviceHold !== "occupied") {
    return verdict("inconclusive", `no listener held ${port} (hold: ${facts.serviceHold ?? "not attempted"}), so a refusal would prove nothing`);
  }
  const release = releaseNote(facts, port);
  if (e.timedOut) return verdict("inconclusive", `service-port probe timed out (rc ${e.code})`, release);
  if (e.code === 0) return verdict("fail", `service port ${port} REACHABLE`, release);
  if (e.code === 1 && SEATBELT_DENIAL.test(e.out)) return verdict("pass", `service port ${port} blocked (listener present, connect denied: Operation not permitted)`, release);
  return verdict("inconclusive", `service-port probe not attributable to the sandbox (nc rc ${e.code}): ${firstLine(e.out)}`, release);
}

// --- filesystem -------------------------------------------------------------------------

interface PathLine {
  readonly rc: number;
  readonly eperm: boolean;
}

/** One `rc<TAB>eperm<TAB>path` line per path from the fixed read/write scripts. */
export function parsePathLines(out: string): ReadonlyMap<string, PathLine> {
  const entries = out.split("\n").flatMap((line): [string, PathLine][] => {
    const m = /^(\d+)\t([01])\t(.+)$/.exec(line);
    return m ? [[m[3] as string, { rc: Number(m[1]), eperm: m[2] === "1" }]] : [];
  });
  return new Map(entries);
}

function denial(line: PathLine | undefined, path: string, verb: string): { result: ProbeResult; note: string } {
  if (!line) return { result: "inconclusive", note: `no result line: ${path}` };
  if (line.rc === 0) return { result: "fail", note: `${verb.toUpperCase()} ALLOWED: ${path}` };
  if (line.eperm) return { result: "pass", note: `blocked (EPERM): ${path}` };
  return { result: "inconclusive", note: `failed without EPERM (rc ${line.rc}), not attributable: ${path}` };
}

/**
 * Named population: every path is listed — probed, "not present", or "not attributable"
 * (inaccessible to the supervisor too) — and the same operation on the throwaway control
 * path must succeed first, or no denial counts.
 */
export function interpretPathProbe(e: ProbeExec, verb: "read" | "write", control: string, population: readonly HostPath[]): Verdict {
  if (e.timedOut) return verdict("inconclusive", `probe timed out (rc ${e.code})`);
  const lines = parsePathLines(e.out);
  if (lines.get(control)?.rc !== 0) {
    return verdict("inconclusive", `positive control failed: ${verb} of throwaway ${control} did not succeed`);
  }
  const observations = [`control: ${verb} of throwaway ${control} succeeded`];
  const results: ProbeResult[] = [];
  for (const p of population) {
    if (p.outside === "absent") observations.push(`not present: ${p.path}`);
    else if (p.outside === "inaccessible") observations.push(`not attributable (inaccessible outside the sandbox too): ${p.path}`);
    else {
      const d = denial(lines.get(p.path), p.path, verb);
      results.push(d.result);
      observations.push(d.note);
    }
  }
  if (!results.length) return { result: "inconclusive", observations: [...observations, "no present path to probe"] };
  return { result: worst(results), observations };
}

/**
 * The repo and the main checkout behind a worktree are both denied to checks (REPO_DENY and
 * MAIN_DENY), so both are probed. An unresolved main checkout can never verify.
 */
export function interpretRepoRead(e: ProbeExec, ctx: ProbeContext): Verdict {
  const main = ctx.mainCheckout;
  const population: HostPath[] = [{ path: ctx.repo, outside: "accessible" }];
  if (main && main !== ctx.repo) population.push({ path: main, outside: "accessible" });
  const v = interpretPathProbe(e, "read", ctx.controlDir, population);
  if (main === undefined) {
    return { result: v.result === "fail" ? "fail" : "inconclusive", observations: [...v.observations, "main-checkout deny not probed (main checkout unresolved)"] };
  }
  return main === ctx.repo ? { ...v, observations: [...v.observations, "main checkout is the repo itself (not a worktree)"] } : v;
}

/** The supervisor's own observation (the file appeared) overrides whatever touch reported. */
export function interpretHomeWrite(e: ProbeExec, facts: ProbeFacts, control: string, target: string): Verdict {
  const v = interpretPathProbe(e, "write", control, [{ path: target, outside: "accessible" }]);
  if (facts.leaked) return verdict("fail", ...v.observations, `WROTE under $HOME: ${target} appeared (removed)`);
  if (facts.leaked === undefined && v.result === "pass") return verdict("inconclusive", ...v.observations, "supervisor did not check the target");
  return v;
}

// --- ipc (keychain only) ------------------------------------------------------------------
//
// SIGNAL UNCONFIRMED UNTIL U5. Scope: the profile is (allow default) and denies only the
// securityd mach-lookup plus the Keychains files, so this probes keychain access, not general
// IPC. The probe asks `security find-generic-password` (inside Seatbelt only) for an item that
// does not exist:
// - "No keychain is available. You may need to restart your computer." (errSecNotAvailable,
//   -25291) is Security.framework's error when it cannot reach securityd at all, which is what
//   (deny mach-lookup (global-name "com.apple.SecurityServer")) should produce. Only this, with a
//   nonzero exit and no other keychain error in the output, counts as a denial.
// - "could not be found in the keychain" (errSecItemNotFound) or exit 0: securityd ANSWERED → fail.
// - Anything else, including -25307 "A default keychain could not be found" (a throwaway HOME
//   with no keychain looks like that), is inconclusive.

const ITEM_NOT_FOUND = /could not be found in the keychain/i;
const SECURITYD_UNAVAILABLE = /No keychain is available/;
const OTHER_KEYCHAIN_ERROR = /default keychain could not be found|-25307\b/i;

export const keychainService = (ctx: ProbeContext): string => `oac-probe-absent-${ctx.runId}`;

export function interpretKeychain(e: ProbeExec): Verdict {
  if (e.timedOut) return verdict("inconclusive", `keychain probe timed out (rc ${e.code})`);
  if (e.code === 0) return verdict("fail", "securityd answered inside the sandbox and returned an item");
  if (ITEM_NOT_FOUND.test(e.out)) return verdict("fail", `securityd answered inside the sandbox (item-not-found, rc ${e.code}): mach-lookup NOT denied`);
  if (SECURITYD_UNAVAILABLE.test(e.out) && !OTHER_KEYCHAIN_ERROR.test(e.out)) {
    return verdict("pass", `securityd unreachable inside the sandbox (errSecNotAvailable -25291, rc ${e.code}) [signal UNCONFIRMED until U5]`);
  }
  return verdict("inconclusive", `keychain probe ambiguous (rc ${e.code}): ${firstLine(e.out)}`);
}

// --- process-tree -----------------------------------------------------------------------

/** The grandchild PID the probe script printed, if it is a plausible user PID. */
export function grandchildPid(out: string): number | undefined {
  const m = /^grandchild=(\d+)$/m.exec(out);
  const pid = m ? Number(m[1]) : NaN;
  return Number.isSafeInteger(pid) && pid > 1 ? pid : undefined;
}

export function interpretProcessTree(e: ProbeExec, facts: ProbeFacts): Verdict {
  if (!e.timedOut) return verdict("inconclusive", `timeout did not fire (rc ${e.code}): the group kill was not exercised`);
  const pid = grandchildPid(e.out);
  if (pid === undefined) return verdict("inconclusive", "grandchild PID not reported");
  if (facts.grandchildGone === undefined) return verdict("inconclusive", `grandchild ${pid}: supervisor did not check the PID`);
  if (!facts.grandchildGone) return verdict("fail", `grandchild ${pid} SURVIVED the timeout group kill`);
  return verdict("pass", `timeout fired; grandchild ${pid} gone (ESRCH) after the group kill`);
}
