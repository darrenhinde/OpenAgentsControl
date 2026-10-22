#!/usr/bin/env bash
# repo-map — fast repository map (symbols per file) for agent context.
#
# Backends (auto-detected, best first):
#   ctags  — universal-ctags JSON output (~50 languages, C-fast)
#   grep   — regex heuristics via ripgrep/grep (no dependencies)
#
# Modes:
#   generate   print compact symbol map (default)
#   pick       fuzzy-pick an entry via fzf (non-TTY: print the top entry)
#   ensure-deps  install missing tooling via the detected package manager
#                (apt/dnf/pacman/zypper/emerge/apk/brew; winget/scoop hints on Windows)
#
# Flags: --root DIR  --top N  --out FILE  -h
set -uo pipefail

MODE=generate
ROOT=.
TOP=25
OUT=""

usage() {
  cat <<'H'
repo-map — fast repository map for agent context.

Usage:
  repo-map.sh generate [--root DIR] [--top N] [--out FILE]
  repo-map.sh pick     [--root DIR] [--top N]      # fzf layer
  repo-map.sh ensure-deps                          # install universal-ctags/fzf/ripgrep
H
}

while [ $# -gt 0 ]; do
  case "$1" in
    generate|pick|ensure-deps) MODE=$1; shift ;;
    --root) ROOT=${2:?'--root needs a value'}; shift 2 ;;
    --top) TOP=${2:?'--top needs a value'}; shift 2 ;;
    --out) OUT=${2:?'--out needs a value'}; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "repo-map: unknown argument: $1" >&2; exit 2 ;;
  esac
done

have() { command -v "$1" >/dev/null 2>&1; }

[ -d "$ROOT" ] || { echo "repo-map: not a directory: $ROOT" >&2; exit 2; }
ROOT=$(cd "$ROOT" && pwd)

# ── backend detection ────────────────────────────────────────────────
BACKEND=none
if have ctags && ctags --list-features 2>/dev/null | grep -q json; then
  BACKEND=ctags
elif have ctags; then
  BACKEND=ctags-nojson # e.g. bsd ctags: usable but no JSON — treat as grep-level
  BACKEND=grep
fi
[ "$BACKEND" = none ] && BACKEND=grep

# ── symbol extraction backends: emit `path<TAB>kind<TAB>name<TAB>line` ──
EXCLUDES=(--exclude=node_modules --exclude=.git --exclude=dist --exclude=.tmp --exclude=build --exclude=coverage --exclude=package-lock.json --exclude=yarn.lock --exclude=pnpm-lock.yaml --exclude='*.min.js' --exclude=.next)

emit_ctags() {
  ctags -R --output-format=json --fields=+n --extras=-F \
    --languages=-JSON,YAML,Markdown,Ini,Html,Css,Make,[\n]* \
    "${EXCLUDES[@]}" -f - "$ROOT" 2>/dev/null |
  python3 -c '
import json, sys
for raw in sys.stdin:
    try: tag = json.loads(raw)
    except Exception: continue
    if tag.get("_type") != "tag": continue
    path, name = tag.get("path",""), tag.get("name","")
    if not path or not name: continue
    kind = str(tag.get("kind","symbol")).replace("\t"," ")
    line = tag.get("line","")
    # Data files (JSON/YAML) yield primitive keys with no line — not useful symbols.
    if kind in ("string", "number", "boolean"): continue
    if not line or str(line) == "0": continue
    print(f"{path}\t{kind}\t{name}\t{line}")
'
}

emit_grep() {
  # ripgrep when present (fast), else grep -R. One heuristic pattern set for
  # the common symbol shapes of ts/js/py/go/rs/sh.
  local PATTERN='^[[:space:]]*(export[[:space:]]+)?(default[[:space:]]+)?(async[[:space:]]+)?(function[[:space:]]+[A-Za-z_$][A-Za-z0-9_$]*|class[[:space:]]+[A-Z][A-Za-z0-9_$]*|interface[[:space:]]+[A-Z][A-Za-z0-9_$]*|type[[:space:]]+[A-Z][A-Za-z0-9_$]*|(def|class)[[:space:]]+[A-Za-z_][A-Za-z0-9_]*|func[[:space:]]+([a-zA-Z_][A-Za-z0-9_]*|[[:space:]]*\([^)]*\)[[:space:]]*[a-zA-Z_][A-Za-z0-9_]*)|(fn|struct|enum|trait)[[:space:]]+[A-Z][A-Za-z0-9_]*)'
  local LISTWERK
  if have rg; then
    rg --no-heading --line-number -I -e "$PATTERN" "$ROOT" \
      --glob '!node_modules' --glob '!.git' --glob '!dist' --glob '!.tmp' --glob '!build' --glob '!coverage' 2>/dev/null
  else
    grep -RnE "$PATTERN" "$ROOT" \
      --include='*.ts' --include='*.js' --include='*.mjs' --include='*.py' --include='*.go' --include='*.rs' --include='*.sh' 2>/dev/null |
      grep -vE '/(node_modules|\.git|dist|\.tmp|build|coverage)/'
  fi | python3 -c '
import re, sys
for raw in sys.stdin:
    raw = raw.rstrip("\n")
    m = re.match(r"(.+?):([0-9]+):(.*)", raw)
    if not m: continue
    path, line, code = m.groups()
    code = code.strip()
    km = re.match(r"(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class|interface|type|def|func|fn|struct|enum|trait)\s+", code)
    if not km: continue
    kind = km.group(1)
    nm = re.search(r"(?:function|class|interface|type|def|func|fn|struct|enum|trait)\s+(?:\([^)]*\)\s*)?([A-Za-z_$][A-Za-z0-9_$]*)", code)
    if not nm: continue
    print(f"{path}\t{kind}\t{nm.group(1)}\t{line}")
'
}

# ── aggregation ──────────────────────────────────────────────────────
aggregate() {
  python3 -c '
import sys

top = int(sys.argv[1]) if len(sys.argv) > 1 else 25
files = {}
total_syms = 0
for raw in sys.stdin:
    parts = (raw.rstrip("\n").split("\t") + ["", "", ""])[:4]
    path, kind, name, line = parts
    if not path: continue
    f = files.setdefault(path, [])
    f.append((kind, name, line))
    total_syms += 1

ranked = sorted(files.items(), key=lambda kv: (-len(kv[1]), kv[0]))
shown = ranked[:top]
print(f"# repo-map files={len(files)} symbols={total_syms} shown={len(shown)}")
for path, syms in shown:
    print(f"{path} ({len(syms)} sym)")
    for kind, name, line in syms[:30]:
        print(f"  {kind} {name}:{line}")
    if len(syms) > 30:
        print(f"  … +{len(syms)-30} more")
' "$TOP"
}

render_map() {
  case "$BACKEND" in
    ctags) emit_ctags ;;
    grep)  emit_grep ;;
    *) echo "repo-map: no backend available" >&2; exit 3 ;;
  esac | aggregate
}

# Detect the system package manager (first match wins; brew last on purpose).
detect_pm() {
  local pm
  for pm in apt-get dnf pacman zypper emerge apk brew winget scoop; do
    have "$pm" && { echo "$pm"; return 0; }
  done
  return 1
}

# Map a generic tool name to the distro-specific package name.
pm_pkg() {
  case "$1:$2" in
    emerge:universal-ctags) echo "dev-util/universal-ctags" ;;
    emerge:fzf)             echo "app-shells/fzf" ;;
    emerge:ripgrep)         echo "sys-apps/ripgrep" ;;
    winget:universal-ctags) echo "universal-ctags.ctags" ;;
    *) echo "$2" ;;
  esac
}

pm_install_cmd() {
  local pm=$1; shift
  local pkgs=("$@")
  case "$pm" in
    apt-get) echo "apt-get install -y ${pkgs[*]}" ;;
    dnf)     echo "dnf install -y ${pkgs[*]}" ;;
    pacman)  echo "pacman -S --noconfirm ${pkgs[*]}" ;;
    zypper)  echo "zypper --non-interactive install ${pkgs[*]}" ;;
    apk)     echo "apk add ${pkgs[*]}" ;;
    emerge)  echo "emerge --ask=n ${pkgs[*]}" ;;
    brew)    echo "brew install ${pkgs[*]}" ;;
    winget)  echo "pwsh -c \"winget install --id ${pkgs[0]} -e\"" ;;
    scoop)   echo "scoop install ${pkgs[*]}" ;;
    *)       echo "install manually: ${pkgs[*]}" ;;
  esac
}

case "$MODE" in
  generate)
    MAP=$(render_map)
    if [ -n "$OUT" ]; then printf '%s\n' "$MAP" > "$OUT"; else printf '%s\n' "$MAP"; fi
    ;;

  pick)
    # fzf layer for humans/agents on a TTY; deterministic top-entry otherwise.
    MAP=$(render_map)
    if have fzf && [ -t 0 ]; then
      printf '%s\n' "$MAP" | fzf --height=80% --reverse \
        --prompt='repo-map> ' \
        --preview-window=right:60% \
        --preview 'line=$(sed -n "s/^[[:space:]]*[a-z]+ [^:]*:\([0-9][0-9]*\)$/\1/p" <<< {} | head -1); file=$(cut -d" " -f1 <<< {}); [ -n "$line" ] && sed -n "$((line>3?line-3:1)),+12p" "$file" || sed -n "1,15p" "$file"'
    else
      # first symbol line of the top file: `  kind name:line`
      top_entry=$(printf '%s\n' "$MAP" | grep -m1 -E '^  [a-zA-Z]+ ')
      [ -n "$top_entry" ] || { echo "repo-map: no symbols found" >&2; exit 3; }
      line=$(printf '%s' "$top_entry" | sed -E 's/.*:([0-9]+)$/\1/')
      file=$(printf '%s\n' "$MAP" | sed -n '2p' | cut -d' ' -f1)
      echo "$file:$line"
    fi
    ;;

  ensure-deps)
    MISSING=()
    { [ "$BACKEND" = ctags ] || have ctags; } || MISSING+=(universal-ctags)
    have fzf || MISSING+=(fzf)
    have rg || MISSING+=(ripgrep)
    if [ "${#MISSING[@]}" -eq 0 ]; then
      echo "repo-map: all dependencies present (ctags json backend: $([ "$BACKEND" = ctags ] && echo yes || echo no))"
      exit 0
    fi
    echo "repo-map: missing: ${MISSING[*]}"
    if PM=$(detect_pm); then
      PKGS=()
      for m in "${MISSING[@]}"; do PKGS+=("$(pm_pkg "$PM" "$m")"); done
      CMD=$(pm_install_cmd "$PM" "${PKGS[@]}")
      if [ "$PM" = "brew" ] || [ "$PM" = "scoop" ]; then
        echo "repo-map: run: $CMD"
      elif [ "$(id -u)" = "0" ]; then
        echo "repo-map: installing via $PM: $CMD"
        sh -c "$CMD" && exit 0
      elif [ "$PM" = "apt-get" ] || [ "$PM" = "dnf" ] || [ "$PM" = "pacman" ] || [ "$PM" = "zypper" ] || [ "$PM" = "apk" ] || [ "$PM" = "emerge" ]; then
        echo "repo-map: run: sudo $CMD"
      else
        echo "repo-map: run: $CMD"
      fi
    else
      echo "repo-map: no supported package manager found — install manually: ${MISSING[*]}"
    fi
    # Exit 0 only when the semantic backend is actually usable.
    [ "$BACKEND" = ctags ] && exit 0 || exit 1
    ;;
esac
