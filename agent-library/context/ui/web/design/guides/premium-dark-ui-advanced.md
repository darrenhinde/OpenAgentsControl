<!-- Context: ui/premium-dark-ui-advanced | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Premium Dark UI - Advanced

Animations, accessibility, and checklists for premium dark UI.

---

## Animations

### Hover Effects

```tsx
// Card hover
<div className="transition-all duration-300 hover:scale-[1.02]">
  Card content
</div>

// Button hover
<button className="transition-colors duration-200 hover:bg-[#6bb890]">
  Button
</button>

// Image hover
<img className="transition-transform duration-700 hover:scale-105" />
```

### Scroll Reveal

```tsx
// npm install react-intersection-observer
import { useInView } from 'react-intersection-observer'

function Component() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  
  return (
    <div 
      ref={ref}
      className={`transition-all duration-700 ${
        inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}
    >
      Content
    </div>
  )
}
```

---

## Accessibility

### Color Contrast

- White on `#0a0f0d`: 21:1 (AAA) ✅
- `slate-300` on `#0a0f0d`: 12.6:1 (AAA) ✅
- `#80cca5` on `#0a0f0d`: 7.8:1 (AAA) ✅

### Focus States

```tsx
<button className="focus:ring-2 focus:ring-[#80cca5] focus:outline-none">
  Button
</button>
```

### Semantic HTML

```tsx
<nav>
  <ul>
    <li><a href="#">Link</a></li>
  </ul>
</nav>
```

---

## Quick Wins (Instant Premium Feel)

1. Replace all backgrounds with `#0a0f0d`
2. Use only white and slate-300 for text
3. Make all CTAs `#80cca5` green
4. Add backdrop-blur-xl to all cards
5. Use rounded-2xl for cards, rounded-full for buttons
6. Add one radial glow to hero section
7. Increase padding (py-24 for sections, p-8 for cards)
8. Add hover effects to all interactive elements

---

## Common Mistakes

❌ **DON'T**:
- Use light backgrounds (`bg-white`, `bg-slate-100`)
- Use `dark:` variants (this is dark-only)
- Mix multiple accent colors
- Use high-opacity glass (`bg-white/50`)
- Skip backdrop blur on glass elements
- Use small padding (looks cramped)
- Forget hover states
- Ignore mobile layout

✅ **DO**:
- Stick to the color palette
- Use consistent spacing (multiples of 4)
- Add subtle animations
- Test on mobile first
- Keep glass opacity low
- Use radial glows sparingly
- Maintain high contrast for text

---

## Final Checklist

Before launching, verify:

- [ ] All backgrounds are `#0a0f0d` or `black`
- [ ] All headings are `text-white`
- [ ] All body text is `text-slate-300`
- [ ] All CTAs are `#80cca5` green
- [ ] All cards have `backdrop-blur-xl`
- [ ] All cards use `bg-white/[0.02]`
- [ ] All buttons have hover states
- [ ] All forms have focus states
- [ ] Spacing uses multiples of 4
- [ ] Mobile layout tested
- [ ] Radial glows are subtle (not overwhelming)
- [ ] No light mode variants (`dark:`)
- [ ] Contrast ratios meet WCAG AA minimum

---

**Time to premium**: 30-60 minutes
**Maintenance**: Easy (4 components, 1 color palette)
**Scalability**: High (reusable components)

---

## Related Files

- [Colors & Typography](./premium-dark-ui-colors.md)
- [Components](./premium-dark-ui-components.md)
- [Layouts](./premium-dark-ui-layouts.md)
- [Visual Reference](./premium-dark-ui-visual-reference.md)
