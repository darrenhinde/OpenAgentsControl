#!/bin/bash

# External Context Management Utility
# Manages cached external documentation in .tmp/external-context/

set -e

EXTERNAL_CONTEXT_DIR=".tmp/external-context"
MANIFEST_FILE="$EXTERNAL_CONTEXT_DIR/.manifest.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo -e "${BLUE}=== $1 ===${NC}"
}

print_success() {
  echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
  echo -e "${RED}✗ $1${NC}"
}

print_warning() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# List all cached external context
list_cache() {
  print_header "Cached External Context"
  
  if [ ! -d "$EXTERNAL_CONTEXT_DIR" ]; then
    print_error "External context directory not found: $EXTERNAL_CONTEXT_DIR"
    return 1
  fi
  
  if [ ! -f "$MANIFEST_FILE" ]; then
    print_warning "Manifest file not found: $MANIFEST_FILE"
    return 1
  fi
  
  echo ""
  echo "Manifest:"
  cat "$MANIFEST_FILE" | jq '.' 2>/dev/null || cat "$MANIFEST_FILE"
  
  echo ""
  echo "Cached files:"
  find "$EXTERNAL_CONTEXT_DIR" -name "*.md" -type f | sort | while read -r file; do
    size=$(du -h "$file" | cut -f1)
    modified=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1-2)
    echo "  $file ($size, modified: $modified)"
  done
}

# Show details of a specific cached file
show_file() {
  local package=$1
  local topic=$2
  
  if [ -z "$package" ] || [ -z "$topic" ]; then
    print_error "Usage: $0 show <package-name> <topic>"
    return 1
  fi
  
  local file="$EXTERNAL_CONTEXT_DIR/$package/$topic.md"
  
  if [ ! -f "$file" ]; then
    print_error "File not found: $file"
    return 1
  fi
  
  print_header "File: $file"
  echo ""
  head -20 "$file"
  echo ""
  echo "... (showing first 20 lines)"
}

# Clean up old external context files
cleanup_old() {
  local days=${1:-7}
  
  print_header "Cleaning up external context older than $days days"
  
  if [ ! -d "$EXTERNAL_CONTEXT_DIR" ]; then
    print_warning "External context directory not found"
    return 0
  fi
  
  local count=0
  while IFS= read -r file; do
    print_warning "Removing: $file"
    rm "$file"
    count=$((count + 1))
  done < <(find "$EXTERNAL_CONTEXT_DIR" -name "*.md" -type f -mtime +"$days")
  
  if [ "$count" -eq 0 ]; then
    print_success "No files older than $days days found"
  else
    print_success "Removed $count old files"
    # Update manifest
    regenerate_manifest
  fi
}

# Regenerate manifest from actual files
regenerate_manifest() {
  print_header "Regenerating manifest"
  
  if [ ! -d "$EXTERNAL_CONTEXT_DIR" ]; then
    print_error "External context directory not found"
    return 1
  fi
  
  # Create new manifest (placeholder for future implementation)
  # local manifest
  # manifest="{\"last_updated\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\", \"version\": \"1.0\", \"packages\": {}}"
  
  # Find all packages and topics
  find "$EXTERNAL_CONTEXT_DIR" -name "*.md" -type f | grep -v README | while read -r file; do
    local package
    local topic
    
    package=$(basename "$(dirname "$file")")
    topic=$(basename "$file" .md)
    
    # Metadata extraction (placeholder for future implementation)
    # local fetched
    # local source
    # local library
    # local official_docs
    # fetched=$(stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" "$file" 2>/dev/null || stat -c "%y" "$file" 2>/dev/null | cut -d' ' -f1-2)
    # source=$(grep "^source:" "$file" | cut -d: -f2- | xargs)
    # library=$(grep "^library:" "$file" | cut -d: -f2- | xargs)
    # official_docs=$(grep "^official_docs:" "$file" | cut -d: -f2- | xargs)
    
    echo "  $package/$topic.md"
  done
  
  print_success "Manifest regenerated"
}

# Delete specific cached file
delete_file() {
  local package=$1
  local topic=$2
  
  if [ -z "$package" ] || [ -z "$topic" ]; then
    print_error "Usage: $0 delete <package-name> <topic>"
    return 1
  fi
  
  local file="$EXTERNAL_CONTEXT_DIR/$package/$topic.md"
  
  if [ ! -f "$file" ]; then
    print_error "File not found: $file"
    return 1
  fi
  
  print_warning "Deleting: $file"
  rm "$file"
  
  # Remove empty directory
  if [ -z "$(ls -A "$EXTERNAL_CONTEXT_DIR/$package" 2>/dev/null)" ]; then
    rmdir "$EXTERNAL_CONTEXT_DIR/$package"
    print_success "Removed empty directory: $EXTERNAL_CONTEXT_DIR/$package"
  fi
  
  # Update manifest
  regenerate_manifest
  print_success "File deleted and manifest updated"
}

# Delete entire package cache
delete_package() {
  local package=$1
  
  if [ -z "$package" ]; then
    print_error "Usage: $0 delete-package <package-name>"
    return 1
  fi
  
  local dir="$EXTERNAL_CONTEXT_DIR/$package"
  
  if [ ! -d "$dir" ]; then
    print_error "Package directory not found: $dir"
    return 1
  fi
  
  print_warning "Deleting entire package: $dir"
  rm -rf "$dir"
  
  # Update manifest
  regenerate_manifest
  print_success "Package deleted and manifest updated"
}

# Show usage
usage() {
  cat << EOF
External Context Management Utility

Usage: $0 <command> [options]

Commands:
  list                          List all cached external context
  show <package> <topic>        Show details of a specific file
  cleanup-old [days]            Remove files older than N days (default: 7)
  regenerate-manifest           Regenerate manifest from actual files
  delete <package> <topic>      Delete a specific file
  delete-package <package>      Delete entire package cache
  help                          Show this help message

Examples:
  $0 list
  $0 show drizzle-orm modular-schemas
  $0 cleanup-old 7
  $0 delete drizzle-orm modular-schemas
  $0 delete-package drizzle-orm

EOF
}

# Main
case "${1:-help}" in
  list)
    list_cache
    ;;
  show)
    show_file "$2" "$3"
    ;;
  cleanup-old)
    cleanup_old "${2:-7}"
    ;;
  regenerate-manifest)
    regenerate_manifest
    ;;
  delete)
    delete_file "$2" "$3"
    ;;
  delete-package)
    delete_package "$2"
    ;;
  help|--help|-h)
    usage
    ;;
  *)
    print_error "Unknown command: $1"
    usage
    exit 1
    ;;
esac
