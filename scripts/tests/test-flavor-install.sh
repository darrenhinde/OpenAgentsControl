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

echo ""
echo -e "${BOLD}Passed: $PASSED  Failed: $FAILED${NC}"
[ "$FAILED" -eq 0 ]
