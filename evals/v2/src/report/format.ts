export function fmtMs(ms: number): string {
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m${String(s).padStart(2, "0")}s`;
}
export const pad = (s: string, n: number): string => (s.length >= n ? s + " " : s + " ".repeat(n - s.length));
export const lpad = (s: string, n: number): string => (s.length >= n ? s : " ".repeat(n - s.length) + s);
