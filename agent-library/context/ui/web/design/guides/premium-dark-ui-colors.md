<!-- Context: ui/premium-dark-ui-colors | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Premium Dark UI - Colors & Typography

Quick reference for colors, spacing, and typography in premium dark UI.

---

## Color Palette

```css
/* Backgrounds */
--bg-deep-dark: #0a0f0d;      /* Main background */
--bg-black: #000000;           /* Alternate sections */

/* Text */
--text-heading: #ffffff;       /* Headings */
--text-body: #cbd5e1;          /* Body (slate-300) */
--text-muted: #94a3b8;         /* Muted (slate-400) */

/* Accent */
--accent: #80cca5;             /* Green - CTAs, links, highlights */
--accent-hover: #6bb890;       /* Hover state */

/* Glass */
--glass-bg: rgba(255, 255, 255, 0.02);
--glass-border: rgba(255, 255, 255, 0.1);
```

**Rule**: Use ONLY these colors. No exceptions.

---

## Spacing System

```css
/* Use these values ONLY */
py-4   /* 16px - Small spacing */
py-8   /* 32px - Medium spacing */
py-12  /* 48px - Large spacing */
py-24  /* 96px - Section spacing */

px-4   /* 16px - Mobile padding */
px-8   /* 32px - Card padding */
px-12  /* 48px - Large card padding */

gap-4  /* 16px - Small gaps */
gap-8  /* 32px - Medium gaps */
gap-12 /* 48px - Large gaps */

mb-4   /* 16px - Small margin bottom */
mb-6   /* 24px - Medium margin bottom */
mb-8   /* 32px - Large margin bottom */
mb-16  /* 64px - Section margin bottom */
```

**Rule**: Stick to multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64, 96).

---

## Typography Scale

```tsx
// Page Title (H1)
<h1 className="text-4xl md:text-6xl font-bold text-white mb-8">
  Page Title
</h1>

// Section Title (H2)
<h2 className="text-3xl md:text-5xl font-bold text-white mb-6">
  Section Title <span className="text-[#80cca5]">Accent</span>
</h2>

// Subsection (H3)
<h3 className="text-2xl md:text-4xl font-bold text-white mb-4">
  Subsection
</h3>

// Body Text
<p className="text-lg text-slate-300 mb-4">
  Body text goes here
</p>

// Muted Text
<p className="text-sm text-slate-400">
  Secondary information
</p>

// Accent Text
<p className="text-lg font-semibold text-[#80cca5]">
  Call to action text
</p>
```

---

## Buttons & Links

```tsx
// Primary CTA Button
<button className="
  px-8 py-4 
  rounded-full 
  bg-[#80cca5] 
  hover:bg-[#6bb890] 
  text-white 
  font-semibold 
  transition-all 
  shadow-lg 
  hover:shadow-xl
">
  Primary Action
</button>

// Secondary Button
<button className="
  px-6 py-3 
  rounded-full 
  bg-white/[0.02] 
  border border-white/10 
  hover:border-[#80cca5]/30 
  text-white 
  font-medium 
  transition-all
">
  Secondary Action
</button>

// Link
<a href="#" className="text-[#80cca5] hover:text-[#6bb890] transition-colors">
  Link Text
</a>
```

---

## Form Inputs

```tsx
// Text Input
<input 
  type="text"
  className="
    w-full px-4 py-3 rounded-lg 
    border border-[#80cca5]/20 
    bg-slate-900/50 
    text-white 
    placeholder:text-slate-500 
    focus:ring-2 focus:ring-[#80cca5] focus:border-transparent
  "
  placeholder="Enter text"
/>

// Label
<label className="text-slate-200 font-medium mb-2 block">
  Field Label
</label>
```

---

## Related Files

- [Components](./premium-dark-ui-components.md)
- [Layouts](./premium-dark-ui-layouts.md)
- [Advanced](./premium-dark-ui-advanced.md)
