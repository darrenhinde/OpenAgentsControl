<!-- Context: ui/web/icons | Priority: medium | Version: 1.0 | Updated: 2026-02-05 -->
# Icon Systems

**Purpose**: Guidelines for using icon libraries

---

## Quick Reference

| Library | Loading | Recommended For |
|---------|---------|-----------------|
| Lucide | CDN script | Default choice |
| Heroicons | Inline SVG | Tailwind projects |
| Font Awesome | CDN CSS | Brand icons |

---

## Lucide Icons (Recommended Default)

### Loading
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
<!-- Or specific version -->
<script src="https://unpkg.com/lucide@0.294.0/dist/umd/lucide.min.js"></script>
```

### Usage
```html
<i data-lucide="home"></i>
<i data-lucide="user"></i>
<i data-lucide="settings"></i>
<i data-lucide="heart" class="w-6 h-6 text-red-500"></i>

<script>lucide.createIcons();</script>
```

### Common Icons
```
Navigation: home, menu, x, chevron-down, arrow-left, arrow-right
User: user, user-plus, users, user-check
Actions: edit, trash, save, download, upload, share, copy
Communication: mail, message-circle, phone, send
Media: image, video, music, file, folder
UI: search, settings, bell, heart, star, bookmark
Status: check, x, alert-circle, info, help-circle
```

---

## Heroicons

### Usage (Inline SVG)
```html
<!-- Outline (24x24) -->
<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3..." />
</svg>

<!-- Solid (20x20) -->
<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7..." />
</svg>
```

---

## Font Awesome

### Loading
```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

### Usage
```html
<!-- Solid -->
<i class="fas fa-home"></i>
<i class="fas fa-user"></i>

<!-- Regular -->
<i class="far fa-heart"></i>

<!-- Brands -->
<i class="fab fa-github"></i>
<i class="fab fa-twitter"></i>

<!-- Sizing -->
<i class="fas fa-home fa-2x"></i>
```

---

## Accessibility Best Practices

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

<!-- Decorative icon -->
<div>
  <i data-lucide="star" aria-hidden="true"></i>
  <span>Featured</span>
</div>

<!-- Screen reader text -->
<button>
  <i data-lucide="search" aria-hidden="true"></i>
  <span class="sr-only">Search</span>
</button>
```

---

## Custom SVG

```html
<!-- Custom icon -->
<svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
    d="M12 4v16m8-8H4" />
</svg>

<!-- Logo -->
<svg class="h-8 w-auto" viewBox="0 0 100 40" fill="currentColor">
  <path d="M10 10h80v20H10z" />
</svg>
```

---

## Related

- `images-guide.md` - Image guidelines
- `fonts-guide.md` - Font loading
- `cdn-resources.md` - CDN libraries
