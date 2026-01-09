# Core Standards Navigation

**Purpose**: Universal standards for all development work

---

## Files

| File | Topic | Priority | Load When |
|------|-------|----------|-----------|
| `code-quality.md` | Code quality rules | ⭐⭐⭐⭐⭐ | Writing/reviewing code |
| `test-coverage.md` | Testing standards | ⭐⭐⭐⭐⭐ | Writing tests |
| `documentation.md` | Documentation rules | ⭐⭐⭐⭐ | Writing docs |
| `security-patterns.md` | Security best practices | ⭐⭐⭐⭐ | Security review, patterns |
| `code-analysis.md` | Analysis approaches | ⭐⭐⭐ | Analyzing code, debugging |

---

## Loading Strategy

**For code implementation**:
1. Load `code-quality.md` (critical)
2. Load `security-patterns.md` (high)

**For testing**:
1. Load `test-coverage.md` (critical)
2. Depends on: `code-quality.md`

**For documentation**:
1. Load `documentation.md` (critical)

**For code review**:
1. Load `code-quality.md` (critical)
2. Load `security-patterns.md` (high)
3. Load `test-coverage.md` (high)

---

## Related

- **Workflows** → `../workflows/navigation.md`
- **Development Principles** → `../../development/principles/`
