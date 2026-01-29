# The Context System: A Complete Guide

## What Is Context?

**Context** is your project's **coding standards and patterns** stored as markdown files. It tells agents:
- How you write code (naming conventions, architecture)
- What libraries you use (React, Next.js, Tailwind, etc.)
- Your security requirements
- Your design system
- Your project-specific patterns

Think of it as a **style guide for AI agents**.

---

## Why Context Matters

### Without Context
```
You: "Create a React component"
Agent: Creates component in its own style
Result: Doesn't match your project
```

### With Context
```
You: "Create a React component"
Agent: Loads your React pattern from context
Agent: Creates component matching your style
Result: Perfectly matches your project
```

---

## How Context Works

### The Flow

```
Your Request
    ↓
Agent receives request
    ↓
ContextScout discovers relevant context files
    ↓
Agent loads context files
    ↓
Agent follows patterns from context
    ↓
Code matches your standards automatically
```

### Example: Creating a React Component

**Step 1: You ask for a component**
```
"Create a user profile component"
```

**Step 2: ContextScout discovers**
- `core/standards/code-quality.md` (modular patterns)
- `ui/web/react-patterns.md` (React conventions)
- `project/project-context.md` (YOUR patterns)

**Step 3: Agent loads context**
```markdown
# From project-context.md

## React Component Pattern

All components should:
- Use TypeScript with strict mode
- Export named component
- Include JSDoc comments
- Use React.FC type

export const UserProfile: React.FC<Props> = ({ user }) => {
  return <div>{user.name}</div>;
};
```

**Step 4: Agent creates component**
```typescript
/**
 * UserProfile - Displays user information
 */
export const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  return (
    <div className="user-profile">
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
};
```

**Result**: Component matches your patterns automatically!

---

## Context Directory Structure

```
.opencode/context/
├── core/                           # Universal standards
│   ├── standards/
│   │   ├── code-quality.md        # Modular, functional patterns
│   │   ├── security-patterns.md   # Security best practices
│   │   ├── test-coverage.md       # Testing standards
│   │   └── documentation.md       # Documentation patterns
│   ├── workflows/
│   │   ├── design-iteration.md    # 4-stage UI design
│   │   ├── task-delegation.md     # Task delegation patterns
│   │   ├── external-libraries.md  # Library integration
│   │   └── code-review.md         # Code review process
│   └── task-management/
│       └── standards/
│           └── task-schema.md     # Task JSON schema
│
├── ui/                             # Design & UX
│   └── web/
│       ├── ui-styling-standards.md    # Tailwind + Flowbite
│       ├── animation-patterns.md      # Micro-interactions
│       ├── react-patterns.md          # React conventions
│       └── design-systems.md          # Design system principles
│
├── development/                    # Language-specific
│   ├── backend-navigation.md
│   ├── ui-navigation.md
│   └── [language-specific patterns]
│
└── project/                        # YOUR custom patterns
    └── project-context.md          # Edit this file!
```

---

## What's Included in Core Context

### 1. Code Quality Standards (`core/standards/code-quality.md`)

**Teaches agents**:
- Modular design principles
- Functional programming patterns
- Pure functions and immutability
- Composition over inheritance
- Naming conventions

**Example**:
```javascript
// ✅ Pure function (from context)
const add = (a, b) => a + b;

// ❌ Impure (agents avoid this)
let total = 0;
const addToTotal = (value) => { total += value; };
```

### 2. Security Patterns (`core/standards/security-patterns.md`)

**Teaches agents**:
- Input validation
- Authentication checks
- Authorization patterns
- Secure error handling
- Logging best practices

### 3. Design Iteration (`core/workflows/design-iteration.md`)

**Teaches agents**:
- 4-stage UI design workflow
- Layout → Theme → Animation → Implementation
- Approval gates at each stage
- Design versioning strategy

### 4. External Libraries (`core/workflows/external-libraries.md`)

**Teaches agents**:
- How to integrate external libraries
- Common patterns for popular libraries
- Configuration best practices
- Dependency management

### 5. UI Styling Standards (`ui/web/ui-styling-standards.md`)

**Teaches agents**:
- Tailwind CSS conventions
- Flowbite component usage
- Color palette standards
- Responsive design patterns

### 6. React Patterns (`ui/web/react-patterns.md`)

**Teaches agents**:
- Modern React hooks
- Component composition
- State management patterns
- Performance optimization

---

## Adding Your Own Patterns

### Step 1: Edit Your Project Context

```bash
# Open your project context file
nano ~/.opencode/context/project/project-context.md
```

### Step 2: Add Your Patterns

```markdown
# Your Project Patterns

## API Endpoint Pattern

All API endpoints should follow this pattern:

```typescript
export async function POST(request: Request) {
  try {
    // 1. Parse and validate input
    const body = await request.json();
    if (!body.email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    // 2. Check authentication
    const user = await auth.verify(request);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Process request
    const result = await processRequest(body);

    // 4. Return response
    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('POST error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

## React Component Pattern

All React components should:
- Use TypeScript with strict mode
- Export named component
- Include JSDoc comments
- Use React.FC type
- Include prop validation

```typescript
interface UserCardProps {
  userId: string;
  onSelect?: (id: string) => void;
}

/**
 * UserCard - Displays user information in a card
 * @param props - Component props
 */
export const UserCard: React.FC<UserCardProps> = ({ 
  userId, 
  onSelect 
}) => {
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    fetchUser(userId).then(setUser);
  }, [userId]);

  return (
    <div className="user-card">
      <h3>{user?.name}</h3>
      <button onClick={() => onSelect?.(userId)}>
        Select
      </button>
    </div>
  );
};
```

## Database Query Pattern

All database queries should:
- Use parameterized queries
- Include error handling
- Log important operations
- Return typed results

```typescript
export async function getUserById(id: string) {
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    
    if (!user.length) {
      throw new Error('User not found');
    }

    return user[0];
  } catch (error) {
    console.error('getUserById error:', error);
    throw error;
  }
}
```

## Security Checklist

All endpoints must:
- [ ] Validate user authentication
- [ ] Check user permissions
- [ ] Sanitize and validate inputs
- [ ] Use parameterized queries
- [ ] Implement rate limiting
- [ ] Log security events
- [ ] Handle errors securely
- [ ] Use HTTPS only

## Naming Conventions

- **Files**: lowercase-with-dashes.ts
- **Functions**: verbPhrases (getUser, validateEmail)
- **Constants**: UPPER_CASE
- **Types**: PascalCase
- **Variables**: camelCase
- **Predicates**: isValid, hasPermission, canAccess

## Folder Structure

```
src/
├── components/          # React components
│   ├── common/         # Reusable components
│   ├── features/       # Feature-specific components
│   └── layouts/        # Layout components
├── lib/                # Utilities and helpers
├── api/                # API routes
├── types/              # TypeScript types
├── styles/             # Global styles
└── hooks/              # Custom React hooks
```
```

### Step 3: Agents Use Your Patterns

When you ask an agent to create code, it will:
1. Load your project context
2. Follow your patterns
3. Create code matching your style

---

## Real-World Examples

### Example 1: Adding a Component Pattern

**Your project context**:
```markdown
## Button Component Pattern

All buttons should:
- Use Tailwind classes
- Include loading state
- Support disabled state
- Include accessibility attributes

export const Button: React.FC<ButtonProps> = ({
  children,
  isLoading,
  disabled,
  ...props
}) => (
  <button
    disabled={disabled || isLoading}
    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
    aria-busy={isLoading}
    {...props}
  >
    {isLoading ? 'Loading...' : children}
  </button>
);
```

**You ask**:
```
"Create a submit button for the login form"
```

**Agent creates**:
```typescript
export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isLoading,
  disabled,
}) => (
  <Button
    type="submit"
    isLoading={isLoading}
    disabled={disabled}
  >
    Sign In
  </Button>
);
```

✅ Automatically follows your button pattern!

### Example 2: Adding an API Pattern

**Your project context**:
```markdown
## API Response Pattern

All API responses should:
- Return { success, data, error }
- Include proper status codes
- Log all requests
- Validate input

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate
    if (!body.email) {
      return Response.json(
        { success: false, error: 'Email required' },
        { status: 400 }
      );
    }

    // Process
    const result = await process(body);

    // Return
    return Response.json({ success: true, data: result });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**You ask**:
```
"Create an API endpoint to create a new user"
```

**Agent creates**:
```typescript
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // Validate
    if (!body.email || !body.password) {
      return Response.json(
        { success: false, error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Process
    const user = await createUser(body);

    // Return
    return Response.json({ success: true, data: user });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

✅ Automatically follows your API pattern!

### Example 3: Adding a Security Pattern

**Your project context**:
```markdown
## Security Requirements

All endpoints must:
- Verify user authentication
- Check user permissions
- Validate all inputs
- Use parameterized queries
- Log security events

Example:
```typescript
export async function POST(request: Request) {
  // 1. Verify authentication
  const user = await auth.verify(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check permissions
  if (!user.isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Validate input
  const body = await request.json();
  if (!validateInput(body)) {
    return Response.json({ error: 'Invalid input' }, { status: 400 });
  }

  // 4. Log security event
  console.log(`Admin action by ${user.id}: create-user`);

  // 5. Process
  const result = await process(body);
  return Response.json({ success: true, data: result });
}
```
```

**You ask**:
```
"Create an admin endpoint to delete a user"
```

**Agent creates**:
```typescript
export async function DELETE(request: Request) {
  // 1. Verify authentication
  const user = await auth.verify(request);
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Check permissions
  if (!user.isAdmin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // 3. Validate input
  const { userId } = await request.json();
  if (!userId) {
    return Response.json({ error: 'User ID required' }, { status: 400 });
  }

  // 4. Log security event
  console.log(`Admin action by ${user.id}: delete-user ${userId}`);

  // 5. Process
  await deleteUser(userId);
  return Response.json({ success: true });
}
```

✅ Automatically includes all security checks!

---

## Context Best Practices

### 1. Keep It Organized

```markdown
# Your Project Patterns

## Components
[Component patterns]

## API Endpoints
[API patterns]

## Database
[Database patterns]

## Security
[Security requirements]

## Naming
[Naming conventions]

## Folder Structure
[Folder structure]
```

### 2. Include Real Examples

```markdown
## Good ✅
export const Button: React.FC<Props> = ({ ... }) => {
  // Real example from your project
};

## Bad ❌
export const Button = (props) => {
  // Generic example
};
```

### 3. Be Specific

```markdown
## Good ✅
All API endpoints must:
- Validate input with Zod
- Return { success, data, error }
- Log with console.error for errors
- Use 400 for validation, 401 for auth, 500 for server

## Bad ❌
All API endpoints should be good
```

### 4. Update Regularly

When you change patterns:
1. Update `project-context.md`
2. Agents will use new patterns immediately
3. No need to restart anything

---

## Troubleshooting

### Problem: Agent isn't following my patterns

**Solution**:
1. Check that `project-context.md` exists
2. Verify the pattern is clearly written
3. Include a real example
4. Ask agent to "follow project patterns"

### Problem: Agent uses old patterns

**Solution**:
1. Update `project-context.md`
2. Restart the agent
3. Ask agent to "load latest context"

### Problem: Pattern is too complex

**Solution**:
1. Break into smaller patterns
2. Include step-by-step example
3. Add comments explaining why

### Problem: Agent creates code that doesn't match

**Solution**:
1. Check if pattern is in `project-context.md`
2. Verify pattern is specific enough
3. Ask agent to "review against project patterns"
4. Provide feedback to refine pattern

---

## Advanced: Context Hierarchy

Agents load context in this order:

1. **Core Standards** (universal patterns)
   - `core/standards/code-quality.md`
   - `core/standards/security-patterns.md`

2. **Workflows** (how to do things)
   - `core/workflows/design-iteration.md`
   - `core/workflows/external-libraries.md`

3. **Domain-Specific** (language/framework)
   - `development/[language]/patterns.md`
   - `ui/web/react-patterns.md`

4. **Project-Specific** (YOUR patterns) ← Most important!
   - `project/project-context.md`

**Project context overrides everything else!**

---

## Summary

**Context is your secret weapon** for AI-assisted development:

✅ **Automatic pattern following** - No manual configuration
✅ **Consistent code** - All code matches your style
✅ **Team alignment** - Everyone follows same patterns
✅ **Easy updates** - Change patterns once, agents use everywhere
✅ **Living documentation** - Patterns stay in sync with code

**Get started**:
1. Edit `~/.opencode/context/project/project-context.md`
2. Add your patterns with examples
3. Ask agents to create code
4. Watch them follow your patterns automatically!

---

## Next Steps

1. **Review** your current coding patterns
2. **Document** them in `project-context.md`
3. **Include** real examples from your project
4. **Test** by asking agents to create code
5. **Refine** patterns based on results

Your agents will become better and better as your context improves!
