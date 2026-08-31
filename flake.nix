{
  description = "Nix flake module for OpenAgentsControl (OAC) + Home Manager OpenCode";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs =
    {
      self,
      nixpkgs,
      ...
    }:
    let
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "x86_64-darwin"
        "aarch64-darwin"
      ];

      forEachSystem =
        f:
        builtins.listToAttrs (
          builtins.map (system: {
            name = system;
            value = f system;
          }) systems
        );
    in
    {
      homeManagerModules = {
        oac = import ./nix/modules/home-manager/oac.nix { oacSource = self; };
        default = self.homeManagerModules.oac;
      };

      packages = forEachSystem (
        system:
        let
          pkgs = import nixpkgs { inherit system; };
        in
        {
          default = pkgs.writeText "oac-flake-module" "OpenAgentsControl Home Manager module";
        }
      );
    };
}
