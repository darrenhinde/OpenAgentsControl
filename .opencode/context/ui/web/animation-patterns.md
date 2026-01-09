<!-- Context: development/animation-patterns | Priority: high | Version: 1.0 | Updated: 2025-12-09 -->
# Animation Patterns

## Overview

Standards and patterns for UI animations, micro-interactions, and transitions. Animations should feel natural, purposeful, and enhance user experience without causing distraction.

## Quick Reference

**Timing**: 150-400ms for most interactions
**Easing**: ease-out for entrances, ease-in for exits
**Purpose**: Every animation should have a clear purpose
**Performance**: Use transform and opacity for 60fps

---

## Animation Micro-Syntax

### Notation Guide

**Format**: `element: duration easing [properties] modifiers`

**Symbols**:
- `→` = transition from → to
- `±` = oscillate/shake
- `↗` = increase
- `↘` = decrease
- `∞` = infinite loop
- `×N` = repeat N times
- `+Nms` = delay N milliseconds

**Properties**:
- `Y` = translateY
- `X` = translateX
- `S` = scale
- `R` = rotate
- `α` = opacity
- `bg` = background

**Example**: `button: 200ms ease-out [S1→1.05, α0.8→1]`
- Button scales from 1 to 1.05 and fades from 0.8 to 1 over 200ms with ease-out

---

## Core Animation Principles

### Timing Standards

```
Ultra-fast:  100-150ms  (micro-feedback, hover states)
Fast:        150-250ms  (button clicks, toggles)
Standard:    250-350ms  (modals, dropdowns, navigation)
Moderate:    350-500ms  (page transitions, complex animations)
Slow:        500-800ms  (dramatic reveals, storytelling)
```

### Easing Functions

```css
/* Entrances - start slow, end fast */
ease-out: cubic-bezier(0, 0, 0.2, 1);

/* Exits - start fast, end slow */
ease-in: cubic-bezier(0.4, 0, 1, 1);

/* Both - smooth throughout */
ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

/* Bounce - playful, attention-grabbing */
bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Elastic - spring-like */
elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6);
```

### Performance Guidelines

**60fps Animations** (GPU-accelerated):
- ✅ `transform` (translate, scale, rotate)
- ✅ `opacity`
- ✅ `filter` (with caution)

**Avoid** (causes reflow/repaint):
- ❌ `width`, `height`
- ❌ `top`, `left`, `right`, `bottom`
- ❌ `margin`, `padding`

---

## Common UI Animation Patterns

### Button Interactions

```css
/* Hover - subtle lift */
.button {
  transition: transform 200ms ease-out, box-shadow 200ms ease-out;
}
.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

/* Press - scale down */
.button:active {
  transform: scale(0.95);
  transition: transform 100ms ease-in;
}

/* Ripple effect */
@keyframes ripple {
  from {
    transform: scale(0);
    opacity: 1;
  }
  to {
    transform: scale(2);
    opacity: 0;
  }
}
.button::after {
  animation: ripple 400ms ease-out;
}
```

**Micro-syntax**:
```
buttonHover: 200ms ease-out [Y0→-2, shadow↗]
buttonPress: 100ms ease-in [S1→0.95]
ripple: 400ms ease-out [S0→2, α1→0]
```

### Card Interactions

```css
/* Hover - lift and shadow */
.card {
  transition: transform 300ms ease-out, box-shadow 300ms ease-out;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.15);
}

/* Select - scale and highlight */
.card.selected {
  transform: scale(1.02);
  background-color: var(--accent);
  transition: all 200ms ease-out;
}
```

**Micro-syntax**:
```
cardHover: 300ms ease-out [Y0→-4, shadow↗]
cardSelect: 200ms ease-out [S1→1.02, bg→accent]
```

### Modal/Dialog Animations

```css
/* Backdrop fade in */
.modal-backdrop {
  animation: fadeIn 300ms ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Modal slide up and fade */
.modal {
  animation: slideUp 350ms ease-out;
}
@keyframes slideUp {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Modal exit */
.modal.closing {
  animation: slideDown 250ms ease-in;
}
@keyframes slideDown {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(40px);
    opacity: 0;
  }
}
```

**Micro-syntax**:
```
backdrop: 300ms ease-out [α0→1]
modalEnter: 350ms ease-out [Y+40→0, α0→1]
modalExit: 250ms ease-in [Y0→+40, α1→0]
```

### Dropdown/Menu Animations

```css
/* Dropdown slide and fade */
.dropdown {
  animation: dropdownOpen 200ms ease-out;
  transform-origin: top;
}
@keyframes dropdownOpen {
  from {
    transform: scaleY(0.95);
    opacity: 0;
  }
  to {
    transform: scaleY(1);
    opacity: 1;
  }
}
```

**Micro-syntax**:
```
dropdown: 200ms ease-out [scaleY0.95→1, α0→1]
```

### Sidebar/Drawer Animations

```css
/* Sidebar slide in */
.sidebar {
  animation: slideInLeft 350ms ease-out;
}
@keyframes slideInLeft {
  from {
    transform: translateX(-280px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Overlay fade */
.overlay {
  animation: overlayFade 300ms ease-out;
}
@keyframes overlayFade {
  from {
    opacity: 0;
    backdrop-filter: blur(0);
  }
  to {
    opacity: 1;
    backdrop-filter: blur(4px);
  }
}
```

**Micro-syntax**:
```
sidebar: 350ms ease-out [X-280→0, α0→1]
overlay: 300ms ease-out [α0→1, blur0→4px]
```

---

## Message/Chat UI Animations

### Message Entrance

```css
/* User message - slide from right */
.message-user {
  animation: slideInRight 400ms ease-out;
}
@keyframes slideInRight {
  from {
    transform: translateX(10px) translateY(20px);
    opacity: 0;
    scale: 0.9;
  }
  to {
    transform: translateX(0) translateY(0);
    opacity: 1;
    scale: 1;
  }
}

/* AI message - slide from left with bounce */
.message-ai {
  animation: slideInLeft 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
  animation-delay: 200ms;
}
@keyframes slideInLeft {
  from {
    transform: translateY(15px);
    opacity: 0;
    scale: 0.95;
  }
  to {
    transform: translateY(0);
    opacity: 1;
    scale: 1;
  }
}
```

**Micro-syntax**:
```
userMsg: 400ms ease-out [Y+20→0, X+10→0, S0.9→1]
aiMsg: 600ms bounce [Y+15→0, S0.95→1] +200ms
```

### Typing Indicator

```css
/* Typing dots animation */
.typing-indicator span {
  animation: typingDot 1400ms infinite;
}
.typing-indicator span:nth-child(2) {
  animation-delay: 200ms;
}
.typing-indicator span:nth-child(3) {
  animation-delay: 400ms;
}
@keyframes typingDot {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-8px);
    opacity: 1;
  }
}
```

**Micro-syntax**:
```
typing: 1400ms ∞ [Y±8, α0.4→1] stagger+200ms
```

### Status Indicators

```css
/* Online status pulse */
.status-online {
  animation: pulse 2000ms infinite;
}
@keyframes pulse {
  0%, 100% {
    opacity: 1;
    scale: 1;
  }
  50% {
    opacity: 0.6;
    scale: 1.05;
  }
}
```

**Micro-syntax**:
```
status: 2000ms ∞ [α1→0.6→1, S1→1.05→1]
```

---

## Form Input Animations

### Focus States

```css
/* Input focus - ring and scale */
.input {
  transition: all 200ms ease-out;
}
.input:focus {
  transform: scale(1.01);
  box-shadow: 0 0 0 3px var(--ring);
}

/* Input blur - return to normal */
.input:not(:focus) {
  transition: all 150ms ease-in;
}
```

**Micro-syntax**:
```
inputFocus: 200ms ease-out [S1→1.01, shadow+ring]
inputBlur: 150ms ease-in [S1.01→1, shadow-ring]
```

### Validation States

```css
/* Error shake */
.input-error {
  animation: shake 400ms ease-in-out;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

/* Success checkmark */
.input-success::after {
  animation: checkmark 600ms cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
@keyframes checkmark {
  from {
    transform: scale(0) rotate(0deg);
    opacity: 0;
  }
  to {
    transform: scale(1.2) rotate(360deg);
    opacity: 1;
  }
}
```

**Micro-syntax**:
```
error: 400ms ease-in-out [X±5] shake
success: 600ms bounce [S0→1.2, R0→360°, α0→1]
```

---

## Loading States

### Skeleton Screens

```css
/* Skeleton shimmer */
.skeleton {
  animation: shimmer 2000ms infinite;
  background: linear-gradient(
    90deg,
    var(--muted) 0%,
    var(--accent) 50%,
    var(--muted) 100%
  );
  background-size: 200% 100%;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Micro-syntax**:
```
skeleton: 2000ms ∞ [bg: muted↔accent]
```

### Spinners

```css
/* Circular spinner */
.spinner {
  animation: spin 1000ms linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Pulsing dots */
.loading-dots span {
  animation: dotPulse 1500ms infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 200ms; }
.loading-dots span:nth-child(3) { animation-delay: 400ms; }
@keyframes dotPulse {
  0%, 80%, 100% { opacity: 0.3; scale: 0.8; }
  40% { opacity: 1; scale: 1; }
}
```

**Micro-syntax**:
```
spinner: 1000ms ∞ linear [R360°]
dotPulse: 1500ms ∞ [α0.3→1→0.3, S0.8→1→0.8] stagger+200ms
```

### Progress Bars

```css
/* Indeterminate progress */
.progress-bar {
  animation: progress 2000ms ease-in-out infinite;
}
@keyframes progress {
  0% { transform: translateX(-100%); }
  50% { transform: translateX(0); }
  100% { transform: translateX(100%); }
}
```

**Micro-syntax**:
```
progress: 2000ms ∞ ease-in-out [X-100%→0→100%]
```

---

## Scroll Animations

### Scroll-Triggered Fade In

```css
/* Fade in on scroll */
.fade-in-on-scroll {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}
.fade-in-on-scroll.visible {
  opacity: 1;
  transform: translateY(0);
}
```

**Micro-syntax**:
```
scrollFadeIn: 500ms ease-out [Y+40→0, α0→1]
```

### Auto-Scroll

```css
/* Smooth scroll behavior */
html {
  scroll-behavior: smooth;
}

/* Scroll hint animation */
.scroll-hint {
  animation: scrollHint 800ms infinite;
  animation-iteration-count: 3;
}
@keyframes scrollHint {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}
```

**Micro-syntax**:
```
autoScroll: 400ms smooth
scrollHint: 800ms ∞×3 [Y±5]
```

---

## Page Transitions

### Route Changes

```css
/* Page fade out */
.page-exit {
  animation: fadeOut 200ms ease-in;
}
@keyframes fadeOut {
  from { opacity: 1; }
  to { opacity: 0; }
}

/* Page fade in */
.page-enter {
  animation: fadeIn 300ms ease-out;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

**Micro-syntax**:
```
pageExit: 200ms ease-in [α1→0]
pageEnter: 300ms ease-out [α0→1]
```

---

## Micro-Interactions

### Hover Effects

```css
/* Link underline slide */
.link {
  position: relative;
}
.link::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  width: 0;
  height: 2px;
  background: currentColor;
  transition: width 250ms ease-out;
}
.link:hover::after {
  width: 100%;
}
```

**Micro-syntax**:
```
linkHover: 250ms ease-out [width0→100%]
```

### Toggle Switches

```css
/* Toggle slide */
.toggle-switch {
  transition: background-color 200ms ease-out;
}
.toggle-switch .thumb {
  transition: transform 200ms ease-out;
}
.toggle-switch.on .thumb {
  transform: translateX(20px);
}
```

**Micro-syntax**:
```
toggle: 200ms ease-out [X0→20, bg→accent]
```

---

## Animation Recipes

### Chat UI Complete Animation System

```
## Core Message Flow
userMsg: 400ms ease-out [Y+20→0, X+10→0, S0.9→1]
aiMsg: 600ms bounce [Y+15→0, S0.95→1] +200ms
typing: 1400ms ∞ [Y±8, α0.4→1] stagger+200ms
status: 300ms ease-out [α0.6→1, S1→1.05→1]

## Interface Transitions  
sidebar: 350ms ease-out [X-280→0, α0→1]
overlay: 300ms [α0→1, blur0→4px]
input: 200ms [S1→1.01, shadow+ring] focus
input: 150ms [S1.01→1, shadow-ring] blur

## Button Interactions
sendBtn: 150ms [S1→0.95→1, R±2°] press
sendBtn: 200ms [S1→1.05, shadow↗] hover
ripple: 400ms [S0→2, α1→0]

## Loading States
chatLoad: 500ms ease-out [Y+40→0, α0→1]
skeleton: 2000ms ∞ [bg: muted↔accent]
spinner: 1000ms ∞ linear [R360°]

## Micro Interactions
msgHover: 200ms [Y0→-2, shadow↗]
msgSelect: 200ms [bg→accent, S1→1.02]
error: 400ms [X±5] shake
success: 600ms bounce [S0→1.2→1, R360°]

## Scroll & Navigation
autoScroll: 400ms smooth
scrollHint: 800ms ∞×3 [Y±5]
```

---

## Best Practices

### Do's ✅

- Keep animations under 400ms for most interactions
- Use `transform` and `opacity` for 60fps performance
- Provide purpose for every animation
- Use ease-out for entrances, ease-in for exits
- Test on low-end devices
- Respect `prefers-reduced-motion`
- Stagger animations for lists (50-100ms delay)
- Use consistent timing across similar interactions

### Don'ts ❌

- Don't animate width/height (use scale instead)
- Don't use animations longer than 800ms
- Don't animate too many elements at once
- Don't use animations without purpose
- Don't ignore accessibility preferences
- Don't use jarring/distracting animations
- Don't animate on every interaction
- Don't use complex easing for simple interactions

---

## Accessibility

### Reduced Motion

```css
/* Respect user preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Focus Indicators

```css
/* Always animate focus states */
:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 2px;
  transition: outline-offset 150ms ease-out;
}
```

---

## References

- [Web Animation API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)
- [CSS Easing Functions](https://easings.net/)
- [Animation Performance](https://web.dev/animations-guide/)
- [Reduced Motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
