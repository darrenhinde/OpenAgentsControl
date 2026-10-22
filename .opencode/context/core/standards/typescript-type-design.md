<!-- Context: core/standards | Priority: critical | Version: 1.0 | Updated: 2026-03-27 -->

# TypeScript Type & API Design Standards

**Purpose**: Type modeling, API surface design, and export conventions  
**Scope**: Complements `universal-typescript-standards.md` (which covers control flow, async, arrays, naming)  
**Tooling**: Formatting and lint rules are handled by Biome — these cover what Biome cannot enforce

---

## 1. Type Definitions

Use `type` for all definitions. Use `interface` only for declaration merging
(e.g. augmenting third-party library types).

```typescript
type UserRole = 'admin' | 'guest';

type User = {
  name: string;
  role: UserRole;
};

// interface only for augmentation
declare namespace NodeJS {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface ProcessEnv {
    NODE_ENV: 'development' | 'production';
  }
}
```

## 2. No Enums

Never use `enum`. Use literal union types for value sets. Use `as const` when
runtime access to values is needed.

```typescript
// Literal type — zero runtime cost
type Status = 'pending' | 'active' | 'archived';

// as const array — when you need to iterate
const STATUSES = ['pending', 'active', 'archived'] as const;
type Status = (typeof STATUSES)[number];

// as const object — when mapping arbitrary values
const HTTP_STATUS = { Ok: 200, NotFound: 404 } as const;
```

## 3. Validated Constants

Use `as const satisfies` when a constant must conform to a known type.

```typescript
type Route = '/home' | '/settings' | '/profile';
const NAV_ROUTES = ['/home', '/settings'] as const satisfies ReadonlyArray<Route>;
```

## 4. Discriminated Unions Over Optional Properties

When properties are state-dependent, model as a discriminated union.

```typescript
// ✅ Illegal states are unrepresentable
type Result<TData> =
  | { status: 'ok'; data: TData }
  | { status: 'error'; error: Error };

// ❌ Bag of optionals — most combinations are invalid
type Result<TData> = {
  status: string;
  data?: TData;
  error?: Error;
};
```

## 5. Return Types on Exports

Exported functions must have explicit return types. Internal functions may
rely on inference.

```typescript
// Exported — explicit
export function parseConfig(raw: string): AppConfig { ... }

// Internal — inferred is fine
const normalize = (s: string) => s.trim().toLowerCase();
```

## 6. Named Exports Only

Always use named exports. Never use `export default`.

```typescript
export function createUser() { ... }
export type User = { ... };
```

## 7. Single Object Argument

Functions with 2+ parameters should accept a single options object.

```typescript
// ✅
function createUser(opts: { name: string; role: UserRole; teamId: string }) { ... }

// ✅ Single primitive is fine
function isEven(n: number) { ... }

// ❌
function createUser(name: string, role: UserRole, teamId: string) { ... }
```

## 8. Immutable Parameters

Prefer `ReadonlyArray<T>` and `Readonly<T>` for function parameters.
Return new arrays/objects instead of mutating inputs.

```typescript
function getActive(users: ReadonlyArray<User>): ReadonlyArray<User> {
  return users.filter(u => u.isActive);
}
```

## 9. Generic Naming

Generic type parameters must start with `T` followed by a descriptor.
Single-letter generics are not allowed.

```typescript
// ✅
function handle<TRequest extends Request>(req: TRequest): void { ... }
const createPair = <TFirst, TSecond>(a: TFirst, b: TSecond) => [a, b];

// ❌
function handle<T extends Request>(req: T): void { ... }
const createPair = <A, B>(a: A, b: B) => [a, b];
```

## 10. Null vs Undefined

- `null` — intentionally no value (assignments, return types)
- `undefined` — not set / not provided (omitted optional fields)

```typescript
function findUser(id: string): User | null { ... }
```

## 11. Type Error Suppression

Use `@ts-expect-error` with a description. Never use `@ts-ignore`.

```typescript
// @ts-expect-error: Library types missing v3 API shape
const result = legacyLib.fetchData(payload);
```

## 12. Minimize Non-null Assertions

Avoid `!` (non-null assertion). If reaching for `user!.name`, restructure
the types instead.

---

## Related Standards

- **Universal TypeScript**: `core/standards/universal-typescript-standards.md` (control flow, async, arrays, naming)
- **Code Quality**: `core/standards/code-quality.md` (general quality standards)

---

**Version**: 1.0.0  
**Last Updated**: 2026-03-27
