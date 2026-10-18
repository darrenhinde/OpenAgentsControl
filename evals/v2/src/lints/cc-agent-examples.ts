// Claude Code dispatches subagents from their description; the shipped agents carried
// <example> blocks for that, and 104356a dropped most of them.
export function lintCcAgentExamples(files: { name: string; text: string }[]): { total: number; withExamples: number; missing: string[] } {
  const missing = files.filter((f) => !/<example>/.test(f.text)).map((f) => f.name);
  return { total: files.length, withExamples: files.length - missing.length, missing };
}
