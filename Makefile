# OpenAgents - GitHub Project Management & Development
# Quick commands for managing your GitHub Project board and running tests

REPO := darrenhinde/OpenAgents
PROJECT_NUMBER := 2
OWNER := darrenhinde

.PHONY: help idea ideas board labels project-info issue-view issue-comment issue-close bug feature
.PHONY: test-evals test-golden test-smoke test-verbose build-evals validate-evals
.PHONY: build-canonical check-canonical-drift oac-cli

help: ## Show this help message
	@echo "OpenAgents GitHub Project Management"
	@echo ""
	@echo "Usage: make [target] [ARGS]"
	@echo ""
	@echo "Targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "Examples:"
	@echo "  make idea TITLE=\"Add eval harness\" BODY=\"Description here\""
	@echo "  make bug TITLE=\"Fix login error\" BODY=\"Users can't login\""
	@echo "  make feature TITLE=\"Add dark mode\" PRIORITY=\"high\""
	@echo "  make ideas"
	@echo "  make board"
	@echo "  make issue-view NUM=123"

idea: ## Create a new idea (requires TITLE, optional BODY, PRIORITY, CATEGORY)
	@if [ -z "$(TITLE)" ]; then \
		echo "Error: TITLE is required"; \
		echo "Usage: make idea TITLE=\"Your title\" BODY=\"Description\" PRIORITY=\"high\" CATEGORY=\"agents\""; \
		exit 1; \
	fi
	@LABELS="idea"; \
	BODY=$${BODY:-}; \
	if [ -n "$(PRIORITY)" ]; then LABELS="$$LABELS,priority-$(PRIORITY)"; fi; \
	if [ -n "$(CATEGORY)" ]; then LABELS="$$LABELS,$(CATEGORY)"; fi; \
	gh issue create \
		--repo $(REPO) \
		--title "$(TITLE)" \
		--body "$$BODY" \
		--label "$$LABELS"

bug: ## Create a bug report (requires TITLE, optional BODY, PRIORITY)
	@if [ -z "$(TITLE)" ]; then \
		echo "Error: TITLE is required"; \
		echo "Usage: make bug TITLE=\"Bug description\" BODY=\"Details\" PRIORITY=\"high\""; \
		exit 1; \
	fi
	@LABELS="bug"; \
	BODY=$${BODY:-}; \
	if [ -n "$(PRIORITY)" ]; then LABELS="$$LABELS,priority-$(PRIORITY)"; fi; \
	if [ -n "$(CATEGORY)" ]; then LABELS="$$LABELS,$(CATEGORY)"; fi; \
	gh issue create \
		--repo $(REPO) \
		--title "$(TITLE)" \
		--body "$$BODY" \
		--label "$$LABELS"

feature: ## Create a feature request (requires TITLE, optional BODY, PRIORITY, CATEGORY)
	@if [ -z "$(TITLE)" ]; then \
		echo "Error: TITLE is required"; \
		echo "Usage: make feature TITLE=\"Feature name\" BODY=\"Description\" PRIORITY=\"high\" CATEGORY=\"agents\""; \
		exit 1; \
	fi
	@LABELS="feature"; \
	BODY=$${BODY:-}; \
	if [ -n "$(PRIORITY)" ]; then LABELS="$$LABELS,priority-$(PRIORITY)"; fi; \
	if [ -n "$(CATEGORY)" ]; then LABELS="$$LABELS,$(CATEGORY)"; fi; \
	gh issue create \
		--repo $(REPO) \
		--title "$(TITLE)" \
		--body "$$BODY" \
		--label "$$LABELS"

ideas: ## List all open ideas
	@gh issue list --repo $(REPO) --label idea --state open

bugs: ## List all open bugs
	@gh issue list --repo $(REPO) --label bug --state open

features: ## List all open features
	@gh issue list --repo $(REPO) --label feature --state open

issues: ## List all open issues
	@gh issue list --repo $(REPO) --state open

by-priority: ## List issues by priority (requires PRIORITY=high|medium|low)
	@if [ -z "$(PRIORITY)" ]; then \
		echo "Error: PRIORITY is required"; \
		echo "Usage: make by-priority PRIORITY=high"; \
		exit 1; \
	fi
	@gh issue list --repo $(REPO) --label "priority-$(PRIORITY)" --state open

by-category: ## List issues by category (requires CATEGORY=agents|evals|framework|docs)
	@if [ -z "$(CATEGORY)" ]; then \
		echo "Error: CATEGORY is required"; \
		echo "Usage: make by-category CATEGORY=agents"; \
		exit 1; \
	fi
	@gh issue list --repo $(REPO) --label "$(CATEGORY)" --state open

board: ## Open the project board in browser
	@open "https://github.com/users/$(OWNER)/projects/$(PROJECT_NUMBER)"

labels: ## List all labels in the repo
	@gh label list --repo $(REPO)

project-info: ## Show project information
	@gh project view $(PROJECT_NUMBER) --owner $(OWNER)

project-items: ## List all items in the project
	@gh project item-list $(PROJECT_NUMBER) --owner $(OWNER) --format json | jq -r '.items[] | "\(.id) - \(.content.title) [\(.content.state)]"'

issue-view: ## View an issue (requires NUM=issue_number)
	@if [ -z "$(NUM)" ]; then \
		echo "Error: NUM is required"; \
		echo "Usage: make issue-view NUM=123"; \
		exit 1; \
	fi
	@gh issue view $(NUM) --repo $(REPO)

issue-comment: ## Comment on an issue (requires NUM and COMMENT)
	@if [ -z "$(NUM)" ] || [ -z "$(COMMENT)" ]; then \
		echo "Error: NUM and COMMENT are required"; \
		echo "Usage: make issue-comment NUM=123 COMMENT=\"Your comment\""; \
		exit 1; \
	fi
	@gh issue comment $(NUM) --repo $(REPO) --body "$(COMMENT)"

issue-close: ## Close an issue (requires NUM)
	@if [ -z "$(NUM)" ]; then \
		echo "Error: NUM is required"; \
		echo "Usage: make issue-close NUM=123"; \
		exit 1; \
	fi
	@gh issue close $(NUM) --repo $(REPO)

# Advanced: Add issue to project (requires ISSUE_URL)
add-to-project: ## Add an issue to the project (requires ISSUE_URL)
	@if [ -z "$(ISSUE_URL)" ]; then \
		echo "Error: ISSUE_URL is required"; \
		echo "Usage: make add-to-project ISSUE_URL=https://github.com/darrenhinde/OpenAgents/issues/123"; \
		exit 1; \
	fi
	@gh project item-add $(PROJECT_NUMBER) --owner $(OWNER) --url "$(ISSUE_URL)"

# Quick shortcuts
.PHONY: new list open high-priority
new: idea ## Alias for 'idea'
list: ideas ## Alias for 'ideas'
open: board ## Alias for 'board'
high-priority: ## List all high priority items
	@make by-priority PRIORITY=high

# =============================================================================
# Evaluation Framework Commands
# =============================================================================

# The canonical build: content/agents/** is the source, .opencode/agent/**, registry.json and
# .oac/build-manifest.json are its committed output. `check-canonical-drift` is exactly what CI
# runs (.github/workflows/packages-checks.yml), so a contributor can reproduce a red gate here.
oac-cli: ## Build the oac CLI and its compatibility-layer dependency
	@pnpm --dir packages/compatibility-layer run build
	@pnpm --dir packages/cli run build

build-canonical: oac-cli ## Regenerate the committed trees from content/agents/**
	@echo "🔨 Building canonical trees..."
	@bun packages/cli/dist/index.js build

check-canonical-drift: oac-cli ## Fail if the generated trees drift from content/agents/** (CI gate)
	@echo "🔍 Checking for generated-tree drift..."
	@bash scripts/validation/check-build-drift.sh

build-evals: ## Build the evaluation framework
	@echo "🔨 Building evaluation framework..."
	@pnpm install --frozen-lockfile
	@pnpm --dir evals/framework run build
	@echo "✅ Build complete"

validate-evals: ## Validate all test suites
	@echo "🔍 Validating test suites..."
	@pnpm --dir evals/framework run validate:suites:all
	@echo "✅ Validation complete"

test-golden: ## Run golden tests (8 tests, ~3-5 min)
	@echo "🧪 Running golden tests..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml"

test-smoke: ## Run smoke test only (1 test, ~30s)
	@echo "🧪 Running smoke test..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=openagent --pattern="**/golden/01-smoke-test.yaml"

test-verbose: ## Run golden tests with full conversation output
	@echo "🧪 Running golden tests (verbose)..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=openagent --pattern="**/golden/*.yaml" --verbose

test-evals: build-evals validate-evals test-golden ## Full eval pipeline: build, validate, test

# Test with specific agent
test-agent: ## Run tests for specific agent (requires AGENT=name)
	@if [ -z "$(AGENT)" ]; then \
		echo "Error: AGENT is required"; \
		echo "Usage: make test-agent AGENT=openagent"; \
		echo "       make test-agent AGENT=opencoder"; \
		exit 1; \
	fi
	@echo "🧪 Running tests for agent: $(AGENT)..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=$(AGENT) --pattern="**/golden/*.yaml"

# Test with specific model
test-model: ## Run tests with specific model (requires MODEL=provider/model)
	@if [ -z "$(MODEL)" ]; then \
		echo "Error: MODEL is required"; \
		echo "Usage: make test-model MODEL=opencode/grok-code-fast"; \
		echo "       make test-model MODEL=anthropic/claude-3-5-sonnet-20241022"; \
		exit 1; \
	fi
	@echo "🧪 Running tests with model: $(MODEL)..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=openagent --model=$(MODEL) --pattern="**/golden/*.yaml"

# Test with prompt variant
test-variant: ## Run tests with prompt variant (requires VARIANT=name)
	@if [ -z "$(VARIANT)" ]; then \
		echo "Error: VARIANT is required"; \
		echo "Usage: make test-variant VARIANT=gpt"; \
		echo "       make test-variant VARIANT=llama"; \
		echo "Available: default, gpt, gemini, grok, llama"; \
		exit 1; \
	fi
	@echo "🧪 Running tests with prompt variant: $(VARIANT)..."
	@pnpm --dir evals/framework run eval:sdk -- --agent=openagent --prompt-variant=$(VARIANT) --pattern="**/golden/*.yaml"

# Test subagent standalone
test-subagent: ## Test subagent in standalone mode (requires SUBAGENT=name)
	@if [ -z "$(SUBAGENT)" ]; then \
		echo "Error: SUBAGENT is required"; \
		echo "Usage: make test-subagent SUBAGENT=coder-agent"; \
		echo "       make test-subagent SUBAGENT=tester"; \
		echo ""; \
		echo "Available subagents:"; \
		echo "  Code: coder-agent, tester, reviewer, build-agent"; \
		echo "  Core: task-manager, documentation, context-retriever"; \
		echo "  System: agent-generator, command-creator, context-organizer"; \
		exit 1; \
	fi
	@echo "⚡ Testing subagent (standalone mode): $(SUBAGENT)..."
	@pnpm --dir evals/framework run eval:sdk -- --subagent=$(SUBAGENT)

# Test subagent via delegation
test-subagent-delegate: ## Test subagent via parent delegation (requires SUBAGENT=name)
	@if [ -z "$(SUBAGENT)" ]; then \
		echo "Error: SUBAGENT is required"; \
		echo "Usage: make test-subagent-delegate SUBAGENT=coder-agent"; \
		echo "       make test-subagent-delegate SUBAGENT=tester"; \
		exit 1; \
	fi
	@echo "🔗 Testing subagent (delegation mode): $(SUBAGENT)..."
	@pnpm --dir evals/framework run eval:sdk -- --subagent=$(SUBAGENT) --delegate

# View results
view-results: ## Open results dashboard in browser
	@echo "📊 Opening results dashboard..."
	@open evals/results/index.html 2>/dev/null || xdg-open evals/results/index.html 2>/dev/null || echo "Open evals/results/index.html in your browser"

# Show latest results
show-results: ## Show latest test results summary
	@echo "📊 Latest test results:"
	@if [ -f "evals/results/latest.json" ]; then \
		echo ""; \
		jq -r '"Agent: \(.meta.agent)\nModel: \(.meta.model)\nTimestamp: \(.meta.timestamp)\n\nResults: \(.summary.passed)/\(.summary.total) passed (\(.summary.pass_rate * 100 | floor)%)\nDuration: \(.summary.duration_ms)ms"' evals/results/latest.json; \
		echo ""; \
		echo "Tests:"; \
		jq -r '.tests[] | "  \(if .passed then "✅" else "❌" end) \(.id) (\(.duration_ms)ms)"' evals/results/latest.json; \
	else \
		echo "No results found. Run 'make test-golden' first."; \
	fi
