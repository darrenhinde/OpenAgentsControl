<!-- Context: core/standards | Priority: critical | Version: 1.0 | Updated: 2026-02-15 -->

# OpenCode Codebase Standards

**Complete Reference Guide**  
_Last Updated: Feb 2026_  
_Analyzed: 206+ TypeScript files across `packages/opencode/src/`_

---

## Table of Contents

1. [Function Definition Standards](#1-function-definition-standards)
2. [Class Usage Standards](#2-class-usage-standards)
3. [Array Handling Standards](#3-array-handling-standards)
4. [Variable & Destructuring Standards](#4-variable--destructuring-standards)
5. [Control Flow Standards](#5-control-flow-standards)
6. [Async & Concurrency Standards](#6-async--concurrency-standards)
7. [Race Condition Prevention](#7-race-condition-prevention)
8. [AI System Integration Standards](#8-ai-system-integration-standards)
9. [Service Architecture Standards](#9-service-architecture-standards)
10. [State Management Standards](#10-state-management-standards)
11. [Event Bus Standards](#11-event-bus-standards)
12. [Configuration Management Standards](#12-configuration-management-standards)
13. [Storage & Persistence Standards](#13-storage--persistence-standards)
14. [Error Handling Standards](#14-error-handling-standards)
15. [Type System Standards](#15-type-system-standards)
16. [Import Organization Standards](#16-import-organization-standards)
17. [Naming Conventions](#17-naming-conventions)
18. [Testing Standards](#18-testing-standards)
19. [Documentation Standards](#19-documentation-standards)
20. [Schema Definition Standards](#20-schema-definition-standards)
21. [Dependency Management Standards](#21-dependency-management-standards)
22. [Build & Development Standards](#22-build--development-standards)
23. [Performance Standards](#23-performance-standards)
24. [Security Standards](#24-security-standards)

---

## 1. Function Definition Standards

### 1.1 Naming Convention

**Rule: Prefer single-word function names**

**Compliance: 95%+**

```typescript
// ✅ GOOD - Single-word names
export const create = fn(...)
export const fork = fn(...)
export const touch = fn(...)
export const get = fn(...)
export const share = fn(...)
export async function stream(input: StreamInput) {...}
export async function work<T>(concurrency, items, fn) {...}

// ✅ ACCEPTABLE - Multi-word only when necessary
export function isDefaultTitle(title: string) {...}      // Boolean predicate
export function assertNotBusy(sessionID: string) {...}   // Assertion pattern
export async function createNext(input) {...}            // Version disambiguation
export async function resolvePromptParts(template) {...} // Complex operation needs clarity

// ❌ AVOID - Unnecessary multi-word names
function prepareJournal(dir: string) {}  // Use: journal()
function getUserData(id: string) {}      // Use: user()
function processFileContent(path) {}     // Use: process()
```

**File References:**

- `packages/opencode/src/session/index.ts` - Lines 140, 200, 206
- `packages/opencode/src/session/llm.ts` - Line 59
- `packages/opencode/src/util/queue.ts` - Lines 1-32

### 1.2 Function Definition Patterns

#### Pattern A: Zod-Validated Functions (Primary Pattern)

```typescript
// packages/opencode/src/util/fn.ts - The fn() wrapper
export function fn<T extends z.ZodType, Result>(schema: T, cb: (input: z.infer<T>) => Result) {
  const result = (input: z.infer<T>) => {
    const parsed = schema.parse(input) // Validates input
    return cb(parsed)
  }
  result.force = (input: z.infer<T>) => cb(input) // Skip validation
  result.schema = schema // Expose schema
  return result
}

// Usage Example 1: Session creation
export const create = fn(
  z
    .object({
      parentID: Identifier.schema("session").optional(),
      title: z.string().optional(),
      permission: Info.shape.permission,
    })
    .optional(),
  async (input) => {
    return createNext({
      parentID: input?.parentID,
      title: input?.title,
      permission: input?.permission ?? "allow",
    })
  },
)

// Usage Example 2: Simple validation
export const touch = fn(Identifier.schema("session"), async (sessionID) => {
  await update(sessionID, (draft) => {
    draft.time.updated = Date.now()
  })
})

// Usage Example 3: Complex object validation
export const messages = fn(
  z.object({
    sessionID: Identifier.schema("session"),
    limit: z.number().optional(),
  }),
  async (input) => {
    const result = [] as MessageV2.WithParts[]
    for await (const msg of MessageV2.stream(input.sessionID)) {
      if (input.limit && result.length >= input.limit) break
      result.push(msg)
    }
    result.reverse()
    return result
  },
)
```

**File References:**

- `packages/opencode/src/util/fn.ts` - Lines 1-12
- `packages/opencode/src/session/index.ts` - Lines 140-202

#### Pattern B: Namespace Organization (Preferred over Classes)

```typescript
// packages/opencode/src/session/index.ts
export namespace Session {
  const log = Log.create({ service: "session" })

  // Exported functions with fn() wrapper
  export const create = fn(...)
  export const fork = fn(...)
  export const touch = fn(...)
  export const messages = fn(...)

  // Async functions without wrapper
  export async function createNext(input) {...}
  export async function update(id, editor, options) {...}

  // Type definitions
  export type Info = z.infer<typeof Info>
  export const Info = z.object({...})

  // Events
  export const Event = {
    Created: BusEvent.define("session.created", z.object({info: Info})),
    Updated: BusEvent.define("session.updated", z.object({info: Info})),
  }

  // Error classes (only exception to no-class rule)
  export class BusyError extends Error {
    constructor(public readonly sessionID: string) {
      super(`Session ${sessionID} is busy`)
    }
  }
}

// Usage
await Session.create({ title: "New Session" })
await Session.touch(sessionID)
const msgs = await Session.messages({ sessionID, limit: 10 })
```

**File References:**

- `packages/opencode/src/session/index.ts` - Lines 26-518
- `packages/opencode/src/tool/tool.ts` - Lines 1-90
- `packages/opencode/src/session/processor.ts` - Lines 19-416

#### Pattern C: Inline vs. Extraction Rule

**Rule: Inline when used once, extract when composable/reusable**

```typescript
// ✅ GOOD - Inline when value used once
const journal = await Bun.file(path.join(dir, "journal.json")).json()
const [language, cfg] = await Promise.all([Provider.getLanguage(input.model), Config.get()])

// ❌ BAD - Unnecessary intermediate variable
const journalPath = path.join(dir, "journal.json")
const journalFile = Bun.file(journalPath)
const journal = await journalFile.json()

// ✅ GOOD - Extract when reusable across multiple call sites
async function resolveTools(input: Pick<StreamInput, "tools" | "agent" | "user">) {
  const disabled = PermissionNext.disabled(Object.keys(input.tools), input.agent.permission)
  for (const tool of Object.keys(input.tools)) {
    if (input.user.tools?.[tool] === false || disabled.has(tool)) {
      delete input.tools[tool]
    }
  }
  return input.tools
}

// Called from multiple locations
const tools = await resolveTools({ tools: input.tools, agent, user })

// ✅ GOOD - Extract when logic is complex and improves readability
function shouldUseCopilotResponsesApi(modelID: string): boolean {
  const match = /^gpt-(\d+)/.exec(modelID)
  if (!match) return false
  return Number(match[1]) >= 5 && !modelID.startsWith("gpt-5-mini")
}
```

**File References:**

- `packages/opencode/src/session/llm.ts` - Lines 59, 268-276
- `packages/opencode/src/provider/provider.ts` - Lines 46-56

### 1.3 Function Composition Patterns

```typescript
// ✅ GOOD - Functional composition with pipes
const filtered = agents
  .filter((a) => a.mode !== "primary")
  .filter((a) => PermissionNext.evaluate("task", a.name, caller.permission).action !== "deny")
  .map((a) => a.name)

// ✅ GOOD - Async composition with Promise.all
const [results, metadata] = await Promise.all([processItems(items), fetchMetadata(id)])

// ✅ GOOD - Higher-order functions
export function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
  return Lock.write(filepath).then(async (lock) => {
    try {
      return await fn()
    } finally {
      lock[Symbol.dispose]()
    }
  })
}
```

---

## 2. Class Usage Standards

### 2.1 Avoid Classes (Except Specific Patterns)

**Finding: Only 5 classes in 206 files**

**Rule: Use namespaces + functions instead of classes**

```typescript
// ❌ AVOID - Class-based organization
class SessionManager {
  private sessions: Map<string, Session> = new Map()

  create(input: CreateInput) {
    const session = { id: generateId(), ...input }
    this.sessions.set(session.id, session)
    return session
  }

  update(id: string, data: Partial<Session>) {
    const session = this.sessions.get(id)
    if (!session) throw new Error("Not found")
    Object.assign(session, data)
    return session
  }
}

// ✅ PREFER - Namespace-based organization
export namespace Session {
  const state = Instance.state(async () => ({
    sessions: new Map<string, Info>()
  }))

  export const create = fn(
    CreateInput.schema,
    async (input) => {
      const session = { id: Identifier.ascending("session"), ...input }
      state().sessions.set(session.id, session)
      return session
    }
  )

  export const update = fn(
    z.object({ id: z.string(), data: z.record(z.unknown()) }),
    async (input) => {
      const session = state().sessions.get(input.id)
      if (!session) throw NotFoundError.create({...})
      Object.assign(session, input.data)
      return session
    }
  )
}
```

### 2.2 Allowed Class Use Cases

#### Use Case 1: Error Types

```typescript
// ✅ GOOD - Custom error classes
export class BusyError extends Error {
  constructor(public readonly sessionID: string) {
    super(`Session ${sessionID} is busy`)
  }
}

// Usage
throw new BusyError(sessionID)

// Catching
try {
  await operation()
} catch (error) {
  if (error instanceof BusyError) {
    // Handle busy state
  }
}
```

**File Reference:** `packages/opencode/src/session/index.ts:494`

#### Use Case 2: Protocol Implementations

```typescript
// ✅ GOOD - Implementing external interfaces
export class OpenAICompatibleChatLanguageModel implements LanguageModelV2 {
  readonly specificationVersion = "v2"
  readonly provider: string
  readonly modelId: string

  constructor(modelId: string, settings: ModelSettings) {
    this.modelId = modelId
    this.provider = settings.provider
  }

  async doGenerate(options: GenerateOptions): Promise<GenerateResult> {
    // Implementation required by interface
  }

  async doStream(options: StreamOptions): AsyncIterableIterator<StreamPart> {
    // Implementation required by interface
  }
}

// ✅ GOOD - OAuth protocol implementation
export class McpOAuthProvider implements OAuthClientProvider {
  async getAccessToken(): Promise<string> {
    // OAuth flow implementation
  }
}
```

**File References:**

- `packages/opencode/src/provider/sdk/*` - Lines 53, 131
- `packages/opencode/src/mcp/oauth-provider.ts:26`

#### Use Case 3: Async Iterators

```typescript
// ✅ GOOD - AsyncIterable implementation
export class AsyncQueue<T> implements AsyncIterable<T> {
  private queue: T[] = []
  private resolvers: ((value: T) => void)[] = []

  push(item: T) {
    const resolve = this.resolvers.shift()
    if (resolve) {
      resolve(item)
    } else {
      this.queue.push(item)
    }
  }

  async next(): Promise<T> {
    if (this.queue.length > 0) {
      return this.queue.shift()!
    }
    return new Promise((resolve) => {
      this.resolvers.push(resolve)
    })
  }

  async *[Symbol.asyncIterator]() {
    while (true) {
      yield await this.next()
    }
  }
}

// Usage
const queue = new AsyncQueue<Message>()
queue.push(message)

for await (const msg of queue) {
  console.log(msg)
}
```

**File Reference:** `packages/opencode/src/util/queue.ts:1-19`

#### Use Case 4: Complex Stateful Managers

```typescript
// ✅ ACCEPTABLE - When managing complex state machines
export class ACPSessionManager {
  private sessions: Map<string, ACPSession>
  private connections: Map<string, WebSocket>

  // Complex lifecycle management
  async createSession(id: string) {...}
  async handleMessage(id: string, msg: Message) {...}
  async closeSession(id: string) {...}

  // State machine logic
  private transition(from: State, to: State) {...}
}
```

**File Reference:** `packages/opencode/src/acp/session.ts:8`

---

## 3. Array Handling Standards

### 3.1 Functional Methods (85% of operations)

**Rule: Prefer map/filter/flatMap over for-loops**

```typescript
// ✅ GOOD - Functional chain with type inference
const files = messages
  .flatMap((x) => x.parts)
  .filter((x): x is Patch => x.type === "patch") // Type guard maintains inference
  .flatMap((x) => x.files)
  .map((x) => path.relative(Instance.worktree, x))

// ✅ GOOD - Parallel async operations
const results = await Promise.all(
  toolCalls.map(async (call) => {
    return executeCall(call)
  }),
)

// ✅ GOOD - Reduce for aggregation
const totalAdditions = diffs.reduce((sum, x) => sum + x.additions, 0)

// ✅ GOOD - Filter with type guards
const agents = await Agent.list().then((x) => x.filter((a): a is Agent & { mode: "secondary" } => a.mode !== "primary"))

// ✅ GOOD - Unique values
const uniqueNames = Array.from(new Set(items.map((x) => x.name)))

// ✅ GOOD - Sorting
const sorted = items.toSorted((a, b) => a.timestamp - b.timestamp)
```

**File References:**

- `packages/opencode/src/tool/batch.ts` - Lines 41, 56, 80, 170
- `packages/opencode/src/session/prompt.ts` - Lines 192-200
- `packages/opencode/src/session/summary.ts` - Lines 96-109

### 3.2 For-Loops (15%, only when necessary)

**Rule: Use for-loops only for:**

1. Algorithm complexity (DP, graph traversal)
2. Early exit requirements
3. Sequential side effects
4. Performance-critical iteration

#### Pattern 1: Algorithm Complexity

```typescript
// ✅ GOOD - Dynamic programming (LCS algorithm)
// packages/opencode/src/tool/edit.ts:175-176
function lcs(a: string[], b: string[]): number[][] {
  const dp: number[][] = Array(a.length + 1)
    .fill(0)
    .map(() => Array(b.length + 1).fill(0))

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  return dp
}
```

#### Pattern 2: Early Exit

```typescript
// ✅ GOOD - Break on condition
// packages/opencode/src/session/revert.ts:31-40
const patches = []
for (const msg of all) {
  if (msg.info.id === revert.messageID) break
  for (const part of msg.parts) {
    if (part.type === "patch") {
      patches.push(part)
    }
  }
}

// ✅ GOOD - Find first match
for (const file of files) {
  if (await Filesystem.exists(file)) {
    return file
  }
}
```

#### Pattern 3: Sequential Side Effects

```typescript
// ✅ GOOD - Sequential mutations
for (const key of Object.keys(input.tools)) {
  if (input.user.tools?.[key] === false || disabled.has(key)) {
    delete input.tools[key]
  }
}

// ✅ GOOD - Streaming output
for (const line of lines) {
  await stream.write(line)
}
```

**File Reference:** `packages/opencode/src/tool/grep.ts:77`

#### Pattern 4: Performance Critical

```typescript
// ✅ GOOD - Low-level iteration for performance
for (let i = 0; i < buffer.length; i++) {
  result += buffer[i] * multiplier
}

// Note: Profile before optimizing - functional methods are often fast enough
```

### 3.3 Type Guards on Filter

**Rule: Use type guards to maintain type inference downstream**

```typescript
// ✅ GOOD - Type guard preserves type information
const patches = messages.flatMap((msg) => msg.parts).filter((part): part is PatchPart => part.type === "patch")
// patches is now PatchPart[], not Part[]

// ❌ BAD - Loses type information
const patches = messages.flatMap((msg) => msg.parts).filter((part) => part.type === "patch")
// patches is still Part[], requires casting later

// ✅ GOOD - Multiple type guards
const validAgents = agents
  .filter((a): a is Agent => a !== undefined)
  .filter((a): a is Agent & { mode: "secondary" } => a.mode !== "primary")
```

**File Reference:** `packages/opencode/src/tool/task.ts:24,29`

---

## 4. Variable & Destructuring Standards

### 4.1 Variable Declaration

**Rule: Prefer `const` over `let`**

```typescript
// ✅ GOOD - Immutable with ternary
const foo = condition ? 1 : 2
const result = await (isValid ? processValid() : processInvalid())

// ❌ BAD - Reassignment
let foo
if (condition) {
  foo = 1
} else {
  foo = 2
}

// ✅ GOOD - Early return instead of reassignment
function getValue(condition: boolean) {
  if (condition) return 1
  return 2
}

// ✅ ACCEPTABLE - let when mutation is necessary
let accumulator = 0
for (const item of items) {
  accumulator += item.value
}
```

**File Reference:** `AGENTS.md:56-68`

### 4.2 Destructuring

**Rule: Avoid unnecessary destructuring, preserve context with dot notation**

```typescript
// ✅ GOOD - Preserve context
function process(session: Session) {
  log.info("processing", { id: session.id, title: session.title })
  return {
    id: session.id,
    status: session.status,
    owner: session.owner
  }
}

// ❌ BAD - Loses context, harder to read
function process(session: Session) {
  const { id, title, status, owner } = session
  log.info("processing", { id, title })
  return { id, status, owner }
}

// ✅ ACCEPTABLE - Destructuring when improving readability
function renderUser({ name, email, avatar }: User) {
  return `<div>${name} (${email})</div>`
}

// ✅ ACCEPTABLE - Destructuring array returns
const [language, cfg, provider] = await Promise.all([...])
```

**File Reference:** `AGENTS.md:43-54`

### 4.3 Variable Naming

**Rule: Concise single-word names when descriptive**

```typescript
// ✅ GOOD
const session = await Session.get(id)
const user = await Auth.current()
const messages = await Session.messages({ sessionID })

// ❌ BAD - Unnecessary verbosity
const currentSession = await Session.get(id)
const currentlyAuthenticatedUser = await Auth.current()
const sessionMessagesList = await Session.messages({ sessionID })

// ✅ GOOD - Multi-word when single word is ambiguous
const sessionID = params.id
const userAgent = req.headers["user-agent"]
const maxRetries = config.retries
```

---

## 5. Control Flow Standards

### 5.1 Early Returns

**Rule: Avoid `else` statements, use early returns**

```typescript
// ✅ GOOD - Early returns
function getStatus(session: Session) {
  if (!session) return "not_found"
  if (session.busy) return "busy"
  if (session.error) return "error"
  return "ready"
}

async function process(id: string) {
  const session = await Session.get(id)
  if (!session) return { error: "Not found" }

  const result = await execute(session)
  if (!result.success) return { error: result.message }

  return { data: result.data }
}

// ❌ BAD - Else statements
function getStatus(session: Session) {
  if (!session) {
    return "not_found"
  } else {
    if (session.busy) {
      return "busy"
    } else {
      if (session.error) {
        return "error"
      } else {
        return "ready"
      }
    }
  }
}
```

**File Reference:** `AGENTS.md:70-86`

### 5.2 Guard Clauses

```typescript
// ✅ GOOD - Guard clauses at function start
async function updateSession(id: string, data: UpdateData) {
  if (!id) throw new Error("ID required")
  if (!data) throw new Error("Data required")
  if (data.title && data.title.length > 100) throw new Error("Title too long")

  // Main logic here
  const session = await Session.get(id)
  await Session.update(id, data)
  return session
}
```

### 5.3 Switch Statements

**Rule: Use exhaustive switch with default case**

```typescript
// ✅ GOOD - Exhaustive switch for stream handling
for await (const value of stream.fullStream) {
  switch (value.type) {
    case "reasoning-start":
      reasoningMap[value.id] = { id: generateId(), type: "reasoning", text: "" }
      break

    case "reasoning-delta":
      if (value.id in reasoningMap) {
        reasoningMap[value.id].text += value.text
        await Session.updatePart({ delta: value.text })
      }
      break

    case "tool-call":
      await Session.updatePart({ state: { status: "running" } })
      break

    case "tool-result":
      await Session.updatePart({ state: { status: "completed" } })
      break

    default:
      const _exhaustive: never = value
      throw new Error(`Unhandled type: ${(value as any).type}`)
  }
}
```

**File Reference:** `packages/opencode/src/session/processor.ts:53-346`

---

## 6. Async & Concurrency Standards

### 6.1 Parallel Execution (Default Pattern)

**Rule: Use `Promise.all` for independent operations**

```typescript
// ✅ GOOD - Parallel independent operations
const [language, cfg, provider, auth] = await Promise.all([
  Provider.getLanguage(input.model),
  Config.get(),
  Provider.getProvider(input.model.providerID),
  Auth.get(input.model.providerID),
])

// ✅ GOOD - Parallel array processing
const results = await Promise.all(
  items.map(async (item) => {
    return processItem(item)
  }),
)

// ❌ BAD - Sequential when independent
const language = await Provider.getLanguage(input.model)
const cfg = await Config.get() // Could run in parallel!
const provider = await Provider.getProvider(input.model.providerID)
const auth = await Auth.get(input.model.providerID)
```

**File Reference:** `packages/opencode/src/session/llm.ts:59`

### 6.2 Sequential Operations

**Rule: Chain when operations depend on previous results**

```typescript
// ✅ GOOD - Sequential dependency chain
const session = await Session.create({ title: "New" })
const message = await Session.addMessage(session.id, { content: "Hello" })
const response = await LLM.stream({ sessionID: session.id, messageID: message.id })

// ✅ GOOD - Promise chain for clarity
const result = await Session.create({ title: "New" })
  .then((session) => Session.addMessage(session.id, { content: "Hello" }))
  .then((message) => LLM.stream({ messageID: message.id }))
```

### 6.3 Error Handling in Async

**Rule: Prefer `.catch()` over try/catch when possible**

```typescript
// ✅ GOOD - Catch at call site
const result = await operation().catch((error) => {
  log.error("Operation failed", { error })
  return defaultValue
})

// ✅ GOOD - Promise.all with error handling
const results = await Promise.all(
  items.map(async (item) => {
    return processItem(item).catch((error) => {
      log.error("Item failed", { item, error })
      return null
    })
  }),
)

// ✅ ACCEPTABLE - try/catch for multiple operations
try {
  const session = await Session.create(input)
  await Session.addMessage(session.id, message)
  await EventBus.publish(Session.Event.Created, { session })
  return session
} catch (error) {
  log.error("Session creation failed", { error })
  throw error
}

// ❌ AVOID - try/catch for single operation
try {
  const result = await operation()
  return result
} catch (error) {
  log.error(error)
  throw error
}
// Better:
const result = await operation().catch((error) => {
  log.error(error)
  throw error
})
```

### 6.4 Concurrent Worker Pattern

```typescript
// ✅ GOOD - Controlled concurrency
export async function work<T>(concurrency: number, items: T[], fn: (item: T) => Promise<void>) {
  const pending = [...items]

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const item = pending.pop()
        if (item === undefined) return
        await fn(item)
      }
    }),
  )
}

// Usage
await work(3, files, async (file) => {
  await processFile(file)
})
```

**File Reference:** `packages/opencode/src/util/queue.ts:21-32`

---

## 7. Race Condition Prevention

### 7.1 Reader-Writer Lock (Storage Operations)

```typescript
// packages/opencode/src/util/lock.ts
export namespace Lock {
  const locks = new Map<
    string,
    {
      readers: number
      writer: boolean
      waitingReaders: (() => void)[]
      waitingWriters: (() => void)[]
    }
  >()

  export async function read(key: string): Promise<Disposable> {
    const lock = get(key)
    return new Promise((resolve) => {
      // Writers get priority
      if (!lock.writer && lock.waitingWriters.length === 0) {
        lock.readers++
        resolve({
          [Symbol.dispose]: () => {
            lock.readers--
            process(key)
          },
        })
      } else {
        lock.waitingReaders.push(() => {
          lock.readers++
          resolve({
            [Symbol.dispose]: () => {
              lock.readers--
              process(key)
            },
          })
        })
      }
    })
  }

  export async function write(key: string): Promise<Disposable> {
    const lock = get(key)
    return new Promise((resolve) => {
      if (!lock.writer && lock.readers === 0) {
        lock.writer = true
        resolve({
          [Symbol.dispose]: () => {
            lock.writer = false
            process(key)
          },
        })
      } else {
        lock.waitingWriters.push(() => {
          lock.writer = true
          resolve({
            [Symbol.dispose]: () => {
              lock.writer = false
              process(key)
            },
          })
        })
      }
    })
  }
}

// Usage with disposable pattern
export async function read<T>(target: string): Promise<T> {
  using _ = await Lock.read(target) // Auto-releases on scope exit
  const file = Bun.file(target)
  if (!(await file.exists())) {
    throw NotFoundError.create({ message: `File not found: ${target}` })
  }
  return file.json()
}

export async function write(target: string, data: any): Promise<void> {
  using _ = await Lock.write(target) // Auto-releases on scope exit
  const dir = path.dirname(target)
  await fs.mkdir(dir, { recursive: true })
  await Bun.write(target, JSON.stringify(data, null, 2))
}
```

**File References:**

- `packages/opencode/src/util/lock.ts` - Lines 1-99
- `packages/opencode/src/storage/storage.ts` - Lines 173, 183, 195

### 7.2 File-Level Lock (Edit Operations)

```typescript
// packages/opencode/src/file/time.ts
export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T> {
  const current = state()
  const currentLock = current.locks.get(filepath) ?? Promise.resolve()

  let release: () => void = () => {}
  const nextLock = new Promise<void>((resolve) => {
    release = resolve
  })

  const chained = currentLock.then(() => nextLock)
  current.locks.set(filepath, chained)

  await currentLock // Wait for previous lock

  try {
    return await fn()
  } finally {
    release()
    if (current.locks.get(filepath) === chained) {
      current.locks.delete(filepath)
    }
  }
}

// Usage: Atomic read-modify-write
await FileTime.withLock(filePath, async () => {
  const contentOld = await Bun.file(filePath).text()
  const contentNew = replace(contentOld, params.oldString, params.newString)
  await Bun.write(filePath, contentNew)
  await FileTime.touch(filePath)
})
```

**File References:**

- `packages/opencode/src/file/time.ts` - Lines 35-53
- `packages/opencode/src/tool/edit.ts` - Line 50

### 7.3 Mutex Pattern

```typescript
// ✅ GOOD - Simple mutex for critical sections
const mutexes = new Map<string, Promise<void>>()

async function withMutex<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const current = mutexes.get(key) ?? Promise.resolve()

  let release: () => void
  const next = new Promise<void>((resolve) => {
    release = resolve
  })
  mutexes.set(key, next)

  await current

  try {
    return await fn()
  } finally {
    release!()
    if (mutexes.get(key) === next) {
      mutexes.delete(key)
    }
  }
}

// Usage
await withMutex(`session:${sessionID}`, async () => {
  // Critical section - only one execution at a time
  const session = await Session.get(sessionID)
  session.busy = true
  await Session.save(session)
})
```

### 7.4 Debouncing & Throttling

```typescript
// ✅ GOOD - Debounce for file watching
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: Timer | undefined

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = undefined
    }, delay)
  }
}

// Usage in file watcher
const debouncedUpdate = debounce((file: string) => {
  Bus.publish(FileWatcher.Event.Updated, { file })
}, 100)

watcher.on("change", (file) => {
  debouncedUpdate(file)
})
```

---

## 8. AI System Integration Standards

### 8.1 Message Context Management

```typescript
// packages/opencode/src/session/message-v2.ts

export type Part = TextPart | FilePart | PatchPart | ToolCallPart | ToolResultPart | ReasoningPart

export interface WithParts {
  info: Info
  parts: Part[]
}

// Convert internal message format to LLM format
export function toModelMessages(input: WithParts[], model: Provider.Model): ModelMessage[] {
  return input.flatMap((msg): ModelMessage[] => {
    if (msg.info.role === "user") {
      return [
        {
          role: "user",
          content: msg.parts.map((part) => {
            if (part.type === "text") {
              return { type: "text", text: part.text }
            }
            if (part.type === "file") {
              return {
                type: "file",
                data: part.data,
                mimeType: part.mimeType,
              }
            }
            if (part.type === "patch") {
              return {
                type: "text",
                text: formatPatch(part),
              }
            }
            // ... handle other types
          }),
        },
      ]
    }

    if (msg.info.role === "assistant") {
      return [
        {
          role: "assistant",
          content: msg.parts
            .filter((p) => p.type === "text" || p.type === "reasoning")
            .map((p) => ({ type: "text", text: p.text })),
        },
      ]
    }

    // Handle tool results...
    return []
  })
}
```

**File Reference:** `packages/opencode/src/session/message-v2.ts:438-500`

### 8.2 System Prompt Construction

```typescript
// packages/opencode/src/session/llm.ts

export async function stream(input: StreamInput) {
  const system: string[] = []

  // Part 1: Base system prompt (cached)
  const header = [
    // Agent prompt OR provider prompt
    ...(input.agent.prompt ? [input.agent.prompt] : isCodex ? [] : SystemPrompt.provider(input.model)),
    // Custom prompt from request
    ...input.system,
    // Custom prompt from user config
    ...(input.user.system ? [input.user.system] : []),
  ]
    .filter(Boolean)
    .join("\n")

  system.push(header)

  // Part 2: Dynamic context (not cached)
  const dynamicContext = [
    `Working directory: ${Instance.directory}`,
    `Current date: ${new Date().toISOString()}`,
    // ... other dynamic info
  ].join("\n")

  system.push(dynamicContext)

  // Allow plugins to transform system prompt
  const original = clone(system)
  await Plugin.trigger(
    "experimental.chat.system.transform",
    {
      model: input.model,
      agent: input.agent,
    },
    { system },
  )

  // Optimize for prompt caching: maintain 2-part structure if header unchanged
  if (system.length > 2 && system[0] === header) {
    const rest = system.slice(1)
    system.length = 0
    system.push(header, rest.join("\n"))
  }

  // Convert to LLM messages
  const messages = [
    ...system.map((text) => ({ role: "system", content: text })),
    ...toModelMessages(input.messages, input.model),
  ]

  return language.doStream({
    model: input.model.id,
    messages,
    tools: await resolveTools(input),
  })
}
```

**File Reference:** `packages/opencode/src/session/llm.ts:67-97`

### 8.3 Tool Definition & Execution

```typescript
// packages/opencode/src/tool/tool.ts

export namespace Tool {
  export interface Info<Parameters = any, Metadata = any> {
    id: string
    title: string
    description: string
    parameters: z.ZodType<Parameters>
    metadata?: Metadata

    execute(args: Parameters, context: Context): Promise<ExecuteResult>
  }

  export interface Context {
    sessionID: string
    messageID: string
    agent: string
    abort: AbortSignal
    messages: () => Promise<MessageV2.WithParts[]>
    metadata: <T>(key: string, value: T) => Promise<void>
    ask: <T>(question: Question<T>) => Promise<T>
  }

  export type ExecuteResult = {
    output?: string
    title?: string
    metadata?: Record<string, unknown>
  }

  export function define<Parameters, Result>(
    id: string,
    init: {
      title: string
      description: string
      parameters: z.ZodType<Parameters>
      execute: (args: Parameters, context: Context) => Promise<ExecuteResult>
    },
  ): Info<Parameters> {
    return {
      id,
      ...init,
    }
  }
}

// Usage: Define a tool
export const ReadTool = Tool.define("read", {
  title: "Read File",
  description: "Read contents of a file from the filesystem",
  parameters: z.object({
    filePath: z.string().describe("Absolute path to file"),
    offset: z.number().optional().describe("Line number to start reading"),
    limit: z.number().optional().describe("Number of lines to read"),
  }),

  async execute(args, context) {
    await context.ask({
      type: "permission",
      message: `Read file ${args.filePath}?`,
      actions: ["allow", "deny"],
    })

    const content = await Bun.file(args.filePath).text()
    const lines = content.split("\n")

    const start = args.offset ?? 0
    const end = args.limit ? start + args.limit : lines.length
    const selected = lines.slice(start, end)

    return {
      output: selected.join("\n"),
      title: `Read ${path.basename(args.filePath)}`,
      metadata: {
        lineCount: selected.length,
        filePath: args.filePath,
      },
    }
  },
})

// Register tool
await ToolRegistry.register(ReadTool)

// Tool execution in session
const tools = await ToolRegistry.tools({ agent: input.agent })

const toolMap = tools.reduce(
  (acc, tool) => {
    acc[tool.id] = vercelAiTool({
      description: tool.description,
      parameters: zodToJsonSchema(tool.parameters),
      execute: async (args) => {
        const result = await tool.execute(args, {
          sessionID: input.sessionID,
          messageID: input.messageID,
          agent: input.agent.name,
          abort: input.abort,
          messages: () => Session.messages({ sessionID: input.sessionID }),
          metadata: async (key, value) => {
            await Session.updatePart({
              messageID: input.messageID,
              metadata: { [key]: value },
            })
          },
          ask: async (question) => {
            return new Promise((resolve) => {
              Bus.publish(Session.Event.Question, {
                sessionID: input.sessionID,
                question,
                respond: resolve,
              })
            })
          },
        })

        return result.output
      },
    })
    return acc
  },
  {} as Record<string, any>,
)
```

**File References:**

- `packages/opencode/src/tool/tool.ts` - Lines 1-90
- `packages/opencode/src/session/prompt.ts` - Lines 711-748

### 8.4 Streaming Handling

```typescript
// packages/opencode/src/session/processor.ts

export function create(input: CreateInput) {
  const reasoningMap: Record<string, ReasoningPart> = {}
  const toolcalls: Record<string, ToolCallPart> = {}

  return {
    async process() {
      const stream = await LLM.stream({
        sessionID: input.sessionID,
        messageID: input.messageID,
        model: input.model,
        messages: input.messages,
        tools: input.tools,
        abort: input.abort,
      })

      // Handle stream events
      for await (const value of stream.fullStream) {
        input.abort.throwIfAborted()

        switch (value.type) {
          case "reasoning-start":
            reasoningMap[value.id] = {
              id: Identifier.ascending("part"),
              type: "reasoning",
              text: "",
              time: { start: Date.now() },
            }
            await Session.addPart({
              messageID: input.messageID,
              part: reasoningMap[value.id],
            })
            break

          case "reasoning-delta":
            if (value.id in reasoningMap) {
              const part = reasoningMap[value.id]
              part.text += value.text
              await Session.updatePart({
                messageID: input.messageID,
                partID: part.id,
                delta: value.text,
              })
            }
            break

          case "reasoning-finish":
            if (value.id in reasoningMap) {
              const part = reasoningMap[value.id]
              part.time.end = Date.now()
              await Session.updatePart({
                messageID: input.messageID,
                partID: part.id,
                part,
              })
            }
            break

          case "text-delta":
            // Handle text streaming...
            break

          case "tool-call":
            const toolPart: ToolCallPart = {
              id: Identifier.ascending("part"),
              type: "tool-call",
              toolCallID: value.toolCallId,
              toolName: value.toolName,
              state: {
                status: "running",
                input: value.args,
                time: { start: Date.now() },
              },
            }
            toolcalls[value.toolCallId] = toolPart
            await Session.addPart({
              messageID: input.messageID,
              part: toolPart,
            })
            break

          case "tool-result":
            const match = toolcalls[value.toolCallId]
            if (match) {
              match.state = {
                status: "completed",
                output: value.result,
                time: {
                  start: match.state.time.start,
                  end: Date.now(),
                },
              }
              await Session.updatePart({
                messageID: input.messageID,
                partID: match.id,
                part: match,
              })
            }
            break

          case "error":
            await Session.updateMessage({
              messageID: input.messageID,
              error: {
                message: value.error.message,
                code: value.error.code,
              },
            })
            throw value.error

          case "finish":
            await Session.updateMessage({
              messageID: input.messageID,
              tokens: value.usage,
              time: { end: Date.now() },
            })
            break

          default:
            // Exhaustiveness check
            const _exhaustive: never = value
            throw new Error(`Unhandled stream type: ${(value as any).type}`)
        }
      }
    },
  }
}
```

**File Reference:** `packages/opencode/src/session/processor.ts:53-346`

### 8.5 Context Compaction

```typescript
// packages/opencode/src/session/compaction.ts

export async function isOverflow(input: {
  tokens: MessageV2.Assistant["tokens"]
  model: Provider.Model
}): Promise<boolean> {
  const limit = input.model.limit.context

  const total = input.tokens.input + input.tokens.output + input.tokens.cache.read + input.tokens.cache.write

  const threshold = limit * 0.75 // Trigger at 75% capacity

  return total > threshold
}

export async function compact(sessionID: string) {
  const messages = await Session.messages({ sessionID })
  const model = await Session.getModel(sessionID)

  // Find oldest non-system messages
  const candidates = messages.filter((m) => m.info.role !== "system")

  if (candidates.length <= 2) {
    // Keep at least 2 messages for context
    return
  }

  // Remove oldest message
  const toRemove = candidates[0]
  await Session.deleteMessage(toRemove.info.id)

  // Add summary if necessary
  const summary = await generateSummary(toRemove)
  await Session.addSystemMessage(sessionID, {
    content: `Previous context (summarized): ${summary}`,
  })

  log.info("compacted session", {
    sessionID,
    removedMessageID: toRemove.info.id,
    remainingMessages: messages.length - 1,
  })
}

// Check after each assistant response
await Session.onMessageComplete(async (messageID) => {
  const message = await Session.getMessage(messageID)
  const model = await Session.getModel(message.sessionID)

  if (await isOverflow({ tokens: message.tokens, model })) {
    await compact(message.sessionID)
  }
})
```

**File References:**

- `packages/opencode/src/session/compaction.ts` - Lines 30-48
- `packages/opencode/src/session/processor.ts` - Lines 282-284

---

## 9. Service Architecture Standards

### 9.1 Core Services Overview

| Service                 | Location                   | Pattern                | Responsibility              |
| ----------------------- | -------------------------- | ---------------------- | --------------------------- |
| **Session Management**  | `src/session/`             | Namespace + State      | AI conversation lifecycle   |
| **File Watching**       | `src/file/watcher.ts`      | Chokidar + Debounce    | Filesystem change detection |
| **LSP Integration**     | `src/lsp/`                 | Multi-client manager   | Language server protocol    |
| **MCP**                 | `src/mcp/`                 | Multi-transport client | Model Context Protocol      |
| **Terminal/PTY**        | `src/server/routes/pty.ts` | WebSocket-based        | Shell session management    |
| **Event Bus**           | `src/bus/`                 | Pub/sub pattern        | Cross-service communication |
| **Storage**             | `src/storage/`             | Lock-based persistence | JSON file storage           |
| **Provider Management** | `src/provider/`            | Lazy-loaded SDKs       | LLM provider abstraction    |
| **Config Management**   | `src/config/`              | Layered merge          | Multi-level configuration   |
| **Scheduler**           | `src/scheduler/`           | Interval-based         | Background job execution    |

### 9.2 Service Implementation Template

```typescript
// Service template following codebase patterns

import { Log } from "../util/log"
import { Instance } from "../project/instance"
import { BusEvent } from "../bus/event"
import z from "zod"

export namespace MyService {
  const log = Log.create({ service: "my-service" })

  // 1. Type definitions
  export type Info = z.infer<typeof Info>
  export const Info = z.object({
    id: z.string(),
    status: z.enum(["idle", "active", "error"]),
    created: z.number(),
  })

  // 2. Per-instance state
  const state = Instance.state(
    async () => {
      log.info("initializing service")

      return {
        items: new Map<string, Info>(),
        timers: new Map<string, Timer>(),
        clients: [] as Client[],
      }
    },
    async (state) => {
      log.info("disposing service")

      // Cleanup resources
      await Promise.all([
        ...state.clients.map((c) => c.close()),
        ...Array.from(state.timers.values()).map((t) => clearInterval(t)),
      ])

      state.items.clear()
    },
  )

  // 3. Event definitions
  export const Event = {
    Created: BusEvent.define(
      "my-service.created",
      z.object({
        info: Info,
      }),
    ),
    Updated: BusEvent.define(
      "my-service.updated",
      z.object({
        info: Info,
      }),
    ),
    Deleted: BusEvent.define(
      "my-service.deleted",
      z.object({
        id: z.string(),
      }),
    ),
  }

  // 4. Public API with fn() wrapper
  export const create = fn(
    z
      .object({
        id: z.string().optional(),
        data: z.record(z.unknown()).optional(),
      })
      .optional(),
    async (input) => {
      const id = input?.id ?? Identifier.ascending("my-service")

      const info: Info = {
        id,
        status: "idle",
        created: Date.now(),
      }

      state().items.set(id, info)
      await Bus.publish(Event.Created, { info })

      log.info("created", { id })
      return info
    },
  )

  export const get = fn(z.string(), async (id) => {
    const item = state().items.get(id)
    if (!item) {
      throw NotFoundError.create({ message: `Item ${id} not found` })
    }
    return item
  })

  export const list = fn(
    z
      .object({
        status: z.enum(["idle", "active", "error"]).optional(),
      })
      .optional(),
    async (input) => {
      const items = Array.from(state().items.values())

      if (input?.status) {
        return items.filter((item) => item.status === input.status)
      }

      return items
    },
  )

  // 5. Internal functions (not exported)
  async function cleanup(id: string) {
    const timer = state().timers.get(id)
    if (timer) {
      clearInterval(timer)
      state().timers.delete(id)
    }
  }
}
```

**File References:**

- `packages/opencode/src/session/index.ts` - Complete example
- `packages/opencode/src/mcp/index.ts` - Multi-client manager
- `packages/opencode/src/lsp/index.ts` - Lazy spawning

---

## 10. State Management Standards

### 10.1 Per-Instance State Isolation

**Rule: All state must be isolated per working directory**

```typescript
// packages/opencode/src/project/instance.ts

export namespace Instance {
  // Current working directory
  export let directory = process.cwd()

  // Git worktree root
  export let worktree = directory

  // Project ID
  export let id = "unknown"

  // Create state scoped to current instance
  export function state<S>(
    init: () => S | Promise<S>,
    dispose?: (state: Awaited<S>) => Promise<void>,
  ): () => Awaited<S> {
    return State.create(
      () => Instance.directory, // Key by directory
      init,
      dispose,
    )
  }
}

// packages/opencode/src/project/state.ts

const recordsByKey = new Map<string, Map<Function, Entry>>()

interface Entry {
  state: any
  dispose?: (state: any) => Promise<void>
}

export function create<S>(
  root: () => string,
  init: () => S | Promise<S>,
  dispose?: (state: Awaited<S>) => Promise<void>,
): () => Awaited<S> {
  return () => {
    const key = root()

    // Get or create entries for this key
    let entries = recordsByKey.get(key)
    if (!entries) {
      entries = new Map<Function, Entry>()
      recordsByKey.set(key, entries)
    }

    // Get or initialize state
    const exists = entries.get(init)
    if (exists) {
      return exists.state as Awaited<S>
    }

    const state = init()
    entries.set(init, { state, dispose })

    return state as Awaited<S>
  }
}

// Dispose all state for a key
export async function dispose(key: string) {
  const entries = recordsByKey.get(key)
  if (!entries) return

  await Promise.all(
    Array.from(entries.values()).map(async (entry) => {
      if (entry.dispose) {
        const state = await entry.state
        await entry.dispose(state)
      }
    }),
  )

  recordsByKey.delete(key)
}
```

**File References:**

- `packages/opencode/src/project/instance.ts` - Lines 66-68
- `packages/opencode/src/project/state.ts` - Lines 12-29

### 10.2 State Initialization Pattern

```typescript
// ✅ GOOD - Lazy initialization with disposal
const state = Instance.state(
  async () => {
    log.info("initializing LSP clients")

    const cfg = await Config.get()
    const servers: Record<string, LSPServer.Info> = {}
    const clients: LSPClient.Info[] = []

    // Initialize servers
    for (const [id, server] of Object.entries(LSPServer)) {
      if (cfg.lsp?.[id]?.enabled !== false) {
        servers[id] = server
      }
    }

    return {
      servers,
      clients,
      broken: new Set<string>(),
      spawning: new Map<string, Promise<LSPClient.Info | undefined>>(),
    }
  },
  async (state) => {
    log.info("disposing LSP clients")

    // Cleanup all clients
    await Promise.all(
      state.clients.map(async (client) => {
        try {
          await client.shutdown()
        } catch (error) {
          log.error("failed to shutdown client", { client: client.id, error })
        }
      }),
    )
  },
)

// Access state
const lspState = state()
lspState.clients.push(newClient)
```

### 10.3 Global State (Rare)

**Rule: Avoid global state, use per-instance state instead**

```typescript
// ❌ AVOID - Global mutable state
const sessions = new Map<string, Session>()

export function addSession(session: Session) {
  sessions.set(session.id, session)
}

// ✅ PREFER - Per-instance state
const state = Instance.state(async () => ({
  sessions: new Map<string, Session>(),
}))

export function addSession(session: Session) {
  state().sessions.set(session.id, session)
}

// ✅ ACCEPTABLE - Truly global state (user config, auth tokens)
export namespace Global {
  export namespace Path {
    export const home = os.homedir()
    export const config = path.join(home, ".config", "opencode")
    export const data = path.join(home, ".local", "share", "opencode")
    export const cache = path.join(home, ".cache", "opencode")
  }
}
```

---

## 11. Event Bus Standards

### 11.1 Event Definition

```typescript
// packages/opencode/src/bus/event.ts

export namespace BusEvent {
  export interface Definition<Properties extends z.ZodType = any> {
    type: string
    properties: Properties
  }

  export function define<Properties extends z.ZodType>(type: string, properties: Properties): Definition<Properties> {
    return { type, properties }
  }
}

// Usage: Define events for a service
export namespace Session {
  export const Event = {
    Created: BusEvent.define("session.created", z.object({ info: Info })),

    Updated: BusEvent.define("session.updated", z.object({ info: Info, changes: z.record(z.unknown()) })),

    Deleted: BusEvent.define("session.deleted", z.object({ id: z.string() })),

    Diff: BusEvent.define(
      "session.diff",
      z.object({
        sessionID: z.string(),
        messageID: z.string(),
        diff: z.object({
          file: z.string(),
          additions: z.number(),
          deletions: z.number(),
        }),
      }),
    ),

    Error: BusEvent.define(
      "session.error",
      z.object({
        sessionID: z.string(),
        error: z.object({
          message: z.string(),
          code: z.string().optional(),
        }),
      }),
    ),

    Question: BusEvent.define(
      "session.question",
      z.object({
        sessionID: z.string(),
        question: z.object({
          type: z.string(),
          message: z.string(),
          options: z.array(z.unknown()),
        }),
        respond: z.function(),
      }),
    ),
  }
}
```

### 11.2 Publishing Events

```typescript
// packages/opencode/src/bus/index.ts

export namespace Bus {
  const state = Instance.state(async () => ({
    subscriptions: new Map<string, Set<Handler>>(),
  }))

  type Handler = (payload: EventPayload) => void | Promise<void>

  interface EventPayload {
    type: string
    properties: any
  }

  export async function publish<Definition extends BusEvent.Definition>(
    def: Definition,
    properties: z.output<Definition["properties"]>,
  ): Promise<void> {
    const payload: EventPayload = {
      type: def.type,
      properties,
    }

    const pending: Promise<void>[] = []

    // Notify specific subscribers
    const specific = state().subscriptions.get(def.type)
    if (specific) {
      for (const handler of specific) {
        pending.push(Promise.resolve(handler(payload)))
      }
    }

    // Notify wildcard subscribers
    const wildcard = state().subscriptions.get("*")
    if (wildcard) {
      for (const handler of wildcard) {
        pending.push(Promise.resolve(handler(payload)))
      }
    }

    // Also publish to global bus (for cross-instance communication)
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload,
    })

    await Promise.all(pending)
  }
}

// Usage: Publish an event
await Bus.publish(Session.Event.Created, {
  info: {
    id: "session-123",
    title: "New Session",
    created: Date.now(),
  },
})

await Bus.publish(Session.Event.Updated, {
  info: updatedSession,
  changes: { title: "Updated Title" },
})
```

**File Reference:** `packages/opencode/src/bus/index.ts:41-64`

### 11.3 Subscribing to Events

```typescript
// packages/opencode/src/bus/index.ts

export namespace Bus {
  export function subscribe<Definition extends BusEvent.Definition>(
    def: Definition | "*",
    handler: (payload: { type: string; properties: z.output<Definition["properties"]> }) => void | Promise<void>,
  ): Disposable {
    const key = typeof def === "string" ? def : def.type

    let subs = state().subscriptions.get(key)
    if (!subs) {
      subs = new Set()
      state().subscriptions.set(key, subs)
    }

    subs.add(handler)

    return {
      [Symbol.dispose]: () => {
        subs?.delete(handler)
        if (subs?.size === 0) {
          state().subscriptions.delete(key)
        }
      },
    }
  }
}

// Usage: Subscribe to specific events
const subscription = Bus.subscribe(Session.Event.Created, async (event) => {
  log.info("session created", { id: event.properties.info.id })
  await notifyUser(`New session: ${event.properties.info.title}`)
})

// Unsubscribe
subscription[Symbol.dispose]()

// Or use disposable pattern
{
  using sub = Bus.subscribe(Session.Event.Updated, handleUpdate)

  // Automatically unsubscribes when scope exits
}

// Subscribe to all events
Bus.subscribe("*", (event) => {
  log.debug("event", { type: event.type, properties: event.properties })
})
```

### 11.4 Event-Driven Communication Pattern

```typescript
// Service A: Publish events
export namespace FileWatcher {
  export const Event = {
    Updated: BusEvent.define(
      "file.updated",
      z.object({
        file: z.string(),
        event: z.enum(["add", "change", "unlink"]),
      }),
    ),
  }

  async function watch(directory: string) {
    const watcher = chokidar.watch(directory)

    watcher.on("change", async (file) => {
      await Bus.publish(Event.Updated, {
        file,
        event: "change",
      })
    })
  }
}

// Service B: React to events
export namespace LSP {
  export async function initialize() {
    // Subscribe to file changes
    Bus.subscribe(FileWatcher.Event.Updated, async (event) => {
      if (event.properties.event === "change") {
        await notifyClientsOfChange(event.properties.file)
      }
    })
  }

  async function notifyClientsOfChange(file: string) {
    const clients = state().clients.filter((c) => c.watchesFile(file))
    await Promise.all(clients.map((c) => c.didChangeTextDocument({ uri: file })))
  }
}

// Service C: Also react to same events
export namespace Session {
  export async function initialize() {
    Bus.subscribe(FileWatcher.Event.Updated, async (event) => {
      // Invalidate cached file contents
      await invalidateFileCache(event.properties.file)
    })
  }
}
```

---

## 12. Configuration Management Standards

### 12.1 Configuration Precedence

**Order (Low → High priority):**

1. **Remote `.well-known/opencode`** - Organization defaults
2. **Global config** - `~/.config/opencode/opencode.json{,c}`
3. **Custom config** - `OPENCODE_CONFIG` env var path
4. **Project config** - `opencode.json{,c}` in project
5. **`.opencode` directories** - `.opencode/opencode.json{,c}`
6. **Inline config** - `OPENCODE_CONFIG_CONTENT` env var
7. **Managed config** - Enterprise `/etc/opencode` (highest priority)

```typescript
// packages/opencode/src/config/config.ts

export namespace Config {
  export const state = Instance.state(async () => {
    let result: Info = {}

    // 1. Remote organization config
    const auth = await Auth.all()
    for (const [key, value] of Object.entries(auth)) {
      if (value.type === "wellknown") {
        const response = await fetch(`${key}/.well-known/opencode`)
        const wellknown = await response.json()
        result = mergeConfigConcatArrays(result, wellknown.config ?? {})
      }
    }

    // 2. Global user config
    result = mergeConfigConcatArrays(result, await global())

    // 3. Custom config path
    if (Flag.OPENCODE_CONFIG) {
      result = mergeConfigConcatArrays(result, await loadFile(Flag.OPENCODE_CONFIG))
    }

    // 4. Project config (if not disabled)
    if (!Flag.OPENCODE_DISABLE_PROJECT_CONFIG) {
      for (const file of ["opencode.jsonc", "opencode.json"]) {
        const found = await Filesystem.findUp(file, Instance.directory, Instance.worktree)
        for (const resolved of found.toReversed()) {
          result = mergeConfigConcatArrays(result, await loadFile(resolved))
        }
      }
    }

    // 5. .opencode directories
    const directories = [
      Global.Path.config,
      ...(!Flag.OPENCODE_DISABLE_PROJECT_CONFIG
        ? await Array.fromAsync(
            Filesystem.up({
              targets: [".opencode"],
              start: Instance.directory,
              stop: Instance.worktree,
            }),
          )
        : []),
      // Always scan user home ~/.opencode/
      ...(await Array.fromAsync(
        Filesystem.up({
          targets: [".opencode"],
          start: Global.Path.home,
          stop: Global.Path.home,
        }),
      )),
    ]

    for (const dir of unique(directories)) {
      for (const file of ["opencode.jsonc", "opencode.json"]) {
        const configPath = path.join(dir, file)
        if (await Filesystem.exists(configPath)) {
          result = mergeConfigConcatArrays(result, await loadFile(configPath))
        }
      }
    }

    // 6. Inline config
    if (Flag.OPENCODE_CONFIG_CONTENT) {
      result = mergeConfigConcatArrays(result, await load(Flag.OPENCODE_CONFIG_CONTENT, "inline"))
    }

    // 7. Managed config (enterprise, highest priority)
    const managedPath = path.join(managedConfigDir, "opencode.json")
    if (await Filesystem.exists(managedPath)) {
      result = mergeConfigConcatArrays(result, await loadFile(managedPath))
    }

    return result
  })

  export const get = fn(z.void(), async () => state())
}
```

**File Reference:** `packages/opencode/src/config/config.ts:62-150`

### 12.2 Configuration Merge Strategy

```typescript
// packages/opencode/src/config/config.ts

function mergeConfigConcatArrays(target: Info, source: Info): Info {
  // Deep merge objects
  const merged = mergeDeep(target, source)

  // Special handling: Concatenate arrays instead of replacing
  if (target.plugin && source.plugin) {
    merged.plugin = Array.from(new Set([...target.plugin, ...source.plugin]))
  }

  if (target.instructions && source.instructions) {
    merged.instructions = Array.from(new Set([...target.instructions, ...source.instructions]))
  }

  return merged
}

// Example:
// Base config:    { plugin: ["a", "b"], model: { id: "gpt-4" } }
// Override config: { plugin: ["b", "c"], model: { temperature: 0.7 } }
// Result:         { plugin: ["a", "b", "c"], model: { id: "gpt-4", temperature: 0.7 } }
```

**File Reference:** `packages/opencode/src/config/config.ts:51-60`

### 12.3 Configuration Schema

```typescript
export namespace Config {
  export type Info = z.infer<typeof Info>
  export const Info = z.object({
    // Model configuration
    model: z
      .object({
        id: z.string().optional(),
        providerID: z.string().optional(),
        temperature: z.number().optional(),
        maxTokens: z.number().optional(),
      })
      .optional(),

    // Providers
    providers: z
      .record(
        z.object({
          apiKey: z.string().optional(),
          baseURL: z.string().optional(),
          enabled: z.boolean().optional(),
        }),
      )
      .optional(),

    // Plugins
    plugin: z.array(z.string()).optional(),

    // Instructions (system prompts)
    instructions: z.array(z.string()).optional(),

    // Agents
    agent: z
      .record(
        z.object({
          mode: z.enum(["primary", "secondary"]).optional(),
          prompt: z.string().optional(),
          permission: z.string().optional(),
        }),
      )
      .optional(),

    // LSP servers
    lsp: z
      .record(
        z.object({
          enabled: z.boolean().optional(),
          command: z.string().optional(),
          args: z.array(z.string()).optional(),
        }),
      )
      .optional(),

    // MCP servers
    mcp: z
      .record(
        z.union([
          z.object({
            command: z.string(),
            args: z.array(z.string()).optional(),
            env: z.record(z.string()).optional(),
            enabled: z.boolean().optional(),
          }),
          z.object({
            url: z.string(),
            transport: z.literal("sse"),
            enabled: z.boolean().optional(),
          }),
        ]),
      )
      .optional(),

    // Formatters
    formatter: z
      .record(
        z.object({
          command: z.string(),
          args: z.array(z.string()).optional(),
        }),
      )
      .optional(),
  })
}
```

### 12.4 Configuration File Loading

```typescript
export namespace Config {
  async function loadFile(filepath: string): Promise<Info> {
    if (!(await Filesystem.exists(filepath))) {
      return {}
    }

    const content = await Bun.file(filepath).text()
    return load(content, filepath)
  }

  async function load(content: string, source: string): Promise<Info> {
    try {
      // Parse JSONC (JSON with comments)
      const parsed = parseJsonc(content)

      // Validate against schema
      const validated = Info.parse(parsed)

      return validated
    } catch (error) {
      if (error instanceof z.ZodError) {
        log.error("config validation failed", {
          source,
          errors: error.errors,
        })
        throw new Error(`Invalid config at ${source}: ${error.errors[0].message}`)
      }

      throw error
    }
  }
}
```

---

## 13. Storage & Persistence Standards

### 13.1 Storage Operations

```typescript
// packages/opencode/src/storage/storage.ts

export namespace Storage {
  const log = Log.create({ service: "storage" })

  export const NotFoundError = NamedError.create("NotFoundError", z.object({ message: z.string() }))

  // Read with lock
  export async function read<T>(target: string): Promise<T> {
    using _ = await Lock.read(target)

    const file = Bun.file(target)
    if (!(await file.exists())) {
      throw NotFoundError.create({
        message: `File not found: ${target}`,
      })
    }

    return file.json()
  }

  // Write with lock
  export async function write(target: string, data: any): Promise<void> {
    using _ = await Lock.write(target)

    const dir = path.dirname(target)
    await fs.mkdir(dir, { recursive: true })

    await Bun.write(target, JSON.stringify(data, null, 2))
  }

  // Update (read-modify-write)
  export async function update<T>(target: string, editor: (draft: T) => void | Promise<void>): Promise<T> {
    using _ = await Lock.write(target)

    const data = await read<T>(target)
    await editor(data)
    await write(target, data)

    return data
  }

  // Delete
  export async function remove(target: string): Promise<void> {
    using _ = await Lock.write(target)

    if (await Filesystem.exists(target)) {
      await fs.rm(target, { recursive: true })
    }
  }

  // List files matching pattern
  export async function list(directory: string, pattern: string): Promise<string[]> {
    using _ = await Lock.read(directory)

    const files: string[] = []
    for await (const file of new Bun.Glob(pattern).scan({ cwd: directory })) {
      files.push(path.join(directory, file))
    }

    return files
  }
}
```

**File Reference:** `packages/opencode/src/storage/storage.ts:1-200`

### 13.2 Storage Paths

```typescript
export namespace Storage {
  export function path(...segments: string[]): string {
    return path.join(Global.Path.data, ...segments)
  }

  // Session storage
  export namespace Session {
    export function info(sessionID: string): string {
      return Storage.path("session", sessionID, "info.json")
    }

    export function messages(sessionID: string): string {
      return Storage.path("session", sessionID, "messages")
    }

    export function message(sessionID: string, messageID: string): string {
      return Storage.path("session", sessionID, "messages", `${messageID}.json`)
    }
  }

  // Project storage
  export namespace Project {
    export function info(projectID: string): string {
      return Storage.path("project", `${projectID}.json`)
    }

    export function list(): Promise<string[]> {
      return Storage.list(Storage.path("project"), "*.json")
    }
  }

  // Cache storage
  export namespace Cache {
    export function file(key: string): string {
      return Storage.path("cache", `${key}.json`)
    }
  }
}
```

### 13.3 Migration Pattern

```typescript
export namespace Storage {
  type Migration = (dir: string) => Promise<void>

  const MIGRATIONS: Migration[] = [
    // Migration 1: Rename old directories
    async (dir) => {
      const oldPath = path.join(dir, "old-structure")
      const newPath = path.join(dir, "new-structure")

      if (await Filesystem.exists(oldPath)) {
        await fs.rename(oldPath, newPath)
        log.info("migrated directory structure")
      }
    },

    // Migration 2: Transform data format
    async (dir) => {
      const files = await Storage.list(path.join(dir, "sessions"), "*.json")

      for (const file of files) {
        const data = await Storage.read<any>(file)

        // Add new field
        if (!data.version) {
          data.version = 2
          data.migrated = Date.now()
          await Storage.write(file, data)
        }
      }

      log.info("migrated session data", { count: files.length })
    },

    // Migration 3: Consolidate files
    async (dir) => {
      const oldDir = path.join(dir, "old")
      const newFile = path.join(dir, "consolidated.json")

      if (await Filesystem.exists(oldDir)) {
        const files = await Storage.list(oldDir, "*.json")
        const consolidated = await Promise.all(files.map((f) => Storage.read(f)))

        await Storage.write(newFile, consolidated)
        await fs.rm(oldDir, { recursive: true })

        log.info("consolidated files", { count: files.length })
      }
    },
  ]

  export async function migrate(): Promise<void> {
    const dataDir = Global.Path.data
    const versionFile = path.join(dataDir, ".version")

    let currentVersion = 0
    if (await Filesystem.exists(versionFile)) {
      currentVersion = Number(await Bun.file(versionFile).text())
    }

    const targetVersion = MIGRATIONS.length

    if (currentVersion >= targetVersion) {
      log.debug("storage up to date", { version: currentVersion })
      return
    }

    log.info("migrating storage", {
      from: currentVersion,
      to: targetVersion,
    })

    // Run pending migrations
    for (let i = currentVersion; i < targetVersion; i++) {
      log.info(`running migration ${i + 1}/${targetVersion}`)
      await MIGRATIONS[i](dataDir)
    }

    // Update version
    await Bun.write(versionFile, String(targetVersion))

    log.info("migration complete", { version: targetVersion })
  }
}
```

**File Reference:** `packages/opencode/src/storage/storage.ts:24-100`

---

## 14. Error Handling Standards

### 14.1 Named Errors (Preferred)

```typescript
// packages/opencode/src/util/error.ts

import { NamedError } from "@opencode-ai/util/error"
import z from "zod"

// Define typed errors
export const NotFoundError = NamedError.create(
  "NotFoundError",
  z.object({
    message: z.string(),
    resource: z.string().optional(),
    id: z.string().optional(),
  }),
)

export const ValidationError = NamedError.create(
  "ValidationError",
  z.object({
    message: z.string(),
    field: z.string().optional(),
    expected: z.string().optional(),
    received: z.string().optional(),
  }),
)

export const PermissionError = NamedError.create(
  "PermissionError",
  z.object({
    message: z.string(),
    action: z.string(),
    resource: z.string(),
  }),
)

// Usage: Throw typed error
throw NotFoundError.create({
  message: "Session not found",
  resource: "session",
  id: sessionID,
})

// Usage: Catch and check type
try {
  await operation()
} catch (error) {
  if (NotFoundError.is(error)) {
    log.warn("resource not found", {
      resource: error.data.resource,
      id: error.data.id,
    })
    return null
  }

  if (PermissionError.is(error)) {
    log.error("permission denied", {
      action: error.data.action,
      resource: error.data.resource,
    })
    throw error
  }

  // Unknown error
  log.error("unexpected error", { error })
  throw error
}
```

**File Reference:** `packages/opencode/src/storage/storage.ts:17-22`

### 14.2 Custom Error Classes (When Needed)

```typescript
// ✅ GOOD - Error with additional context
export class BusyError extends Error {
  constructor(public readonly sessionID: string) {
    super(`Session ${sessionID} is busy`)
    this.name = "BusyError"
  }
}

// Usage
throw new BusyError(sessionID)

// Catching
try {
  await process(sessionID)
} catch (error) {
  if (error instanceof BusyError) {
    log.info("session busy, retrying", { sessionID: error.sessionID })
    await retry()
  }
}
```

**File Reference:** `packages/opencode/src/session/index.ts:494`

### 14.3 Result Pattern (for Tools)

```typescript
// ✅ GOOD - Never throw in tool execution
export const ReadTool = Tool.define("read", {
  async execute(args, context) {
    try {
      const content = await Bun.file(args.filePath).text()

      return {
        output: content,
        title: `Read ${path.basename(args.filePath)}`,
      }
    } catch (error) {
      return {
        output: `Error reading file: ${error.message}`,
        title: "Read Failed",
        metadata: {
          error: true,
          message: error.message,
        },
      }
    }
  },
})

// ✅ GOOD - Result type for fallible operations
export type Result<T, E = Error> = { success: true; value: T } | { success: false; error: E }

export async function operation(): Promise<Result<Data>> {
  try {
    const data = await fetchData()
    return { success: true, value: data }
  } catch (error) {
    return { success: false, error }
  }
}

// Usage
const result = await operation()
if (result.success) {
  console.log(result.value)
} else {
  log.error("operation failed", { error: result.error })
}
```

### 14.4 Error Context

```typescript
// ✅ GOOD - Rich error context
class OperationError extends Error {
  constructor(
    message: string,
    public readonly context: {
      operation: string
      input: unknown
      timestamp: number
      sessionID?: string
    }
  ) {
    super(message)
    this.name = "OperationError"
  }
}

// Usage
try {
  await processData(input)
} catch (error) {
  throw new OperationError(
    "Failed to process data",
    {
      operation: "processData",
      input,
      timestamp: Date.now(),
      sessionID: context.sessionID
    }
  )
}

// Logging with context
catch (error) {
  if (error instanceof OperationError) {
    log.error("operation failed", {
      operation: error.context.operation,
      sessionID: error.context.sessionID,
      error: error.message
    })
  }
}
```

---

## 15. Type System Standards

### 15.1 Zod Schemas (Primary)

**Rule: Use Zod for runtime validation, derive TypeScript types from schemas**

```typescript
// ✅ GOOD - Schema-first approach
export namespace Session {
  export const Info = z.object({
    id: z.string(),
    title: z.string(),
    projectID: z.string(),
    modelID: z.string().optional(),
    permission: z.enum(["allow", "ask", "deny"]),
    time: z.object({
      created: z.number(),
      updated: z.number(),
    }),
  })

  // Derive TypeScript type from schema
  export type Info = z.infer<typeof Info>

  // Use in functions
  export const create = fn(Info.pick({ title: true, projectID: true }).partial(), async (input): Promise<Info> => {
    // Implementation
  })
}

// ❌ BAD - Type-first approach (no runtime validation)
export interface SessionInfo {
  id: string
  title: string
  projectID: string
}

export function create(input: Partial<SessionInfo>): SessionInfo {
  // No validation! Runtime errors possible
}
```

### 15.2 Type Inference

**Rule: Rely on type inference, avoid explicit annotations**

```typescript
// ✅ GOOD - Let TypeScript infer
const session = await Session.create({ title: "New" })
const messages = session.messages.filter((m) => m.role === "user")
const ids = messages.map((m) => m.id)

// ❌ BAD - Unnecessary annotations
const session: Session.Info = await Session.create({ title: "New" })
const messages: Message[] = session.messages.filter((m) => m.role === "user")
const ids: string[] = messages.map((m) => m.id)

// ✅ ACCEPTABLE - Annotation for clarity in complex scenarios
const messages: Message[] = await fetchMessages().then((msgs): Message[] => {
  return msgs.filter((m) => m.deleted !== true)
})
```

**File Reference:** `AGENTS.md:15`

### 15.3 Avoid `any`

```typescript
// ❌ BAD
function process(data: any) {
  return data.value.toString()
}

// ✅ GOOD - Use unknown and validate
function process(data: unknown) {
  if (typeof data !== "object" || data === null) {
    throw new Error("Expected object")
  }

  if (!("value" in data)) {
    throw new Error("Missing value property")
  }

  return String(data.value)
}

// ✅ BEST - Use Zod schema
const DataSchema = z.object({
  value: z.union([z.string(), z.number()]),
})

function process(data: unknown) {
  const validated = DataSchema.parse(data)
  return String(validated.value)
}
```

**File Reference:** `AGENTS.md:12`

### 15.4 Type Guards

```typescript
// ✅ GOOD - Type guards for narrowing
function isMessage(value: unknown): value is Message {
  return typeof value === "object" && value !== null && "id" in value && "role" in value && typeof value.id === "string"
}

// Usage
if (isMessage(data)) {
  console.log(data.id) // TypeScript knows data is Message
}

// ✅ GOOD - Type guards in filter
const messages = items.filter((item): item is Message => isMessage(item)).map((msg) => msg.id)

// ✅ GOOD - Discriminated unions
type Part =
  | { type: "text"; text: string }
  | { type: "file"; data: Buffer; mimeType: string }
  | { type: "patch"; files: string[]; diff: string }

function handle(part: Part) {
  switch (part.type) {
    case "text":
      console.log(part.text) // TypeScript knows: text part
      break
    case "file":
      console.log(part.mimeType) // TypeScript knows: file part
      break
    case "patch":
      console.log(part.files) // TypeScript knows: patch part
      break
    default:
      const _exhaustive: never = part
      throw new Error("Unhandled part type")
  }
}
```

---

## 16. Import Organization Standards

### 16.1 Import Order

```typescript
// 1. Zod and validation libraries
import z from "zod"

// 2. Node.js built-ins
import path from "path"
import fs from "fs/promises"
import os from "os"

// 3. External packages (alphabetical)
import { mergeDeep, sortBy, unique } from "remeda"
import chokidar from "chokidar"
import fuzzysort from "fuzzysort"

// 4. Internal packages (@opencode-ai/*)
import { NamedError } from "@opencode-ai/util/error"

// 5. Project utilities (../util/*)
import { Log } from "../util/log"
import { Lock } from "../util/lock"
import { fn } from "../util/fn"

// 6. Project services (../<service>/*)
import { Config } from "../config/config"
import { Storage } from "../storage/storage"
import { Bus } from "../bus"

// 7. Relative imports (same directory)
import { Session } from "./session"
import { MessageV2 } from "./message-v2"
```

### 16.2 Import Style

```typescript
// ✅ GOOD - Named imports
import { create, update, get } from "./session"
import { Log, type LogOptions } from "./util/log"

// ❌ AVOID - Default imports (except for external packages)
import session from "./session"

// ✅ GOOD - Namespace imports for large APIs
import * as Session from "./session"

// ✅ GOOD - Type-only imports
import type { Session } from "./session"
import { type Config, loadConfig } from "./config"
```

### 16.3 Circular Dependency Prevention

```typescript
// ❌ BAD - Circular dependency
// file-a.ts
import { funcB } from "./file-b"
export function funcA() {
  return funcB()
}

// file-b.ts
import { funcA } from "./file-a"
export function funcB() {
  return funcA()
}

// ✅ GOOD - Extract shared code
// shared.ts
export function shared() {
  return 42
}

// file-a.ts
import { shared } from "./shared"
export function funcA() {
  return shared()
}

// file-b.ts
import { shared } from "./shared"
export function funcB() {
  return shared()
}
```

---

## 17. Naming Conventions

### 17.1 Functions & Variables

```typescript
// ✅ camelCase for functions and variables
const sessionID = "abc123"
const userAgent = "opencode/1.0"
const maxRetries = 3

async function processMessage(messageID: string) {}
async function createSession() {}
```

### 17.2 Types & Interfaces

```typescript
// ✅ PascalCase for types, interfaces, and classes
type SessionInfo = {
  id: string
  title: string
}

interface Message {
  id: string
  content: string
}

class BusyError extends Error {}

namespace Session {
  export type Info = z.infer<typeof Info>
}
```

### 17.3 Constants

```typescript
// ✅ SCREAMING_SNAKE_CASE for true constants
const MAX_RETRY_ATTEMPTS = 3
const DEFAULT_TIMEOUT = 5000
const API_BASE_URL = "https://api.example.com"

// ✅ camelCase for configuration values
const maxRetries = config.retries ?? 3
const defaultModel = config.model?.id ?? "gpt-4"
```

### 17.4 Namespaces

```typescript
// ✅ PascalCase for namespaces
export namespace Session {}
export namespace Storage {}
export namespace FileWatcher {}
```

### 17.5 Files

```typescript
// ✅ kebab-case for files
// session-manager.ts
// message-processor.ts
// file-watcher.ts

// ✅ Single word when possible
// session.ts
// storage.ts
// config.ts
```

---

## 18. Testing Standards

### 18.1 Principles

1. **Avoid mocks** - Test actual implementation
2. **No logic duplication** - Don't reimplement logic in tests
3. **Use Bun test runner** - `bun test`

**File Reference:** `AGENTS.md:108-111`

### 18.2 Test Structure

```typescript
// packages/opencode/src/addons/serialize.test.ts

import { expect, test, describe } from "bun:test"
import { serialize, deserialize } from "./serialize"

describe("serialize", () => {
  test("preserves Date objects", () => {
    const input = { date: new Date("2024-01-01") }
    const serialized = serialize(input)
    const deserialized = deserialize(serialized)

    expect(deserialized.date).toBeInstanceOf(Date)
    expect(deserialized.date.toISOString()).toBe("2024-01-01T00:00:00.000Z")
  })

  test("preserves Set objects", () => {
    const input = { set: new Set([1, 2, 3]) }
    const serialized = serialize(input)
    const deserialized = deserialize(serialized)

    expect(deserialized.set).toBeInstanceOf(Set)
    expect(Array.from(deserialized.set)).toEqual([1, 2, 3])
  })

  test("handles nested structures", () => {
    const input = {
      map: new Map([["key", { date: new Date("2024-01-01") }]]),
      array: [new Set([1, 2])],
    }
    const serialized = serialize(input)
    const deserialized = deserialize(serialized)

    expect(deserialized.map).toBeInstanceOf(Map)
    expect(deserialized.map.get("key")?.date).toBeInstanceOf(Date)
    expect(deserialized.array[0]).toBeInstanceOf(Set)
  })
})
```

**File Reference:** `packages/opencode/src/addons/serialize.test.ts`

### 18.3 Test Commands

```bash
# Run all tests
bun test

# Run specific test file
bun test src/util/queue.test.ts

# Run tests matching pattern
bun test --test-name-pattern "serialize"

# Watch mode
bun test --watch

# Coverage
bun test --coverage
```

**File Reference:** `packages/opencode/AGENTS.md` - Build/Test Commands

### 18.4 Integration Tests

```typescript
import { test, expect, beforeAll, afterAll } from "bun:test"
import { Session } from "./session"
import { Storage } from "./storage"

let sessionID: string

beforeAll(async () => {
  // Setup: Create test session
  const session = await Session.create({ title: "Test Session" })
  sessionID = session.id
})

afterAll(async () => {
  // Cleanup: Delete test session
  await Session.delete(sessionID)
})

test("create and retrieve session", async () => {
  const session = await Session.get(sessionID)

  expect(session).toBeDefined()
  expect(session.id).toBe(sessionID)
  expect(session.title).toBe("Test Session")
})

test("update session", async () => {
  await Session.update(sessionID, { title: "Updated" })

  const session = await Session.get(sessionID)
  expect(session.title).toBe("Updated")
})
```

---

## 19. Documentation Standards

### 19.1 Code Comments

**Rule: Comment WHY, not WHAT**

```typescript
// ✅ GOOD - Explains why
// Cache header separately to enable 2-part prompt caching
if (system.length > 2 && system[0] === header) {
  system.length = 0
  system.push(header, rest.join("\n"))
}

// Prevent race condition: lock before checking existence
using _ = await Lock.write(filepath)
if (await Filesystem.exists(filepath)) {
  await fs.rm(filepath)
}

// ❌ BAD - States the obvious
// Push the item to the array
items.push(item)

// Set the title property
session.title = "New Title"
```

### 19.2 JSDoc (For Exported APIs)

````typescript
/**
 * Execute a function with a file lock to prevent concurrent access.
 *
 * The lock is automatically released when the function completes or throws.
 * Locks are queued and processed in order.
 *
 * @param filepath - Absolute path to the file to lock
 * @param fn - Function to execute while holding the lock
 * @returns The result of the function
 *
 * @example
 * ```typescript
 * await withLock("/path/to/file", async () => {
 *   const content = await Bun.file("/path/to/file").text()
 *   await Bun.write("/path/to/file", content + "\n")
 * })
 * ```
 */
export async function withLock<T>(filepath: string, fn: () => Promise<T>): Promise<T>
````

### 19.3 README Structure

```markdown
# Package Name

Brief description of what this package does.

## Installation

\`\`\`bash
bun install @opencode-ai/package-name
\`\`\`

## Usage

\`\`\`typescript
import { feature } from "@opencode-ai/package-name"

await feature()
\`\`\`

## API

### `function(param: Type): ReturnType`

Description of function.

**Parameters:**

- `param` - Description of parameter

**Returns:** Description of return value

**Example:**
\`\`\`typescript
const result = await function(param)
\`\`\`

## Development

\`\`\`bash
bun install
bun test
\`\`\`
```

---

## 20. Schema Definition Standards

### 20.1 Drizzle Schema (Database)

**Rule: Use snake_case for field names to match SQL conventions**

```typescript
// ✅ GOOD - snake_case fields
const sessionTable = sqliteTable("session", {
  id: text().primaryKey(),
  project_id: text().notNull(),
  created_at: integer().notNull(),
  updated_at: integer().notNull(),
})

// ❌ BAD - camelCase requires explicit column names
const sessionTable = sqliteTable("session", {
  id: text("id").primaryKey(),
  projectID: text("project_id").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
})
```

**File Reference:** `AGENTS.md:88-106`

### 20.2 Zod Schema

```typescript
// ✅ GOOD - Consistent field naming
export const SessionInfo = z.object({
  id: z.string(),
  projectID: z.string(), // camelCase for TypeScript
  title: z.string(),
  permission: z.enum(["allow", "ask", "deny"]),
  time: z.object({
    created: z.number(),
    updated: z.number(),
  }),
})

// ✅ GOOD - Schema composition
export const CreateSessionInput = SessionInfo.pick({
  title: true,
  projectID: true,
}).partial()

export const UpdateSessionInput = SessionInfo.partial().required({
  id: true,
})

// ✅ GOOD - Schema extension
export const SessionWithMessages = SessionInfo.extend({
  messages: z.array(MessageInfo),
})
```

---

## 21. Dependency Management Standards

### 21.1 Bun Runtime Preference

**Rule: Use Bun APIs when available**

```typescript
// ✅ GOOD - Bun APIs
const content = await Bun.file(filepath).text()
await Bun.write(filepath, content)
const json = await Bun.file(filepath).json()

const proc = Bun.spawn(["ls", "-la"], {
  cwd: directory,
  stdout: "pipe",
})

// ❌ AVOID - Node.js fs when Bun alternative exists
import fs from "fs/promises"
const content = await fs.readFile(filepath, "utf-8")
await fs.writeFile(filepath, content)
```

**File Reference:** `AGENTS.md:14`

### 21.2 Package Installation

```bash
# Add dependency
bun add package-name

# Add dev dependency
bun add -d package-name

# Add workspace dependency
bun add @opencode-ai/other-package
```

### 21.3 Version Management

```json
// package.json
{
  "dependencies": {
    "zod": "^3.22.4", // Allow patch and minor updates
    "remeda": "1.30.0", // Pin exact version for critical deps
    "@ai-sdk/anthropic": "^0.0.39"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3"
  }
}
```

---

## 22. Build & Development Standards

### 22.1 Development Commands

```bash
# Install dependencies
bun install

# Run in development (TUI)
bun dev                       # Run in packages/opencode
bun dev <directory>           # Run in specific directory
bun dev .                     # Run in repo root

# Run API server
bun dev serve                 # Start on port 4096
bun dev serve --port 8080     # Custom port

# Run web UI (requires server running)
bun dev web                   # Start server + open web UI
bun run --cwd packages/app dev  # Just web UI

# Run desktop app
bun run --cwd packages/desktop tauri dev

# Type checking
bun run typecheck

# Run tests
bun test
bun test path/to/test.ts

# Build standalone executable
./packages/opencode/script/build.ts --single

# Regenerate SDK (after server changes)
./script/generate.ts
```

**File Reference:** `CONTRIBUTING.md:30-150`

### 22.2 Project Structure

```
opencode/
├── packages/
│   ├── opencode/           # Core business logic & CLI
│   │   ├── src/
│   │   │   ├── session/    # Session management
│   │   │   ├── tool/       # Tool implementations
│   │   │   ├── agent/      # Agent system
│   │   │   ├── mcp/        # Model Context Protocol
│   │   │   ├── lsp/        # Language Server Protocol
│   │   │   ├── file/       # File operations
│   │   │   ├── config/     # Configuration
│   │   │   ├── provider/   # LLM providers
│   │   │   ├── server/     # HTTP/WebSocket server
│   │   │   └── cli/cmd/tui/  # Terminal UI (SolidJS)
│   │   └── script/
│   │       └── build.ts    # Build script
│   ├── app/                # Web UI (SolidJS)
│   ├── desktop/            # Native app (Tauri)
│   ├── sdk/js/             # TypeScript SDK
│   ├── plugin/             # Plugin system
│   └── console/            # Web console
├── script/
│   ├── generate.ts         # Generate SDK
│   └── format.ts           # Format code
├── AGENTS.md               # Agent guidelines
├── CONTRIBUTING.md         # Contribution guide
└── CODEBASE_STANDARDS.md   # This document
```

### 22.3 Build Output

```bash
# Single build creates:
packages/opencode/dist/opencode-darwin-arm64/
├── bin/
│   └── opencode           # Executable
├── node_modules/          # Bundled dependencies
└── package.json

# Run built executable:
./packages/opencode/dist/opencode-darwin-arm64/bin/opencode
```

---

## 23. Performance Standards

### 23.1 Lazy Initialization

```typescript
// ✅ GOOD - Lazy state initialization
const state = Instance.state(async () => {
  // Only initialize when first accessed
  const config = await Config.get()
  return { config, clients: [] }
})

// Access only when needed
if (needsClient) {
  const client = state().clients[0]
}

// ✅ GOOD - Lazy loading of heavy dependencies
const lazyModule = lazy(async () => {
  return import("./heavy-module")
})

// Load only when needed
const module = await lazyModule()
```

### 23.2 Caching

```typescript
// ✅ GOOD - Cache expensive operations
const cache = new Map<string, Data>()

async function getData(id: string): Promise<Data> {
  const cached = cache.get(id)
  if (cached) return cached

  const data = await fetchData(id)
  cache.set(id, data)
  return data
}

// ✅ GOOD - Time-based cache invalidation
const cache = new Map<string, { data: Data; expires: number }>()

async function getData(id: string): Promise<Data> {
  const cached = cache.get(id)
  if (cached && Date.now() < cached.expires) {
    return cached.data
  }

  const data = await fetchData(id)
  cache.set(id, {
    data,
    expires: Date.now() + 60_000, // 1 minute
  })
  return data
}
```

### 23.3 Debouncing

```typescript
// ✅ GOOD - Debounce high-frequency events
function debounce<T extends (...args: any[]) => any>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: Timer | undefined

  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn(...args)
      timer = undefined
    }, delay)
  }
}

// Usage
const debouncedSave = debounce(async (content: string) => {
  await save(content)
}, 500)

// Only saves after 500ms of inactivity
input.on("change", (content) => {
  debouncedSave(content)
})
```

### 23.4 Streaming

```typescript
// ✅ GOOD - Stream large responses
export async function* streamMessages(sessionID: string) {
  const files = await Storage.list(Storage.path("messages", sessionID), "*.json")

  for (const file of files) {
    const message = await Storage.read<Message>(file)
    yield message
  }
}

// Usage
for await (const message of streamMessages(sessionID)) {
  process(message)
}
```

---

## 24. Security Standards

### 24.1 Input Validation

```typescript
// ✅ GOOD - Validate all external input
export const handleRequest = fn(
  z.object({
    sessionID: z.string().regex(/^session-[a-z0-9]{10}$/),
    content: z.string().max(100_000),
    metadata: z.record(z.unknown()).optional(),
  }),
  async (input) => {
    // Input is validated, safe to use
    return process(input)
  },
)

// ✅ GOOD - Validate file paths
function validatePath(filepath: string) {
  const normalized = path.normalize(filepath)
  const absolute = path.resolve(normalized)

  // Prevent directory traversal
  if (!absolute.startsWith(Instance.worktree)) {
    throw new Error("Path outside worktree")
  }

  return absolute
}
```

### 24.2 Permission Checks

```typescript
// ✅ GOOD - Check permissions before sensitive operations
async function readFile(filepath: string, context: Context) {
  // Validate path
  const safe = validatePath(filepath)

  // Check permission
  const permission = await PermissionNext.evaluate("read", safe, context.agent.permission)

  if (permission.action === "deny") {
    throw PermissionError.create({
      message: "Permission denied",
      action: "read",
      resource: safe,
    })
  }

  if (permission.action === "ask") {
    const allowed = await context.ask({
      type: "permission",
      message: `Read file ${path.basename(safe)}?`,
      actions: ["allow", "deny"],
    })

    if (!allowed) {
      throw PermissionError.create({
        message: "User denied permission",
        action: "read",
        resource: safe,
      })
    }
  }

  // Permission granted, perform operation
  return Bun.file(safe).text()
}
```

### 24.3 Secrets Management

```typescript
// ✅ GOOD - Load secrets from environment
export namespace Auth {
  export async function get(providerID: string): Promise<string | undefined> {
    const key = `OPENCODE_${providerID.toUpperCase()}_API_KEY`
    return process.env[key]
  }
}

// ❌ AVOID - Hardcoded secrets
const API_KEY = "sk-abc123..."

// ❌ AVOID - Logging secrets
log.info("api key", { key: apiKey })

// ✅ GOOD - Redact secrets in logs
log.info("api request", { key: apiKey.slice(0, 8) + "..." })
```

### 24.4 Command Injection Prevention

```typescript
// ❌ BAD - Command injection vulnerability
const output = await $`ls ${userInput}`.text()

// ✅ GOOD - Use array syntax (prevents injection)
const proc = Bun.spawn(["ls", userInput], {
  stdout: "pipe",
})
const output = await new Response(proc.stdout).text()

// ✅ GOOD - Validate input
const sanitized = userInput.replace(/[^a-zA-Z0-9_-]/g, "")
const proc = Bun.spawn(["ls", sanitized])
```

---

## Summary: Key Principles

1. **Single-word function names** unless multi-word necessary (95%+ adherence)
2. **Namespaces over classes** for code organization (only 5 classes in 206 files)
3. **Functional array methods** over for-loops (85/15 split)
4. **Parallel execution by default** via `Promise.all`
5. **Lock mechanisms** prevent race conditions (reader-writer locks, file locks)
6. **Per-instance state isolation** for multi-project support
7. **Event-driven architecture** via pub/sub bus
8. **Zod validation** for all inputs via `fn()` wrapper
9. **Disposable resources** with `using` keyword for automatic cleanup
10. **Bun runtime preference** for file I/O and process spawning
11. **Inline values once, extract when reusable**
12. **Named errors** over throw strings
13. **Avoid mocks in tests**, test actual implementation
14. **Layered config** with clear precedence (7 levels)
15. **Graceful disposal** for all stateful services
16. **Prefer `const` over `let`** - use ternaries instead of reassignment
17. **Avoid `else` statements** - use early returns
18. **Avoid destructuring** - preserve context with dot notation
19. **Type inference** - avoid explicit annotations unless necessary
20. **Avoid `any` type** - use `unknown` with validation
21. **Comment WHY, not WHAT** - explain reasoning, not obvious operations
22. **Schema-first approach** - define Zod schemas, derive TS types
23. **Reader-writer locks** for concurrent access
24. **System prompt caching** - maintain 2-part structure for efficiency
25. **Context compaction** at 75% token threshold

---

## File References Quick Index

### Core Patterns

- **Function wrapper**: `packages/opencode/src/util/fn.ts`
- **State management**: `packages/opencode/src/project/state.ts`
- **Instance isolation**: `packages/opencode/src/project/instance.ts`
- **Event bus**: `packages/opencode/src/bus/index.ts`
- **Locks**: `packages/opencode/src/util/lock.ts`
- **Async queue**: `packages/opencode/src/util/queue.ts`

### Services

- **Session**: `packages/opencode/src/session/index.ts`
- **LLM streaming**: `packages/opencode/src/session/llm.ts`
- **Processor**: `packages/opencode/src/session/processor.ts`
- **Messages**: `packages/opencode/src/session/message-v2.ts`
- **LSP**: `packages/opencode/src/lsp/index.ts`
- **MCP**: `packages/opencode/src/mcp/index.ts`
- **Storage**: `packages/opencode/src/storage/storage.ts`
- **Config**: `packages/opencode/src/config/config.ts`
- **Provider**: `packages/opencode/src/provider/provider.ts`

### Tools

- **Tool definition**: `packages/opencode/src/tool/tool.ts`
- **Edit**: `packages/opencode/src/tool/edit.ts`
- **Batch**: `packages/opencode/src/tool/batch.ts`
- **Grep**: `packages/opencode/src/tool/grep.ts`

### Documentation

- **Style guide**: `AGENTS.md`
- **Contributing**: `CONTRIBUTING.md`
- **This document**: `CODEBASE_STANDARDS.md`

---

**End of Standards Document**
