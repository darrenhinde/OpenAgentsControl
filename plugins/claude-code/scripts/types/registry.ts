/**
 * Registry Type Definitions
 * Schema for OpenAgents Control built-ai-configs/registry/registry.json
 */

import { z } from 'zod'

// Component schema
export const ComponentSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  path: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
  category: z.string(),
  files: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  version: z.string().optional(),
})

export type Component = z.infer<typeof ComponentSchema>

// Registry schema
export const RegistrySchema = z.object({
  version: z.string(),
  schema_version: z.string(),
  repository: z.string(),
  categories: z.record(z.string()),
  components: z.object({
    agents: z.array(ComponentSchema).optional(),
    subagents: z.array(ComponentSchema).optional(),
    commands: z.array(ComponentSchema).optional(),
    tools: z.array(ComponentSchema).optional(),
    plugins: z.array(ComponentSchema).optional(),
    skills: z.array(ComponentSchema).optional(),
    contexts: z.array(ComponentSchema).optional(),
    config: z.array(ComponentSchema).optional(),
  }),
})

export type Registry = z.infer<typeof RegistrySchema>

// Profile types
export type Profile = 'essential' | 'standard' | 'extended' | 'specialized' | 'all'

// Installation options
export interface InstallOptions {
  profile?: Profile
  customComponents?: string[]
  dryRun?: boolean
  force?: boolean
  verbose?: boolean
}

// Installation result
export interface InstallResult {
  success: boolean
  manifest: InstallManifest
  errors?: string[]
}

// Manifest types (defined in manifest.ts but referenced here)
export interface InstallManifest {
  version: string
  profile: Profile | 'custom'
  source: {
    repository: string
    branch: string
    commit: string
    downloaded_at: string
  }
  context: Array<{
    id: string
    name: string
    path: string
    local_path: string
    category: string
  }>
}
