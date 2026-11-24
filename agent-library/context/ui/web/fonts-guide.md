<!-- Context: ui/web/fonts | Priority: medium | Version: 1.0 | Updated: 2026-02-05 -->
# Font Loading

**Purpose**: Guidelines for loading and using web fonts

---

## Quick Reference

**Recommended**: Google Fonts with preconnect

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

---

## Google Fonts (Recommended)

### Basic Loading
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```

### Multiple Fonts
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
```

### CSS Usage
```css
body {
  font-family: 'Inter', sans-serif;
}

code, pre {
  font-family: 'JetBrains Mono', monospace;
}
```

---

## Popular Font Combinations

### Modern UI
```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Professional
```html
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">
```

### Editorial
```html
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=Source+Sans+Pro:wght@400;600&display=swap" rel="stylesheet">
```

### Friendly
```html
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

---

## Performance Optimization

### Subset Fonts
```html
<!-- Only load needed characters -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&text=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789&display=swap" rel="stylesheet">
```

### Preload Critical Fonts
```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```

### Self-Hosted Fonts
```html
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

## Best Practices

**Do ✅:**
- Use `font-display: swap` (included in Google Fonts URL)
- Preconnect to font servers
- Limit to 2-3 font families
- Subset when possible
- Preload critical fonts

**Don't ❌:**
- Load too many font weights
- Use fonts synchronously (blocking)
- Load fonts you don't need

---

## Related

- `images-guide.md` - Image guidelines
- `icons-guide.md` - Icon systems
- `cdn-resources.md` - CDN libraries
