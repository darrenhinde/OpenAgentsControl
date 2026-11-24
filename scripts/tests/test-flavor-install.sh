#!/usr/bin/env bash
#
# Offline tests for the OpenCode v2 / v1 flavors of install.sh and update.sh.
#
# Nothing here touches the network or runs a real `opencode`: components are fetched from this
# checkout through OAC_RAW_URL=file://..., and OAC_OPENCODE_VERSION stands in for
# `opencode --version`. Every install goes to a throwaway directory.

set -u

GREEN='\033[0;32m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/oac-flavor-install.XXXXXX")"
PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✓${NC} $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAILED=$((FAILED + 1)); }

# shellcheck disable=SC2329
cleanup() { rm -rf "$TEST_DIR"; }
trap cleanup EXIT

export OAC_RAW_URL="file://$REPO_ROOT"
export OAC_OPENCODE_VERSION=none

install() {
    # install.sh <args...>; runs from the repo root so it finds ./registry*.json
    (cd "$REPO_ROOT" && bash install.sh "$@")
}

assert_file()    { [ -f "$1" ] && pass "$2" || fail "$2 (missing: $1)"; }
assert_no_file() { [ ! -e "$1" ] && pass "$2" || fail "$2 (unexpected: $1)"; }
assert_contains() { grep -q -- "$2" "$1" 2>/dev/null && pass "$3" || fail "$3 ($1 lacks: $2)"; }

echo -e "\n${BOLD}install.sh${NC}"

# --- default is v2 -----------------------------------------------------------
D="$TEST_DIR/default/.opencode"
install full --install-dir="$D" > "$TEST_DIR/default.log" 2>&1
assert_file    "$D/agent/openagent.md"                  "default install is v2: flat agent"
assert_no_file "$D/agent/core"                          "default install has no nested v1 agents"
assert_no_file "$D/tool"                                "default install has no v1 tools"
assert_no_file "$D/plugin"                              "default install has no v1 plugins"
assert_no_file "$D/agent/image-specialist.md"           "default install omits the v1-only agent"
assert_contains "$D/.oac-opencode" "v2"                 "default install records v2"
if grep -q 'subagent_type' "$D/agent/openagent.md"; then fail "v2 agent speaks v1 delegation"; else pass "v2 agent speaks v2 delegation"; fi

# --- v1 is an explicit opt-in --------------------------------------------------
V="$TEST_DIR/v1/.opencode"
install full --opencode v1 --install-dir="$V" > "$TEST_DIR/v1.log" 2>&1
assert_file    "$V/agent/core/openagent.md"             "--opencode v1 installs nested agents"
assert_contains "$V/agent/core/openagent.md" "^name: OpenAgent" "v1 agent keeps its name: line"
assert_file    "$V/agent/content/image-specialist.md" "v1 installs the v1-only agent"
assert_file    "$V/tool/gemini/index.ts"                "v1 installs tools"
assert_file    "$V/plugin/notify.ts"                    "v1 installs plugins"
assert_file    "$V/skills/task-management/SKILL.md"     "v1 installs skills"
assert_file    "$V/command/openagents/check-context-deps.md" "v1 installs commands"
assert_no_file "$V/agent/openagent.md"                  "v1 installs no flat v2 agent"
assert_no_file "$TEST_DIR/v1/built-ai-configs"          "the built-ai-configs/ folder name never reaches a project"
assert_no_file "$V/built-ai-configs"                    "the v1 build's built-ai-configs/opencode-v1 prefix is stripped on install"
assert_contains "$V/.oac-opencode" "v1"                 "v1 install records v1"
assert_contains "$V/command/openagents/check-context-deps.md" "subagent_type" "v1 gets the v1 variant of the command"

# --- environment variable, bad value, host mismatch ------------------------------
E="$TEST_DIR/env/.opencode"
OAC_OPENCODE=v1 install essential --install-dir="$E" > "$TEST_DIR/env.log" 2>&1
assert_file "$E/agent/core/openagent.md" "OAC_OPENCODE=v1 selects v1"

if install essential --opencode v3 --install-dir="$TEST_DIR/bad/.opencode" > "$TEST_DIR/bad.log" 2>&1; then
    fail "an unknown flavor is rejected"
else
    pass "an unknown flavor is rejected"
fi
assert_contains "$TEST_DIR/bad.log" "v1 or v2" "the rejection says what is valid"

OAC_OPENCODE_VERSION=1.19.3 install essential --install-dir="$TEST_DIR/mm/.opencode" > "$TEST_DIR/mm.log" 2>&1
assert_contains "$TEST_DIR/mm.log" "--opencode v1" "v2 on a v1 host warns and names the opt-in"
assert_file "$TEST_DIR/mm/.opencode/agent/openagent.md" "...but still installs v2 (never auto-selects v1)"

# --- listing follows the flavor --------------------------------------------------
install list > "$TEST_DIR/list2.log" 2>&1
install list --opencode v1 > "$TEST_DIR/list1.log" 2>&1
if grep -q 'gemini' "$TEST_DIR/list2.log"; then fail "v2 listing offers a v1-only tool"; else pass "v2 listing omits v1-only tools"; fi
assert_contains "$TEST_DIR/list1.log" "gemini" "v1 listing offers the tool"

# --- legacy nested agents are flagged, not deleted -------------------------------
L="$TEST_DIR/legacy/.opencode"
mkdir -p "$L/agent/core"
echo "old" > "$L/agent/core/openagent.md"
install essential --install-dir="$L" > "$TEST_DIR/legacy.log" 2>&1
assert_contains "$TEST_DIR/legacy.log" "oac update --opencode v2" "v2 install over nested agents says how to migrate"
assert_file "$L/agent/core/openagent.md" "...and does not delete the user's files"

echo -e "\n${BOLD}update.sh${NC}"

# v1 update pulls the v1 build of a file
echo "stale" > "$V/agent/core/openagent.md"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$V") > "$TEST_DIR/upd1.log" 2>&1
assert_contains "$V/agent/core/openagent.md" "^name: OpenAgent" "update.sh keeps a v1 install on v1 (reads the marker)"

# v2 update pulls the flat v2 build
echo "stale" > "$D/agent/openagent.md"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$D") > "$TEST_DIR/upd2.log" 2>&1
if grep -q "stale" "$D/agent/openagent.md"; then fail "update.sh refreshes a v2 file"; else pass "update.sh refreshes a v2 file"; fi
assert_no_file "$D/agent/core" "update.sh on v2 does not create nested agents"

# a file the update replaces keeps its old copy (an edit must never be discarded unsaved)
KEPT=$(ls -d "$D".backup.*/agent/openagent.md 2>/dev/null | head -1)
if [ -n "$KEPT" ] && grep -q "^stale$" "$KEPT"; then
    pass "update.sh saves the replaced copy of a changed file in <install dir>.backup.<time>/"
else
    fail "update.sh saves the replaced copy of a changed file in <install dir>.backup.<time>/"
fi
assert_contains "$TEST_DIR/upd2.log" "old copy saved in" "...and says where the old copy went"

# a file already identical to upstream is left alone and produces no backup of its own
rm -rf "$D".backup.*
(cd "$REPO_ROOT" && bash update.sh --install-dir "$D") > "$TEST_DIR/upd2b.log" 2>&1
if ls -d "$D".backup.* > /dev/null 2>&1; then
    fail "update.sh makes no backup when nothing changed"
else
    pass "update.sh makes no backup when nothing changed"
fi

# an install with no marker and nested agents is refused, not guessed
rm -f "$V/.oac-opencode"
if (cd "$REPO_ROOT" && bash update.sh --install-dir "$V") > "$TEST_DIR/upd3.log" 2>&1; then
    fail "update.sh refuses an install of unknown OpenCode version"
else
    pass "update.sh refuses an install of unknown OpenCode version"
fi
assert_contains "$TEST_DIR/upd3.log" "--opencode v1" "...and says how to proceed"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$V" --opencode v1) > "$TEST_DIR/upd4.log" 2>&1 \
    && pass "--opencode v1 updates an unrecorded v1 install" || fail "--opencode v1 updates an unrecorded v1 install"

# --- markers: update.sh records the flavor; install.sh records it on an all-skipped re-run -----
echo -e "\n${BOLD}flavor marker${NC}"

# legacy v1 install (nested agents, no marker): --opencode v1 must leave a marker so a plain update works next
G="$TEST_DIR/legacy-rec/.opencode"
install essential --opencode v1 --install-dir="$G" > "$TEST_DIR/g1.log" 2>&1
rm -f "$G/.oac-opencode"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$G" --opencode v1) > "$TEST_DIR/g2.log" 2>&1
assert_contains "$G/.oac-opencode" "v1" "update.sh --opencode v1 records v1 on a legacy install"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$G") > "$TEST_DIR/g3.log" 2>&1 \
    && pass "the next plain update is not refused" || fail "the next plain update is not refused"

# --opencode v2 on a v1 install: refused clearly, non-zero, no success message, marker unchanged, files untouched
echo "keep" > "$G/agent/core/openagent.md"
if (cd "$REPO_ROOT" && bash update.sh --install-dir "$G" --opencode v2) > "$TEST_DIR/g4.log" 2>&1; then
    fail "update.sh --opencode v2 on a v1 install exits non-zero"
else
    pass "update.sh --opencode v2 on a v1 install exits non-zero"
fi
if grep -q "Update complete" "$TEST_DIR/g4.log"; then fail "...and prints no success"; else pass "...and prints no success"; fi
assert_contains "$TEST_DIR/g4.log" "oac update --opencode v2" "...and names the tool that migrates"
assert_contains "$G/.oac-opencode" "v1" "...and leaves the marker on v1"
assert_contains "$G/agent/core/openagent.md" "keep" "...and leaves the files alone"

# update.sh on a fresh v2 install with no marker records v2
rm -f "$D/.oac-opencode"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$D") > "$TEST_DIR/g5.log" 2>&1
assert_contains "$D/.oac-opencode" "v2" "update.sh records v2 when it decides v2"

# install.sh re-run where every file is skipped still writes the marker
rm -f "$D/.oac-opencode"
install essential --install-dir="$D" > "$TEST_DIR/g6.log" 2>&1
assert_contains "$TEST_DIR/g6.log" "Skipped" "second install skipped everything"
assert_contains "$D/.oac-opencode" "v2" "install.sh writes the marker even when every file was skipped"

# ...but a run that wrote nothing does not flip a marker of the other flavor
echo v1 > "$D/.oac-opencode"
install essential --install-dir="$D" > "$TEST_DIR/g7.log" 2>&1
assert_contains "$D/.oac-opencode" "v1" "an install that wrote nothing does not flip the recorded flavor"

# --- the other flavor over an existing install is refused ----------------------------------------
echo -e "\n${BOLD}flavor switch${NC}"
if install essential --opencode v2 --install-dir="$V" > "$TEST_DIR/sw.log" 2>&1; then
    fail "install.sh --opencode v2 over a v1 install exits non-zero"
else
    pass "install.sh --opencode v2 over a v1 install exits non-zero"
fi
assert_contains "$TEST_DIR/sw.log" "oac update --opencode v2" "...and names the tool that migrates"
assert_contains "$V/.oac-opencode" "v1"                       "...and leaves the marker on v1"
assert_no_file  "$V/agent/openagent.md"                       "...and adds no flat v2 agent"
install essential --opencode v1 --install-dir="$V" > "$TEST_DIR/sw2.log" 2>&1 \
    && pass "a same-flavor re-run still works" || fail "a same-flavor re-run still works"

# --- a partly failed install still records the flavor ----------------------------------------------
PART="$TEST_DIR/part"
mkdir -p "$PART/pkg/built-ai-configs/registry" "$PART/pkg/.opencode/agent"
echo "ok" > "$PART/pkg/.opencode/agent/good.md"
cat > "$PART/pkg/built-ai-configs/registry/registry.json" <<'JSON'
{"version":"1.0.0","components":{"agents":[
 {"id":"good","name":"good","type":"agent","path":".opencode/agent/good.md","description":"x","tags":[],"dependencies":[],"category":"core"},
 {"id":"gone","name":"gone","type":"agent","path":".opencode/agent/gone.md","description":"x","tags":[],"dependencies":[],"category":"core"}
],"subagents":[],"commands":[],"tools":[],"plugins":[],"contexts":[],"skills":[],"config":[]},
"profiles":{"essential":{"name":"e","description":"e","components":["agent:good","agent:gone"]}}}
JSON
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$PART/pkg" REGISTRY_URL="file://$PART/pkg/built-ai-configs/registry/registry.json" bash install.sh essential --install-dir="$PART/proj/.opencode") > "$PART/log" 2>&1
assert_contains "$PART/log" "Failed" "one component failed"
assert_contains "$PART/proj/.opencode/.oac-opencode" "v2" "...but the marker is written because a file was installed"

# --- agents renamed or moved by a release: the old copy is retired, never duplicated -------------
echo -e "\n${BOLD}superseded agents${NC}"

assert_no_dir() { [ ! -d "$1" ] && pass "$2" || fail "$2 (unexpected dir: $1)"; }
count_backups() { ls -d "$1".backup.* 2>/dev/null | wc -l | tr -d ' '; }

# v2, install.sh: an old install left tester.md / contextscout.md next to the new files.
SD="$TEST_DIR/sup2/.opencode"
install full --install-dir="$SD" > "$TEST_DIR/sup2a.log" 2>&1
cp "$SD/agent/test-engineer.md" "$SD/agent/tester.md"
{ cat "$SD/agent/context-scout.md"; echo "MY EDIT"; } > "$SD/agent/contextscout.md"
printf -- '---\ndescription: my team reviewer, nothing to do with OAC\nmode: subagent\n---\nmine\n' > "$SD/agent/reviewer.md"
printf -- '---\ndescription: mine\nmode: subagent\n---\nmine\n' > "$SD/agent/my-own.md"
install full --install-dir="$SD" > "$TEST_DIR/sup2b.log" 2>&1
assert_no_file "$SD/agent/tester.md"        "install.sh removes the superseded tester.md"
assert_no_file "$SD/agent/contextscout.md"  "install.sh removes the superseded contextscout.md (even when edited)"
assert_file    "$SD/agent/test-engineer.md" "...the replacement stays"
assert_file    "$SD/agent/reviewer.md"      "install.sh leaves a user's own agent that shares an old id"
assert_contains "$TEST_DIR/sup2b.log" "Left .*reviewer.md" "...and says so"
assert_file    "$SD/agent/my-own.md"        "install.sh leaves custom agents alone"
BK=$(ls -d "$SD".backup.* 2>/dev/null | head -n 1)
assert_contains "$BK/agent/contextscout.md" "MY EDIT" "the edited file is backed up before removal"
assert_file    "$BK/agent/tester.md"        "every removed file is backed up"
N1=$(count_backups "$SD")
install full --install-dir="$SD" > "$TEST_DIR/sup2c.log" 2>&1
[ "$(count_backups "$SD")" = "$N1" ] && pass "a second install.sh run retires nothing more (idempotent)" || fail "a second install.sh run retires nothing more (idempotent)"

# v2, update.sh: an old install (no doc-writer.md yet); the update installs the replacement.
cp "$SD/agent/doc-writer.md" "$SD/agent/documentation.md"
rm -f "$SD/agent/doc-writer.md"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$SD") > "$TEST_DIR/sup2d.log" 2>&1
assert_file    "$SD/agent/doc-writer.md"    "update.sh installs the replacement of a renamed agent"
assert_no_file "$SD/agent/documentation.md" "update.sh removes the superseded documentation.md"
assert_file    "$SD/agent/reviewer.md"      "update.sh leaves the user's own agent"
assert_file    "$SD/agent/my-own.md"        "update.sh leaves custom agents alone"
assert_contains "$TEST_DIR/sup2d.log" "old copy saved in" "update.sh says where the backup went"

# v1: subagents moved from agent/subagents/<category>/ to agent/<category>/.
SV="$TEST_DIR/sup1/.opencode"
install full --opencode v1 --install-dir="$SV" > "$TEST_DIR/sup1a.log" 2>&1
mkdir -p "$SV/agent/subagents/core" "$SV/agent/subagents/development"
cp "$SV/agent/core/context-scout.md" "$SV/agent/subagents/core/contextscout.md"
cp "$SV/agent/dev/devops-specialist.md" "$SV/agent/subagents/development/devops-specialist.md"
echo '{"name":"development"}' > "$SV/agent/subagents/development/0-category.json"
printf -- '---\ndescription: mine\nmode: subagent\n---\nmine\n' > "$SV/agent/subagents/core/mine.md"
install full --opencode v1 --install-dir="$SV" > "$TEST_DIR/sup1b.log" 2>&1
assert_no_file "$SV/agent/subagents/core/contextscout.md"               "v1: install.sh removes the old-layout copy of a renamed subagent"
assert_no_file "$SV/agent/subagents/development/devops-specialist.md"   "v1: install.sh removes the old-layout copy of a moved subagent"
assert_no_dir  "$SV/agent/subagents/development"                        "v1: ...and the emptied folder (with its category marker)"
assert_file    "$SV/agent/subagents/core/mine.md"                       "v1: a user's own file in agent/subagents/ is kept"
assert_contains "$TEST_DIR/sup1b.log" "agent/subagents" "v1: the leftover old-layout folder is named in a warning"
assert_file    "$SV/agent/core/context-scout.md"                        "v1: the replacement stays"

rm -f "$SV/agent/core/task-manager.md"
mkdir -p "$SV/agent/subagents/core"
cp "$REPO_ROOT/built-ai-configs/opencode-v1/agent/core/task-manager.md" "$SV/agent/subagents/core/task-manager.md"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$SV") > "$TEST_DIR/sup1c.log" 2>&1
assert_file    "$SV/agent/core/task-manager.md"                         "v1: update.sh installs the moved subagent at its new path"
assert_no_file "$SV/agent/subagents/core/task-manager.md"               "v1: ...and removes the old-layout copy"

echo -e "\n${BOLD}update.sh${NC} (config.json)"
# a CLI-installed project: flavor only in .oac/config.json, no marker
C="$TEST_DIR/cli/.opencode"
install essential --opencode v1 --install-dir="$C" > "$TEST_DIR/c1.log" 2>&1
rm -f "$C/.oac-opencode"
mkdir -p "$TEST_DIR/cli/.oac"
printf '{\n  "opencode": {\n    "target": "v1"\n  }\n}\n' > "$TEST_DIR/cli/.oac/config.json"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$C") > "$TEST_DIR/c2.log" 2>&1 \
    && pass "update.sh reads the flavor from .oac/config.json" || fail "update.sh reads the flavor from .oac/config.json"
if grep -q "predates" "$TEST_DIR/c2.log"; then fail "...and does not say the install predates v2 support"; else pass "...and does not say the install predates v2 support"; fi
assert_contains "$C/.oac-opencode" "v1" "...and records the marker"
# a stale marker loses to the config (the CLI migrated the project to v2)
printf '{"opencode":{"target":"v2"}}' > "$TEST_DIR/cli/.oac/config.json"
rm -rf "$C"/agent/{core,code,planning,dev,content,data,meta,system-builder,subagents} "$C/tool" "$C/plugin"; mkdir -p "$C/agent"; echo x > "$C/agent/openagent.md"
(cd "$REPO_ROOT" && bash update.sh --install-dir "$C" --opencode v2) > "$TEST_DIR/c3.log" 2>&1 \
    && pass "config v2 beats a stale v1 marker: update.sh --opencode v2 is not refused" || fail "config v2 beats a stale v1 marker: update.sh --opencode v2 is not refused"
assert_contains "$C/.oac-opencode" "v2" "...and the marker is corrected"

# --- registry paths cannot escape the install dir ----------------------------------------------
echo -e "\n${BOLD}path guard${NC}"
EVIL="$TEST_DIR/evil"
mkdir -p "$EVIL/pkg/built-ai-configs/registry" "$EVIL/pkg/.opencode/agent"
echo "payload" > "$EVIL/pkg/.opencode/agent/x.md"
echo "payload" > "$EVIL/up.md"
cat > "$EVIL/pkg/built-ai-configs/registry/registry.json" <<'JSON'
{"version":"1.0.0","components":{"agents":[
 {"id":"evil","name":"evil","type":"agent","path":"x/../../up.md","description":"x","tags":[],"dependencies":[],"category":"core"},
 {"id":"abs","name":"abs","type":"agent","path":"/tmp/oac-escaped-abs.md","description":"x","tags":[],"dependencies":[],"category":"core"}
],"subagents":[],"commands":[],"tools":[],"plugins":[],"contexts":[],"skills":[],"config":[]},
"profiles":{"essential":{"name":"e","description":"e","components":["agent:evil","agent:abs"]}}}
JSON
rm -f /tmp/oac-escaped-abs.md
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$EVIL/pkg" REGISTRY_URL="file://$EVIL/pkg/built-ai-configs/registry/registry.json" bash install.sh essential --install-dir="$EVIL/proj/.opencode") > "$EVIL/log" 2>&1
assert_no_file "$EVIL/proj/up.md" "a registry path with .. does not write outside the install dir"
assert_no_file "/tmp/oac-escaped-abs.md" "an absolute registry path is not written"
assert_contains "$EVIL/log" "unsafe registry path" "...and the refusal is reported"

# --- a hostile registry or a symlink cannot make the superseded-file removal leave agent/ ----------
echo -e "\n${BOLD}superseded path guard${NC}"
HS="$TEST_DIR/hostile"
mkdir -p "$HS/pkg/built-ai-configs/registry" "$HS/pkg/.opencode/agent"
printf -- '---\ndescription: Shared description\nmode: subagent\n---\nnew\n' > "$HS/pkg/.opencode/agent/new.md"
cat > "$HS/pkg/built-ai-configs/registry/registry.json" <<'JSON'
{"version":"1.0.0","components":{"agents":[],"subagents":[
 {"id":"new","name":"new","type":"subagent","path":".opencode/agent/new.md","description":"Shared description","tags":[],"dependencies":[],"category":"core",
  "supersedes":[".opencode/context/index.md",".opencode/agent/x.txt",".opencode/agent/linkdir/victim.md",".opencode/agent/linked.md",".opencode/agent/old.md"]}
],"commands":[],"tools":[],"plugins":[],"contexts":[],"skills":[],"config":[]},
"profiles":{"essential":{"name":"e","description":"e","components":["subagent:new"]}}}
JSON
hostile_project() {
    # $1 = project dir; leaves a decoy of everything the registry above tries to reach
    rm -rf "$1" "$1-outside"
    mkdir -p "$1/.opencode/context" "$1/.opencode/agent" "$1-outside"
    local desc='---\ndescription: Shared description\nmode: subagent\n---\nold\n'
    printf -- "$desc" > "$1/.opencode/context/index.md"
    printf -- "$desc" > "$1/.opencode/agent/x.txt"
    printf -- "$desc" > "$1/.opencode/agent/old.md"
    printf -- "$desc" > "$1-outside/victim.md"
    printf -- "$desc" > "$1-outside/real.md"
    ln -s "$1-outside" "$1/.opencode/agent/linkdir"
    ln -s "$1-outside/real.md" "$1/.opencode/agent/linked.md"
}
assert_hostile_survived() {
    assert_file "$1/.opencode/context/index.md"  "$2: a supersedes path outside agent/ is ignored"
    assert_file "$1/.opencode/agent/x.txt"       "$2: a supersedes path that is not .md is ignored"
    assert_file "$1-outside/victim.md"           "$2: a symlinked directory cannot reach a file outside the install"
    assert_file "$1-outside/real.md"             "$2: a symlinked file is neither read nor removed"
    assert_no_file "$1/.opencode/agent/old.md"   "$2: the legitimate superseded file is still retired"
    assert_file "$1/.opencode/agent/new.md"      "$2: the replacement is installed"
}
HP="$HS/p1"
hostile_project "$HP"
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$HS/pkg" REGISTRY_URL="file://$HS/pkg/built-ai-configs/registry/registry.json" bash install.sh essential --install-dir="$HP/.opencode") > "$HS/install.log" 2>&1
assert_hostile_survived "$HP" "install.sh"
assert_contains "$HS/install.log" "symlink" "install.sh warns about the symlink"
assert_contains "$HS/install.log" "Replaced files backed up in" "install.sh prints the backup directory in its summary"
HU="$HS/p2"
hostile_project "$HU"
cp "$HS/pkg/.opencode/agent/new.md" "$HU/.opencode/agent/new.md"
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$HS/pkg" bash update.sh --install-dir "$HU/.opencode") > "$HS/update.log" 2>&1
assert_hostile_survived "$HU" "update.sh"
assert_contains "$HS/update.log" "symlink" "update.sh warns about the symlink"
assert_contains "$HS/update.log" "backed up in" "update.sh prints the backup directory"

# update.sh without jq must not fetch the old name (it 404s): it skips it and still succeeds.
NJ="$HS/nojq-bin"
mkdir -p "$NJ"
for tool in curl cp rm mkdir date sed head tr grep find ls wc dirname cat mktemp mv basename sort uname awk printf touch chmod; do
    p=$(command -v "$tool" 2>/dev/null) && [ -x "$p" ] && ln -sf "$p" "$NJ/$tool"
done
HN="$HS/p3"
hostile_project "$HN"
cp "$HS/pkg/.opencode/agent/new.md" "$HN/.opencode/agent/new.md"
if (cd "$REPO_ROOT" && PATH="$NJ" OAC_RAW_URL="file://$HS/pkg" /bin/bash update.sh --install-dir "$HN/.opencode") > "$HS/nojq.log" 2>&1; then
    pass "update.sh without jq succeeds when a superseded old file is installed"
else
    fail "update.sh without jq succeeds when a superseded old file is installed (see $HS/nojq.log)"; sed 's/^/    /' "$HS/nojq.log" | tail -15
fi
assert_contains "$HS/nojq.log" "jq not found" "...and warns that jq is missing"
assert_contains "$HS/nojq.log" "Skipping agent/old.md" "...and skips the old name instead of fetching it"
assert_file "$HN/.opencode/agent/old.md" "...and leaves it in place"
assert_file "$HN-outside/victim.md" "...and touches nothing outside"

# --- retired files: shipped once, shipped no more (registry "retired"), same containment ----------------
echo -e "\n${BOLD}retired files${NC}"
RT="$TEST_DIR/retired"
sha() { shasum -a 256 "$1" | awk '{print $1}'; }
mkdir -p "$RT/pkg/built-ai-configs/registry" "$RT/pkg/.opencode/agent" "$RT/seed"
printf -- '---\ndescription: Shared description\nmode: subagent\n---\nnew\n' > "$RT/pkg/.opencode/agent/new.md"
printf 'old readme\n' > "$RT/seed/README.md"
printf 'name: t\n' > "$RT/seed/t.yaml"
printf '\000\377\200\n' > "$RT/seed/blob.bin"
printf 'old skill\n' > "$RT/seed/SKILL.md"
printf 'victim\n' > "$RT/seed/victim.md"
printf 'index\n' > "$RT/seed/index.md"
H_README=$(sha "$RT/seed/README.md"); H_YAML=$(sha "$RT/seed/t.yaml"); H_BIN=$(sha "$RT/seed/blob.bin")
H_SKILL=$(sha "$RT/seed/SKILL.md"); H_VICTIM=$(sha "$RT/seed/victim.md"); H_INDEX=$(sha "$RT/seed/index.md")
NA=".opencode/command/openagents/new-agents"
cat > "$RT/pkg/built-ai-configs/registry/registry.json" <<JSON
{"version":"1.0.0","components":{"agents":[],"subagents":[
 {"id":"new","name":"new","type":"subagent","path":".opencode/agent/new.md","description":"Shared description","tags":[],"dependencies":[],"category":"core"}
],"commands":[],"tools":[],"plugins":[],"contexts":[],"skills":[],"config":[]},
"profiles":{"essential":{"name":"e","description":"e","components":["subagent:new"]}},
"retired":[
 {"path":"$NA/README.md","sha256":["$(printf 'f%.0s' $(seq 64))","$H_README"],"replacedBy":"docs/guides/new-agents/README.md"},
 {"path":"$NA/templates/t.yaml","sha256":["$H_YAML"]},
 {"path":"$NA/templates/blob.bin","sha256":["$H_BIN"]},
 {"path":"$NA/edited.md","sha256":["$H_README"]},
 {"path":".opencode/skills/old-skill/SKILL.md","sha256":["$H_SKILL"]},
 {"path":".opencode/context/index.md","sha256":["$H_INDEX"]},
 {"path":".opencode/context/openagents-repo/guides/old.md","sha256":["$H_INDEX"]},
 {"path":".opencode/context/project/mine.md","sha256":["$H_INDEX"]},
 {"path":".opencode/command/../context/navigation.md","sha256":["$H_INDEX"]},
 {"path":".opencode\\\\command\\\\x.md","sha256":["$H_INDEX"]},
 {"path":".opencode/command/linkdir/victim.md","sha256":["$H_VICTIM"]},
 {"path":".opencode/skills/linked.md","sha256":["$H_VICTIM"]}
]}
JSON
retired_project() {
    rm -rf "$1" "$1-outside"
    mkdir -p "$1/$NA/templates" "$1/.opencode/skills/old-skill" "$1/.opencode/context" "$1/.opencode/agent" "$1-outside"
    cp "$RT/seed/README.md" "$1/$NA/README.md"
    cp "$RT/seed/t.yaml" "$1/$NA/templates/t.yaml"
    cp "$RT/seed/blob.bin" "$1/$NA/templates/blob.bin"
    { cat "$RT/seed/README.md"; echo "MY NOTES"; } > "$1/$NA/edited.md"
    printf -- '---\ndescription: a real command\n---\nmine\n' > "$1/$NA/create-agent.md"
    cp "$RT/seed/SKILL.md" "$1/.opencode/skills/old-skill/SKILL.md"
    echo "mine" > "$1/.opencode/skills/old-skill/mine.md"
    cp "$RT/seed/index.md" "$1/.opencode/context/index.md"
    cp "$RT/seed/index.md" "$1/.opencode/context/navigation.md"
    mkdir -p "$1/.opencode/context/openagents-repo/guides" "$1/.opencode/context/project"
    cp "$RT/seed/index.md" "$1/.opencode/context/openagents-repo/guides/old.md"
    cp "$RT/seed/index.md" "$1/.opencode/context/project/mine.md"
    cp "$RT/seed/victim.md" "$1-outside/victim.md"
    ln -s "$1-outside" "$1/.opencode/command/linkdir"
    ln -s "$1-outside/victim.md" "$1/.opencode/skills/linked.md"
}
assert_retired_ok() {
    assert_no_file "$1/$NA/README.md"                         "$2: a pristine retired .md is removed"
    assert_no_file "$1/$NA/templates/t.yaml"                  "$2: a pristine retired yaml is removed"
    assert_no_file "$1/$NA/templates/blob.bin"                "$2: a pristine retired binary is removed"
    assert_no_file "$1/.opencode/skills/old-skill/SKILL.md"   "$2: a retired file under skills/ is removed"
    assert_file    "$1/.opencode/skills/old-skill/mine.md"    "$2: a user's file next to it stays"
    assert_file    "$1/$NA/edited.md"                         "$2: an edited retired file is left"
    assert_file    "$1/$NA/create-agent.md"                   "$2: a real command in the same folder stays"
    assert_file    "$1/.opencode/context/index.md"            "$2: a retired path outside agent/command/skills is ignored"
    assert_file    "$1/.opencode/context/navigation.md"       "$2: a retired path with .. is ignored"
    assert_no_file "$1/.opencode/context/openagents-repo/guides/old.md" "$2: a pristine retired OAC contributor doc is removed"
    assert_file    "$1/.opencode/context/project/mine.md"     "$2: a retired path in a user-owned context slot is ignored"
    assert_file    "$1-outside/victim.md"                     "$2: a symlinked directory cannot reach a file outside the install"
    assert_file    "$1/.opencode/skills/linked.md"            "$2: a symlinked file is not removed"
    assert_file    "$1/.opencode/agent/new.md"                "$2: the rest of the install still happens"
    assert_no_dir  "$1/$NA/templates"                         "$2: the emptied folder is removed"
}
RP="$RT/p1"
retired_project "$RP"
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$RT/pkg" REGISTRY_URL="file://$RT/pkg/built-ai-configs/registry/registry.json" bash install.sh essential --install-dir="$RP/.opencode") > "$RT/install.log" 2>&1
assert_retired_ok "$RP" "install.sh"
assert_contains "$RT/install.log" "differs from the version OAC shipped" "install.sh says why the edited file stayed"
assert_contains "$RT/install.log" "symlink" "install.sh warns about the symlink"
RB=$(ls -d "$RP/.opencode".backup.* 2>/dev/null | head -n 1)
assert_file "$RB/command/openagents/new-agents/README.md" "install.sh backs a retired file up before removing it"
cmp -s "$RB/command/openagents/new-agents/templates/blob.bin" "$RT/seed/blob.bin" && pass "install.sh: the backed-up binary is byte-identical" || fail "install.sh: the backed-up binary is byte-identical"
N2=$(count_backups "$RP/.opencode")
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$RT/pkg" REGISTRY_URL="file://$RT/pkg/built-ai-configs/registry/registry.json" bash install.sh essential --install-dir="$RP/.opencode") > "$RT/install2.log" 2>&1
[ "$(count_backups "$RP/.opencode")" = "$N2" ] && pass "install.sh: a second run retires nothing more (idempotent)" || fail "install.sh: a second run retires nothing more (idempotent)"

RU="$RT/p2"
retired_project "$RU"
cp "$RT/pkg/.opencode/agent/new.md" "$RU/.opencode/agent/new.md"
(cd "$REPO_ROOT" && OAC_RAW_URL="file://$RT/pkg" bash update.sh --install-dir "$RU/.opencode") > "$RT/update.log" 2>&1
assert_retired_ok "$RU" "update.sh"
assert_contains "$RT/update.log" "backed up in" "update.sh prints the backup directory"
assert_contains "$RT/update.log" "Skipping command/openagents/new-agents/edited.md" "update.sh skips the edited retired file instead of fetching it (it would 404)"

# update.sh without jq: removes nothing, skips the retired names, still succeeds.
RN="$RT/p3"
retired_project "$RN"
cp "$RT/pkg/.opencode/agent/new.md" "$RN/.opencode/agent/new.md"
if (cd "$REPO_ROOT" && PATH="$NJ" OAC_RAW_URL="file://$RT/pkg" /bin/bash update.sh --install-dir "$RN/.opencode") > "$RT/nojq.log" 2>&1; then
    pass "update.sh without jq succeeds when retired files are installed"
else
    fail "update.sh without jq succeeds when retired files are installed (see $RT/nojq.log)"; sed 's/^/    /' "$RT/nojq.log" | tail -15
fi
assert_contains "$RT/nojq.log" "jq not found" "...and warns that jq is missing"
assert_contains "$RT/nojq.log" "Skipping command/openagents/new-agents/README.md" "...and skips the retired name instead of fetching it"
assert_file "$RN/$NA/README.md" "...and removes nothing"
assert_file "$RN/$NA/templates/t.yaml" "...not even a pristine yaml"
assert_file "$RN-outside/victim.md" "...and touches nothing outside"

echo ""
echo -e "${BOLD}Passed: $PASSED  Failed: $FAILED${NC}"
[ "$FAILED" -eq 0 ]
