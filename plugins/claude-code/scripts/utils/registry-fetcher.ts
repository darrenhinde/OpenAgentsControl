/**
 * Registry Fetcher
 * Fetches and parses built-ai-configs/registry/registry.json from GitHub
 */

import { RegistrySchema, type Registry, type Component, type Profile } from '../types/registry'

export interface FetchRegistryOptions {
  source?: 'github' | 'local'
  repository?: string
  branch?: string
  localPath?: string
}

/**
 * Fetch registry from GitHub or local file
 */
export async function fetchRegistry(
  options: FetchRegistryOptions = {}
): Promise<Registry> {
  const {
    source = 'github',
    repository = 'darrenhinde/OpenAgentsControl',
    branch = 'main',
    localPath,
  } = options

  let registryData: unknown

  if (source === 'github') {
    // Fetch from GitHub raw URL
    const url = `https://raw.githubusercontent.com/${repository}/${branch}/built-ai-configs/registry/registry.json`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch registry: ${response.statusText}`)
    }

    registryData = await response.json()
  } else {
    // Load from local file
    if (!localPath) {
      throw new Error('localPath required for local source')
    }

    const fs = await import('fs/promises')
    const content = await fs.readFile(localPath, 'utf-8')
    registryData = JSON.parse(content)
  }

  // Validate with Zod
  const registry = RegistrySchema.parse(registryData)

  return registry
}

/**
 * Filter context components by profile
 */
export function filterContextByProfile(
  registry: Registry,
  profile: Profile
): Component[] {
  const contexts = registry.components.contexts || []

  if (profile === 'all') {
    return contexts
  }

  // Map profiles to categories
  const profileCategories: Record<Profile, string[]> = {
    essential: ['essential', 'core'],
    standard: ['essential', 'core', 'standard'],
    extended: ['essential', 'core', 'standard', 'extended'],
    specialized: ['essential', 'core', 'standard', 'extended', 'specialized'],
    all: [], // handled above
  }

  const categories = profileCategories[profile]
  
  if (!categories) {
    throw new Error(`Unknown profile: ${profile}`)
  }

  return contexts.filter((component) => categories.includes(component.category))
}

/**
 * Filter context components by custom IDs
 */
export function filterContextByIds(
  registry: Registry,
  componentIds: string[]
): Component[] {
  const contexts = registry.components.contexts || []

  return contexts.filter((component) => componentIds.includes(component.id))
}

/**
 * Get unique paths from components
 */
export function getUniquePaths(components: Component[]): string[] {
  const paths = new Set<string>()

  for (const component of components) {
    // Extract directory path from component path
    const pathParts = component.path.split('/')
    pathParts.pop() // Remove filename
    const dirPath = pathParts.join('/')
    
    if (dirPath) {
      paths.add(dirPath)
    }
  }

  return Array.from(paths)
}
