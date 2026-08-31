# OpenAgents Control Documentation

Welcome to the OpenAgents Control documentation! This directory contains all documentation organized by topic.

## 📚 Documentation Index

### Getting Started

- **[Installation Guide](getting-started/installation.md)** - Complete installation guide with collision handling
- **[Collision Handling](getting-started/collision-handling.md)** - Quick reference for install script collision strategies
- **[Nix Home Manager Guide](getting-started/nix-home-manager.md)** - Install OAC with the flake module and configure `programs.opencode.oac`

### Features

- **[System Builder](features/system-builder/)** - Build complete AI systems tailored to your domain
  - [Quick Start](features/system-builder/README.md) - Get started with the system builder
  - [Complete Guide](features/system-builder/guide.md) - Detailed documentation and examples
- **[Agent System Blueprint](features/agent-system-blueprint.md)** - Architecture patterns and how to extend the system

### Contributing

- **[Contributing Guide](contributing/CONTRIBUTING.md)** - How to contribute to the project
- **[Code of Conduct](contributing/CODE_OF_CONDUCT.md)** - Community guidelines

### GitHub

- **[GitHub Settings](github/GITHUB_SETTINGS.md)** - Repository settings checklist

## 🚀 Quick Links

### For New Users
- Start with the main [README](../README.md) in the repository root
- Follow the [Installation Guide](getting-started/installation.md)
- Use `opencode --agent OpenAgent` to start building
- Read the [OpenAgent Guide](agents/openagent.md) to understand the workflow

### For Contributors
- Read the [Contributing Guide](contributing/CONTRIBUTING.md)
- Review the [Code of Conduct](contributing/CODE_OF_CONDUCT.md)
- Check out [good first issues](https://github.com/darrenhinde/OpenAgentsControl/labels/good%20first%20issue)

### For Advanced Users
- Study the [Agent System Blueprint](features/agent-system-blueprint.md)
- Try the [System Builder](features/system-builder/)
- Create custom agents and commands

## 📖 Documentation Structure

```
docs/
├── README.md                           # This file
├── getting-started/
│   ├── installation.md                 # Installation guide
│   ├── collision-handling.md           # Collision handling reference
│   └── nix-home-manager.md             # Nix/Home Manager flake module guide
├── features/
│   ├── system-builder/
│   │   ├── README.md                   # System builder quick start
│   │   └── guide.md                    # System builder complete guide
│   └── agent-system-blueprint.md       # Architecture patterns
├── contributing/
│   ├── CODE_OF_CONDUCT.md              # Community guidelines
│   └── CONTRIBUTING.md                 # Contribution guide
└── github/
    └── GITHUB_SETTINGS.md              # Repository settings
```

## 🔍 Finding What You Need

### I want to...

**...install OpenAgents Control**
→ [Installation Guide](getting-started/installation.md)

**...install OpenAgents Control with Nix/Home Manager**
→ [Nix Home Manager Guide](getting-started/nix-home-manager.md)

**...understand collision handling**
→ [Collision Handling](getting-started/collision-handling.md)

**...build a custom AI system**
→ [System Builder](features/system-builder/)

**...understand the architecture**
→ [Agent System Blueprint](features/agent-system-blueprint.md)

**...contribute to the project**
→ [Contributing Guide](contributing/CONTRIBUTING.md)

**...report a bug or request a feature**
→ [GitHub Issues](https://github.com/darrenhinde/OpenAgentsControl/issues)

## 💡 Additional Resources

- **Main README**: [../README.md](../README.md) - Complete overview and quick start
- **CHANGELOG**: [../CHANGELOG.md](../CHANGELOG.md) - Version history and updates
- **GitHub Repository**: https://github.com/darrenhinde/OpenAgentsControl
- **OpenCode CLI Docs**: https://opencode.ai/docs
- **Component Registry**: [../registry.json](../registry.json)

## 📌 Current Version

**v0.6.0** (January 28, 2026)

Latest updates:
- ExternalScout subagent for fetching live library documentation (18+ libraries)
- Enhanced ContextScout with multi-model optimization
- Complete command and agent documentation
- Simplified agent architecture (OpenAgent + OpenCoder)

## 🤝 Community

- **Issues**: [Report bugs or request features](https://github.com/darrenhinde/OpenAgentsControl/issues)
- **Discussions**: [Ask questions and share ideas](https://github.com/darrenhinde/OpenAgentsControl/discussions)
- **Pull Requests**: [Contribute code](https://github.com/darrenhinde/OpenAgentsControl/pulls)

## 📝 License

This project is licensed under the MIT License. See [LICENSE](../LICENSE) for details.

---

**Need help?** Check the [Contributing Guide](contributing/CONTRIBUTING.md) or open an [issue](https://github.com/darrenhinde/OpenAgentsControl/issues).
