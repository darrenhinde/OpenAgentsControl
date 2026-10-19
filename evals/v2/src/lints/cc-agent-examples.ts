// Claude Code dispatches subagents from their description, so every shipped Claude agent
// carries <example> blocks. 104356a dropped them; on main only 3 of the 7 ever had them.
export function lintCcAgentExamples(files: { name: string; text: string }[]): { total: number; withExamples: number; missing: string[] } {
  const missing = files.filter((f) => !/<example>/.test(f.text)).map((f) => f.name);
  return { total: files.length, withExamples: files.length - missing.length, missing };
}
