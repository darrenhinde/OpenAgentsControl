#!/usr/bin/env bash

#############################################################################
# OpenAgents Control Installer
# Interactive installer for OpenCode agents, commands, tools, and plugins
#
# Compatible with:
# - macOS (bash 3.2+)
# - Linux (bash 3.2+)
# - Windows (Git Bash, WSL)
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

# Colors for output (disable on Windows if not supported)
if [ "$PLATFORM" = "Windows" ] && [ -z "$WT_SESSION" ] && [ -z "$ConEmuPID" ]; then
    # Basic Windows terminal without color support
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    MAGENTA=''
    CYAN=''
    BOLD=''
    NC=''
else
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    MAGENTA='\033[0;35m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m' # No Color
fi

# Configuration
REPO_URL="https://github.com/darrenhinde/OpenAgentsControl"
BRANCH="${OPENCODE_BRANCH:-main}"  # Allow override via environment variable
# OAC_RAW_URL overrides where component files are fetched from, e.g. file:///path/to/checkout
# or http://127.0.0.1:8000 for installer tests against a local tree (D-014). Default unchanged.
RAW_URL="${OAC_RAW_URL:-https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/${BRANCH}}"

# Which OpenCode major to install for. v2 is the default and is never inferred from the host;
# v1 is an explicit opt-in (--opencode v1 or OAC_OPENCODE=v1). The v1 build lives under
# built-ai-configs/opencode-v1/ in the repository and installs into the user's .opencode/ - the folder name is
# never used in a project.
OPENCODE_FLAVOR="${OAC_OPENCODE:-v2}"
# True when the user asked for a flavor (flag or OAC_OPENCODE) rather than getting the default.
OPENCODE_FLAVOR_EXPLICIT=false
[ -n "${OAC_OPENCODE:-}" ] && OPENCODE_FLAVOR_EXPLICIT=true

# Registry URL - supports local fallback for development.
# Priority: 1) REGISTRY_URL env var, 2) Local registry file, 3) Remote GitHub.
# The registry file depends on the flavor, so it is resolved in fetch_registry once the
# arguments are parsed: built-ai-configs/registry/registry.json for v2, built-ai-configs/registry/registry.v1.json for v1.

INSTALL_DIR="${OPENCODE_INSTALL_DIR:-.opencode}"  # Allow override via environment variable
TEMP_DIR="/tmp/opencode-installer-$$"

# Cleanup temp directory on exit (success or failure)
trap 'rm -rf "$TEMP_DIR" 2>/dev/null || true' EXIT INT TERM

# Global variables
SELECTED_COMPONENTS=()
INSTALL_MODE=""
PROFILE=""
NON_INTERACTIVE=false
CUSTOM_INSTALL_DIR=""  # Set via --install-dir argument
LIST_ONLY=false

#############################################################################
# Utility Functions
#############################################################################

jq_exec() {
    local output
    output=$(jq -r "$@")
    local ret=$?
    printf "%s\n" "$output" | tr -d '\r'
    return $ret
}

print_header() {
    echo -e "${CYAN}${BOLD}"
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║                                                                ║"
    echo "║           OpenAgents Control Installer v1.0.0                 ║"
    echo "║                                                                ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_step() {
    echo -e "\n${MAGENTA}${BOLD}▶${NC} $1\n"
}

#############################################################################
# Path Handling (Cross-Platform)
#############################################################################

normalize_and_validate_path() {
    local input_path="$1"
    local normalized_path
    
    # Handle empty path
    if [ -z "$input_path" ]; then
        echo ""
        return 1
    fi
    
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

validate_install_path() {
    local path="$1"
    local parent_dir
    
    # Get parent directory
    parent_dir="$(dirname "$path")"
    
    # Check if parent directory exists
    if [ ! -d "$parent_dir" ]; then
        print_error "Parent directory does not exist: $parent_dir"
        return 1
    fi
    
    # Check if parent directory is writable
    if [ ! -w "$parent_dir" ]; then
        print_error "No write permission for directory: $parent_dir"
        return 1
    fi
    
    # If target directory exists, check if it's writable
    if [ -d "$path" ] && [ ! -w "$path" ]; then
        print_error "No write permission for directory: $path"
        return 1
    fi
    
    return 0
}

get_global_install_path() {
    # Return platform-appropriate global installation path
    case "$PLATFORM" in
        macOS)
            # macOS: Use XDG standard (consistent with Linux)
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

#############################################################################
# Dependency Checks
#############################################################################

check_bash_version() {
    # Check bash version (need 3.2+)
    local bash_version="${BASH_VERSION%%.*}"
    if [ "$bash_version" -lt 3 ]; then
        echo "Error: This script requires Bash 3.2 or higher"
        echo "Current version: $BASH_VERSION"
        echo ""
        echo "Please upgrade bash or use a different shell:"
        echo "  macOS:   brew install bash"
        echo "  Linux:   Use your package manager to update bash"
        echo "  Windows: Use Git Bash or WSL"
        exit 1
    fi
}

check_dependencies() {
    print_step "Checking dependencies..."
    
    local missing_deps=()
    
    if ! command -v curl &> /dev/null; then
        missing_deps+=("curl")
    fi
    
    if ! command -v jq &> /dev/null; then
        missing_deps+=("jq")
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        print_error "Missing required dependencies: ${missing_deps[*]}"
        echo ""
        echo "Please install them:"
        case "$PLATFORM" in
            macOS)
                echo "  brew install ${missing_deps[*]}"
                ;;
            Linux)
                echo "  Ubuntu/Debian: sudo apt-get install ${missing_deps[*]}"
                echo "  Fedora/RHEL:   sudo dnf install ${missing_deps[*]}"
                echo "  Arch:          sudo pacman -S ${missing_deps[*]}"
                ;;
            Windows)
                echo "  Git Bash: Install via https://git-scm.com/"
                echo "  WSL:      sudo apt-get install ${missing_deps[*]}"
                echo "  Scoop:    scoop install ${missing_deps[*]}"
                ;;
            *)
                echo "  Use your package manager to install: ${missing_deps[*]}"
                ;;
        esac
        exit 1
    fi
    
    print_success "All dependencies found"
}

#############################################################################
# Registry Functions
#############################################################################

# Normalise and validate an OpenCode flavor ("v1", "v2", "1", "2"); echoes v1 or v2, or nothing.
normalize_flavor() {
    case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
        v1|1) echo "v1" ;;
        v2|2) echo "v2" ;;
        *) echo "" ;;
    esac
}

registry_file_name() {
    if [ "$OPENCODE_FLAVOR" = "v1" ]; then
        echo "built-ai-configs/registry/registry.v1.json"
    else
        echo "built-ai-configs/registry/registry.json"
    fi
}

# Major version of the OpenCode on PATH, or empty. OAC_OPENCODE_VERSION overrides detection
# (CI and tests set it so a real opencode is never run); "none" means no host.
detect_opencode_major() {
    local out
    if [ -n "${OAC_OPENCODE_VERSION:-}" ]; then
        out="$OAC_OPENCODE_VERSION"
    else
        out=$(opencode --version 2>/dev/null || true)
    fi
    [ "$out" = "none" ] && return 0
    printf '%s' "$out" | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -n 1 | cut -d. -f1
}

warn_flavor_host_mismatch() {
    local major
    major=$(detect_opencode_major)
    [ -z "$major" ] && return 0
    if [ "$OPENCODE_FLAVOR" = "v2" ] && [ "$major" = "1" ]; then
        print_warning "OpenCode v1 is installed, but this installs for OpenCode v2 (the default). For v1, run again with --opencode v1."
    elif [ "$OPENCODE_FLAVOR" = "v1" ] && [ "$major" != "1" ]; then
        print_warning "Installing for OpenCode v1, but OpenCode ${major} is installed; v1 agents, tools and plugins do not load there."
    fi
}

# A later release can rename an agent (contextscout -> context-scout) or move it (v1:
# agent/subagents/core/x.md -> agent/core/x.md). The registry lists, on the component that replaced
# it, the paths it used to ship at ("supersedes"). OpenCode loads every file under agent/, so
# leaving the old copy next to the new one defines the agent twice.
#
# superseded_rows prints "old<TAB>new<TAB>description" for every such pair in the registry.
superseded_rows() {
    [ -f "$TEMP_DIR/registry.json" ] || return 0
    jq -r '.components | to_entries[] | .value[]? | select((.supersedes // []) | length > 0)
           | .path as $p | (.description // "") as $d | .supersedes[] | [., $p, $d] | @tsv' \
        "$TEMP_DIR/registry.json" 2>/dev/null | tr -d '\r'
}

# The description line of an agent's frontmatter, without surrounding quotes.
frontmatter_description() {
    sed -n -E '1,/^---[[:space:]]*$/{ s/^description:[[:space:]]*//p; }' "$1" 2>/dev/null | head -n 1 \
        | sed -E 's/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/; s/[[:space:]]+$//'
}

# Remove empty directories between a removed file and the install dir (never the install dir itself).
prune_empty_dirs() {
    local dir
    dir=$(dirname "$1")
    while [ "$dir" != "$INSTALL_DIR" ] && [ "${dir#"$INSTALL_DIR"/}" != "$dir" ]; do
        # A v1 folder holding only its category marker is empty for our purposes.
        if [ -f "$dir/0-category.json" ] && [ "$(ls -A "$dir" | wc -l | tr -d ' ')" = "1" ]; then
            rm -f "$dir/0-category.json"
        fi
        rmdir "$dir" 2>/dev/null || return 0
        dir=$(dirname "$dir")
    done
}

# Retire installed files that a renamed or moved component replaced, once the replacement is on
# disk. Never deletes without a copy: each file is first copied to ${INSTALL_DIR}.backup.<time>/
# (the same convention as the "backup" install strategy). A file that no longer reads as the old
# bundled copy (its description differs) is the user's own agent: it is left and reported.
# Needs jq (already required by this script). Paths come from the registry and are checked by
# get_install_path, so nothing outside the install directory can be touched.
retire_superseded_files() {
    local rows old new desc dest_old dest_new retired=0 kept=0 backup_dir="" actual
    rows=$(superseded_rows) || return 0
    [ -n "$rows" ] || return 0
    while IFS=$'\t' read -r old new desc; do
        [ -n "$old" ] && [ -n "$new" ] || continue
        dest_new=$(get_install_path "$new") || continue
        dest_old=$(get_install_path "$old") || { print_warning "Refusing unsafe registry path: $old"; continue; }
        [ "$dest_old" != "$dest_new" ] || continue
        [ -f "$dest_old" ] || continue
        [ -f "$dest_new" ] || continue
        actual=$(frontmatter_description "$dest_old")
        if [ "$actual" != "$desc" ]; then
            print_warning "Left ${dest_old}: it does not look like the old OAC file replaced by ${dest_new}. If it is a duplicate, remove it yourself."
            kept=$((kept + 1))
            continue
        fi
        if [ -z "$backup_dir" ]; then
            backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
        fi
        local rel="${dest_old#"${INSTALL_DIR}"/}"
        mkdir -p "$(dirname "${backup_dir}/${rel}")"
        if cp "$dest_old" "${backup_dir}/${rel}" && rm -f "$dest_old"; then
            print_success "Removed superseded ${rel} (replaced by ${dest_new#"${INSTALL_DIR}"/}; copy in ${backup_dir})"
            prune_empty_dirs "$dest_old"
            retired=$((retired + 1))
        else
            print_warning "Could not remove superseded ${dest_old}"
        fi
    done <<< "$rows"
    SUPERSEDED_RETIRED=$retired
    SUPERSEDED_KEPT=$kept
}

SUPERSEDED_RETIRED=0
SUPERSEDED_KEPT=0

# Warn about agent files from an earlier layout that are still next to their replacements.
# retire_superseded_files has already removed what it safely could; this names the rest.
warn_legacy_agent_layout() {
    # v2: an earlier release nested agents by category (agent/core/openagent.md); v2 loads every file.
    if [ "$OPENCODE_FLAVOR" = "v2" ]; then
        if [ -d "${INSTALL_DIR}/agent/core" ] || [ -d "${INSTALL_DIR}/agent/subagents" ]; then
            print_warning "Found nested agents from an earlier install in ${INSTALL_DIR}/agent/. OpenCode v2 would load them next to the new ones. Run 'oac update --opencode v2' to migrate safely, or remove them."
        fi
        return 0
    fi
    # v1: subagents used to live in agent/subagents/<category>/; they now live in agent/<category>/.
    if [ -d "${INSTALL_DIR}/agent/subagents" ]; then
        local left
        left=$(find "${INSTALL_DIR}/agent/subagents" -name '*.md' -type f 2>/dev/null | head -n 20)
        if [ -n "$left" ]; then
            print_warning "Old-layout agents remain in ${INSTALL_DIR}/agent/subagents/ (OpenCode v1 loads them next to their replacements in agent/<category>/):"
            while IFS= read -r f; do printf '    %s\n' "$f"; done <<< "$left"
            print_warning "Run 'oac update' to remove the ones OAC shipped (edited copies are backed up), or delete them yourself if they are duplicates."
        fi
    fi
}

record_flavor() {
    mkdir -p "$INSTALL_DIR"
    printf '%s\n' "$OPENCODE_FLAVOR" > "${INSTALL_DIR}/.oac-opencode"
}

FILES_WRITTEN=0

# Write the marker when this run left files of this flavor on disk: at least one file was written,
# or nothing failed and every file was already there (an all-skipped re-run). Components that
# failed do not matter once some file was written - a mostly complete install with no marker is
# later refused by update.sh as "unknown version". A run that wrote nothing and failed records
# nothing. refuse_flavor_switch has already ruled out an install of the other flavor.
record_flavor_if_ok() {
    local written=$1 failed=$2
    if [ "$written" -gt 0 ] || [ "$failed" -eq 0 ]; then
        record_flavor
    fi
}

# Refuse to install one flavor over an existing install of the other: the files would sit side by
# side (flat v2 agents next to nested v1 agents, every agent defined twice). Same wording as
# update.sh; `oac update --opencode <flavor>` is the tool that migrates safely.
# What the install is, in order: .oac/config.json (the CLI's record, which wins), the marker file,
# and - only when the user explicitly asked for a flavor - the layout on disk.
refuse_flavor_switch() {
    local actual="" project_root="" config_file=""
    if [ "$(basename "$INSTALL_DIR")" = ".opencode" ]; then
        project_root="$(dirname "$INSTALL_DIR")"
        config_file="${project_root}/.oac/config.json"
    fi
    if [ -n "$config_file" ] && [ -f "$config_file" ]; then
        actual=$(normalize_flavor "$(jq -r '.opencode.target // empty' "$config_file" 2>/dev/null | tr -d '\r')")
    fi
    if [ -z "$actual" ] && [ -f "${INSTALL_DIR}/.oac-opencode" ]; then
        actual=$(normalize_flavor "$(tr -d '[:space:]' < "${INSTALL_DIR}/.oac-opencode")")
    fi
    if [ -z "$actual" ] && [ "$OPENCODE_FLAVOR_EXPLICIT" = true ]; then
        if [ -d "${INSTALL_DIR}/agent/core" ] || [ -d "${INSTALL_DIR}/agent/subagents" ]; then
            actual="v1"
        elif [ -f "${INSTALL_DIR}/agent/openagent.md" ]; then
            actual="v2"
        fi
    fi
    if [ -n "$actual" ] && [ "$actual" != "$OPENCODE_FLAVOR" ]; then
        print_error "${INSTALL_DIR} is an OpenCode ${actual} install; install.sh cannot add OpenCode ${OPENCODE_FLAVOR} files next to it."
        print_error "Migrate it with: oac update --opencode ${OPENCODE_FLAVOR}   (or install.sh --opencode ${actual} to stay on ${actual})"
        cleanup_and_exit 1
    fi
}

# A registry path is only ever a relative path inside the repository. Same rule as the CLI's
# isInstallablePath: no absolute paths (POSIX or drive-letter) and no ".." segment.
is_safe_registry_path() {
    local p="${1//\\//}"
    [ -n "$p" ] || return 1
    case "$p" in
        /*|[A-Za-z]:*|..|../*|*/..|*/../*) return 1 ;;
    esac
    return 0
}

fetch_registry() {
    print_step "Fetching component registry..."
    
    mkdir -p "$TEMP_DIR"

    local registry_file
    registry_file=$(registry_file_name)
    if [ -n "$REGISTRY_URL" ]; then
        # Explicit REGISTRY_URL (for testing) wins.
        :
    elif [ -f "./${registry_file}" ]; then
        # Local registry file if it exists (for development)
        REGISTRY_URL="file://$(pwd)/${registry_file}"
    else
        REGISTRY_URL="${RAW_URL}/${registry_file}"
    fi
    
    # Handle local file:// URLs
    if [[ "$REGISTRY_URL" == file://* ]]; then
        local local_path="${REGISTRY_URL#file://}"
        if [ -f "$local_path" ]; then
            cp "$local_path" "$TEMP_DIR/registry.json"
            print_success "Using local registry: $local_path"
        else
            print_error "Local registry not found: $local_path"
            exit 1
        fi
    else
        # Fetch from remote URL
        if ! curl -fsSL "$REGISTRY_URL" -o "$TEMP_DIR/registry.json"; then
            print_error "Failed to fetch registry from $REGISTRY_URL"
            exit 1
        fi
        print_success "Registry fetched successfully"
    fi
}

get_profile_components() {
    local profile=$1
    jq_exec ".profiles.${profile}.components[]?" "$TEMP_DIR/registry.json"
}

get_component_info() {
    local component_id=$1
    local component_type=$2
    
    if [ "$component_type" = "context" ] && [[ "$component_id" == */* ]]; then
        jq_exec "first(.components.contexts[]? | select(.path == \".opencode/context/${component_id}.md\"))" "$TEMP_DIR/registry.json"
        return
    fi

    jq_exec ".components.${component_type}[]? | select(.id == \"${component_id}\" or (.aliases // [] | index(\"${component_id}\")))" "$TEMP_DIR/registry.json"
}

resolve_component_path() {
    local component_type=$1
    local component_id=$2
    local registry_key
    registry_key=$(get_registry_key "$component_type")

    if [ "$component_type" = "context" ] && [[ "$component_id" == */* ]]; then
        # Try .md extension first (most context files), then fall back to the
        # path as-is for non-markdown files (e.g. paths.json). Fixes #251.
        local result
        result=$(jq_exec "first(.components.contexts[]? | select(.path == \".opencode/context/${component_id}.md\") | .path)" "$TEMP_DIR/registry.json")
        if [ -z "$result" ] || [ "$result" = "null" ]; then
            result=$(jq_exec "first(.components.contexts[]? | select(.path == \".opencode/context/${component_id}\") | .path)" "$TEMP_DIR/registry.json")
        fi
        echo "$result"
        return
    fi

    jq_exec ".components.${registry_key}[]? | select(.id == \"${component_id}\" or (.aliases // [] | index(\"${component_id}\"))) | .path" "$TEMP_DIR/registry.json"
}

# Helper function to get the correct registry key for a component type
get_registry_key() {
    local type=$1
    # Handle both singular and plural forms
    # Registry uses plural keys: agents, contexts, skills
    case "$type" in
        config) echo "config" ;;
        # Already plural forms - use as-is
        agents|contexts|skills) echo "$type" ;;
        # Singular forms - pluralize them
        agent) echo "agents" ;;
        context) echo "contexts" ;;
        skill) echo "skills" ;;
        # Fallback: if already ends with 's', assume plural
        *s) echo "$type" ;;
        # Default: add 's' to make plural
        *) echo "${type}s" ;;
    esac
}

# Helper function to convert registry path to installation path
# Registry paths are like ".opencode/agent/foo.md"
# We need to replace ".opencode" with the actual INSTALL_DIR
get_install_path() {
    local registry_path=$1
    is_safe_registry_path "$registry_path" || return 1
    # Strip the leading .opencode/ - or built-ai-configs/opencode-v1/, the repository folder of the v1 build,
    # whose files install to the same place - if present
    local relative_path="${registry_path#.opencode/}"
    relative_path="${relative_path#built-ai-configs/opencode-v1/}"
    # Return INSTALL_DIR + relative path
    echo "${INSTALL_DIR}/${relative_path}"
}

expand_context_wildcard() {
    local pattern=$1
    local prefix="${pattern%%\**}"

    prefix="${prefix%/}"
    if [ -n "$prefix" ]; then
        prefix="${prefix}/"
    fi

    jq_exec ".components.contexts[]? | select(.path | startswith(\".opencode/context/${prefix}\")) | .path | sub(\"^\\\\.opencode/context/\"; \"\") | sub(\"\\\\.md$\"; \"\")" "$TEMP_DIR/registry.json"
}

expand_selected_components() {
    local expanded=()

    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        local id="${comp##*:}"

        if [[ "$id" == *"*"* ]]; then
            if [ "$type" != "context" ]; then
                print_warning "Wildcard only supported for context components: ${comp}"
                continue
            fi

            local matches
            matches=$(expand_context_wildcard "$id")

            if [ -z "$matches" ]; then
                print_warning "No contexts matched: ${comp}"
                continue
            fi

            while IFS= read -r match; do
                [ -n "$match" ] && expanded+=("context:${match}")
            done <<< "$matches"
            continue
        fi

        expanded+=("$comp")
    done

    local deduped=()
    for comp in "${expanded[@]}"; do
        local found=0
        for existing in "${deduped[@]}"; do
            if [ "$existing" = "$comp" ]; then
                found=1
                break
            fi
        done
        if [ "$found" -eq 0 ]; then
            deduped+=("$comp")
        fi
    done

    SELECTED_COMPONENTS=("${deduped[@]}")
}

resolve_dependencies() {
    local component=$1
    local type="${component%%:*}"
    local id="${component##*:}"
    
    # Get the correct registry key (handles singular/plural)
    local registry_key
    registry_key=$(get_registry_key "$type")
    
    # Get dependencies for this component
    local deps
    deps=$(jq_exec ".components.${registry_key}[] | select(.id == \"${id}\" or (.aliases // [] | index(\"${id}\"))) | .dependencies[]?" "$TEMP_DIR/registry.json" 2>/dev/null || echo "")
    
    if [ -n "$deps" ]; then
        for dep in $deps; do
            if [[ "$dep" == *"*"* ]]; then
                local dep_type="${dep%%:*}"
                local dep_id="${dep##*:}"

                if [ "$dep_type" = "context" ]; then
                    local matched
                    matched=$(expand_context_wildcard "$dep_id")

                    if [ -z "$matched" ]; then
                        print_warning "No contexts matched dependency: ${dep}"
                        continue
                    fi

                    while IFS= read -r match; do
                        local expanded_dep="context:${match}"
                        local found=0
                        for existing in "${SELECTED_COMPONENTS[@]}"; do
                            if [ "$existing" = "$expanded_dep" ]; then
                                found=1
                                break
                            fi
                        done
                        if [ "$found" -eq 0 ]; then
                            SELECTED_COMPONENTS+=("$expanded_dep")
                            resolve_dependencies "$expanded_dep"
                        fi
                    done <<< "$matched"
                    continue
                fi
            fi

            # Add dependency if not already in list
            local found=0
            for existing in "${SELECTED_COMPONENTS[@]}"; do
                if [ "$existing" = "$dep" ]; then
                    found=1
                    break
                fi
            done
            if [ "$found" -eq 0 ]; then
                SELECTED_COMPONENTS+=("$dep")
                # Recursively resolve dependencies
                resolve_dependencies "$dep"
            fi
        done
    fi
}

#############################################################################
# Installation Mode Selection
#############################################################################

check_interactive_mode() {
    # Check if stdin is a terminal (not piped from curl)
    if [ ! -t 0 ]; then
        print_header
        print_error "Interactive mode requires a terminal"
        echo ""
        echo "You're running this script in a pipe (e.g., curl | bash)"
        echo "For interactive mode, download the script first:"
        echo ""
        echo -e "${CYAN}# Download the script${NC}"
        echo "curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh -o install.sh"
        echo ""
        echo -e "${CYAN}# Run interactively${NC}"
        echo "bash install.sh"
        echo ""
        echo "Or use a profile directly:"
        echo ""
        echo -e "${CYAN}# Quick install with profile${NC}"
        echo "curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s essential"
        echo ""
        echo "Available profiles: essential, developer, business, full, advanced"
        echo ""
        cleanup_and_exit 1
    fi
}

show_install_location_menu() {
    check_interactive_mode
    
    clear
    print_header
    
    local global_path
    global_path=$(get_global_install_path)
    
    echo -e "${BOLD}Choose installation location:${NC}\n"
    echo -e "  ${GREEN}1) Local${NC} - Install to ${CYAN}.opencode/${NC} in current directory"
    echo "     (Best for project-specific agents)"
    echo ""
    echo -e "  ${BLUE}2) Global${NC} - Install to ${CYAN}${global_path}${NC}"
    echo "     (Best for user-wide agents available everywhere)"
    echo ""
    echo -e "  ${MAGENTA}3) Custom${NC} - Enter exact path"
    echo "     Examples:"
    case "$PLATFORM" in
        Windows)
            echo -e "       ${CYAN}C:/Users/username/my-agents${NC} or ${CYAN}~/my-agents${NC}"
            ;;
        *)
            echo -e "       ${CYAN}/home/username/my-agents${NC} or ${CYAN}~/my-agents${NC}"
            ;;
    esac
    echo ""
    echo "  4) Back / Exit"
    echo ""
    read -r -p "Enter your choice [1-4]: " location_choice
    
    case $location_choice in
        1)
            INSTALL_DIR=".opencode"
            print_success "Installing to local directory: .opencode/"
            sleep 1
            ;;
        2)
            INSTALL_DIR="$global_path"
            print_success "Installing to global directory: $global_path"
            sleep 1
            ;;
        3)
            echo ""
            read -r -p "Enter installation path: " custom_path
            
            if [ -z "$custom_path" ]; then
                print_error "No path entered"
                sleep 2
                show_install_location_menu
                return
            fi
            
            local normalized_path
            normalized_path=$(normalize_and_validate_path "$custom_path")
            
            if ! normalize_and_validate_path "$custom_path" > /dev/null; then
                print_error "Invalid path"
                sleep 2
                show_install_location_menu
                return
            fi
            
            if ! validate_install_path "$normalized_path"; then
                echo ""
                read -r -p "Continue anyway? [y/N]: " continue_choice
                if [[ ! $continue_choice =~ ^[Yy] ]]; then
                    show_install_location_menu
                    return
                fi
            fi
            
            INSTALL_DIR="$normalized_path"
            print_success "Installing to custom directory: $INSTALL_DIR"
            sleep 1
            ;;
        4)
            cleanup_and_exit 0
            ;;
        *)
            print_error "Invalid choice"
            sleep 2
            show_install_location_menu
            return
            ;;
    esac
}

show_main_menu() {
    check_interactive_mode
    
    clear
    print_header
    
    echo -e "${BOLD}Choose installation mode:${NC}\n"
    echo "  1) Quick Install (Choose a profile)"
    echo "  2) Custom Install (Pick individual components)"
    echo "  3) List Available Components"
    echo "  4) Exit"
    echo ""
    read -r -p "Enter your choice [1-4]: " choice
    
    case $choice in
        1) INSTALL_MODE="profile" ;;
        2) INSTALL_MODE="custom" ;;
        3) list_components; read -r -p "Press Enter to continue..."; show_main_menu ;;
        4) cleanup_and_exit 0 ;;
        *) print_error "Invalid choice"; sleep 2; show_main_menu ;;
    esac
}

#############################################################################
# Profile Installation
#############################################################################

show_profile_menu() {
    clear
    print_header
    
    echo -e "${BOLD}Available Installation Profiles:${NC}\n"
    
    # Essential profile
    local essential_name
    essential_name=$(jq_exec '.profiles.essential.name' "$TEMP_DIR/registry.json")
    local essential_desc
    essential_desc=$(jq_exec '.profiles.essential.description' "$TEMP_DIR/registry.json")
    local essential_count
    essential_count=$(jq_exec '.profiles.essential.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${GREEN}1) ${essential_name}${NC}"
    echo -e "     ${essential_desc}"
    echo -e "     Components: ${essential_count}\n"
    
    # Developer profile
    local dev_desc
    dev_desc=$(jq_exec '.profiles.developer.description' "$TEMP_DIR/registry.json")
    local dev_count
    dev_count=$(jq_exec '.profiles.developer.components | length' "$TEMP_DIR/registry.json")
    local dev_badge
    dev_badge=$(jq_exec '.profiles.developer.badge // ""' "$TEMP_DIR/registry.json")
    if [ -n "$dev_badge" ]; then
        echo -e "  ${BLUE}2) Developer ${GREEN}[${dev_badge}]${NC}"
    else
        echo -e "  ${BLUE}2) Developer${NC}"
    fi
    echo -e "     ${dev_desc}"
    echo -e "     Components: ${dev_count}\n"
    
    # Business profile
    local business_name
    business_name=$(jq_exec '.profiles.business.name' "$TEMP_DIR/registry.json")
    local business_desc
    business_desc=$(jq_exec '.profiles.business.description' "$TEMP_DIR/registry.json")
    local business_count
    business_count=$(jq_exec '.profiles.business.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${CYAN}3) ${business_name}${NC}"
    echo -e "     ${business_desc}"
    echo -e "     Components: ${business_count}\n"
    
    # Full profile
    local full_name
    full_name=$(jq_exec '.profiles.full.name' "$TEMP_DIR/registry.json")
    local full_desc
    full_desc=$(jq_exec '.profiles.full.description' "$TEMP_DIR/registry.json")
    local full_count
    full_count=$(jq_exec '.profiles.full.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${MAGENTA}4) ${full_name}${NC}"
    echo -e "     ${full_desc}"
    echo -e "     Components: ${full_count}\n"
    
    # Advanced profile
    local adv_name
    adv_name=$(jq_exec '.profiles.advanced.name' "$TEMP_DIR/registry.json")
    local adv_desc
    adv_desc=$(jq_exec '.profiles.advanced.description' "$TEMP_DIR/registry.json")
    local adv_count
    adv_count=$(jq_exec '.profiles.advanced.components | length' "$TEMP_DIR/registry.json")
    echo -e "  ${YELLOW}5) ${adv_name}${NC}"
    echo -e "     ${adv_desc}"
    echo -e "     Components: ${adv_count}\n"
    
    echo "  6) Back to main menu"
    echo ""
    read -r -p "Enter your choice [1-6]: " choice
    
    case $choice in
        1) PROFILE="essential" ;;
        2) PROFILE="developer" ;;
        3) PROFILE="business" ;;
        4) PROFILE="full" ;;
        5) PROFILE="advanced" ;;
        6) show_main_menu; return ;;
        *) print_error "Invalid choice"; sleep 2; show_profile_menu; return ;;
    esac
    
    # Load profile components (compatible with bash 3.2+)
    SELECTED_COMPONENTS=()
    local temp_file="$TEMP_DIR/components.tmp"
    get_profile_components "$PROFILE" > "$temp_file"
    while IFS= read -r component; do
        [ -n "$component" ] && SELECTED_COMPONENTS+=("$component")
    done < "$temp_file"

    expand_selected_components
    
    # Resolve dependencies for profile installs
    print_step "Resolving dependencies..."
    local original_count=${#SELECTED_COMPONENTS[@]}
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        resolve_dependencies "$comp"
    done
    
    local new_count=${#SELECTED_COMPONENTS[@]}
    if [ "$new_count" -gt "$original_count" ]; then
        local added=$((new_count - original_count))
        print_info "Added $added dependencies"
    fi
    
    show_installation_preview
}

#############################################################################
# Custom Component Selection
#############################################################################

show_custom_menu() {
    clear
    print_header
    
    echo -e "${BOLD}Select component categories to install:${NC}\n"
    echo "Use space to toggle, Enter to continue"
    echo ""
    
    local categories=("agents" "subagents" "commands" "tools" "plugins" "skills" "contexts" "config")
    local selected_categories=()
    
    # Simple selection (for now, we'll make it interactive later)
    echo "Available categories:"
    for i in "${!categories[@]}"; do
        local cat="${categories[$i]}"
        local count
        count=$(jq_exec ".components.${cat} | length" "$TEMP_DIR/registry.json")
        local cat_display
        cat_display=$(echo "$cat" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
        echo "  $((i+1))) ${cat_display} (${count} available)"
    done
    echo "  $((${#categories[@]}+1))) Select All"
    echo "  $((${#categories[@]}+2))) Continue to component selection"
    echo "  $((${#categories[@]}+3))) Back to main menu"
    echo ""
    
    read -r -p "Enter category numbers (space-separated) or option: " -a selections
    
    for sel in "${selections[@]}"; do
        if [ "$sel" -eq $((${#categories[@]}+1)) ]; then
            selected_categories=("${categories[@]}")
            break
        elif [ "$sel" -eq $((${#categories[@]}+2)) ]; then
            break
        elif [ "$sel" -eq $((${#categories[@]}+3)) ]; then
            show_main_menu
            return
        elif [ "$sel" -ge 1 ] && [ "$sel" -le ${#categories[@]} ]; then
            selected_categories+=("${categories[$((sel-1))]}")
        fi
    done
    
    if [ ${#selected_categories[@]} -eq 0 ]; then
        print_warning "No categories selected"
        sleep 2
        show_custom_menu
        return
    fi
    
    show_component_selection "${selected_categories[@]}"
}

show_component_selection() {
    local categories=("$@")
    clear
    print_header
    
    echo -e "${BOLD}Select components to install:${NC}\n"
    
    local all_components=()
    local component_details=()
    
    for category in "${categories[@]}"; do
        local cat_display
        cat_display=$(echo "$category" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
        echo -e "${CYAN}${BOLD}${cat_display}:${NC}"
        
        local components
        components=$(jq_exec ".components.${category}[]? | .id" "$TEMP_DIR/registry.json")
        
        local idx=1
        while IFS= read -r comp_id; do
            local comp_name
            comp_name=$(jq_exec ".components.${category}[]? | select(.id == \"${comp_id}\") | .name" "$TEMP_DIR/registry.json")
            local comp_desc
            comp_desc=$(jq_exec ".components.${category}[]? | select(.id == \"${comp_id}\") | .description" "$TEMP_DIR/registry.json")
            
            echo "  ${idx}) ${comp_name}"
            echo "     ${comp_desc}"
            
            all_components+=("${category}:${comp_id}")
            component_details+=("${comp_name}|${comp_desc}")
            
            idx=$((idx+1))
        done <<< "$components"
        
        echo ""
    done
    
    echo "Enter component numbers (space-separated), 'all' for all, or 'done' to continue:"
    read -r -a selections
    
    for sel in "${selections[@]}"; do
        if [ "$sel" = "all" ]; then
            SELECTED_COMPONENTS=("${all_components[@]}")
            break
        elif [ "$sel" = "done" ]; then
            break
        elif [ "$sel" -ge 1 ] && [ "$sel" -le ${#all_components[@]} ]; then
            SELECTED_COMPONENTS+=("${all_components[$((sel-1))]}")
        fi
    done
    
    if [ ${#SELECTED_COMPONENTS[@]} -eq 0 ]; then
        print_warning "No components selected"
        sleep 2
        show_custom_menu
        return
    fi
    
    # Resolve dependencies
    print_step "Resolving dependencies..."
    local original_count=${#SELECTED_COMPONENTS[@]}
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        resolve_dependencies "$comp"
    done
    
    if [ ${#SELECTED_COMPONENTS[@]} -gt "$original_count" ]; then
        print_info "Added $((${#SELECTED_COMPONENTS[@]} - original_count)) dependencies"
    fi
    
    show_installation_preview
}

#############################################################################
# Installation Preview & Confirmation
#############################################################################

show_installation_preview() {
    # Only clear screen in interactive mode
    if [ "$NON_INTERACTIVE" != true ]; then
        clear
    fi
    print_header
    
    echo -e "${BOLD}Installation Preview${NC}\n"
    
    if [ -n "$PROFILE" ]; then
        echo -e "Profile: ${GREEN}${PROFILE}${NC}"
    else
        echo -e "Mode: ${GREEN}Custom${NC}"
    fi
    
    echo -e "Installation directory: ${CYAN}${INSTALL_DIR}${NC}"
    
    echo -e "\nComponents to install (${#SELECTED_COMPONENTS[@]} total):\n"
    
    # Group by type
    local agents=()
    local subagents=()
    local commands=()
    local tools=()
    local plugins=()
    local skills=()
    local contexts=()
    local configs=()
    
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        case $type in
            agent) agents+=("$comp") ;;
            subagent) subagents+=("$comp") ;;
            command) commands+=("$comp") ;;
            tool) tools+=("$comp") ;;
            plugin) plugins+=("$comp") ;;
            skill) skills+=("$comp") ;;
            context) contexts+=("$comp") ;;
            config) configs+=("$comp") ;;
        esac
    done
    
    [ ${#agents[@]} -gt 0 ] && echo -e "${CYAN}Agents (${#agents[@]}):${NC} ${agents[*]##*:}"
    [ ${#subagents[@]} -gt 0 ] && echo -e "${CYAN}Subagents (${#subagents[@]}):${NC} ${subagents[*]##*:}"
    [ ${#commands[@]} -gt 0 ] && echo -e "${CYAN}Commands (${#commands[@]}):${NC} ${commands[*]##*:}"
    [ ${#tools[@]} -gt 0 ] && echo -e "${CYAN}Tools (${#tools[@]}):${NC} ${tools[*]##*:}"
    [ ${#plugins[@]} -gt 0 ] && echo -e "${CYAN}Plugins (${#plugins[@]}):${NC} ${plugins[*]##*:}"
    [ ${#skills[@]} -gt 0 ] && echo -e "${CYAN}Skills (${#skills[@]}):${NC} ${skills[*]##*:}"
    [ ${#contexts[@]} -gt 0 ] && echo -e "${CYAN}Contexts (${#contexts[@]}):${NC} ${contexts[*]##*:}"
    [ ${#configs[@]} -gt 0 ] && echo -e "${CYAN}Config (${#configs[@]}):${NC} ${configs[*]##*:}"
    
    echo ""
    
    # Skip confirmation if profile was provided via command line
    if [ "$NON_INTERACTIVE" = true ]; then
        print_info "Installing automatically (profile specified)..."
        perform_installation
    else
        read -r -p "Proceed with installation? [Y/n]: " confirm
        
        if [[ $confirm =~ ^[Nn] ]]; then
            print_info "Installation cancelled"
            cleanup_and_exit 0
        fi
        
        perform_installation
    fi
}

#############################################################################
# Collision Detection
#############################################################################

show_collision_report() {
    local collision_count=$1
    shift
    local collisions=("$@")
    
    echo ""
    print_warning "Found ${collision_count} file collision(s):"
    echo ""
    
    # Group by type
    local agents=()
    local subagents=()
    local commands=()
    local tools=()
    local plugins=()
    local skills=()
    local contexts=()
    local configs=()
    
    for file in "${collisions[@]}"; do
        # Skip empty entries
        [ -z "$file" ] && continue
        
        if [[ $file == *"/agent/subagents/"* ]]; then
            subagents+=("$file")
        elif [[ $file == *"/agent/"* ]]; then
            agents+=("$file")
        elif [[ $file == *"/command/"* ]]; then
            commands+=("$file")
        elif [[ $file == *"/tool/"* ]]; then
            tools+=("$file")
        elif [[ $file == *"/plugin/"* ]]; then
            plugins+=("$file")
        elif [[ $file == *"/skills/"* ]]; then
            skills+=("$file")
        elif [[ $file == *"/context/"* ]]; then
            contexts+=("$file")
        else
            configs+=("$file")
        fi
    done
    
    # Display grouped collisions
    [ ${#agents[@]} -gt 0 ] && echo -e "${YELLOW}  Agents (${#agents[@]}):${NC}" && printf '    %s\n' "${agents[@]}"
    [ ${#subagents[@]} -gt 0 ] && echo -e "${YELLOW}  Subagents (${#subagents[@]}):${NC}" && printf '    %s\n' "${subagents[@]}"
    [ ${#commands[@]} -gt 0 ] && echo -e "${YELLOW}  Commands (${#commands[@]}):${NC}" && printf '    %s\n' "${commands[@]}"
    [ ${#tools[@]} -gt 0 ] && echo -e "${YELLOW}  Tools (${#tools[@]}):${NC}" && printf '    %s\n' "${tools[@]}"
    [ ${#plugins[@]} -gt 0 ] && echo -e "${YELLOW}  Plugins (${#plugins[@]}):${NC}" && printf '    %s\n' "${plugins[@]}"
    [ ${#skills[@]} -gt 0 ] && echo -e "${YELLOW}  Skills (${#skills[@]}):${NC}" && printf '    %s\n' "${skills[@]}"
    [ ${#contexts[@]} -gt 0 ] && echo -e "${YELLOW}  Context (${#contexts[@]}):${NC}" && printf '    %s\n' "${contexts[@]}"
    [ ${#configs[@]} -gt 0 ] && echo -e "${YELLOW}  Config (${#configs[@]}):${NC}" && printf '    %s\n' "${configs[@]}"
    
    echo ""
}

get_install_strategy() {
    echo -e "${BOLD}How would you like to proceed?${NC}\n" >&2
    echo -e "  1) ${GREEN}Skip existing${NC} - Only install new files, keep all existing files unchanged" >&2
    echo -e "  2) ${YELLOW}Overwrite all${NC} - Replace existing files with new versions (your changes will be lost)" >&2
    echo -e "  3) ${CYAN}Backup & overwrite${NC} - Backup existing files, then install new versions" >&2
    echo -e "  4) ${RED}Cancel${NC} - Exit without making changes" >&2
    echo "" >&2
    read -r -p "Enter your choice [1-4]: " strategy_choice
    
    case $strategy_choice in
        1) echo "skip" ;;
        2) 
            echo "" >&2
            print_warning "This will overwrite existing files. Your changes will be lost!"
            read -r -p "Are you sure? Type 'yes' to confirm: " confirm
            if [ "$confirm" = "yes" ]; then
                echo "overwrite"
            else
                echo "cancel"
            fi
            ;;
        3) echo "backup" ;;
        4) echo "cancel" ;;
        *) echo "cancel" ;;
    esac
}

#############################################################################
# Installation
#############################################################################

perform_installation() {
    refuse_flavor_switch
    print_step "Preparing installation..."
    
    # Create base directory only - subdirectories created on-demand when files are installed
    mkdir -p "$INSTALL_DIR"
    
    # Check for collisions
    local collisions=()
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        local id="${comp##*:}"
        local registry_key
        registry_key=$(get_registry_key "$type")
        local path
        path=$(resolve_component_path "$type" "$id")
        
        if [ -n "$path" ] && [ "$path" != "null" ]; then
            local install_path
            install_path=$(get_install_path "$path") || continue
            if [ -f "$install_path" ]; then
                collisions+=("$install_path")
            fi
        fi
    done
    
    # Determine installation strategy
    local install_strategy="fresh"
    
    if [ ${#collisions[@]} -gt 0 ]; then
        # In non-interactive mode, use default strategy (skip existing files)
        if [ "$NON_INTERACTIVE" = true ]; then
            print_info "Found ${#collisions[@]} existing file(s) - using 'skip' strategy (non-interactive mode)"
            print_info "To overwrite, download script and run interactively, or delete existing files first"
            install_strategy="skip"
        else
            show_collision_report ${#collisions[@]} "${collisions[@]}"
            install_strategy=$(get_install_strategy)
            
            if [ "$install_strategy" = "cancel" ]; then
                print_info "Installation cancelled by user"
                cleanup_and_exit 0
            fi
        fi
        
        # Handle backup strategy
        if [ "$install_strategy" = "backup" ]; then
            local backup_dir
            backup_dir="${INSTALL_DIR}.backup.$(date +%Y%m%d-%H%M%S)"
            print_step "Creating backup..."
            
            # Only backup files that will be overwritten
            local backup_count=0
            for file in "${collisions[@]}"; do
                if [ -f "$file" ]; then
                    local backup_file="${backup_dir}/${file}"
                    mkdir -p "$(dirname "$backup_file")"
                    if cp "$file" "$backup_file" 2>/dev/null; then
                        backup_count=$((backup_count + 1))
                    else
                        print_warning "Failed to backup: $file"
                    fi
                fi
            done
            
            if [ $backup_count -gt 0 ]; then
                print_success "Backed up ${backup_count} file(s) to $backup_dir"
                install_strategy="overwrite"  # Now we can overwrite
            else
                print_error "Backup failed. Installation cancelled."
                cleanup_and_exit 1
            fi
        fi
    fi
    
    # Perform installation
    print_step "Installing components..."
    
    local installed=0
    local skipped=0
    local failed=0
    FILES_WRITTEN=0
    
    for comp in "${SELECTED_COMPONENTS[@]}"; do
        local type="${comp%%:*}"
        local id="${comp##*:}"
        
        # Get the correct registry key (handles singular/plural)
        local registry_key
        registry_key=$(get_registry_key "$type")
        
        # Get component path
        local path
        path=$(resolve_component_path "$type" "$id")
        
        if [ -z "$path" ] || [ "$path" = "null" ]; then
            print_warning "Could not find path for ${comp}"
            failed=$((failed + 1))
            continue
        fi
        
        # Check if component has additional files (for skills)
        local files_array
        files_array=$(jq_exec ".components.${registry_key}[]? | select(.id == \"${id}\") | .files[]?" "$TEMP_DIR/registry.json")
        
        if [ -n "$files_array" ]; then
            # Component has multiple files - download all of them
            local component_installed=0
            local component_failed=0
            
            while IFS= read -r file_path; do
                [ -z "$file_path" ] && continue
                
                local dest
                if ! dest=$(get_install_path "$file_path"); then
                    print_warning "Refusing unsafe registry path: $file_path"
                    component_failed=$((component_failed + 1))
                    continue
                fi
                
                # Check if file exists and we're in skip mode
                if [ -f "$dest" ] && [ "$install_strategy" = "skip" ]; then
                    continue
                fi
                
                # Download file
                local url="${RAW_URL}/${file_path}"
                mkdir -p "$(dirname "$dest")"
                
                if curl -fsSL "$url" -o "$dest"; then
                    FILES_WRITTEN=$((FILES_WRITTEN + 1))
                    # Transform paths for global installation
                    if [[ "$INSTALL_DIR" != ".opencode" ]] && [[ "$INSTALL_DIR" != *"/.opencode" ]]; then
                        local expanded_path="${INSTALL_DIR/#\~/$HOME}"
                        sed -i.bak -e "s|@\.opencode/context/|@${expanded_path}/context/|g" \
                                   -e "s|\.opencode/context|${expanded_path}/context|g" "$dest" 2>/dev/null || true
                        rm -f "${dest}.bak" 2>/dev/null || true
                    fi
                    component_installed=$((component_installed + 1))
                else
                    component_failed=$((component_failed + 1))
                fi
            done <<< "$files_array"
            
            if [ $component_failed -eq 0 ]; then
                print_success "Installed ${type}: ${id} (${component_installed} files)"
                installed=$((installed + 1))
            else
                print_error "Failed to install ${type}: ${id} (${component_failed} files failed)"
                failed=$((failed + 1))
            fi
        else
            # Single file component - original logic
            local dest
            if ! dest=$(get_install_path "$path"); then
                print_error "Refusing unsafe registry path for ${type}:${id}: $path"
                failed=$((failed + 1))
                continue
            fi
            
            # Check if file exists before we install (for proper messaging)
            local file_existed=false
            if [ -f "$dest" ]; then
                file_existed=true
            fi
            
            # Check if file exists and we're in skip mode
            if [ "$file_existed" = true ] && [ "$install_strategy" = "skip" ]; then
                print_info "Skipped existing: ${type}:${id}"
                skipped=$((skipped + 1))
                continue
            fi
            
            # Download component
            local url="${RAW_URL}/${path}"
            
            # Create parent directory if needed
            mkdir -p "$(dirname "$dest")"
            
            if curl -fsSL "$url" -o "$dest"; then
                FILES_WRITTEN=$((FILES_WRITTEN + 1))
                # Transform paths for global installation (any non-local path)
                # Local paths: .opencode or */.opencode
                if [[ "$INSTALL_DIR" != ".opencode" ]] && [[ "$INSTALL_DIR" != *"/.opencode" ]]; then
                    # Expand tilde and get absolute path for transformation
                    local expanded_path="${INSTALL_DIR/#\~/$HOME}"
                    # Transform @.opencode/context/ references to actual install path
                    sed -i.bak -e "s|@\.opencode/context/|@${expanded_path}/context/|g" \
                               -e "s|\.opencode/context|${expanded_path}/context|g" "$dest" 2>/dev/null || true
                    rm -f "${dest}.bak" 2>/dev/null || true
                fi
                
                # Show appropriate message based on whether file existed before
                if [ "$file_existed" = true ]; then
                    print_success "Updated ${type}: ${id}"
                else
                    print_success "Installed ${type}: ${id}"
                fi
                installed=$((installed + 1))
            else
                print_error "Failed to install ${type}: ${id}"
                failed=$((failed + 1))
            fi
        fi
    done
    
    # Handle additional paths for advanced profile
    if [ "$PROFILE" = "advanced" ]; then
        local additional_paths
        additional_paths=$(jq_exec '.profiles.advanced.additionalPaths[]?' "$TEMP_DIR/registry.json")
        if [ -n "$additional_paths" ]; then
            print_step "Installing additional paths..."
            while IFS= read -r path; do
                # For directories, we'd need to recursively download
                # For now, just note them
                print_info "Additional path: $path (manual download required)"
            done <<< "$additional_paths"
        fi
    fi
    
    record_flavor_if_ok "$FILES_WRITTEN" "$failed"
    # Always: a re-run that skipped everything can still find old copies beside earlier new ones.
    retire_superseded_files
    if [ "$installed" -gt 0 ] || [ "$SUPERSEDED_RETIRED" -gt 0 ] || [ "$SUPERSEDED_KEPT" -gt 0 ]; then
        warn_legacy_agent_layout
    fi

    echo ""
    print_success "Installation complete!"
    echo -e "  OpenCode:  ${OPENCODE_FLAVOR}"
    echo -e "  Installed: ${GREEN}${installed}${NC}"
    [ $skipped -gt 0 ] && echo -e "  Skipped: ${CYAN}${skipped}${NC}"
    [ $failed -gt 0 ] && echo -e "  Failed: ${RED}${failed}${NC}"
    
    show_post_install
}

#############################################################################
# Post-Installation
#############################################################################

show_post_install() {
    echo ""
    print_step "Next Steps"
    
    echo -e "1. Review the installed components in ${CYAN}${INSTALL_DIR}/${NC}"
    
    # Check if env.example was installed
    if [ -f "${INSTALL_DIR}/env.example" ] || [ -f "env.example" ]; then
        echo "2. Copy env.example to .env and configure:"
        echo -e "   ${CYAN}cp env.example .env${NC}"
        echo "3. Start using OpenCode agents:"
    else
        echo "2. Start using OpenCode agents:"
    fi
    echo -e "   ${CYAN}opencode${NC}"
    echo ""
    
    # Show installation location info
    print_info "Installation directory: ${CYAN}${INSTALL_DIR}${NC}"
    
    # Check for backup directories
    local has_backup=0
    local backup_dir
    local backup_dirs=()

    shopt -s nullglob
    backup_dirs=("${INSTALL_DIR}.backup."*)
    shopt -u nullglob

    for backup_dir in "${backup_dirs[@]}"; do
        if [ -d "$backup_dir" ]; then
            has_backup=1
            break
        fi
    done
    if [ "$has_backup" -eq 1 ]; then
        print_info "Backup created - you can restore files from ${INSTALL_DIR}.backup.* if needed"
    fi
    
    print_info "Documentation: ${REPO_URL}"
    echo ""
    
    cleanup_and_exit 0
}

#############################################################################
# Component Listing
#############################################################################

list_components() {
    clear || true
    print_header
    
    echo -e "${BOLD}Available Components${NC}\n"
    
    local categories=("agents" "subagents" "commands" "tools" "plugins" "skills" "contexts")
    
    for category in "${categories[@]}"; do
        local cat_display
        cat_display=$(echo "$category" | awk '{print toupper(substr($0,1,1)) tolower(substr($0,2))}')
        echo -e "${CYAN}${BOLD}${cat_display}:${NC}"
        
        local components
        components=$(jq_exec ".components.${category}[]? | \"\(.id)|\(.name)|\(.description)\"" "$TEMP_DIR/registry.json")
        
        while IFS='|' read -r id name desc; do
            echo -e "  ${GREEN}${name}${NC} (${id})"
            echo -e "    ${desc}"
        done <<< "$components"
        
        echo ""
    done
}

#############################################################################
# Cleanup
#############################################################################

cleanup_and_exit() {
    rm -rf "$TEMP_DIR"
    exit "$1"
}

trap 'cleanup_and_exit 1' INT TERM

#############################################################################
# Main
#############################################################################

main() {
    # Parse command line arguments
    while [ $# -gt 0 ]; do
        case "$1" in
            --install-dir=*)
                CUSTOM_INSTALL_DIR="${1#*=}"
                # Basic validation - check not empty
                if [ -z "$CUSTOM_INSTALL_DIR" ]; then
                    echo "Error: --install-dir requires a non-empty path"
                    exit 1
                fi
                shift
                ;;
            --install-dir)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    CUSTOM_INSTALL_DIR="$2"
                    shift 2
                else
                    echo "Error: --install-dir requires a path argument"
                    exit 1
                fi
                ;;
            --opencode=*)
                OPENCODE_FLAVOR="${1#*=}"
                OPENCODE_FLAVOR_EXPLICIT=true
                shift
                ;;
            --opencode)
                if [ -n "$2" ] && [ "${2:0:1}" != "-" ]; then
                    OPENCODE_FLAVOR="$2"
                    OPENCODE_FLAVOR_EXPLICIT=true
                    shift 2
                else
                    echo "Error: --opencode requires v1 or v2"
                    exit 1
                fi
                ;;
            essential|--essential)
                INSTALL_MODE="profile"
                PROFILE="essential"
                NON_INTERACTIVE=true
                shift
                ;;
            developer|--developer)
                INSTALL_MODE="profile"
                PROFILE="developer"
                NON_INTERACTIVE=true
                shift
                ;;
            business|--business)
                INSTALL_MODE="profile"
                PROFILE="business"
                NON_INTERACTIVE=true
                shift
                ;;
            full|--full)
                INSTALL_MODE="profile"
                PROFILE="full"
                NON_INTERACTIVE=true
                shift
                ;;
            advanced|--advanced)
                INSTALL_MODE="profile"
                PROFILE="advanced"
                NON_INTERACTIVE=true
                shift
                ;;
            list|--list)
                # Deferred until every option is parsed, so `list --opencode v1` works too.
                LIST_ONLY=true
                shift
                ;;
            --help|-h|help)
                print_header
                echo "Usage: $0 [PROFILE] [OPTIONS]"
                echo ""
                echo -e "${BOLD}Profiles:${NC}"
                echo "  essential, --essential    Minimal setup with core agents"
                echo "  developer, --developer    Code-focused development tools"
                echo "  business, --business      Content and business-focused tools"
                echo "  full, --full              Everything except system-builder"
                echo "  advanced, --advanced      Complete system with all components"
                echo ""
                echo -e "${BOLD}Options:${NC}"
                echo "  --install-dir PATH        Custom installation directory"
                echo "                            (default: .opencode)"
                echo "  --opencode v1|v2          OpenCode major to install for (default: v2)."
                echo "                            v1 is an explicit opt-in and installs the full v1 build"
                echo "                            (agents, tools, plugins, skills, commands) into .opencode/"
                echo "  list, --list              List all available components"
                echo "  help, --help, -h          Show this help message"
                echo ""
                echo -e "${BOLD}Environment Variables:${NC}"
                echo "  OPENCODE_INSTALL_DIR      Installation directory"
                echo "  OPENCODE_BRANCH           Git branch to install from (default: main)"
                echo "  OAC_OPENCODE              OpenCode major, v1 or v2 (same as --opencode; default: v2)"
                echo "  OAC_RAW_URL               Base URL for component files (default: GitHub raw for the branch)"
                echo ""
                echo -e "${BOLD}Examples:${NC}"
                echo ""
                echo -e "  ${CYAN}# Interactive mode (choose location and components)${NC}"
                echo "  $0"
                echo ""
                echo -e "  ${CYAN}# Quick install with default location (.opencode/)${NC}"
                echo "  $0 developer"
                echo ""
                echo -e "  ${CYAN}# Install to global location (Linux/macOS)${NC}"
                echo "  $0 developer --install-dir ~/.config/opencode"
                echo ""
                echo -e "  ${CYAN}# Install to global location (Windows Git Bash)${NC}"
                echo "  $0 developer --install-dir ~/.config/opencode"
                echo ""
                echo -e "  ${CYAN}# Install to custom location${NC}"
                echo "  $0 essential --install-dir ~/my-agents"
                echo ""
                echo -e "  ${CYAN}# Using environment variable${NC}"
                echo "  export OPENCODE_INSTALL_DIR=~/.config/opencode"
                echo "  $0 developer"
                echo ""
                echo -e "  ${CYAN}# Install from URL (non-interactive)${NC}"
                echo "  curl -fsSL https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/main/install.sh | bash -s developer"
                echo ""
                echo -e "${BOLD}Platform Support:${NC}"
                echo "  ✓ Linux (bash 3.2+)"
                echo "  ✓ macOS (bash 3.2+)"
                echo "  ✓ Windows (Git Bash, WSL)"
                echo ""
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                echo "Run '$0 --help' for usage information"
                exit 1
                ;;
        esac
    done
    
    # Apply custom install directory if specified (CLI arg overrides env var)
    if [ -n "$CUSTOM_INSTALL_DIR" ]; then
        local normalized_path
        if normalize_and_validate_path "$CUSTOM_INSTALL_DIR" > /dev/null; then
            normalized_path=$(normalize_and_validate_path "$CUSTOM_INSTALL_DIR")
            INSTALL_DIR="$normalized_path"
            if ! validate_install_path "$INSTALL_DIR"; then
                print_warning "Installation path may have issues, but continuing..."
            fi
        else
            print_error "Invalid installation directory: $CUSTOM_INSTALL_DIR"
            exit 1
        fi
    fi
    
    local normalized_flavor
    normalized_flavor=$(normalize_flavor "$OPENCODE_FLAVOR")
    if [ -z "$normalized_flavor" ]; then
        print_error "Unknown OpenCode version '${OPENCODE_FLAVOR}'. Use v1 or v2."
        exit 1
    fi
    OPENCODE_FLAVOR="$normalized_flavor"

    if [ "$LIST_ONLY" = true ]; then
        check_dependencies
        fetch_registry
        list_components
        cleanup_and_exit 0
    fi

    warn_flavor_host_mismatch

    check_bash_version
    check_dependencies
    fetch_registry
    
    if [ -n "$PROFILE" ]; then
        # Non-interactive mode (compatible with bash 3.2+)
        SELECTED_COMPONENTS=()
        local temp_file="$TEMP_DIR/components.tmp"
        get_profile_components "$PROFILE" > "$temp_file"
        while IFS= read -r component; do
            [ -n "$component" ] && SELECTED_COMPONENTS+=("$component")
        done < "$temp_file"

        expand_selected_components

        # Resolve dependencies for profile installs
        print_step "Resolving dependencies..."
        local original_count=${#SELECTED_COMPONENTS[@]}
        for comp in "${SELECTED_COMPONENTS[@]}"; do
            resolve_dependencies "$comp"
        done

        local new_count=${#SELECTED_COMPONENTS[@]}
        if [ "$new_count" -gt "$original_count" ]; then
            local added=$((new_count - original_count))
            print_info "Added $added dependencies"
        fi

        show_installation_preview
    else
        # Interactive mode - show location menu first
        show_install_location_menu
        show_main_menu
        
        if [ "$INSTALL_MODE" = "profile" ]; then
            show_profile_menu
        elif [ "$INSTALL_MODE" = "custom" ]; then
            show_custom_menu
        fi
    fi
}

main "$@"
