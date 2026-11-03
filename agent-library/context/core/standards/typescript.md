<!-- Context: core/standards | Priority: critical | Version: 1.0 | Updated: 2026-02-16 -->

# Universal TypeScript Standards

**Purpose**: Universal TypeScript patterns applicable to any TypeScript project  
**Scope**: Language-level patterns, not framework-specific  
**Last Updated**: 2026-02-16

---

## Table of Contents

1. [Function Patterns](#1-function-patterns)
2. [Type Safety](#2-type-safety)
3. [Array Operations](#3-array-operations)
4. [Async Patterns](#4-async-patterns)
5. [Control Flow](#5-control-flow)
6. [Code Organization](#6-code-organization)
7. [Testing Principles](#7-testing-principles)
8. [Variable Naming](#8-variable-naming)

---

## 1. Function Patterns

### 1.1 Naming Convention

**Rule: Prefer single-word function names**

```typescript
// ✅ GOOD - Single-word names
export function create() {...}
export function fork() {...}
export function touch() {...}
export function get() {...}
export async function stream(input: StreamInput) {...}

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

### 1.2 Pure Functions

**Rule: Prefer pure functions when possible**

```typescript
// ✅ GOOD - Pure function
function calculateTotal(items: Item[]): number {
  return items.reduce((sum, item) => sum + item.price, 0)
}

// ❌ AVOID - Side effects
let total = 0
function addToTotal(item: Item) {
  total += item.price  // Mutates external state
}
```

### 1.3 Function Composition

```typescript
// ✅ GOOD - Functional composition with pipes
const filtered = agents
  .filter((a) => a.mode !== "primary")
  .filter((a) => hasPermission(a, caller))
  .map((a) => a.name)

// ✅ GOOD - Higher-order functions
export function withRetry<T>(fn: () => Promise<T>, maxRetries: number): Promise<T> {
  return fn().catch((error) => {
    if (maxRetries > 0) {
      return withRetry(fn, maxRetries - 1)
    }
    throw error
  })
}
```

---

## 2. Type Safety

### 2.1 TypeScript Types

**Rule: Use TypeScript's type system, avoid `any`**

```typescript
// ✅ GOOD - Explicit types
interface User {
  id: string
  name: string
  email: string
}

function getUser(id: string): User {
  // Implementation
}

// ❌ AVOID - any type
function getUser(id: any): any {
  // Loses all type safety
}
```

### 2.2 Type Inference

**Rule: Let TypeScript infer when obvious**

```typescript
// ✅ GOOD - Inference works
const count = 42  // TypeScript knows this is number
const users = await fetchUsers()  // Type inferred from return type

// ❌ AVOID - Redundant annotations
const count: number = 42
const users: User[] = await fetchUsers()
```

### 2.3 Type Guards

**Rule: Use type guards for runtime type checking**

```typescript
// ✅ GOOD - Type guard
function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "name" in value
  )
}

// Usage
if (isUser(data)) {
  console.log(data.name)  // TypeScript knows data is User
}
```

### 2.4 Avoid Any

**Rule: Use `unknown` instead of `any` when type is truly unknown**

```typescript
// ✅ GOOD - unknown requires type checking
function processData(data: unknown) {
  if (typeof data === "string") {
    return data.toUpperCase()
  }
  throw new Error("Invalid data")
}

// ❌ AVOID - any bypasses type checking
function processData(data: any) {
  return data.toUpperCase()  // No compile-time safety
}
```

---

## 3. Array Operations

### 3.1 Functional Methods (Preferred)

**Rule: Prefer map/filter/reduce over for-loops**

```typescript
// ✅ GOOD - Functional chain with type inference
const files = messages
  .flatMap((x) => x.parts)
  .filter((x): x is Patch => x.type === "patch")
  .flatMap((x) => x.files)
  .map((x) => path.relative(worktree, x))

// ✅ GOOD - Parallel async operations
const results = await Promise.all(
  toolCalls.map(async (call) => {
    return executeCall(call)
  }),
)

// ✅ GOOD - Reduce for aggregation
const totalAdditions = diffs.reduce((sum, x) => sum + x.additions, 0)

// ✅ GOOD - Unique values
const uniqueNames = Array.from(new Set(items.map((x) => x.name)))

// ✅ GOOD - Sorting
const sorted = items.toSorted((a, b) => a.timestamp - b.timestamp)
```

### 3.2 For-Loops (When Necessary)

**Rule: Use for-loops only for:**
1. Algorithm complexity (DP, graph traversal)
2. Early exit requirements
3. Sequential side effects
4. Performance-critical iteration

```typescript
// ✅ GOOD - Early exit
const patches = []
for (const msg of all) {
  if (msg.info.id === targetID) break
  for (const part of msg.parts) {
    if (part.type === "patch") {
      patches.push(part)
    }
  }
}

// ✅ GOOD - Sequential mutations
for (const key of Object.keys(tools)) {
  if (disabled.has(key)) {
    delete tools[key]
  }
}
```

### 3.3 Type Guards on Filter

**Rule: Use type guards to maintain type inference downstream**

```typescript
// ✅ GOOD - Type guard preserves type information
const patches = messages
  .flatMap((msg) => msg.parts)
  .filter((part): part is PatchPart => part.type === "patch")
// patches is now PatchPart[], not Part[]

// ❌ BAD - Loses type information
const patches = messages
  .flatMap((msg) => msg.parts)
  .filter((part) => part.type === "patch")
// patches is still Part[], requires casting later
```

---

## 4. Async Patterns

### 4.1 Parallel Execution (Default Pattern)

**Rule: Use `Promise.all` for independent operations**

```typescript
// ✅ GOOD - Parallel independent operations
const [language, cfg, provider, auth] = await Promise.all([
  getLanguage(model),
  getConfig(),
  getProvider(model.providerID),
  getAuth(model.providerID),
])

// ✅ GOOD - Parallel array processing
const results = await Promise.all(
  items.map(async (item) => {
    return processItem(item)
  }),
)

// ❌ BAD - Sequential when independent
const language = await getLanguage(model)
const cfg = await getConfig()  // Could run in parallel!
const provider = await getProvider(model.providerID)
```

### 4.2 Sequential Operations

**Rule: Chain when operations depend on previous results**

```typescript
// ✅ GOOD - Sequential dependency chain
const session = await createSession({ title: "New" })
const message = await addMessage(session.id, { content: "Hello" })
const response = await processMessage(message.id)

// ✅ GOOD - Promise chain for clarity
const result = await createSession({ title: "New" })
  .then((session) => addMessage(session.id, { content: "Hello" }))
  .then((message) => processMessage(message.id))
```

### 4.3 Error Handling in Async

**Rule: Prefer `.catch()` over try/catch when possible**

```typescript
// ✅ GOOD - Catch at call site
const result = await operation().catch((error) => {
  console.error("Operation failed", error)
  return defaultValue
})

// ✅ GOOD - Promise.all with error handling
const results = await Promise.all(
  items.map(async (item) => {
    return processItem(item).catch((error) => {
      console.error("Item failed", { item, error })
      return null
    })
  }),
)

// ✅ ACCEPTABLE - try/catch for multiple operations
try {
  const session = await createSession(input)
  await addMessage(session.id, message)
  await publishEvent({ session })
  return session
} catch (error) {
  console.error("Session creation failed", error)
  throw error
}

// ❌ AVOID - try/catch for single operation
try {
  const result = await operation()
  return result
} catch (error) {
  console.error(error)
  throw error
}
// Better:
const result = await operation().catch((error) => {
  console.error(error)
  throw error
})
```

---

## 5. Control Flow

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
  const session = await getSession(id)
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

### 5.2 Guard Clauses

```typescript
// ✅ GOOD - Guard clauses at function start
async function updateSession(id: string, data: UpdateData) {
  if (!id) throw new Error("ID required")
  if (!data) throw new Error("Data required")
  if (data.title && data.title.length > 100) throw new Error("Title too long")

  // Main logic here
  const session = await getSession(id)
  await update(id, data)
  return session
}
```

### 5.3 Switch Statements

**Rule: Use exhaustive switch with default case**

```typescript
// ✅ GOOD - Exhaustive switch
function handleEvent(event: Event) {
  switch (event.type) {
    case "start":
      return handleStart(event)
    
    case "update":
      return handleUpdate(event)
    
    case "complete":
      return handleComplete(event)
    
    default:
      const _exhaustive: never = event
      throw new Error(`Unhandled event type: ${(event as any).type}`)
  }
}
```

---

## 6. Code Organization

### 6.1 Import Order

**Rule: Organize imports by source**

```typescript
// ✅ GOOD - Organized imports
// 1. Node built-ins
import path from "path"
import fs from "fs/promises"

// 2. External packages
import { z } from "zod"
import express from "express"

// 3. Internal modules
import { User } from "./types"
import { getConfig } from "./config"
```

### 6.2 Naming Conventions

```typescript
// ✅ GOOD - Clear naming
const session = await getSession(id)
const user = await getCurrentUser()
const messages = await getMessages({ sessionID })

// ❌ BAD - Unnecessary verbosity
const currentSession = await getSession(id)
const currentlyAuthenticatedUser = await getCurrentUser()
const sessionMessagesList = await getMessages({ sessionID })

// ✅ GOOD - Multi-word when single word is ambiguous
const sessionID = params.id
const userAgent = req.headers["user-agent"]
const maxRetries = config.retries
```

### 6.3 File Structure

**Rule: One primary export per file**

```typescript
// user.ts
export interface User {
  id: string
  name: string
}

export async function getUser(id: string): Promise<User> {
  // Implementation
}

export async function createUser(data: CreateUserInput): Promise<User> {
  // Implementation
}
```

---

## 7. Testing Principles

### 7.1 Test Structure

**Rule: Follow Arrange-Act-Assert pattern**

```typescript
// ✅ GOOD - AAA pattern
test("creates user with valid data", async () => {
  // Arrange
  const userData = { name: "Alice", email: "alice@example.com" }
  
  // Act
  const user = await createUser(userData)
  
  // Assert
  expect(user.name).toBe("Alice")
  expect(user.email).toBe("alice@example.com")
})
```

### 7.2 Coverage Goals

**Rule: Test both success and failure cases**

```typescript
// ✅ GOOD - Both positive and negative tests
describe("createUser", () => {
  test("creates user with valid data", async () => {
    const user = await createUser({ name: "Alice", email: "alice@example.com" })
    expect(user).toBeDefined()
  })
  
  test("throws error with invalid email", async () => {
    await expect(
      createUser({ name: "Alice", email: "invalid" })
    ).rejects.toThrow("Invalid email")
  })
})
```

### 7.3 Mock External Dependencies

**Rule: Mock all external dependencies**

```typescript
// ✅ GOOD - Mocked dependencies
test("fetches user data", async () => {
  const mockFetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ id: "1", name: "Alice" })
  })
  
  global.fetch = mockFetch
  
  const user = await fetchUser("1")
  expect(user.name).toBe("Alice")
})
```

---

## 8. Variable Naming

### 8.1 Variable Declaration

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

### 8.2 Destructuring

**Rule: Avoid unnecessary destructuring, preserve context with dot notation**

```typescript
// ✅ GOOD - Preserve context
function process(session: Session) {
  console.log("processing", { id: session.id, title: session.title })
  return {
    id: session.id,
    status: session.status,
    owner: session.owner
  }
}

// ❌ BAD - Loses context, harder to read
function process(session: Session) {
  const { id, title, status, owner } = session
  console.log("processing", { id, title })
  return { id, status, owner }
}

// ✅ ACCEPTABLE - Destructuring when improving readability
function renderUser({ name, email, avatar }: User) {
  return `<div>${name} (${email})</div>`
}

// ✅ ACCEPTABLE - Destructuring array returns
const [language, cfg, provider] = await Promise.all([...])
```

---

## Related Standards

- **OpenCode TypeScript**: `.opencode/context/openagents-repo/standards/opencode-typescript.md` (framework-specific patterns)
- **Code Quality**: `.opencode/context/core/standards/code-quality.md` (general quality standards)
- **Test Coverage**: `.opencode/context/core/standards/test-coverage.md` (testing standards)

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-16  
**Maintainer**: OpenAgents Control Team
