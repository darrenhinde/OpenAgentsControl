/**
 * Moving a tracked install between OpenCode layouts when its profiles are unknown.
 *
 * An install with no persisted installation scope can only be updated from what its manifest
 * tracks. Across a flavor change the tracked PATHS differ (nested v1 agents vs flat v2 ones), so
 * each tracked file is mapped through the registries: file -> component (type:id) in the layout
 * on disk -> the same component in the target layout -> that component's files.
 *
 * Pure: registries in, source paths out.
 */
import { filesForComponent, listComponents, type Registry, type RegistryComponent } from './registry.js';
import { toDestPath } from './flavor.js';

const key = (c: RegistryComponent): string => `${c.type}:${c.id}`;

const ownerOf = (registry: Registry, destPath: string): RegistryComponent | undefined =>
  listComponents(registry).find((c) => filesForComponent(c).some((f) => toDestPath(f) === destPath));

/**
 * @param tracked  destination paths from the manifest.
 * @param from     the registry describing the layout currently on disk.
 * @param to       the registry of the layout being installed.
 * @returns sorted, de-duplicated SOURCE paths in `to`'s layout.
 */
export const mapTrackedFiles = (tracked: readonly string[], from: Registry, to: Registry): string[] => {
  const target = new Map(listComponents(to).map((c) => [key(c), c]));
  const out = new Set<string>();

  for (const destPath of tracked) {
    const owner = ownerOf(from, destPath);
    if (owner === undefined) {
      out.add(destPath); // not a component file (custom context, config): keep as is
      continue;
    }
    const counterpart = target.get(key(owner));
    if (counterpart === undefined) continue; // the target does not ship it
    for (const file of filesForComponent(counterpart)) out.add(file);
  }
  return [...out].sort();
};
