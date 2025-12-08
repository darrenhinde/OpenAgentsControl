# OpenAgents - GitHub Project Management
# Quick commands for managing your GitHub Project board from the terminal

REPO := darrenhinde/OpenAgents
PROJECT_NUMBER := 2
OWNER := darrenhinde

.PHONY: help idea ideas board labels project-info issue-view issue-comment issue-close bug feature

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
