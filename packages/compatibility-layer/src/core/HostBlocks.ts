/**
 * HostBlocks — keep or drop host-specific blocks of a canonical body per build target.
 *
 * A canonical agent body is shared by every host. Where a passage only makes sense on some
 * hosts it is fenced with a pair of HTML comments:
 *
 *     <!-- oac:only claude-code -->
 *     Text only Claude Code sees.
 *     <!-- /oac:only -->
 *
 * Grammar (each marker must be alone on its line; leading/trailing spaces or tabs are allowed):
 *
 *     open   := "<!--" WS* "oac:only" WS+ target (WS* "," WS* target)* WS* "-->"
 *     close  := "<!--" WS* "/oac:only" WS* "-->"
 *     target := [a-z0-9-]+          (must be one of the known build targets)
 *
 * Any other line that contains `<!-- oac:only` or `<!-- /oac:only` (an inline marker, a missing
 * target list, a trailing word) is a malformed marker and throws, so a typo can never silently
 * leak one host's text into another. Blocks do not nest. Markers are recognised everywhere in the
 * body, fenced code included.
 *
 * Newline handling — line-based, with the original line terminators (`\n` or `\r\n`) preserved:
 *
 *   - A body that contains no marker is returned unchanged (the same string, byte-identical).
 *   - Target listed: the two marker lines (with their terminators) are removed; the content
 *     between them is kept verbatim.
 *   - Target not listed: every line from the open marker through the close marker is removed.
 *   - After each removed span (a single marker line, or a whole dropped block) one blank line is
 *     collapsed so no stray blank line is left behind:
 *       * if the nearest kept line before the span is blank (or the span starts the body) and the
 *         nearest kept line after it is blank, that following blank line is removed;
 *       * if the span ends the body and the nearest kept line before it is blank, that preceding
 *         blank line is removed.
 *     So a block written as its own paragraph (blank line before and after, content tight against
 *     or separated by blank lines from the markers) leaves exactly one blank line between the
 *     surrounding paragraphs whether it is kept or dropped.
 *   - If the original last line had no terminator and it was removed, the terminator is stripped
 *     from the new last line so the output's final-newline state matches the input's.
 *
 * Pure: no I/O, no clock, no ambient state. Idempotent on its own output (which has no markers).
 */

import { BuildTargetSchema } from "../types.js";

/** The build targets a marker may name. Single source: the canonical `BuildTargetSchema`. */
export const HOST_BLOCK_TARGETS: readonly string[] = BuildTargetSchema.options;

/** A malformed, unbalanced or unknown-target `oac:only` marker. */
export class HostBlocksError extends Error {
  constructor(
    message: string,
    readonly file: string | undefined,
    readonly line: number | undefined,
  ) {
    const where = file === undefined ? (line === undefined ? "" : `line ${line}: `) : `${file}${line === undefined ? "" : `:${line}`}: `;
    super(`${where}${message}`);
    this.name = "HostBlocksError";
  }
}

export interface FilterHostBlocksOptions {
  /** Targets a marker may name. Defaults to {@link HOST_BLOCK_TARGETS}. */
  knownTargets?: readonly string[];
  /** Source path used in error messages. */
  file?: string;
  /**
   * Lines of the source file that precede `body` (e.g. its frontmatter), added to every line
   * number reported in an error so it points into the file, not into the body. Defaults to 0.
   */
  lineOffset?: number;
}

const ANY_MARKER = /<!--\s*\/?oac:only\b/;
const OPEN = /^[ \t]*<!--[ \t]*oac:only[ \t]+([a-z0-9-]+(?:[ \t]*,[ \t]*[a-z0-9-]+)*)[ \t]*-->[ \t]*$/;
const CLOSE = /^[ \t]*<!--[ \t]*\/oac:only[ \t]*-->[ \t]*$/;
const BLANK = /^[ \t]*$/;
const TERMINATOR = /\r?\n$/;

const contentOf = (line: string): string => line.replace(TERMINATOR, "");

/**
 * Return `body` with every `oac:only` block resolved for `target`.
 *
 * @throws {HostBlocksError} on an unknown `target`, a malformed marker, a marker naming an
 * unknown target, a nested open, a close without an open, or an open never closed.
 */
export function filterHostBlocks(
  body: string,
  target: string,
  options: FilterHostBlocksOptions = {},
): string {
  const known = options.knownTargets ?? HOST_BLOCK_TARGETS;
  const { file } = options;
  const offset = options.lineOffset ?? 0;
  if (!known.includes(target)) {
    throw new HostBlocksError(
      `unknown build target "${target}" (known: ${known.join(", ")})`,
      file,
      undefined,
    );
  }
  if (!ANY_MARKER.test(body)) return body;

  const lines = body.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  const spans: Array<[number, number]> = [];
  let open: { index: number; keep: boolean } | undefined;

  lines.forEach((raw, index) => {
    const text = contentOf(raw);
    if (!ANY_MARKER.test(text)) return;
    const lineNo = offset + index + 1;
    const opened = OPEN.exec(text);
    if (opened) {
      if (open !== undefined) {
        throw new HostBlocksError(
          `nested "oac:only" block (the block opened on line ${offset + open.index + 1} is still open)`,
          file,
          lineNo,
        );
      }
      const targets = opened[1]!.split(",").map((t) => t.trim());
      for (const t of targets) {
        if (!known.includes(t)) {
          throw new HostBlocksError(
            `unknown target "${t}" in oac:only marker (known: ${known.join(", ")})`,
            file,
            lineNo,
          );
        }
      }
      open = { index, keep: targets.includes(target) };
      return;
    }
    if (CLOSE.test(text)) {
      if (open === undefined) {
        throw new HostBlocksError(`"/oac:only" without a matching "oac:only"`, file, lineNo);
      }
      if (open.keep) spans.push([open.index, open.index], [index, index]);
      else spans.push([open.index, index]);
      open = undefined;
      return;
    }
    throw new HostBlocksError(
      `malformed oac:only marker "${text.trim()}" (expected "<!-- oac:only <target>[,<target>] -->" or "<!-- /oac:only -->" alone on a line)`,
      file,
      lineNo,
    );
  });

  if (open !== undefined) {
    throw new HostBlocksError(`"oac:only" block is never closed`, file, offset + open.index + 1);
  }

  const kept = lines.map(() => true);
  for (const [s, e] of spans) for (let i = s; i <= e; i += 1) kept[i] = false;

  const isBlank = (i: number): boolean => BLANK.test(contentOf(lines[i]!));
  const prevKept = (i: number): number => {
    for (let j = i - 1; j >= 0; j -= 1) if (kept[j]) return j;
    return -1;
  };
  const nextKept = (i: number): number => {
    for (let j = i + 1; j < lines.length; j += 1) if (kept[j]) return j;
    return -1;
  };

  for (const [s, e] of spans) {
    const prev = prevKept(s);
    const next = nextKept(e);
    if (next === -1) {
      if (prev !== -1 && isBlank(prev)) kept[prev] = false;
    } else if ((prev === -1 || isBlank(prev)) && isBlank(next)) {
      kept[next] = false;
    }
  }

  const out = lines.filter((_, i) => kept[i]);
  const lastRaw = lines[lines.length - 1]!;
  if (out.length > 0 && !TERMINATOR.test(lastRaw) && !kept[lines.length - 1]) {
    out[out.length - 1] = contentOf(out[out.length - 1]!);
  }
  return out.join("");
}
