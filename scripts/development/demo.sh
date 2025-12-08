#!/bin/bash
# OpenCode Repository Demo
# Shows repository structure and prompt library system
#
# Usage:
#   ./scripts/development/demo.sh           # Interactive mode
#   ./scripts/development/demo.sh --quick   # Quick tour (non-interactive)
#   ./scripts/development/demo.sh --full    # Full demo (non-interactive)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${CYAN}  $1${NC}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_section() {
  echo ""
  echo -e "${BLUE}▶ $1${NC}"
  echo ""
}

print_success() {
  echo -e "${GREEN}✓${NC} $1"
}

print_info() {
  echo -e "${YELLOW}ℹ${NC} $1"
}

pause() {
  if [ "$NON_INTERACTIVE" != "true" ]; then
    echo ""
    read -p "Press Enter to continue..."
  else
    echo ""
  fi
}

# Main demo functions
show_welcome() {
  clear
  print_header "Welcome to OpenCode Agents"
  
  cat << EOF
OpenCode is a context-aware agent system for AI-powered development.

This demo will show you:
  1. Repository structure
  2. Agent system architecture
  3. Prompt library system
  4. Testing framework
  5. How to contribute

Choose a mode:
  [1] Quick Tour (2-3 minutes)
  [2] Full Demo (10-15 minutes)
  [3] Interactive Explorer
  [q] Quit

EOF
  
  read -p "Your choice: " choice
  echo "$choice"
}

show_repo_structure() {
  print_header "Repository Structure"
  
  print_section "Main Directories"
  
  cat << EOF
${GREEN}.opencode/${NC}
├── agent/              ${YELLOW}# Agents${NC}
│   ├── openagent.md        ${YELLOW}# Main orchestrator${NC}
│   ├── opencoder.md        ${YELLOW}# Development specialist${NC}
│   └── subagents/          ${YELLOW}# Specialized subagents${NC}
├── prompts/            ${YELLOW}# Prompt library (variants)${NC}
├── command/            ${YELLOW}# Slash commands${NC}
├── tool/               ${YELLOW}# Utility tools${NC}
└── context/            ${YELLOW}# Context files${NC}

${GREEN}evals/${NC}
├── agents/             ${YELLOW}# Agent test suites${NC}
├── framework/          ${YELLOW}# Testing framework${NC}
└── results/            ${YELLOW}# Test results${NC}

${GREEN}scripts/${NC}
├── prompts/            ${YELLOW}# Prompt management${NC}
└── tests/              ${YELLOW}# Test utilities${NC}

${GREEN}docs/${NC}
├── agents/             ${YELLOW}# Agent documentation${NC}
├── contributing/       ${YELLOW}# Contribution guides${NC}
└── guides/             ${YELLOW}# User guides${NC}
EOF
  
  pause
}

show_agent_system() {
  print_header "Agent System"
  
  print_section "Main Agents"
  
  if [ -f ".opencode/agent/openagent.md" ]; then
    print_success "openagent.md - Main orchestrator agent"
    echo "   Handles planning, delegation, and workflow management"
  fi
  
  if [ -f ".opencode/agent/opencoder.md" ]; then
    print_success "opencoder.md - Development specialist"
    echo "   Focused on writing clean, maintainable code"
  fi
  
  print_section "Subagents"
  
  if [ -d ".opencode/agent/subagents" ]; then
    subagent_count=$(find .opencode/agent/subagents -name "*.md" -type f | wc -l | tr -d ' ')
    echo "Found $subagent_count specialized subagents:"
    echo ""
    
    # Show subagent categories
    for category in .opencode/agent/subagents/*/; do
      if [ -d "$category" ]; then
        category_name=$(basename "$category")
        agent_count=$(find "$category" -name "*.md" -type f | wc -l | tr -d ' ')
        echo -e "${GREEN}$category_name/${NC} ($agent_count agents)"
      fi
    done
  fi
  
  pause
}

show_prompt_library() {
  print_header "Prompt Library System"
  
  print_section "How It Works"
  
  cat << EOF
The prompt library allows different AI models to use optimized prompts:

${GREEN}.opencode/prompts/openagent/${NC}
├── default.md          ${YELLOW}# Stable version (used in PRs)${NC}
├── sonnet-4.md         ${YELLOW}# Claude Sonnet 4 optimized${NC}
├── grok-fast.md        ${YELLOW}# Grok Fast optimized${NC}
├── TEMPLATE.md         ${YELLOW}# Template for new variants${NC}
└── results/            ${YELLOW}# Test results${NC}

${BLUE}Key Principles:${NC}
  • PRs must use default prompts (enforced by CI)
  • Variants are tested and documented
  • Users can choose the best prompt for their model
  • Contributors can add optimized variants

EOF
  
  pause
  
  print_section "Available Variants"
  
  if [ -d ".opencode/prompts" ]; then
    for agent_dir in .opencode/prompts/*/; do
      if [ -d "$agent_dir" ]; then
        agent=$(basename "$agent_dir")
        echo -e "${GREEN}$agent:${NC}"
        
        variant_count=0
        for variant in "$agent_dir"*.md; do
          if [ -f "$variant" ]; then
            variant_name=$(basename "$variant" .md)
            if [ "$variant_name" != "README" ] && [ "$variant_name" != "TEMPLATE" ]; then
              variant_count=$((variant_count + 1))
              # Check if results exist
              results_file="$agent_dir/results/$variant_name-results.json"
              if [ -f "$results_file" ]; then
                passed=$(jq -r '.passed // 0' "$results_file" 2>/dev/null || echo "?")
                total=$(jq -r '.total // 0' "$results_file" 2>/dev/null || echo "?")
                echo "  ✓ $variant_name ($passed/$total tests passing)"
              else
                echo "  • $variant_name (not tested)"
              fi
            fi
          fi
        done
        
        if [ $variant_count -eq 0 ]; then
          echo "  ${YELLOW}No variants yet - coming soon!${NC}"
        fi
        echo ""
      fi
    done
  else
    echo "${YELLOW}Prompt library not yet set up - coming soon!${NC}"
  fi
  
  pause
}

show_testing_framework() {
  print_header "Testing Framework"
  
  print_section "Test Structure"
  
  cat << EOF
${GREEN}evals/agents/openagent/tests/${NC}
├── 01-critical-rules/      ${YELLOW}# Core behavior tests${NC}
├── 02-workflow-stages/     ${YELLOW}# Workflow validation${NC}
├── 03-delegation/          ${YELLOW}# Delegation logic${NC}
└── ...

Each test validates specific agent behaviors.

EOF
  
  if [ -d "evals/agents/openagent/tests" ]; then
    test_count=$(find evals/agents/openagent/tests -name "*.json" -type f | wc -l | tr -d ' ')
    echo "Total tests: $test_count"
    echo ""
  fi
  
  print_section "Running Tests"
  
  cat << EOF
${BLUE}Test a prompt variant:${NC}
  ./scripts/prompts/test-prompt.sh openagent sonnet-4

${BLUE}Validate PR:${NC}
  ./scripts/prompts/validate-pr.sh

${BLUE}Use a variant:${NC}
  ./scripts/prompts/use-prompt.sh openagent sonnet-4

EOF
  
  pause
}

show_contributing() {
  print_header "Contributing"
  
  print_section "How to Contribute"
  
  cat << EOF
${BLUE}1. Create a prompt variant:${NC}
   cp .opencode/prompts/openagent/TEMPLATE.md .opencode/prompts/openagent/my-variant.md

${BLUE}2. Edit your variant:${NC}
   # Optimize for your target model
   vim .opencode/prompts/openagent/my-variant.md

${BLUE}3. Test it:${NC}
   ./scripts/prompts/test-prompt.sh openagent my-variant

${BLUE}4. Document results:${NC}
   # Update .opencode/prompts/openagent/README.md with test results

${BLUE}5. Submit PR:${NC}
   # Include your variant and results
   # Do NOT change the default prompt

${YELLOW}Important:${NC} All PRs must use default prompts (CI enforces this)

EOF
  
  print_section "Other Ways to Contribute"
  
  cat << EOF
• Add new agents or subagents
• Improve documentation
• Add test cases
• Fix bugs
• Enhance the testing framework

See ${BLUE}docs/contributing/CONTRIBUTING.md${NC} for details.

EOF
  
  pause
}

interactive_mode() {
  while true; do
    clear
    print_header "Interactive Explorer"
    
    cat << EOF
Choose a section to explore:
  [1] Repository Structure
  [2] Agent System
  [3] Prompt Library
  [4] Testing Framework
  [5] Contributing Guide
  [b] Back to main menu
  [q] Quit

EOF
    
    read -p "Your choice: " choice
    
    case $choice in
      1) show_repo_structure ;;
      2) show_agent_system ;;
      3) show_prompt_library ;;
      4) show_testing_framework ;;
      5) show_contributing ;;
      b) return ;;
      q) exit 0 ;;
      *) echo "Invalid choice" ;;
    esac
  done
}

quick_tour() {
  show_repo_structure
  show_agent_system
  show_prompt_library
  
  print_header "Quick Tour Complete!"
  
  cat << EOF
${GREEN}Next Steps:${NC}
  • Read the docs: ${BLUE}docs/README.md${NC}
  • Try the agents: ${BLUE}.opencode/agent/${NC}
  • Run tests: ${BLUE}./scripts/prompts/test-prompt.sh${NC}
  • Contribute: ${BLUE}docs/contributing/CONTRIBUTING.md${NC}

${YELLOW}For more details, run:${NC}
  ./scripts/development/demo.sh

EOF
}

full_demo() {
  show_repo_structure
  show_agent_system
  show_prompt_library
  show_testing_framework
  show_contributing
  
  print_header "Demo Complete!"
  
  cat << EOF
${GREEN}You've seen:${NC}
  ✓ Repository structure
  ✓ Agent system architecture
  ✓ Prompt library system
  ✓ Testing framework
  ✓ How to contribute

${YELLOW}Ready to get started?${NC}
  • Read: ${BLUE}docs/getting-started/installation.md${NC}
  • Explore: ${BLUE}.opencode/prompts/${NC}
  • Test: ${BLUE}./scripts/prompts/test-prompt.sh${NC}

EOF
}

# Main
main() {
  # Check for command line arguments
  if [ "$1" = "--quick" ]; then
    NON_INTERACTIVE=true
    quick_tour
    exit 0
  elif [ "$1" = "--full" ]; then
    NON_INTERACTIVE=true
    full_demo
    exit 0
  elif [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
    cat << EOF
OpenCode Repository Demo

Usage:
  ./scripts/development/demo.sh           Interactive mode with menu
  ./scripts/development/demo.sh --quick   Quick tour (non-interactive)
  ./scripts/development/demo.sh --full    Full demo (non-interactive)
  ./scripts/development/demo.sh --help    Show this help

EOF
    exit 0
  fi
  
  # Interactive mode
  choice=$(show_welcome)
  
  case $choice in
    1) quick_tour ;;
    2) full_demo ;;
    3) interactive_mode ;;
    q) exit 0 ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
}

main "$@"
