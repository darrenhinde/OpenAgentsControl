<!-- Context: ui/premium-dark-ui-layouts | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Premium Dark UI - Layouts

Common layout patterns for premium dark UI.

---

## Hero Section

```tsx
<PremiumSection>
  <div className="max-w-4xl mx-auto text-center">
    <PremiumHeading as="h1" accent="AI">
      Build Production
    </PremiumHeading>
    <p className="text-xl text-slate-300 mb-8">
      Your subtitle goes here
    </p>
    <button className="px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all shadow-lg">
      Get Started
    </button>
  </div>
</PremiumSection>
```

---

## Feature Grid

```tsx
<PremiumSection>
  <div className="text-center mb-16">
    <PremiumHeading accent="Features">
      Powerful
    </PremiumHeading>
  </div>
  <div className="grid md:grid-cols-3 gap-8">
    {features.map((feature) => (
      <PremiumCard key={feature.id}>
        <Icon className="size-12 text-[#80cca5] mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">
          {feature.title}
        </h3>
        <p className="text-slate-300">
          {feature.description}
        </p>
      </PremiumCard>
    ))}
  </div>
</PremiumSection>
```

---

## CTA Section

```tsx
<PremiumSection>
  <div className="max-w-3xl mx-auto">
    <div className="text-center mb-12">
      <PremiumHeading accent="Started">
        Get
      </PremiumHeading>
      <p className="text-xl text-slate-300">
        Join thousands of users
      </p>
    </div>
    <PremiumCard className="p-8 md:p-12">
      <form className="space-y-6">
        <input 
          type="email"
          placeholder="you@example.com"
          className="w-full px-4 py-3 rounded-lg border border-[#80cca5]/20 bg-slate-900/50 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-[#80cca5] focus:border-transparent"
        />
        <button className="w-full px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold transition-all">
          Sign Up
        </button>
      </form>
    </PremiumCard>
  </div>
</PremiumSection>
```

---

## Responsive Design

```tsx
// Mobile: Stack, Desktop: Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
  {/* Items */}
</div>

// Mobile: Full width, Desktop: Constrained
<div className="w-full lg:max-w-4xl mx-auto">
  {/* Content */}
</div>

// Mobile: Small text, Desktop: Large text
<h2 className="text-3xl md:text-5xl">
  Responsive Heading
</h2>

// Mobile: Center, Desktop: Left
<div className="text-center lg:text-left">
  {/* Content */}
</div>
```

**Breakpoints**:
- `sm`: 640px (tablets)
- `md`: 768px (tablets/small laptops)
- `lg`: 1024px (laptops)
- `xl`: 1280px (desktops)

---

## Starter Template

```tsx
export default function Page() {
  return (
    <div className="min-h-screen bg-[#0a0f0d]">
      {/* Hero */}
      <PremiumSection>
        <div className="max-w-4xl mx-auto text-center">
          <PremiumHeading as="h1" accent="Premium">
            Your
          </PremiumHeading>
          <p className="text-xl text-slate-300 mb-8">Subtitle here</p>
          <button className="px-8 py-4 rounded-full bg-[#80cca5] hover:bg-[#6bb890] text-white font-semibold">
            Get Started
          </button>
        </div>
      </PremiumSection>

      {/* Features */}
      <PremiumSection>
        <div className="text-center mb-16">
          <PremiumHeading accent="Features">Amazing</PremiumHeading>
        </div>
        <div className="grid md:grid-cols-3 gap-8">
          <PremiumCard>
            <h3 className="text-xl font-bold text-white mb-2">Feature 1</h3>
            <p className="text-slate-300">Description</p>
          </PremiumCard>
          {/* More cards */}
        </div>
      </PremiumSection>

      {/* CTA */}
      <PremiumSection>
        <div className="max-w-3xl mx-auto text-center">
          <PremiumHeading accent="Started">Get</PremiumHeading>
          <PremiumCard className="p-8 md:p-12">
            <form className="space-y-6">
              <input type="email" placeholder="you@example.com" className="w-full px-4 py-3 rounded-lg border border-[#80cca5]/20 bg-slate-900/50 text-white" />
              <button className="w-full px-8 py-4 rounded-full bg-[#80cca5] text-white font-semibold">Sign Up</button>
            </form>
          </PremiumCard>
        </div>
      </PremiumSection>
    </div>
  )
}
```

---

## Related Files

- [Colors & Typography](./premium-dark-ui-colors.md)
- [Components](./premium-dark-ui-components.md)
- [Advanced](./premium-dark-ui-advanced.md)
