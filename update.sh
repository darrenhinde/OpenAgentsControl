#!/usr/bin/env bash

#############################################################################
# OpenAgents Control Updater
# Updates existing OpenCode components to latest versions
#
# Compatible with:
# - macOS (bash 3.2+)
# - Linux (bash 3.2+)
# - Windows (Git Bash, WSL)
#
# Usage:
#   ./update.sh                          # Auto-detect install location
#   ./update.sh --install-dir PATH       # Update a specific install path
#   ./update.sh --opencode v1            # Update an OpenCode v1 install (default: the recorded
#                                        # version, else v2; v1 is never chosen implicitly)
#
# Environment variables:
#   OPENCODE_INSTALL_DIR                 # Override default install directory
#   OPENCODE_BRANCH                      # Branch to pull from (default: main)
#############################################################################

set -e

# Detect platform
PLATFORM="$(uname -s)"
case "$PLATFORM" in
    Linux*)     PLATFORM="Linux";;
    Darwin*)    PLATFORM="macOS";;
    CYGWIN*|MINGW*|MSYS*) PLATFORM="Windows";;
    *)          PLATFORM="Unknown";;
esac

# Colors (disable on Windows terminals without color support)
if [ "$PLATFORM" = "Windows" ] && [ -z "$WT_SESSION" ] && [ -z "$ConEmuPID" ]; then
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    BOLD=''
    NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
fi

BRANCH="${OPENCODE_BRANCH:-main}"
# OAC_RAW_URL overrides where files are fetched from (e.g. file:///path/to/checkout), as in install.sh.
REPO_URL="${OAC_RAW_URL:-https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/${BRANCH}}"

# CLI argument for custom install dir (overrides env var)
CUSTOM_INSTALL_DIR=""

# OpenCode major this install targets: --opencode, else the marker install.sh wrote, else v2.
# v1 is never chosen implicitly; its files live under built-ai-configs/opencode-v1/ in the repository and
# install into the same .opencode/ paths as everything else.
OPENCODE_FLAVOR=""

UPDATED_COUNT=0
FAILED_COUNT=0
SKIPPED_SUPERSEDED=0

# Track backup files for cleanup on exit
BACKUP_FILES=()

# Clean up any leftover backup files on exit/interrupt
cleanup_backups() {
    for f in "${BACKUP_FILES[@]}"; do
        # `[ -f ] && rm` returns 1 for a backup that was already restored (mv), and under `set -e` a
        # failing EXIT trap turns a finished update into exit status 1.
        if [ -f "$f" ]; then rm -f "$f"; fi
    done
}
trap cleanup_backups EXIT INT TERM

#############################################################################
# Utility Functions
#############################################################################

print_success() { echo -e "${GREEN}✓${NC} $1"; }
print_info()    { echo -e "${BLUE}ℹ${NC} $1"; }
print_warning() { echo -e "${YELLOW}⚠${NC} $1"; }
print_error()   { echo -e "${RED}✗${NC} $1" >&2; }
print_step()    { echo -e "\n${CYAN}${BOLD}▶${NC} $1\n"; }

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           OpenAgents Control Updater v1.1.0                   ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_usage() {
    echo "Usage: $0 [--install-dir PATH] [--opencode v1|v2]"
    echo ""
    echo "Options:"
    echo "  --install-dir PATH   Update a specific installation directory"
    echo "  --opencode v1|v2     OpenCode major of the install (default: the recorded one, else v2)"
    echo "  --help               Show this help message"
    echo ""
    echo "Installs made by an older shell installer (nested agents, no recorded version) are refused"
    echo "until you choose. Existing shell-installed users run either:"
    echo "  oac update                      (npm i -g @controlstack/oac; migrates safely)"
    echo "  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/update.sh | bash -s -- --opencode v1   (stay on v1)"
    echo "New installs default to OpenCode v2; install.sh --opencode v1 is available."
    echo "Files this script retires or replaces are copied to <install dir>.backup.<timestamp>/"
    echo "(add .opencode.backup.*/ to your .gitignore)."
    echo ""
    echo "Environment variables:"
    echo "  OPENCODE_INSTALL_DIR   Override the default installation directory"
    echo "  OPENCODE_BRANCH        Branch to pull updates from (default: main)"
    echo ""
    echo "Examples:"
    echo "  # Auto-detect and update"
    echo "  $0"
    echo ""
    echo "  # Update a global installation"
    echo "  $0 --install-dir ~/.config/opencode"
    echo ""
    echo "  # Update via environment variable"
    echo "  export OPENCODE_INSTALL_DIR=~/.config/opencode && $0"
}

#############################################################################
# Path Resolution
#############################################################################

get_global_install_path() {
    # Return platform-appropriate global installation path
    case "$PLATFORM" in
        macOS)
            echo "${HOME}/.config/opencode"
            ;;
        Linux)
            echo "${HOME}/.config/opencode"
            ;;
        Windows)
            # Windows Git Bash/WSL: Use same as Linux
            echo "${HOME}/.config/opencode"
            ;;
        *)
            echo "${HOME}/.config/opencode"
            ;;
    esac
}

normalize_path() {
    local input_path="$1"

    # Handle empty path
    if [ -z "$input_path" ]; then
        echo ""
        return 1
    fi

    local normalized_path

    # Expand tilde to $HOME (works on Linux, macOS, Windows Git Bash)
    if [[ $input_path == ~* ]]; then
        normalized_path="${HOME}${input_path:1}"
    else
        normalized_path="$input_path"
    fi

    # Convert backslashes to forward slashes (Windows compatibility)
    normalized_path="${normalized_path//\\//}"

    # Remove trailing slashes
    normalized_path="${normalized_path%/}"

    # If path is relative, make it absolute based on current directory
    if [[ ! "$normalized_path" = /* ]] && [[ ! "$normalized_path" =~ ^[A-Za-z]: ]]; then
        normalized_path="$(pwd)/${normalized_path}"
    fi

    echo "$normalized_path"
    return 0
}

resolve_install_dir() {
    local custom_dir="$1"

    # Priority: CLI arg → env var → auto-detect (local then global)
    if [ -n "$custom_dir" ]; then
        normalize_path "$custom_dir"
        return
    fi

    if [ -n "$OPENCODE_INSTALL_DIR" ]; then
        normalize_path "$OPENCODE_INSTALL_DIR"
        return
    fi

    # Auto-detect: prefer local project install, fall back to global
    local local_path
    local_path="$(pwd)/.opencode"
    local global_path
    global_path=$(get_global_install_path)

    if [ -d "$local_path" ]; then
        echo "$local_path"
    elif [ -d "$global_path" ]; then
        echo "$global_path"
    else
        # Neither exists — return local path so main() gives a clear error
        echo "$local_path"
    fi
}

#############################################################################
# OpenCode flavor
#############################################################################

# The flavor `oac` recorded in <project>/.oac/config.json ("opencode": {"target": "v1"}), or empty.
# Needs no jq: the file is JSON the CLI wrote, so it is flattened and matched with sed.
config_flavor() {
    local install_dir="$1" config_file
    [ "$(basename "$install_dir")" = ".opencode" ] || return 0
    config_file="$(dirname "$install_dir")/.oac/config.json"
    [ -f "$config_file" ] || return 0
    tr -d '\n\r' < "$config_file" \
        | sed -n -E 's/.*"opencode"[[:space:]]*:[[:space:]]*\{[[:space:]]*"target"[[:space:]]*:[[:space:]]*"(v[12])".*/\1/p'
}

# Settle OPENCODE_FLAVOR to v1 or v2. An explicit --opencode wins; otherwise what the install
# recorded: .oac/config.json (written by the CLI) first, then the marker install.sh writes. If the
# two disagree the config wins, because the CLI updates both and a stale marker is the wrong one.
# Otherwise v2. An install that predates the marker and still has nested agents
# is the v1 layout: it is left alone and the user is pointed at the tool that migrates safely.
#
# This script never converts one layout into the other: it only refreshes files that already
# exist, so asking for the other flavor than the install has is refused (it would 404 on every
# file or overwrite v1 files with v2 content). `oac update --opencode vN` does the migration.
resolve_flavor() {
    local install_dir="$1"
    local requested recorded=""
    requested=$(printf '%s' "$OPENCODE_FLAVOR" | tr '[:upper:]' '[:lower:]')
    case "$requested" in
        v1|1) requested="v1" ;;
        v2|2) requested="v2" ;;
        "") ;;
        *) print_error "Unknown OpenCode version '${OPENCODE_FLAVOR}'. Use v1 or v2."; exit 1 ;;
    esac

    recorded=$(config_flavor "$install_dir")
    if [ -z "$recorded" ] && [ -f "$install_dir/.oac-opencode" ]; then
        recorded=$(tr -d '[:space:]' < "$install_dir/.oac-opencode")
        if [ "$recorded" != "v1" ] && [ "$recorded" != "v2" ]; then
            recorded=""
        fi
    fi

    local nested=false flat=false
    { [ -d "$install_dir/agent/core" ] || [ -d "$install_dir/agent/subagents" ]; } && nested=true
    [ -f "$install_dir/agent/openagent.md" ] && flat=true

    if [ -n "$requested" ]; then
        local actual="$recorded"
        if [ -z "$actual" ]; then
            if [ "$nested" = true ]; then actual="v1"
            elif [ "$flat" = true ]; then actual="v2"
            fi
        fi
        if [ -n "$actual" ] && [ "$actual" != "$requested" ]; then
            print_error "This install is the OpenCode ${actual} layout; update.sh cannot convert it to ${requested}."
            print_error "Migrate it with: oac update --opencode ${requested}   (or reinstall with install.sh --opencode ${requested})"
            exit 1
        fi
        OPENCODE_FLAVOR="$requested"
        return 0
    fi

    if [ -n "$recorded" ]; then
        OPENCODE_FLAVOR="$recorded"
        return 0
    fi

    OPENCODE_FLAVOR="v2"
    if [ "$nested" = true ]; then
        print_warning "This install predates OpenCode v2 support (nested agents, no recorded version)."
        print_warning "Updating as v1 would need --opencode v1; v2 files are flat."
        print_error "Not updating an install of unknown OpenCode version. Pick one:"
        echo "  Stay on OpenCode v1 (paste this):"
        echo "    curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/update.sh | bash -s -- --opencode v1"
        echo "  Or migrate safely with the oac CLI:"
        echo "    npm i -g @controlstack/oac && oac update"
        exit 1
    fi
}

# Record the flavor this update was run for, so the next plain update is not refused again.
record_flavor() {
    printf '%s\n' "$OPENCODE_FLAVOR" > "$1/.oac-opencode"
}

#############################################################################
# Update Logic
#############################################################################

# Same rule as install.sh and the CLI's isInstallablePath: relative, with no ".." segment.
is_safe_relative_path() {
    local p="${1//\\//}"
    [ -n "$p" ] || return 1
    case "$p" in
        /*|[A-Za-z]:*|..|../*|*/..|*/../*) return 1 ;;
    esac
    return 0
}

update_component() {
    local path="$1"
    local install_dir="$2"
    local relative_path="${path#"$install_dir"/}"

    # Guard: reject paths that escaped the install dir (absolute, or any ".." segment)
    if ! is_safe_relative_path "$relative_path"; then
        print_warning "Skipping suspicious path: $path"
        return 1
    fi

    # A file a renamed or moved agent replaced has no upstream copy under its old name: skip it
    # (migrate_superseded handled it, or left it on purpose) instead of counting a 404 as a failure.
    if is_superseded_old_path "$relative_path"; then
        print_warning "Skipping ${relative_path}: renamed, moved or no longer shipped by OAC, so there is no newer copy under this name."
        SKIPPED_SUPERSEDED=$((SKIPPED_SUPERSEDED + 1))
        return 0
    fi

    local url="${REPO_URL}/.opencode/${relative_path}"
    local backup="${path}.backup"

    cp "$path" "$backup"
    BACKUP_FILES+=("$backup")

    # v1 prefers its own build of a file (nested agents, tools, plugins) and falls back to the
    # files both flavors share.
    if [ "$OPENCODE_FLAVOR" = "v1" ] && curl -fsSL "${REPO_URL}/built-ai-configs/opencode-v1/${relative_path}" -o "$path" 2>/dev/null; then
        print_success "Updated $path"
        rm -f "$backup"
        local v1_backups=()
        for f in "${BACKUP_FILES[@]}"; do
            [ "$f" != "$backup" ] && v1_backups+=("$f")
        done
        BACKUP_FILES=("${v1_backups[@]+"${v1_backups[@]}"}")
    elif curl -fsSL "$url" -o "$path" 2>/dev/null; then
        print_success "Updated $path"
        rm -f "$backup"
        # Remove from tracking array (bash 3.2 compatible)
        local new_backups=()
        for f in "${BACKUP_FILES[@]}"; do
            [ "$f" != "$backup" ] && new_backups+=("$f")
        done
        BACKUP_FILES=("${new_backups[@]+"${new_backups[@]}"}")
    else
        print_warning "Could not update $path — restoring backup"
        mv "$backup" "$path"
        return 1
    fi
}

# A later release can rename an agent (contextscout -> context-scout) or move it (v1:
# agent/subagents/core/x.md -> agent/core/x.md). The registry lists, on the component that replaced
# it, the paths it used to ship at ("supersedes"). The per-file refresh below fetches each
# installed file from its own path, so an old name would only ever 404: instead, install the
# replacement and retire the old copy. Each retired file is first copied to
# <install dir>.backup.<time>/ (the install.sh convention); a file whose description no longer
# matches the bundled one is the user's own and is left and reported. Needs jq; without it the
# stale files are named in a warning and nothing is removed.
frontmatter_description() {
    sed -n -E '1,/^---[[:space:]]*$/{ s/^description:[[:space:]]*//p; }' "$1" 2>/dev/null | head -n 1 \
        | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/; s/[[:space:]]+$//'
}

prune_empty_dirs() {
    local install_dir="$1" dir
    dir=$(dirname "$2")
    while [ "$dir" != "$install_dir" ] && [ "${dir#"$install_dir"/}" != "$dir" ]; do
        if [ ! -L "$dir" ] && [ -f "$dir/0-category.json" ] && [ ! -L "$dir/0-category.json" ] && [ "$(ls -A "$dir" | wc -l | tr -d ' ')" = "1" ]; then
            rm -f "$dir/0-category.json"
        fi
        rmdir "$dir" 2>/dev/null || return 0
        dir=$(dirname "$dir")
    done
}

# Physical (symlink-free) path of a directory, or fail. cd -P / pwd -P exist in bash 3.2 and on macOS.
physical_dir() {
    (cd -P "$1" 2>/dev/null && pwd -P)
}

# A superseded file may only be an .md file under <install dir>/agent/ ($1 = install-relative path).
# The registry comes from the network, so this holds whatever the build validated.
superseded_rel_ok() {
    case "$1" in
        agent/*.md) ;;
        *) return 1 ;;
    esac
    case "$1" in
        *\\*|*/../*|../*|*/..|*//*|*/./*) return 1 ;;
    esac
    return 0
}

# Safe to read or remove $2 (a file under install dir $1)? Not a symlink, and its parent directory,
# with symlinks resolved, lies inside the resolved <install dir>/<$3, default agent>. A missing file is fine.
superseded_target_safe() {
    local install_dir="$1" file="$2" jail="${3:-agent}" agent_real parent_real
    [ -L "$file" ] && return 1
    [ -e "$file" ] || return 0
    [ -f "$file" ] || return 1
    agent_real=$(physical_dir "${install_dir}/${jail}") || return 1
    parent_real=$(physical_dir "$(dirname "$file")") || return 1
    case "${parent_real}/" in
        "${agent_real}/"*) return 0 ;;
    esac
    return 1
}

# Registry path -> path relative to the install dir (same prefixes as install.sh's get_install_path).
registry_relative_path() {
    local rel="${1#.opencode/}"
    echo "${rel#built-ai-configs/opencode-v1/}"
}

SUPERSEDED_RETIRED=0
SUPERSEDED_BACKUP_DIR=
# Install-relative paths (one per line) of files a renamed or moved agent replaced. The per-file
# refresh must not fetch them: the old name no longer exists upstream.
SUPERSEDED_OLD_PATHS=

is_superseded_old_path() {
    case "
${SUPERSEDED_OLD_PATHS}
" in
        *"
$1
"*) return 0 ;;
    esac
    return 1
}

# Retired files: paths an earlier release shipped that no release ships now, replaced by nothing
# installable (the registry's top-level "retired" list, e.g. the agent-creation templates that sat
# in command/openagents/new-agents/). Same containment as superseded agent files, widened to the
# three folders OpenCode loads content from: a normalised path under agent/, command/ or skills/,
# no symlink, and a parent directory that stays inside that folder once symlinks are resolved. The
# file must still hash to a version OAC shipped (they are not all agents, so there is no description
# to compare); an edited file or the user's own is left and reported. A copy goes to
# <install dir>.backup.<time>/ before any removal. Needs jq, like the superseded handling.

# Hex SHA-256 of a file, empty when no tool is available.
file_sha256() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" 2>/dev/null | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" 2>/dev/null | awk '{print $1}'
    elif command -v openssl >/dev/null 2>&1; then
        openssl dgst -sha256 "$1" 2>/dev/null | awk '{print $NF}'
    fi
}

# A retired file may only sit under <install dir>/{agent,command,skills,context/openagents-repo}/ ($1 = install-relative path).
retired_rel_ok() {
    case "$1" in
        agent/?*|command/?*|skills/?*|context/openagents-repo/?*) ;;
        *) return 1 ;;
    esac
    case "$1" in
        *\\*|*/../*|../*|*/..|*//*|*/./*|*/.) return 1 ;;
    esac
    return 0
}

# Remove the retired files listed in registry file $2 from install dir $1.
retire_retired_files() {
    local install_dir="$1" registry_file="$2"
    local rows path sums rel dest root actual
    rows=$(jq -r '(.retired // [])[]? | select(.path != null) | [.path, ((.sha256 // []) | join(","))] | @tsv' \
                "$registry_file" 2>/dev/null | tr -d '\r')
    [ -n "$rows" ] || return 0
    while IFS=$'\t' read -r path sums; do
        [ -n "$path" ] || continue
        rel=$(registry_relative_path "$path")
        is_safe_relative_path "$rel" || { print_warning "Skipping suspicious registry path: $path"; continue; }
        retired_rel_ok "$rel" || { print_warning "Ignoring retired path outside agent/, command/, skills/ and context/openagents-repo/: $path"; continue; }
        dest="${install_dir}/${rel}"
        [ -e "$dest" ] || [ -L "$dest" ] || continue
        root="${rel%%/*}"
        if ! superseded_target_safe "$install_dir" "$dest" "$root"; then
            print_warning "Left ${dest}: it is a symlink, or sits behind one that leaves ${install_dir}/${root}. Nothing was read or removed."
            continue
        fi
        actual=$(file_sha256 "$dest")
        case ",${sums}," in
            *",${actual},"*) ;;
            *) actual="" ;;
        esac
        if [ -z "$actual" ]; then
            print_warning "Left ${dest}: OAC no longer ships it, but it differs from the version OAC shipped (edited, or your own file). Remove it yourself if you do not need it."
            continue
        fi
        if [ -z "$SUPERSEDED_BACKUP_DIR" ]; then
            SUPERSEDED_BACKUP_DIR="${install_dir}.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        mkdir -p "$(dirname "${SUPERSEDED_BACKUP_DIR}/${rel}")"
        if cp "$dest" "${SUPERSEDED_BACKUP_DIR}/${rel}" && rm -f "$dest"; then
            print_success "Removed retired ${rel} (no longer shipped; copy in ${SUPERSEDED_BACKUP_DIR})"
            prune_empty_dirs "$install_dir" "$dest"
            SUPERSEDED_RETIRED=$((SUPERSEDED_RETIRED + 1))
        else
            print_warning "Could not remove retired ${dest}"
        fi
    done <<< "$rows"
}

migrate_superseded() {
    local install_dir="$1"
    local registry_rel="built-ai-configs/registry/registry.json"
    [ "$OPENCODE_FLAVOR" = "v1" ] && registry_rel="built-ai-configs/registry/registry.v1.json"

    local registry_file
    registry_file=$(mktemp "${TMPDIR:-/tmp}/oac-registry.XXXXXX") || return 0
    if ! curl -fsSL "${REPO_URL}/${registry_rel}" -o "$registry_file" 2>/dev/null; then
        print_warning "Could not fetch the registry; files replaced by renamed agents (if any) were not migrated. Run 'oac update' for that."
        rm -f "$registry_file"
        return 0
    fi

    # The old paths, without jq: squeeze the JSON to one line and pull out every "supersedes" array.
    # Only used to skip those files in the per-file refresh (they would 404), never to delete.
    local old_registry_path old_rel
    while IFS= read -r old_registry_path; do
        [ -n "$old_registry_path" ] || continue
        old_rel=$(registry_relative_path "$old_registry_path")
        is_safe_relative_path "$old_rel" || continue
        SUPERSEDED_OLD_PATHS="${SUPERSEDED_OLD_PATHS}${old_rel}
"
    done < <(tr -d '\n\r\t ' < "$registry_file" | grep -o '"supersedes":\[[^]]*\]' \
                 | grep -o '"[^"]*"' | grep -v '^"supersedes"$' | tr -d '"')
    # Retired entries are objects starting {"path":"..." (a component starts {"id":...), so this
    # picks them out without jq. They are skipped by the per-file refresh too: no newer copy exists.
    while IFS= read -r old_registry_path; do
        [ -n "$old_registry_path" ] || continue
        old_rel=$(registry_relative_path "$old_registry_path")
        is_safe_relative_path "$old_rel" || continue
        SUPERSEDED_OLD_PATHS="${SUPERSEDED_OLD_PATHS}${old_rel}
"
    done < <(tr -d '\n\r\t ' < "$registry_file" | grep -o '{"path":"[^"]*"' | sed -e 's/^{"path":"//' -e 's/"$//')

    if ! command -v jq >/dev/null 2>&1; then
        print_warning "jq not found: cannot check for agents renamed or moved, or files retired, by this release. Run 'oac update' (or install jq) to migrate them. Their old files are skipped by this update, not removed."
        rm -f "$registry_file"
        return 0
    fi

    retire_retired_files "$install_dir" "$registry_file"

    local rows
    rows=$(jq -r '.components | to_entries[] | .value[]? | select((.supersedes // []) | length > 0)
                  | .path as $p | (.description // "") as $d | .supersedes[] | [., $p, $d] | @tsv' \
                 "$registry_file" 2>/dev/null | tr -d '\r')
    rm -f "$registry_file"
    [ -n "$rows" ] || return 0

    local old new desc rel_old rel_new dest_old dest_new backup_dir="" rel
    while IFS=$'\t' read -r old new desc; do
        [ -n "$old" ] && [ -n "$new" ] || continue
        rel_old=$(registry_relative_path "$old")
        rel_new=$(registry_relative_path "$new")
        is_safe_relative_path "$rel_old" && is_safe_relative_path "$rel_new" || { print_warning "Skipping suspicious registry path: $old"; continue; }
        [ "$rel_old" != "$rel_new" ] || continue
        superseded_rel_ok "$rel_old" || { print_warning "Ignoring superseded path outside agent/: $old"; continue; }
        dest_old="${install_dir}/${rel_old}"
        dest_new="${install_dir}/${rel_new}"
        [ -e "$dest_old" ] || [ -L "$dest_old" ] || continue
        if ! superseded_target_safe "$install_dir" "$dest_old"; then
            print_warning "Left ${dest_old}: it is a symlink, or sits behind one that leaves ${install_dir}/agent. Nothing was read or removed."
            continue
        fi

        if [ "$(frontmatter_description "$dest_old")" != "$desc" ]; then
            print_warning "Left ${dest_old}: it does not look like the old OAC file replaced by ${rel_new}. If it is a duplicate, remove it yourself."
            continue
        fi
        if [ ! -f "$dest_new" ]; then
            mkdir -p "$(dirname "$dest_new")"
            if ! curl -fsSL "${REPO_URL}/${new}" -o "$dest_new" 2>/dev/null; then
                rm -f "$dest_new"
                print_warning "Could not fetch ${rel_new}; keeping ${rel_old}"
                continue
            fi
        fi
        if [ -z "$backup_dir" ]; then
            backup_dir="${install_dir}.backup.$(date +%Y%m%d-%H%M%S)"
            SUPERSEDED_BACKUP_DIR="$backup_dir"
        fi
        mkdir -p "$(dirname "${backup_dir}/${rel_old}")"
        if cp "$dest_old" "${backup_dir}/${rel_old}" && rm -f "$dest_old"; then
            print_success "Replaced ${rel_old} with ${rel_new} (old copy saved in ${backup_dir})"
            prune_empty_dirs "$install_dir" "$dest_old"
            SUPERSEDED_RETIRED=$((SUPERSEDED_RETIRED + 1))
        else
            print_warning "Could not remove superseded ${dest_old}"
        fi
    done <<< "$rows"
}

update_all_components() {
    local install_dir="$1"
    local updated=0
    local failed=0

    # Update markdown files
    while IFS= read -r -d '' file; do
        if update_component "$file" "$install_dir"; then
            updated=$((updated + 1))
        else
            failed=$((failed + 1))
        fi
    done < <(find "$install_dir" -name "*.md" -type f -not -path "*/node_modules/*" -print0)

    # Update TypeScript files
    while IFS= read -r -d '' file; do
        if update_component "$file" "$install_dir"; then
            updated=$((updated + 1))
        else
            failed=$((failed + 1))
        fi
    done < <(find "$install_dir" -name "*.ts" -type f -not -path "*/node_modules/*" -print0)

    # Update shell scripts inside install dir
    while IFS= read -r -d '' file; do
        if update_component "$file" "$install_dir"; then
            updated=$((updated + 1))
        else
            failed=$((failed + 1))
        fi
    done < <(find "$install_dir" -name "*.sh" -type f -not -path "*/node_modules/*" -print0)

    updated=$((updated - SKIPPED_SUPERSEDED))
    print_info "Updated: $updated file(s), failed: $failed file(s)"
    UPDATED_COUNT=$updated
    FAILED_COUNT=$failed
}

#############################################################################
# Argument Parsing
#############################################################################

parse_args() {
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --install-dir=*)
                CUSTOM_INSTALL_DIR="${1#*=}"
                if [ -z "$CUSTOM_INSTALL_DIR" ]; then
                    print_error "--install-dir requires a non-empty path"
                    exit 1
                fi
                shift
                ;;
            --install-dir)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    CUSTOM_INSTALL_DIR="$2"
                    shift 2
                else
                    print_error "--install-dir requires a path argument"
                    exit 1
                fi
                ;;
            --opencode=*)
                OPENCODE_FLAVOR="${1#*=}"
                shift
                ;;
            --opencode)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    OPENCODE_FLAVOR="$2"
                    shift 2
                else
                    print_error "--opencode requires v1 or v2"
                    exit 1
                fi
                ;;
            --help|-h)
                print_usage
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_usage
                exit 1
                ;;
        esac
    done
}

#############################################################################
# Main
#############################################################################

main() {
    parse_args "$@"

    print_header

    local install_dir
    install_dir=$(resolve_install_dir "$CUSTOM_INSTALL_DIR")

    if [ ! -d "$install_dir" ]; then
        print_error "Installation directory not found: $install_dir"
        echo ""
        echo "Searched locations:"
        echo "  1. --install-dir argument"
        echo "  2. OPENCODE_INSTALL_DIR environment variable"
        echo "  3. Local path:  $(pwd)/.opencode"
        echo "  4. Global path: $(get_global_install_path)"
        echo ""
        echo "Run install.sh first to install components, or specify the correct"
        echo "path with: $0 --install-dir PATH"
        exit 1
    fi

    if [ ! -w "$install_dir" ]; then
        print_error "No write permission for: $install_dir"
        exit 1
    fi

    resolve_flavor "$install_dir"
    print_info "Updating installation at: ${CYAN}${install_dir}${NC} (OpenCode ${OPENCODE_FLAVOR})"
    print_step "Updating components..."

    migrate_superseded "$install_dir"
    update_all_components "$install_dir"

    # Nothing could be refreshed: this is a failure, not an update (never report success).
    if [ "$UPDATED_COUNT" -eq 0 ] && [ "$FAILED_COUNT" -gt 0 ]; then
        print_error "Update failed: none of the ${FAILED_COUNT} file(s) could be updated; the install is unchanged."
        exit 1
    fi

    record_flavor "$install_dir"

    if [ -n "$SUPERSEDED_BACKUP_DIR" ]; then
        print_info "Replaced files were backed up in: ${SUPERSEDED_BACKUP_DIR}"
        print_info "Tip: add '.opencode.backup.*/' to your .gitignore"
    fi

    if [ "$FAILED_COUNT" -gt 0 ]; then
        print_warning "Update finished, but ${FAILED_COUNT} file(s) were left as they were (not in this version, or unreachable)."
    else
        print_success "Update complete!"
    fi
}

main "$@"
