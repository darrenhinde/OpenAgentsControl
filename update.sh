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

BRANCH="${OPENCODE_BRANCH:-v1-opencode}"
REPO_URL="https://raw.githubusercontent.com/darrenhinde/OpenAgentsControl/${BRANCH}"

# CLI argument for custom install dir (overrides env var)
CUSTOM_INSTALL_DIR=""

# Track backup files for cleanup on exit
BACKUP_FILES=()

# Clean up any leftover backup files on exit/interrupt
cleanup_backups() {
    for f in "${BACKUP_FILES[@]}"; do
        [ -f "$f" ] && rm -f "$f"
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
    echo "Usage: $0 [--install-dir PATH]"
    echo ""
    echo "Options:"
    echo "  --install-dir PATH   Update a specific installation directory"
    echo "  --help               Show this help message"
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
# Update Logic
#############################################################################

update_component() {
    local path="$1"
    local install_dir="$2"
    local relative_path="${path#"$install_dir"/}"

    # Guard: reject paths that escaped the install dir
    if [[ "$relative_path" == /* ]] || [[ "$relative_path" == *..* ]]; then
        print_warning "Skipping suspicious path: $path"
        return 1
    fi

    local url="${REPO_URL}/.opencode/${relative_path}"
    local backup="${path}.backup"

    cp "$path" "$backup"
    BACKUP_FILES+=("$backup")

    if curl -fsSL "$url" -o "$path" 2>/dev/null; then
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

    print_info "Updated: $updated file(s), failed: $failed file(s)"
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

    print_info "Updating installation at: ${CYAN}${install_dir}${NC}"
    print_step "Updating components..."

    update_all_components "$install_dir"

    print_success "Update complete!"
}

main "$@"
