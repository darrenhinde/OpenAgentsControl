<!-- Context: ui/web/cdn | Priority: medium | Version: 1.0 | Updated: 2026-02-05 -->
# CDN Resources

**Purpose**: Common CDN libraries for frontend development

---

## CSS Frameworks

### Tailwind CSS
```html
<script src="https://cdn.tailwindcss.com"></script>
```

### Flowbite
```html
<link href="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>
```

### Bootstrap
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
```

---

## JavaScript Libraries

### Alpine.js
```html
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

### HTMX
```html
<script src="https://unpkg.com/htmx.org@1.9.10"></script>
```

### Chart.js
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

---

## Animation Libraries

### Animate.css
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">
```

### AOS (Animate On Scroll)
```html
<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
```

---

## Video Placeholders

```html
<!-- Sample video -->
<video class="w-full rounded-lg" controls>
  <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
</video>

<!-- Background video -->
<video class="w-full h-screen object-cover" autoplay muted loop playsinline>
  <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" type="video/mp4">
</video>
```

---

## Best Practices

### Version Pinning
```html
<!-- Good: Specific version -->
<script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js"></script>

<!-- Risky: Latest version -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

### Integrity Hashes
```html
<script 
  src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js" 
  integrity="sha384-..." 
  crossorigin="anonymous"
></script>
```

---

## File Naming Conventions

**Design Files:**
- Initial: `{name}_1.html` (e.g., `table_1.html`)
- Iterations: `{name}_1_1.html`, `{name}_1_2.html`
- Themes: `theme_1.css`, `theme_2.css`

**Asset Files:**
- Images: `hero-image.jpg`, `product-1.png`
- Icons: `logo.svg`, `icon-menu.svg`
- Fonts: `inter-var.woff2`

---

## Project Structure

```
design_iterations/
├── theme_1.css
├── ui_1.html
├── ui_1_1.html (iteration)
├── dashboard_1.html
└── assets/
    ├── images/
    ├── icons/
    └── fonts/
```

---

## Accessibility Checklist

**Images:**
- [ ] All images have alt text
- [ ] Decorative images have `alt=""` and `role="presentation"`
- [ ] Complex images have figcaption

**Icons:**
- [ ] Icon-only buttons have `aria-label`
- [ ] Decorative icons have `aria-hidden="true"`
- [ ] Icons with text are hidden from screen readers

---

## Related

- `images-guide.md` - Image guidelines
- `icons-guide.md` - Icon systems
- `fonts-guide.md` - Font loading
