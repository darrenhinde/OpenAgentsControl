/**
 * Tests for scripts/development/repo-map.sh
 *
 * Runs the real script (bash) against temp fixtures. Host assumes no
 * universal-ctags -> grep backend path; assertions cover backend output
 * shape, --top, --out, non-interactive pick, ensure-deps hinting, arg errors.
 *
 * Run: npx -y bun test scripts/development/repo-map.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SCRIPT = path.resolve(import.meta.dir, "repo-map.sh");

let fixture: string;

const runScript = (args: string[]) =>
  spawnSync("bash", [SCRIPT, ...args], { encoding: "utf-8", cwd: fixture });

beforeAll(() => {
  fixture = fs.mkdtempSync(path.join(os.tmpdir(), "repo-map-"));
  fs.mkdirSync(path.join(fixture, "src"), { recursive: true });
  fs.mkdirSync(path.join(fixture, "node_modules"), { recursive: true });
  fs.writeFileSync(
    path.join(fixture, "src", "auth.ts"),
    'export function login() {\n  return 1;\n}\nexport class AuthService {\n}\nexport interface User {\n}\n',
  );
  fs.writeFileSync(
    path.join(fixture, "app.py"),
    'def handler():\n    pass\n\nclass Model:\n    pass\n',
  );
  fs.writeFileSync(
    path.join(fixture, "node_modules", "skip.ts"),
    'export function nope() {\n}\n',
  );
  fs.writeFileSync(path.join(fixture, "readme.md"), "# no symbols here\n");
});

afterAll(() => {
  fs.rmSync(fixture, { recursive: true, force: true });
});

describe("repo-map generate (grep backend)", () => {
  it("prints a ranked map with header and matched symbols", () => {
    const proc = runScript(["generate", "--root", fixture]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toMatch(/^# repo-map files=\d+ symbols=\d+ shown=\d+$/m);
    expect(proc.stdout).toContain("src/auth.ts");
    expect(proc.stdout).toContain("function login:");
    expect(proc.stdout).toContain("class AuthService:");
    expect(proc.stdout).toContain("def handler:");
    // excluded / non-code files must not leak in
    expect(proc.stdout).not.toContain("node_modules");
    expect(proc.stdout).not.toContain("nope");
    expect(proc.stdout).not.toContain("readme.md");
  });

  it("ranks files by symbol count (auth.ts before app.py)", () => {
    const proc = runScript(["generate", "--root", fixture]);
    expect(proc.stdout.indexOf("src/auth.ts")).toBeLessThan(
      proc.stdout.indexOf("app.py"),
    );
  });

  it("honors --top", () => {
    const proc = runScript(["generate", "--root", fixture, "--top", "1"]);
    expect(proc.stdout).toMatch(/shown=1$/m);
    expect(proc.stdout).toContain("src/auth.ts");
    expect(proc.stdout).not.toContain("app.py");
  });

  it("writes --out file instead of stdout", () => {
    const out = path.join(fixture, "map.txt");
    const proc = runScript(["generate", "--root", fixture, "--out", out]);
    expect(proc.status).toBe(0);
    expect(proc.stdout).toBe("");
    const content = fs.readFileSync(out, "utf-8");
    expect(content).toMatch(/^# repo-map files=/m);
    expect(content).toContain("login");
  });

  it("rejects unknown arguments with exit 2", () => {
    const proc = runScript(["--wat"]);
    expect(proc.status).toBe(2);
  });
});

describe("repo-map pick (non-TTY)", () => {
  it("prints the deterministic top entry as file:line", () => {
    const proc = runScript(["pick", "--root", fixture]);
    expect(proc.status).toBe(0);
    const out = proc.stdout.trim();
    expect(out).toMatch(/src\/auth\.ts:\d+$/);
    expect(out.endsWith(":1")).toBe(true); // first symbol line of the top file
  });
});

describe("repo-map ensure-deps (no ctags on PATH)", () => {
  it("reports missing tools and exits non-zero without installing", () => {
    const proc = runScript(["ensure-deps"]);
    expect(proc.status).not.toBe(0);
    expect(proc.stdout).toContain("universal-ctags");
    expect(proc.stdout).toMatch(/sudo apt-get|brew install|install manually/);
  });
});

describe("repo-map ensure-deps: multi-distro package managers", () => {
  it("prints the distro-specific install command for each detected PM", () => {
    for (const [pm, expected] of [
      ["apt-get", "sudo apt-get install -y universal-ctags fzf ripgrep"],
      ["dnf", "sudo dnf install -y universal-ctags fzf ripgrep"],
      ["pacman", "sudo pacman -S --noconfirm universal-ctags fzf ripgrep"],
      ["zypper", "sudo zypper --non-interactive install universal-ctags fzf ripgrep"],
      ["apk", "sudo apk add universal-ctags fzf ripgrep"],
      ["emerge", "sudo emerge --ask=n dev-util/universal-ctags app-shells/fzf sys-apps/ripgrep"],
      ["brew", "brew install universal-ctags fzf ripgrep"],
      ["winget", 'pwsh -c "winget install --id universal-ctags.ctags -e"'],
      ["scoop", "scoop install universal-ctags fzf ripgrep"],
    ] as const) {
      const stub = fs.mkdtempSync(path.join(os.tmpdir(), "oac-pm-"));
      // Core utils: symlink the real host binaries; the PM itself: a synthetic
      // executable stub (detection only needs `command -v` to succeed).
      for (const tool of ["sh", "bash", "id", "grep", "sort", "awk", "sed", "head", "find", "printf", "cat", "wc", "tr", "uname", "dirname"]) {
        const src = ["/usr/bin/" + tool, "/bin/" + tool].find((p) => fs.existsSync(p));
        if (src) fs.symlinkSync(src, path.join(stub, tool));
      }
      fs.writeFileSync(path.join(stub, pm), "#!/bin/sh\nexit 0\n");
      fs.chmodSync(path.join(stub, pm), 0o755);
      const proc = spawnSync("/bin/bash", [SCRIPT, "ensure-deps"], {
        encoding: "utf-8",
        env: { ...process.env, PATH: stub },
      });
      expect(proc.stdout).toContain(expected);
      fs.rmSync(stub, { recursive: true, force: true });
    }
  });
});

describe("repo-map error handling", () => {
  it("fails cleanly on a missing root", () => {
    const proc = runScript(["generate", "--root", path.join(fixture, "nope")]);
    expect(proc.status).toBe(2);
    expect(proc.stderr).toContain("not a directory");
  });
});
