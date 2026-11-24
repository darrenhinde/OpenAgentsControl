#!/usr/bin/env python3
"""
Registry Fix Script
Fixes dead references and adds orphaned files to built-ai-configs/registry/registry.json
"""

import json
import os
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent.parent
REGISTRY_FILE = REPO_ROOT / "built-ai-configs/registry/registry.json"

def load_registry():
    with open(REGISTRY_FILE, 'r') as f:
        return json.load(f)

def save_registry(registry):
    with open(REGISTRY_FILE, 'w') as f:
        json.dump(registry, f, indent=2)
    print(f"✓ Registry saved to {REGISTRY_FILE}")

def remove_dead_references(registry):
    """Remove entries that point to non-existent files"""
    dead_entries = [
        "workflows-delegation",  # Split into multiple files
        "design-iteration",      # Split into multiple files  
        "design-assets",         # Doesn't exist
        "animation-patterns",    # Split into animation-*.md files
        "adding-agent",          # Split into adding-agent-*.md
        "adding-skill",          # Split into adding-skill-*.md
        "navigation-design",     # Split into navigation-design-*.md
        "claude-agent-skills",   # Directory doesn't exist
        "claude-create-subagents", # Directory doesn't exist
        "claude-hooks",          # Directory doesn't exist
        "claude-plugins",        # Directory doesn't exist
        "external-libraries",    # Split into external-libraries-*.md
        "navigation",            # Duplicate/to-be-consumed doesn't exist
    ]
    
    removed = []
    for category in ['contexts']:
        if category in registry['components']:
            original_count = len(registry['components'][category])
            registry['components'][category] = [
                c for c in registry['components'][category] 
                if c['id'] not in dead_entries
            ]
            removed_count = original_count - len(registry['components'][category])
            if removed_count > 0:
                removed.append(f"{category}: {removed_count} entries")
    
    print(f"✓ Removed dead references: {', '.join(removed) if removed else 'None'}")
    return registry

def add_split_file_entries(registry):
    """Add entries for split files that exist on disk"""
    
    new_entries = [
        # Task Delegation (split files)
        {
            "id": "task-delegation-basics",
            "name": "Task Delegation Basics",
            "type": "context",
            "path": ".opencode/context/core/workflows/task-delegation-basics.md",
            "description": "Task delegation fundamentals and basic usage patterns",
            "tags": ["workflows", "delegation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "task-delegation-specialists",
            "name": "Task Delegation Specialists",
            "type": "context",
            "path": ".opencode/context/core/workflows/task-delegation-specialists.md",
            "description": "Specialist subagents for task delegation workflows",
            "tags": ["workflows", "delegation", "subagents"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "task-delegation-caching",
            "name": "Task Delegation Caching",
            "type": "context",
            "path": ".opencode/context/core/workflows/task-delegation-caching.md",
            "description": "Caching strategies for task delegation workflows",
            "tags": ["workflows", "delegation", "caching"],
            "dependencies": [],
            "category": "standard"
        },
        
        # Design Iteration (split files)
        {
            "id": "design-iteration-overview",
            "name": "Design Iteration Overview",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-overview.md",
            "description": "Overview of the design iteration workflow process",
            "tags": ["workflows", "design", "iteration"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-plan-file",
            "name": "Design Iteration Plan File",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-plan-file.md",
            "description": "Structure and format for design iteration plan files",
            "tags": ["workflows", "design", "planning"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-plan-iterations",
            "name": "Design Iteration Plan Iterations",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-plan-iterations.md",
            "description": "Planning iterations in the design workflow",
            "tags": ["workflows", "design", "planning"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-stage-layout",
            "name": "Design Iteration Stage - Layout",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-stage-layout.md",
            "description": "Layout stage guidelines for design iteration",
            "tags": ["workflows", "design", "layout"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-stage-theme",
            "name": "Design Iteration Stage - Theme",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-stage-theme.md",
            "description": "Theme stage guidelines for design iteration",
            "tags": ["workflows", "design", "theme"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-stage-implementation",
            "name": "Design Iteration Stage - Implementation",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-stage-implementation.md",
            "description": "Implementation stage guidelines for design iteration",
            "tags": ["workflows", "design", "implementation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-stage-animation",
            "name": "Design Iteration Stage - Animation",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-stage-animation.md",
            "description": "Animation stage guidelines for design iteration",
            "tags": ["workflows", "design", "animation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-visual-content",
            "name": "Design Iteration Visual Content",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-visual-content.md",
            "description": "Visual content guidelines for design iteration",
            "tags": ["workflows", "design", "visual"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "design-iteration-best-practices",
            "name": "Design Iteration Best Practices",
            "type": "context",
            "path": ".opencode/context/core/workflows/design-iteration-best-practices.md",
            "description": "Best practices for design iteration workflows",
            "tags": ["workflows", "design", "best-practices"],
            "dependencies": [],
            "category": "standard"
        },
        
        # External Libraries (split files)
        {
            "id": "external-libraries-workflow",
            "name": "External Libraries Workflow",
            "type": "context",
            "path": ".opencode/context/core/workflows/external-libraries-workflow.md",
            "description": "Workflow for managing external library dependencies",
            "tags": ["workflows", "external", "libraries"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "external-libraries-scenarios",
            "name": "External Libraries Scenarios",
            "type": "context",
            "path": ".opencode/context/core/workflows/external-libraries-scenarios.md",
            "description": "Common scenarios for external library integration",
            "tags": ["workflows", "external", "libraries", "scenarios"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "external-libraries-faq",
            "name": "External Libraries FAQ",
            "type": "context",
            "path": ".opencode/context/core/workflows/external-libraries-faq.md",
            "description": "Frequently asked questions about external libraries",
            "tags": ["workflows", "external", "libraries", "faq"],
            "dependencies": [],
            "category": "standard"
        },
        
        # Adding Agent (split files)
        {
            "id": "adding-agent-basics",
            "name": "Adding Agent - Basics",
            "type": "context",
            "path": ".opencode/context/openagents-repo/guides/adding-agent-basics.md",
            "description": "Basic guide for adding new agents",
            "tags": ["guides", "agents", "basics"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "adding-agent-testing",
            "name": "Adding Agent - Testing",
            "type": "context",
            "path": ".opencode/context/openagents-repo/guides/adding-agent-testing.md",
            "description": "Testing guide for new agents",
            "tags": ["guides", "agents", "testing"],
            "dependencies": [],
            "category": "standard"
        },
        
        # Adding Skill (split files)
        {
            "id": "adding-skill-basics",
            "name": "Adding Skill - Basics",
            "type": "context",
            "path": ".opencode/context/openagents-repo/guides/adding-skill-basics.md",
            "description": "Basic guide for adding new skills",
            "tags": ["guides", "skills", "basics"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "adding-skill-implementation",
            "name": "Adding Skill - Implementation",
            "type": "context",
            "path": ".opencode/context/openagents-repo/guides/adding-skill-implementation.md",
            "description": "Implementation guide for new skills",
            "tags": ["guides", "skills", "implementation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "adding-skill-example",
            "name": "Adding Skill - Example",
            "type": "context",
            "path": ".opencode/context/openagents-repo/guides/adding-skill-example.md",
            "description": "Example of adding a new skill",
            "tags": ["guides", "skills", "examples"],
            "dependencies": [],
            "category": "standard"
        },
        
        # Navigation Design (split files)
        {
            "id": "navigation-design-basics",
            "name": "Navigation Design Basics",
            "type": "context",
            "path": ".opencode/context/core/context-system/guides/navigation-design-basics.md",
            "description": "Basics of designing navigation files",
            "tags": ["context-system", "navigation", "design"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "navigation-templates",
            "name": "Navigation Templates",
            "type": "context",
            "path": ".opencode/context/core/context-system/guides/navigation-templates.md",
            "description": "Templates for navigation files",
            "tags": ["context-system", "navigation", "templates"],
            "dependencies": [],
            "category": "standard"
        },
        
        # Animation Patterns (split files)
        {
            "id": "animation-basics",
            "name": "Animation Basics",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-basics.md",
            "description": "Basic animation patterns and guidelines",
            "tags": ["ui", "web", "animation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "animation-advanced",
            "name": "Animation Advanced",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-advanced.md",
            "description": "Advanced animation patterns and techniques",
            "tags": ["ui", "web", "animation"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "animation-components",
            "name": "Animation Components",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-components.md",
            "description": "Component-specific animation patterns",
            "tags": ["ui", "web", "animation", "components"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "animation-forms",
            "name": "Animation Forms",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-forms.md",
            "description": "Animation patterns for forms",
            "tags": ["ui", "web", "animation", "forms"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "animation-chat",
            "name": "Animation Chat",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-chat.md",
            "description": "Animation patterns for chat interfaces",
            "tags": ["ui", "web", "animation", "chat"],
            "dependencies": [],
            "category": "standard"
        },
        {
            "id": "animation-loading",
            "name": "Animation Loading",
            "type": "context",
            "path": ".opencode/context/ui/web/animation-loading.md",
            "description": "Loading animation patterns",
            "tags": ["ui", "web", "animation", "loading"],
            "dependencies": [],
            "category": "standard"
        },
    ]
    
    # Verify files exist before adding
    verified_entries = []
    for entry in new_entries:
        file_path = REPO_ROOT / entry['path']
        if file_path.exists():
            verified_entries.append(entry)
        else:
            print(f"⚠ File doesn't exist: {entry['path']}")
    
    # Add to registry
    if 'contexts' not in registry['components']:
        registry['components']['contexts'] = []
    
    existing_ids = {c['id'] for c in registry['components']['contexts']}
    added = 0
    for entry in verified_entries:
        if entry['id'] not in existing_ids:
            registry['components']['contexts'].append(entry)
            added += 1
    
    print(f"✓ Added {added} new split-file entries")
    return registry

def update_dependencies(registry):
    """Update dependencies that referenced old split files"""
    # Update OpenCoder dependencies
    for agent in registry['components'].get('agents', []):
        if agent['id'] == 'opencoder':
            # Replace workflows-delegation with task-delegation-basics
            agent['dependencies'] = [
                dep.replace('context:workflows-delegation', 'context:task-delegation-basics')
                for dep in agent['dependencies']
            ]
            print(f"✓ Updated dependencies for agent: {agent['id']}")
    
    # Update context dependencies
    for ctx in registry['components'].get('contexts', []):
        if 'dependencies' in ctx:
            # Replace external-libraries with external-libraries-workflow
            ctx['dependencies'] = [
                dep.replace('context:external-libraries', 'context:external-libraries-workflow')
                for dep in ctx['dependencies']
            ]
            # Replace adding-agent with adding-agent-basics
            ctx['dependencies'] = [
                dep.replace('context:adding-agent', 'context:adding-agent-basics')
                for dep in ctx['dependencies']
            ]
            # Replace adding-skill with adding-skill-basics  
            ctx['dependencies'] = [
                dep.replace('context:adding-skill', 'context:adding-skill-basics')
                for dep in ctx['dependencies']
            ]
    
    print(f"✓ Updated dependencies referencing split files")
    return registry

def main():
    print("=" * 60)
    print("Registry Fix Script")
    print("=" * 60)
    
    # Load registry
    registry = load_registry()
    print(f"✓ Loaded registry with {len(registry['components'].get('contexts', []))} contexts")
    
    # Fix steps
    registry = remove_dead_references(registry)
    registry = add_split_file_entries(registry)
    registry = update_dependencies(registry)
    
    # Save registry
    save_registry(registry)
    
    # Validate
    context_count = len(registry['components'].get('contexts', []))
    print(f"\n✓ Registry now has {context_count} context entries")
    print("\nNext: Run validation to check results")
    print("  bun run scripts/registry/validate-registry.ts")

if __name__ == "__main__":
    main()
