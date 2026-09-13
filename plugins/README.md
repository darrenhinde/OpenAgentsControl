# OpenAgents Control - IDE Plugins

This directory contains IDE-specific plugin implementations for OpenAgents Control.

## Structure

```
plugins/
└── claude-code/          # Claude Code plugin
    ├── .claude-plugin/   # Plugin manifest
    ├── skills/           # Claude-specific skills
    ├── agents/           # Claude-specific agents
    ├── hooks/            # Event-driven automation
    ├── commands/         # Custom slash commands
    ├── context/          # Symlink to .opencode/context/
    └── README.md         # Plugin documentation
```

## Available Plugins

### Claude Code (`claude-code/`)

**Plugin Name**: `oac`

**Installation**:
```bash
# From GitHub marketplace
/plugin marketplace add darrenhinde/OpenAgentsControl
/plugin install oac

# Local testing
claude --plugin-dir ./plugins/claude-code
```

**Features**:
- Intelligent code review with security analysis
- TDD test generation
- Automated documentation
- Smart task breakdown
- Context-aware agents

**Documentation**: See `claude-code/README.md`

## Future Plugins

- **VS Code** - Planned

## Development

Each plugin is self-contained and can be developed/tested independently.

### Adding a New Plugin

1. Create plugin directory: `plugins/your-ide/`
2. Add plugin manifest (IDE-specific format)
3. Symlink to shared context: `ln -s ../../.opencode/context context`
4. Add skills/agents/commands
5. Update `.claude-plugin/marketplace.json` if applicable
6. Document in plugin's README.md

---

**Last Updated**: 2026-02-16
