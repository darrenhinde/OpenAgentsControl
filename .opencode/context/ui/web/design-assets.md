<!-- Context: development/design-assets | Priority: medium | Version: 1.0 | Updated: 2025-12-09 -->
# Design Assets

## Overview

Guidelines for images, icons, fonts, and other design assets in frontend development. Focus on using reliable CDN sources and placeholder services.

## Quick Reference

**Images**: Unsplash, placehold.co (never make up URLs)
**Icons**: Lucide (default), Heroicons, Font Awesome
**Fonts**: Google Fonts
**CDN**: Use established CDN services only

---

## Image Guidelines

### Placeholder Images

**Rule**: NEVER make up image URLs. Always use known placeholder services.

#### Unsplash (Recommended)

**Random Images**:
```html
<!-- Random image (1200x800) -->
<img src="https://source.unsplash.com/random/1200x800" alt="Random image">

<!-- Random image with category -->
<img src="https://source.unsplash.com/random/1200x800/?nature" alt="Nature image">
<img src="https://source.unsplash.com/random/1200x800/?technology" alt="Technology image">
<img src="https://source.unsplash.com/random/1200x800/?people" alt="People image">
```

**Categories Available**:
- nature, landscape, mountains, ocean, forest
- technology, computer, code, workspace
- people, portrait, business, team
- food, coffee, restaurant
- architecture, building, interior
- travel, city, street
- abstract, pattern, texture

**Specific Images**:
```html
<!-- Use photo ID for consistency -->
<img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4" alt="Mountain landscape">
```

#### Placehold.co

**Simple Placeholders**:
```html
<!-- Basic placeholder (800x600) -->
<img src="https://placehold.co/800x600" alt="Placeholder">

<!-- With custom colors (background/text) -->
<img src="https://placehold.co/800x600/EEE/31343C" alt="Placeholder">

<!-- With text -->
<img src="https://placehold.co/800x600?text=Product+Image" alt="Product placeholder">

<!-- Different formats -->
<img src="https://placehold.co/800x600.png" alt="PNG placeholder">
<img src="https://placehold.co/800x600.jpg" alt="JPG placeholder">
<img src="https://placehold.co/800x600.webp" alt="WebP placeholder">
```

#### Picsum Photos

**Random Photos**:
```html
<!-- Random photo (800x600) -->
<img src="https://picsum.photos/800/600" alt="Random photo">

<!-- Specific photo by ID -->
<img src="https://picsum.photos/id/237/800/600" alt="Specific photo">

<!-- Grayscale -->
<img src="https://picsum.photos/800/600?grayscale" alt="Grayscale photo">

<!-- Blur effect -->
<img src="https://picsum.photos/800/600?blur=2" alt="Blurred photo">
```

### Image Best Practices

```html
<!-- Responsive image with srcset -->
<img 
  src="https://source.unsplash.com/random/800x600/?nature" 
  srcset="
    https://source.unsplash.com/random/400x300/?nature 400w,
    https://source.unsplash.com/random/800x600/?nature 800w,
    https://source.unsplash.com/random/1200x900/?nature 1200w
  "
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  alt="Nature landscape"
  loading="lazy"
>

<!-- Background image with object-fit -->
<div 
  class="w-full h-64 bg-cover bg-center rounded-lg"
  style="background-image: url('https://source.unsplash.com/random/1200x800/?workspace')"
  role="img"
  aria-label="Workspace background"
></div>

<!-- Modern picture element -->
<picture>
  <source 
    srcset="https://source.unsplash.com/random/1200x800/?nature" 
    media="(min-width: 1024px)"
  >
  <source 
    srcset="https://source.unsplash.com/random/800x600/?nature" 
    media="(min-width: 768px)"
  >
  <img 
    src="https://source.unsplash.com/random/400x300/?nature" 
    alt="Responsive nature image"
    loading="lazy"
  >
</picture>
```

---

## Icon Systems

### Lucide Icons (Recommended Default)

**Loading**:
```html
<!-- Load Lucide from CDN -->
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>

<!-- Or specific version -->
<script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js"></script>
```

**Usage**:
```html
<!-- Icon elements -->
<i data-lucide="home"></i>
<i data-lucide="user"></i>
<i data-lucide="settings"></i>
<i data-lucide="search"></i>
<i data-lucide="menu"></i>
<i data-lucide="x"></i>
<i data-lucide="chevron-down"></i>
<i data-lucide="arrow-right"></i>

<!-- With custom size and color -->
<i data-lucide="heart" class="w-6 h-6 text-red-500"></i>

<!-- Initialize icons -->
<script>
  lucide.createIcons();
</script>
```

**Common Icons**:
```
Navigation: home, menu, x, chevron-down, chevron-up, arrow-left, arrow-right
User: user, user-plus, users, user-check, user-x
Actions: edit, trash, save, download, upload, share, copy
Communication: mail, message-circle, phone, send
Media: image, video, music, file, folder
UI: search, settings, bell, heart, star, bookmark
Status: check, x, alert-circle, info, help-circle
```

### Heroicons

**Loading**:
```html
<!-- Heroicons via CDN (inline SVG) -->
<!-- Use individual icon imports or copy SVG code -->
```

**Usage**:
```html
<!-- Outline style (24x24) -->
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
</svg>

<!-- Solid style (20x20) -->
<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
</svg>
```

### Font Awesome

**Loading**:
```html
<!-- Font Awesome Free CDN -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

**Usage**:
```html
<!-- Solid icons -->
<i class="fas fa-home"></i>
<i class="fas fa-user"></i>
<i class="fas fa-cog"></i>

<!-- Regular icons -->
<i class="far fa-heart"></i>
<i class="far fa-star"></i>

<!-- Brands -->
<i class="fab fa-github"></i>
<i class="fab fa-twitter"></i>
<i class="fab fa-linkedin"></i>

<!-- With sizing -->
<i class="fas fa-home fa-2x"></i>
<i class="fas fa-user fa-3x"></i>
```

### Icon Best Practices

```html
<!-- Always provide accessible labels -->
<button aria-label="Close menu">
  <i data-lucide="x"></i>
</button>

<!-- Use semantic HTML with icons -->
<a href="#" class="flex items-center gap-2">
  <i data-lucide="external-link" class="w-4 h-4"></i>
  <span>Visit website</span>
</a>

<!-- Icon-only buttons need labels -->
<button aria-label="Search" class="p-2">
  <i data-lucide="search" class="w-5 h-5"></i>
</button>

<!-- Decorative icons should be hidden from screen readers -->
<div>
  <i data-lucide="star" aria-hidden="true"></i>
  <span>Featured</span>
</div>
```

---

## Font Loading

### Google Fonts (Recommended)

**Loading**:
```html
<!-- Preconnect for performance -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<!-- Load font families -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

<!-- Multiple fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

**Usage**:
```css
body {
  font-family: 'Inter', sans-serif;
}

code, pre {
  font-family: 'JetBrains Mono', monospace;
}
```

**Popular Font Combinations**:

```html
<!-- Modern UI: Inter + JetBrains Mono -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- Professional: Roboto + Roboto Mono -->
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">

<!-- Editorial: Playfair Display + Source Sans Pro -->
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">

<!-- Friendly: Poppins + Space Mono -->
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

### Font Loading Strategies

```html
<!-- Optimal loading with font-display -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" rel="stylesheet">

<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>

<!-- Self-hosted fonts -->
<style>
  @font-face {
    font-family: 'Inter';
    src: url('/fonts/inter-var.woff2') format('woff2');
    font-weight: 100 900;
    font-display: swap;
  }
</style>
```

---

## CDN Resources

### CSS Frameworks

```html
<!-- Tailwind CSS -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Flowbite -->
<link href="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/flowbite@2.0.0/dist/flowbite.min.js"></script>

<!-- Bootstrap -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
```

### JavaScript Libraries

```html
<!-- Alpine.js -->
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>

<!-- HTMX -->
<script src="https://unpkg.com/htmx.org@1.9.10"></script>

<!-- Chart.js -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

### Utility Libraries

```html
<!-- Animate.css -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css">

<!-- AOS (Animate On Scroll) -->
<link href="https://unpkg.com/aos@2.3.1/dist/aos.css" rel="stylesheet">
<script src="https://unpkg.com/aos@2.3.1/dist/aos.js"></script>
```

---

## SVG Assets

### Inline SVG

```html
<!-- Custom icon -->
<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
</svg>

<!-- Logo -->
<svg class="h-8 w-auto" viewBox="0 0 100 40" fill="currentColor">
  <path d="M10 10h80v20H10z" />
</svg>
```

### SVG Backgrounds

```html
<!-- Pattern background -->
<div class="w-full h-64" style="background-image: url('data:image/svg+xml,<svg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 80 80&quot;><path fill=&quot;%23f0f0f0&quot; d=&quot;M0 0h80v80H0z&quot;/><path fill=&quot;%23e0e0e0&quot; d=&quot;M0 0h40v40H0zm40 40h40v40H40z&quot;/></svg>')"></div>
```

---

## Video Assets

### Placeholder Videos

```html
<!-- Sample video from CDN -->
<video class="w-full rounded-lg" controls>
  <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

<!-- Background video -->
<video class="w-full h-screen object-cover" autoplay muted loop playsinline>
  <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4" type="video/mp4">
</video>
```

---

## Asset Organization

### File Structure

```
design_iterations/
├── theme_1.css
├── ui_1.html
├── ui_1_1.html (iteration)
├── ui_1_2.html (iteration)
├── dashboard_1.html
└── assets/
    ├── images/
    ├── icons/
    └── fonts/
```

### Naming Conventions

**Design Files**:
- Initial: `{design_name}_1.html` (e.g., `table_1.html`)
- Iterations: `{design_name}_1_1.html`, `{design_name}_1_2.html`
- Theme files: `theme_1.css`, `theme_2.css`

**Asset Files**:
- Images: `hero-image.jpg`, `product-1.png`
- Icons: `logo.svg`, `icon-menu.svg`
- Fonts: `inter-var.woff2`, `jetbrains-mono.woff2`

---

## Performance Optimization

### Image Optimization

```html
<!-- Lazy loading -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- Modern formats with fallback -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <source srcset="image.jpg" type="image/jpeg">
  <img src="image.jpg" alt="Description">
</picture>

<!-- Responsive images -->
<img 
  srcset="image-400.jpg 400w, image-800.jpg 800w, image-1200.jpg 1200w"
  sizes="(max-width: 768px) 100vw, 50vw"
  src="image-800.jpg"
  alt="Description"
>
```

### Font Optimization

```html
<!-- Subset fonts (only load needed characters) -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&display=swap" rel="stylesheet">

<!-- Preload critical fonts -->
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin>
```

### CDN Best Practices

```html
<!-- Use integrity hashes for security -->
<script 
  src="https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js" 
  integrity="sha384-..." 
  crossorigin="anonymous"
></script>

<!-- Specify versions to avoid breaking changes -->
<script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js"></script>
```

---

## Best Practices

### Do's ✅

- Use established placeholder services (Unsplash, placehold.co)
- Always provide alt text for images
- Use Lucide as default icon library
- Load fonts from Google Fonts
- Use lazy loading for images
- Provide responsive image srcsets
- Use semantic SVG with accessible labels
- Specify CDN versions for stability
- Optimize images before deployment
- Use modern image formats (WebP, AVIF)

### Don'ts ❌

- Don't make up image URLs
- Don't use images without alt text
- Don't load unnecessary icon libraries
- Don't use too many font families (2-3 max)
- Don't skip lazy loading
- Don't use unoptimized images
- Don't forget ARIA labels for icon buttons
- Don't use latest CDN versions in production
- Don't load fonts synchronously
- Don't use decorative images in content

---

## Accessibility

### Image Accessibility

```html
<!-- Informative image -->
<img src="chart.png" alt="Sales increased 25% in Q4 2024">

<!-- Decorative image -->
<img src="decoration.png" alt="" role="presentation">

<!-- Complex image with description -->
<figure>
  <img src="diagram.png" alt="System architecture diagram">
  <figcaption>
    The diagram shows three layers: frontend, API, and database.
  </figcaption>
</figure>
```

### Icon Accessibility

```html
<!-- Icon with visible text -->
<button class="flex items-center gap-2">
  <i data-lucide="trash" aria-hidden="true"></i>
  <span>Delete</span>
</button>

<!-- Icon-only button -->
<button aria-label="Delete item">
  <i data-lucide="trash"></i>
</button>

<!-- Icon with screen reader text -->
<button>
  <i data-lucide="search" aria-hidden="true"></i>
  <span class="sr-only">Search</span>
</button>
```

---

## References

- [Unsplash Source](https://source.unsplash.com/)
- [Placehold.co](https://placehold.co/)
- [Lucide Icons](https://lucide.dev/)
- [Google Fonts](https://fonts.google.com/)
- [Web.dev Image Optimization](https://web.dev/fast/#optimize-your-images)
