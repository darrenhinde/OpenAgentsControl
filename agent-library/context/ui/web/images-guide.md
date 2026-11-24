<!-- Context: ui/web/images | Priority: medium | Version: 1.0 | Updated: 2026-02-05 -->
# Image Guidelines

**Purpose**: Guidelines for placeholder and responsive images

---

## Quick Reference

**Rule**: NEVER make up image URLs. Always use known placeholder services.

| Service | Best For | URL Pattern |
|---------|----------|-------------|
| Unsplash | Real photos | `source.unsplash.com/random/WxH/?category` |
| Placehold.co | Simple placeholders | `placehold.co/WxH` |
| Picsum | Random photos | `picsum.photos/W/H` |

---

## Unsplash (Recommended)

### Random Images
```html
<img src="https://source.unsplash.com/random/1200x800" alt="Random">
<img src="https://source.unsplash.com/random/1200x800/?nature" alt="Nature">
<img src="https://source.unsplash.com/random/1200x800/?technology" alt="Tech">
```

### Categories
- nature, landscape, mountains, ocean, forest
- technology, computer, code, workspace
- people, portrait, business, team
- food, coffee, restaurant
- architecture, building, interior
- travel, city, street
- abstract, pattern, texture

### Specific Images
```html
<img src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4" alt="Mountain">
```

---

## Placehold.co

```html
<!-- Basic -->
<img src="https://placehold.co/800x600" alt="Placeholder">

<!-- Custom colors -->
<img src="https://placehold.co/800x600/EEE/31343C" alt="Placeholder">

<!-- With text -->
<img src="https://placehold.co/800x600?text=Product+Image" alt="Product">

<!-- Formats -->
<img src="https://placehold.co/800x600.webp" alt="WebP">
```

---

## Picsum Photos

```html
<img src="https://picsum.photos/800/600" alt="Random">
<img src="https://picsum.photos/id/237/800/600" alt="Specific">
<img src="https://picsum.photos/800/600?grayscale" alt="Grayscale">
<img src="https://picsum.photos/800/600?blur=2" alt="Blurred">
```

---

## Responsive Images

```html
<!-- srcset -->
<img 
  src="https://source.unsplash.com/random/800x600/?nature" 
  srcset="
    https://source.unsplash.com/random/400x300/?nature 400w,
    https://source.unsplash.com/random/800x600/?nature 800w,
    https://source.unsplash.com/random/1200x900/?nature 1200w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Nature"
  loading="lazy"
>

<!-- Picture element -->
<picture>
  <source srcset="url-1200" media="(min-width: 1024px)">
  <source srcset="url-800" media="(min-width: 768px)">
  <img src="url-400" alt="Responsive" loading="lazy">
</picture>

<!-- Background -->
<div 
  class="bg-cover bg-center"
  style="background-image: url('https://source.unsplash.com/random/1200x800/?workspace')"
  role="img"
  aria-label="Workspace"
></div>
```

---

## Optimization

```html
<!-- Lazy loading -->
<img src="image.jpg" loading="lazy" alt="Description">

<!-- Modern formats with fallback -->
<picture>
  <source srcset="image.webp" type="image/webp">
  <img src="image.jpg" alt="Description">
</picture>
```

---

## Related

- `icons-guide.md` - Icon systems
- `fonts-guide.md` - Font loading
- `cdn-resources.md` - CDN libraries
