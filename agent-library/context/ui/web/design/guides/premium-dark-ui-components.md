<!-- Context: ui/premium-dark-ui-components | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Premium Dark UI - Core Components

The 4 building blocks for premium dark UI.

---

## A. Section Wrapper

```tsx
// PremiumSection.tsx
export function PremiumSection({ children, withGlow = true }) {
  return (
    <section className="relative py-24 px-4 bg-[#0a0f0d] overflow-hidden">
      {withGlow && (
        <div 
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(128, 204, 165, 0.15) 0%, transparent 70%)',
            opacity: 0.15
          }}
        />
      )}
      <div className="max-w-7xl mx-auto relative z-10">
        {children}
      </div>
    </section>
  )
}
```

---

## B. Glass Card

```tsx
// PremiumCard.tsx
export function PremiumCard({ children, className = "" }) {
  return (
    <div className={`
      p-8 rounded-2xl 
      bg-white/[0.02] 
      border border-white/10 
      backdrop-blur-xl 
      shadow-2xl 
      transition-all duration-300
      hover:bg-white/[0.04] 
      hover:border-[#80cca5]/30
      ${className}
    `}>
      {children}
    </div>
  )
}
```

---

## C. Heading

```tsx
// PremiumHeading.tsx
export function PremiumHeading({ children, accent, as: Tag = 'h2' }) {
  return (
    <Tag className="text-3xl md:text-5xl font-bold text-white mb-6">
      {children}
      {accent && <span className="text-[#80cca5]"> {accent}</span>}
    </Tag>
  )
}
```

---

## D. Radial Glow

```tsx
// RadialGlow.tsx
export function RadialGlow({ className = "" }) {
  return (
    <div 
      className={`absolute -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none ${className}`}
      style={{
        background: 'radial-gradient(circle, rgba(128, 204, 165, 0.15) 0%, transparent 70%)',
        opacity: 0.15
      }}
    />
  )
}
```

---

## Glassmorphism Rules

✅ **DO**:
- Use `bg-white/[0.02]` for card backgrounds
- Add `backdrop-blur-xl` for blur effect
- Use `border-white/10` for subtle borders
- Keep opacity LOW (0.02 to 0.04)
- Layer multiple glass surfaces

❌ **DON'T**:
- Use high opacity (breaks glass effect)
- Skip backdrop blur (looks flat)
- Use on light backgrounds (invisible)
- Overuse (reserve for cards/panels)

---

## Radial Glow Usage

### When to Use:
- ✅ Hero sections (large, centered)
- ✅ Important CTAs (behind forms)
- ✅ Section breaks (corner glows)
- ❌ Every section (overwhelming)
- ❌ Small components (too subtle)

### Sizes:
- **Small**: 400px (subtle accent)
- **Medium**: 600px (default)
- **Large**: 800px (hero sections)

### Positioning:
```tsx
// Centered
<RadialGlow className="top-1/2 left-1/2" />

// Top-left
<RadialGlow className="top-0 left-0" />

// Bottom-right
<RadialGlow className="bottom-0 right-0" />
```

---

## Related Files

- [Colors & Typography](./premium-dark-ui-colors.md)
- [Layouts](./premium-dark-ui-layouts.md)
- [Advanced](./premium-dark-ui-advanced.md)
