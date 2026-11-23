# OpenAgents Control with Nix Home Manager

Use this guide if you want to install OpenAgents Control through the repository's built-in flake module instead of the shell installer.

## When to use this

This setup is a good fit if you already manage your OpenCode configuration with Nix and want OAC installation to be reproducible.

If you do **not** already use Nix or Home Manager, the standard installer is simpler:

- [Main README quick start](../../README.md#-quick-start)
- [Installation Guide](./installation.md)

---

## Quick start

Add OAC as a flake input and import its Home Manager module:

```nix
{
  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager.url = "github:nix-community/home-manager";
    home-manager.inputs.nixpkgs.follows = "nixpkgs";

    oac.url = "github:darrenhinde/OpenAgentsControl";
  };

  outputs = { nixpkgs, home-manager, oac, ... }: {
    homeConfigurations.my-user = home-manager.lib.homeManagerConfiguration {
      pkgs = import nixpkgs { system = "x86_64-linux"; };
      modules = [
        oac.homeManagerModules.default
        {
          programs.opencode.oac = {
            enable = true;
            profile = "developer";
          };
        }
      ];
    };
  };
}
```

Apply the configuration:

```bash
home-manager switch --flake .#my-user
```

---

## What the module does by default

When you enable `programs.opencode.oac`, the module:

- imports `oac.homeManagerModules.default`
- enables `programs.opencode` automatically
- uses this flake's source tree by default
- rewrites `.opencode/context` references in installed files by default
- points rewritten context references at the pinned source-backed context path by default
- installs the bootstrap context files required for reliable context discovery
- enables a default set of OpenCode permission rules for OAC context access and project `.tmp` access

---

## Common configuration

### Minimal configuration

```nix
{
  programs.opencode.oac = {
    enable = true;
    profile = "developer";
  };
}
```

### Add extra components

```nix
{
  programs.opencode.oac = {
    enable = true;
    profile = "developer";
    components = [
      "agent:openagent"
      "command:add-context"
      "context:core/*"
    ];
  };
}
```

### Install only custom-selected components

Set `profile = null` to skip profile presets and install only the components you specify:

```nix
{
  programs.opencode.oac = {
    enable = true;
    profile = null;
    components = [
      "agent:openagent"
      "command:add-context"
    ];
  };
}
```

### Exclude components from a profile

```nix
{
  programs.opencode.oac = {
    enable = true;
    profile = "full";
    excludeComponents = [
      "plugin:notify"
    ];
  };
}
```

---

## Important options

### Core options

| Option | Default | What it does |
| --- | --- | --- |
| `enable` | `false` | Turns on OAC installation through Home Manager. |
| `enableOpencode` | `true` | Enables `programs.opencode` automatically when OAC is enabled. |
| `source` | flake source | Uses a custom OAC source tree containing `registry.json` and `.opencode/`. |
| `profile` | `"developer"` | Installs a preset profile: `essential`, `developer`, `business`, `full`, or `advanced`. Use `null` for custom-only selection. |
| `components` | `[]` | Adds extra registry components on top of the selected profile. |
| `excludeComponents` | `[]` | Removes specific components after profile and dependency expansion. |
| `includeDependencies` | `true` | Includes transitive dependencies from `registry.json`. |

### Installation layout options

| Option | Default | What it does |
| --- | --- | --- |
| `targetRoot` | `"opencode"` | Base directory under `$XDG_CONFIG_HOME` where files are installed. |
| `layout.agent` | `"agent"` | Destination directory name for agent files. |
| `layout.command` | `"command"` | Destination directory name for command files. |
| `layout.context` | `"context"` | Destination directory name for context files. |
| `layout.tool` | `"tool"` | Destination directory name for tool files. |
| `layout.plugin` | `"plugin"` | Destination directory name for plugins. |
| `layout.skills` | `"skills"` | Destination directory name for skills. |
| `layout.config` | `""` | Destination directory for files that are not under `.opencode/`. Empty keeps them at the target root. |
| `pathOverrides` | `{}` | Overrides exact generated destination paths for specific source files. |
| `force` | `false` | Sets `xdg.configFile.<name>.force` for generated files. |

### Context and rewrite options

| Option | Default | What it does |
| --- | --- | --- |
| `rewriteContextReferences` | `true` | Rewrites `.opencode/context` references inside installed files. |
| `contextReferencePath` | `null` | Overrides the path used for rewritten context references. |
| `extraFiles` | `{}` | Adds extra files under `targetRoot` after generated profile files. |
| `overrides` | `{}` | Replaces final installed files under `targetRoot` after all generation steps. |

### Permission and advanced options

| Option | Default | What it does |
| --- | --- | --- |
| `enableBuiltinPermissions` | `true` | Enables the module's built-in OpenCode permission rules. |
| `allowOacContextRead` | `true` | Allows reads to the OAC context reference path, denies edits there, and requires approval for matching bash commands. |
| `allowTmpDirFullAccess` | `true` | Allows reads, edits, and built-in `ls` / `mkdir` patterns for project `.tmp`. |
| `installAdditionalPaths` | `false` | Installs profile `additionalPaths` recursively as XDG config files. |
| `additionalPathsPrefix` | `"additional"` | Target prefix used when `installAdditionalPaths = true`. |

---

## Bootstrap context files

These bootstrap files are installed unless explicitly excluded:

- `$XDG_CONFIG_HOME/opencode/context/navigation.md`
- `$XDG_CONFIG_HOME/opencode/context/core/config/paths.json`

These are canonical discovery files and do **not** follow `pathOverrides`.

---

## Context reference behavior

By default, `contextReferencePath = null` resolves to the pinned source-backed context directory:

```nix
{
  programs.opencode.oac.contextReferencePath = null;
}
```

That means rewritten references point at the flake source / Nix store path for `.opencode/context`, not the Home Manager symlink tree. This avoids symlink traversal issues during context discovery.

If you want rewritten references to point at your config directory instead:

```nix
{ config, ... }:
{
  programs.opencode.oac.contextReferencePath = "${config.xdg.configHome}/opencode/context";
}
```

If you want to keep installed file contents unchanged, disable rewriting:

```nix
{
  programs.opencode.oac.rewriteContextReferences = false;
}
```

---

## Built-in permissions

The module can install a default permission policy for OpenCode.

### Default behavior

- `enableBuiltinPermissions = true`
- `allowOacContextRead = true`
- `allowTmpDirFullAccess = true`

This means:

- the OAC context reference path is readable
- edits to that context reference path are denied
- bash commands targeting that path require approval
- project `.tmp` reads and edits are allowed
- built-in `ls` and `mkdir` patterns for `.tmp` are allowed

### Example: customize permissions

```nix
{
  programs.opencode.oac = {
    enable = true;
    enableBuiltinPermissions = true;
    allowOacContextRead = true;
    allowTmpDirFullAccess = false;
  };
}
```

### Example: disable module-managed permissions completely

```nix
{
  programs.opencode.oac = {
    enable = true;
    enableBuiltinPermissions = false;
  };
}
```

Use that if you want to manage OpenCode permissions yourself through `programs.opencode.settings`.

---

## Path customization examples

### Change the install root

```nix
{
  programs.opencode.oac.targetRoot = "opencode-team";
}
```

This installs files under `$XDG_CONFIG_HOME/opencode-team/...`.

### Override a generated file path

```nix
{
  programs.opencode.oac.pathOverrides = {
    ".opencode/agent/core/openagent.md" = "agents/openagent.md";
  };
}
```

### Add your own files after profile generation

```nix
{
  programs.opencode.oac.extraFiles = {
    "context/project-intelligence/technical-domain.md" = ./technical-domain.md;
  };
}
```

### Replace a generated file entirely

```nix
{
  programs.opencode.oac.overrides = {
    "agent/core/openagent.md" = ./openagent.md;
  };
}
```

---

## Notes about the `advanced` profile

The `advanced` profile can reference `additionalPaths` entries from `registry.json`.

Those are **not** installed by default, which matches the current shell installer behavior. To include them:

```nix
{
  programs.opencode.oac = {
    enable = true;
    profile = "advanced";
    installAdditionalPaths = true;
  };
}
```

---

## Related docs

- [Main README](../../README.md)
- [Installation Guide](./installation.md)
- [Documentation Index](../README.md)
- [OpenCode CLI Docs](https://opencode.ai/docs)
