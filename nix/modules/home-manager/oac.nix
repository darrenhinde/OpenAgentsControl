{
  oacSource ? null,
}:
{ lib, config, ... }:
let
  inherit (lib)
    mkEnableOption
    mkIf
    mkMerge
    mkOption
    mkDefault
    types
    nameValuePair
    mapAttrs'
    ;

  cfg = config.programs.opencode.oac;

  source = if cfg.source != null then cfg.source else oacSource;

  registry =
    if source == null then null else builtins.fromJSON (builtins.readFile "${source}/registry.json");

  components = if registry == null then { } else registry.components;
  contexts = components.contexts or [ ];
  profiles = if registry == null then { } else registry.profiles;

  parseSpec =
    spec:
    let
      match = builtins.match "([^:]+):(.+)" spec;
    in
    if match == null then
      null
    else
      {
        type = builtins.elemAt match 0;
        id = builtins.elemAt match 1;
      };

  hasWildcard = spec: builtins.match ".*\*.*" spec != null;

  toRegistryKey =
    type:
    if type == "agent" then
      "agents"
    else if type == "subagent" then
      "subagents"
    else if type == "command" then
      "commands"
    else if type == "tool" then
      "tools"
    else if type == "plugin" then
      "plugins"
    else if type == "skill" then
      "skills"
    else if type == "context" then
      "contexts"
    else if type == "config" then
      "config"
    else if lib.hasSuffix "s" type then
      type
    else
      "${type}s";

  findById =
    items: id:
    let
      matches = builtins.filter (
        item: (item.id or null) == id || lib.elem id (item.aliases or [ ])
      ) items;
    in
    if matches == [ ] then null else builtins.head matches;

  findContextByPathId =
    id:
    let
      pathMd = ".opencode/context/${id}.md";
      pathAsIs = ".opencode/context/${id}";
      matches = builtins.filter (
        item: (item.path or "") == pathMd || (item.path or "") == pathAsIs
      ) contexts;
    in
    if matches == [ ] then null else builtins.head matches;

  resolveComponent =
    spec:
    let
      parsed = parseSpec spec;
    in
    if parsed == null then
      null
    else if parsed.type == "context" && lib.hasInfix "/" parsed.id then
      findContextByPathId parsed.id
    else
      findById (components.${toRegistryKey parsed.type} or [ ]) parsed.id;

  stripMdSuffix = path: if lib.hasSuffix ".md" path then lib.removeSuffix ".md" path else path;

  expandContextPattern =
    pattern:
    let
      match = builtins.match "(.*)\*.*" pattern;
      prefixRaw = if match == null then pattern else builtins.elemAt match 0;
      prefix = lib.removeSuffix "/" prefixRaw;
      prefixWithSlash = if prefix == "" then "" else "${prefix}/";
      fullPrefix = ".opencode/context/${prefixWithSlash}";
      matches = builtins.filter (item: lib.hasPrefix fullPrefix (item.path or "")) contexts;
    in
    map (item: "context:${stripMdSuffix (lib.removePrefix ".opencode/context/" item.path)}") matches;

  expandSpec =
    spec:
    let
      parsed = parseSpec spec;
    in
    if parsed == null then
      [ ]
    else if parsed.type == "context" && hasWildcard spec then
      expandContextPattern parsed.id
    else
      [ spec ];

  selectedProfile =
    if cfg.profile == null then
      null
    else if builtins.hasAttr cfg.profile profiles then
      builtins.getAttr cfg.profile profiles
    else
      null;

  profileComponents = if selectedProfile == null then [ ] else selectedProfile.components or [ ];
  profileAdditionalPaths =
    if selectedProfile == null then [ ] else selectedProfile.additionalPaths or [ ];

  bootstrapContextSpecs = [
    "context:root-navigation"
    "context:context-paths-config"
  ];

  initialSpecs = lib.unique (
    lib.concatMap expandSpec (profileComponents ++ cfg.components ++ bootstrapContextSpecs)
  );

  dependenciesFor =
    spec:
    let
      component = resolveComponent spec;
      dependencies = if component == null then [ ] else component.dependencies or [ ];
      expandDependency =
        dep:
        let
          parsed = parseSpec dep;
        in
        if parsed != null && parsed.type == "context" && hasWildcard dep then
          expandContextPattern parsed.id
        else
          [ dep ];
    in
    lib.unique (lib.concatMap expandDependency dependencies);

  resolveAllDependencies =
    seen: queue:
    if queue == [ ] then
      seen
    else
      let
        current = builtins.head queue;
        rest = builtins.tail queue;
      in
      if lib.elem current seen then
        resolveAllDependencies seen rest
      else
        let
          deps = dependenciesFor current;
        in
        resolveAllDependencies (seen ++ [ current ]) (deps ++ rest);

  resolvedSpecs =
    if cfg.includeDependencies then resolveAllDependencies [ ] initialSpecs else initialSpecs;

  finalSpecs = builtins.filter (spec: !(lib.elem spec cfg.excludeComponents)) resolvedSpecs;

  requiredBootstrapSpecs = builtins.filter (
    spec: !(lib.elem spec cfg.excludeComponents)
  ) bootstrapContextSpecs;

  bootstrapResolvedComponents = map (spec: {
    inherit spec;
    component = resolveComponent spec;
  }) requiredBootstrapSpecs;

  missingBootstrapComponents = builtins.filter (
    entry: entry.component == null
  ) bootstrapResolvedComponents;

  bootstrapExpectedSourceFiles = lib.unique (
    lib.concatMap (
      entry:
      if entry.component == null then
        [ ]
      else if entry.component ? files then
        entry.component.files
      else
        [ entry.component.path ]
    ) bootstrapResolvedComponents
  );

  sourceFiles = lib.unique (
    lib.concatMap (
      spec:
      let
        component = resolveComponent spec;
      in
      if component == null then
        [ ]
      else if component ? files then
        component.files
      else
        [ component.path ]
    ) finalSpecs
  );

  missingBootstrapSourcePaths = builtins.filter (
    path: !(builtins.pathExists "${source}/${path}")
  ) bootstrapExpectedSourceFiles;

  layoutMap = {
    agent = cfg.layout.agent;
    command = cfg.layout.command;
    context = cfg.layout.context;
    tool = cfg.layout.tool;
    plugin = cfg.layout.plugin;
    skills = cfg.layout.skills;
    config = cfg.layout.config;
  };

  mapSourceRelativePath =
    sourcePath:
    if lib.hasPrefix ".opencode/" sourcePath then
      let
        rel = lib.removePrefix ".opencode/" sourcePath;
        segments = lib.splitString "/" rel;
        headSegment = builtins.head segments;
        tailSegments = builtins.tail segments;
        mappedHead =
          if builtins.hasAttr headSegment layoutMap then
            builtins.getAttr headSegment layoutMap
          else
            headSegment;
        mappedSegments = if mappedHead == "" then tailSegments else [ mappedHead ] ++ tailSegments;
      in
      lib.concatStringsSep "/" mappedSegments
    else if cfg.layout.config == "" then
      sourcePath
    else
      "${cfg.layout.config}/${sourcePath}";

  mapRelativePath =
    sourcePath:
    if builtins.hasAttr sourcePath cfg.pathOverrides then
      builtins.getAttr sourcePath cfg.pathOverrides
    else
      mapSourceRelativePath sourcePath;

  withTargetRoot = rel: if cfg.targetRoot == "" then rel else "${cfg.targetRoot}/${rel}";

  contextReferencePath =
    if cfg.contextReferencePath != null then
      cfg.contextReferencePath
    else
      "${source}/.opencode/context";

  contextReferencePathForPermissions = builtins.unsafeDiscardStringContext contextReferencePath;

  expandPermissionPaths = path: [
    path
    "${path}/**"
  ];

  oacContextPermissionPaths = lib.unique (
    lib.concatMap expandPermissionPaths [
      contextReferencePathForPermissions
    ]
  );

  oacContextBashPatterns = lib.unique [
    "* ${contextReferencePathForPermissions}*"
  ];

  tmpDirPermissionPaths = expandPermissionPaths ".tmp";

  tmpDirBashPatterns = [
    "ls .tmp*"
    "ls * .tmp*"
    "ls \".tmp*"
    "ls * \".tmp*"
    "mkdir * tmp*"
    "mkdir tmp*"
    "mkdir \".tmp*"
    "mkdir * \".tmp*"
  ];

  mkPermissionRules =
    patterns: action:
    builtins.listToAttrs (map (pattern: nameValuePair pattern (mkDefault action)) patterns);

  contextDirectoryPermissionSettings = {
    permission = {
      external_directory = mkPermissionRules oacContextPermissionPaths "allow";
      read = mkPermissionRules oacContextPermissionPaths "allow";
      edit = mkPermissionRules oacContextPermissionPaths "deny";
      bash = mkPermissionRules oacContextBashPatterns "ask";
    };
  };

  tmpDirFullAccessSettings = {
    permission = {
      read = mkPermissionRules tmpDirPermissionPaths "allow";
      edit = mkPermissionRules tmpDirPermissionPaths "allow";
      bash = mkPermissionRules tmpDirBashPatterns "allow";
    };
  };

  rewriteContextRefs =
    text:
    if cfg.rewriteContextReferences then
      builtins.replaceStrings
        [
          "@.opencode/context/"
          ".opencode/context"
          "~/.config/opencode/context"
        ]
        [
          "@${contextReferencePath}/"
          contextReferencePath
          contextReferencePath
        ]
        text
    else
      text;

  mkFileEntry =
    pathMapper: sourcePath:
    let
      src = "${source}/${sourcePath}";
      destRel = pathMapper sourcePath;
      key = withTargetRoot destRel;
      fileValue =
        if cfg.rewriteContextReferences then
          {
            text = rewriteContextRefs (builtins.readFile src);
          }
        else
          {
            source = src;
          };
    in
    nameValuePair key ({ force = cfg.force; } // fileValue);

  mkGeneratedFileEntry = mkFileEntry mapRelativePath;

  mkBootstrapFileEntry = mkFileEntry mapSourceRelativePath;

  generatedFileEntries = builtins.listToAttrs (map mkGeneratedFileEntry sourceFiles);

  bootstrapFileEntries = builtins.listToAttrs (map mkBootstrapFileEntry bootstrapExpectedSourceFiles);

  additionalPaths = if cfg.installAdditionalPaths then profileAdditionalPaths else [ ];

  mkAdditionalPathEntry =
    relPath:
    let
      cleanRel = lib.removeSuffix "/" relPath;
      src = "${source}/${cleanRel}";
      destRel =
        if cfg.additionalPathsPrefix == "" then cleanRel else "${cfg.additionalPathsPrefix}/${cleanRel}";
      key = withTargetRoot destRel;
      base = {
        source = src;
        force = cfg.force;
      };
      recursiveAttrs = if lib.pathIsDirectory src then { recursive = true; } else { };
    in
    nameValuePair key (base // recursiveAttrs);

  additionalPathEntries = builtins.listToAttrs (map mkAdditionalPathEntry additionalPaths);

  mkUserEntry =
    key: value:
    nameValuePair (withTargetRoot key) (
      { force = cfg.force; } // (if lib.isPath value then { source = value; } else { text = value; })
    );

  extraFileEntries = mapAttrs' mkUserEntry cfg.extraFiles;
  overrideEntries = mapAttrs' mkUserEntry cfg.overrides;

  missingFiles = builtins.filter (path: !(builtins.pathExists "${source}/${path}")) sourceFiles;
in
{
  options.programs.opencode.oac = {
    enable = mkEnableOption "OpenAgentsControl profile installation for Home Manager OpenCode";

    enableOpencode = mkOption {
      type = types.bool;
      default = true;
      description = "Enable `programs.opencode` automatically when OAC is enabled.";
    };

    enableBuiltinPermissions = mkOption {
      type = types.bool;
      default = true;
      description = ''
        Enable OAC's built-in OpenCode permission rules.

        When enabled, this module can add the OAC context read policy and the project `.tmp`
        access policy according to `allowOacContextRead` and `allowTmpDirFullAccess`. Set this
        to `false` to disable all permission rules generated by this module while still installing
        OAC files and preserving any permission settings you define directly in
        `programs.opencode.settings`.
      '';
    };

    allowOacContextRead = mkOption {
      type = types.bool;
      default = true;
      description = ''
        Add default OpenCode permission rules for the OAC context reference path.

        This allows reads to the pinned OAC context path while denying edits and requiring
        `ask` approval for bash commands that target that path. Set to `false` to disable
        this policy. This option only has an effect when `enableBuiltinPermissions` is true.
      '';
    };

    allowTmpDirFullAccess = mkOption {
      type = types.bool;
      default = true;
      description = ''
        Add default OpenCode permission rules for the project `.tmp` directory.

        This allows reads and edits for both `.tmp` and `.tmp/**` and adds allow rules for the
        built-in `ls` and `mkdir` command patterns used to inspect or create `.tmp` directories.
        Set to `false` to disable this policy. This option only has an effect when
        `enableBuiltinPermissions` is true.
      '';
    };

    source = mkOption {
      type = types.nullOr types.path;
      default = null;
      description = ''
        OAC source tree containing `registry.json` and `.opencode/` files.

        By default this uses the source tree of this flake.
      '';
    };

    profile = mkOption {
      type = types.nullOr (
        types.enum [
          "essential"
          "developer"
          "business"
          "full"
          "advanced"
        ]
      );
      default = "developer";
      description = ''
        Profile to install from OAC `registry.json`.

        Set to `null` for custom-only component selection.
      '';
    };

    components = mkOption {
      type = types.listOf types.str;
      default = [ ];
      example = [
        "agent:openagent"
        "command:add-context"
        "context:core/*"
      ];
      description = "Extra components to install on top of the selected profile.";
    };

    excludeComponents = mkOption {
      type = types.listOf types.str;
      default = [ ];
      example = [ "plugin:notify" ];
      description = "Component specs to exclude after profile/dependency expansion.";
    };

    includeDependencies = mkOption {
      type = types.bool;
      default = true;
      description = "Resolve and include transitive dependencies from `registry.json`.";
    };

    targetRoot = mkOption {
      type = types.str;
      default = "opencode";
      description = ''
        Base directory under `$XDG_CONFIG_HOME` where OAC files are installed.

        Example: `opencode` -> `$XDG_CONFIG_HOME/opencode/...`
      '';
    };

    layout = {
      agent = mkOption {
        type = types.str;
        default = "agent";
        description = "Directory name for OAC agent files.";
      };

      command = mkOption {
        type = types.str;
        default = "command";
        description = "Directory name for OAC command files.";
      };

      context = mkOption {
        type = types.str;
        default = "context";
        description = "Directory name for OAC context files.";
      };

      tool = mkOption {
        type = types.str;
        default = "tool";
        description = "Directory name for OAC tools.";
      };

      plugin = mkOption {
        type = types.str;
        default = "plugin";
        description = "Directory name for OAC plugins.";
      };

      skills = mkOption {
        type = types.str;
        default = "skills";
        description = "Directory name for OAC skills.";
      };

      config = mkOption {
        type = types.str;
        default = "";
        description = ''
          Directory name for config-root files that are not under `.opencode/` (for example `env.example`).

          Empty string keeps them at the target root.
        '';
      };
    };

    pathOverrides = mkOption {
      type = types.attrsOf types.str;
      default = { };
      example = {
        ".opencode/agent/core/openagent.md" = "agents/openagent.md";
      };
      description = "Exact source-path to destination-path overrides for generated OAC files.";
    };

    rewriteContextReferences = mkOption {
      type = types.bool;
      default = true;
      description = ''
        Rewrite `.opencode/context` references in installed file content to a global config path,
        mirroring the installer's global path rewrite behavior.
      '';
    };

    contextReferencePath = mkOption {
      type = types.nullOr types.str;
      default = null;
      description = ''
        Explicit path used for rewritten context references.

        When null, defaults to the pinned OAC source context directory in the Nix store.
        This keeps context discovery on immutable real paths instead of Home Manager symlinks.
      '';
    };

    installAdditionalPaths = mkOption {
      type = types.bool;
      default = false;
      description = ''
        Install profile `additionalPaths` entries (currently used by `advanced`) as recursive xdg config files.

        The install script currently reports these as manual downloads.
      '';
    };

    additionalPathsPrefix = mkOption {
      type = types.str;
      default = "additional";
      description = "Destination prefix under `targetRoot` for profile `additionalPaths` when enabled.";
    };

    force = mkOption {
      type = types.bool;
      default = false;
      description = "Set `xdg.configFile.<name>.force` for generated OAC files.";
    };

    extraFiles = mkOption {
      type = types.attrsOf (types.either types.lines types.path);
      default = { };
      example = {
        "context/project-intelligence/technical-domain.md" = ./technical-domain.md;
      };
      description = "Additional files installed under `targetRoot` after generated profile files.";
    };

    overrides = mkOption {
      type = types.attrsOf (types.either types.lines types.path);
      default = { };
      example = {
        "agent/core/openagent.md" = ./openagent.md;
      };
      description = "Final override files/text installed under `targetRoot` (applied last).";
    };
  };

  config = mkIf cfg.enable {
    assertions = [
      {
        assertion = source != null;
        message = "programs.opencode.oac.source is null and no default oacSource was provided by the flake module.";
      }
      {
        assertion = builtins.pathExists "${source}/registry.json";
        message = "OAC source does not contain registry.json.";
      }
      {
        assertion = missingFiles == [ ];
        message =
          "Some resolved OAC files were not found in source: " + lib.concatStringsSep ", " missingFiles;
      }
      {
        assertion = missingBootstrapComponents == [ ];
        message =
          "Required bootstrap components could not be resolved from registry/source: "
          + lib.concatStringsSep ", " (map (entry: entry.spec) missingBootstrapComponents);
      }
      {
        assertion = missingBootstrapSourcePaths == [ ];
        message =
          "Resolved bootstrap components reference source paths that do not exist: "
          + lib.concatStringsSep ", " missingBootstrapSourcePaths;
      }
    ];

    warnings =
      lib.optional
        (cfg.profile == "advanced" && profileAdditionalPaths != [ ] && !cfg.installAdditionalPaths)
        "programs.opencode.oac.profile=advanced includes additionalPaths in registry.json, but installAdditionalPaths=false so they are skipped (matching install.sh behavior).";

    programs.opencode.enable = mkIf cfg.enableOpencode (mkDefault true);

    programs.opencode.settings = mkMerge [
      (mkIf (cfg.enableBuiltinPermissions && cfg.allowOacContextRead) contextDirectoryPermissionSettings)
      (mkIf (cfg.enableBuiltinPermissions && cfg.allowTmpDirFullAccess) tmpDirFullAccessSettings)
    ];

    xdg.configFile =
      generatedFileEntries
      // bootstrapFileEntries
      // additionalPathEntries
      // extraFileEntries
      // overrideEntries;
  };
}
