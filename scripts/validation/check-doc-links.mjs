// Dead relative-link finder for the top-level docs. Run through check-doc-links.sh.
import fs from "node:fs";
import path from "node:path";

const files = ["README.md", "docs/contributing/CONTRIBUTING.md", "docs/README.md", "agent-library/README.md"].filter((f) =>
  fs.existsSync(f),
);
// Shipped guidance: the architecture docs, the end-user guides, the Claude plugin README and the
// authoring context for contributors. Dated history and maintenance notes are not scanned.
files.push("plugins/claude-code/README.md");
const walkMd = (dir, deep) => {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isFile() && e.name.endsWith(".md")) files.push(p);
    else if (e.isDirectory() && deep && e.name !== "node_modules") walkMd(p, deep);
  }
};
walkMd("docs/architecture", false);
walkMd("docs/guides", true);
walkMd("agent-library/context/openagents-repo", true);

const dead = [];
for (const file of files) {
  let fence = false;
  fs.readFileSync(file, "utf8")
    .split("\n")
    .forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) {
        fence = !fence;
        return;
      }
      if (fence) return;
      const text = line.replace(/`[^`]*`/g, "");
      for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
        if (/^([a-z][a-z0-9+.-]*:|#)/i.test(m[1])) continue;
        const target = decodeURIComponent(m[1].split("#")[0]);
        if (!target) continue;
        const resolved = target.startsWith("/") ? target.slice(1) : path.join(path.dirname(file), target);
        if (!fs.existsSync(resolved)) dead.push(`${file}:${i + 1}: ${m[1]}`);
      }
    });
}
console.log(dead.join("\n"));
