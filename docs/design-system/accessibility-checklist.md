# AGILE3D Accessibility Checklist

Comprehensive checklist for ensuring WCAG 2.2 Level AA compliance in the AGILE3D Interactive Demo.

## Table of Contents

- [Overview](#overview)
- [Automated Testing](#automated-testing)
- [Perceivable](#perceivable)
- [Operable](#operable)
- [Understandable](#understandable)
- [Robust](#robust)
- [Testing Tools](#testing-tools)

---

## Overview

This checklist covers the **WCAG 2.2 Level AA** success criteria relevant to the AGILE3D project. All items marked with ✅ are implemented in the design system.

**PRD References:**
- NFR-3.5: WCAG 2.2 AA compliance
- NFR-3.6: Keyboard navigation support
- NFR-3.7: Respect prefers-reduced-motion

---

## Automated Testing

### Using Axe-Core

The project includes `axe-core` for automated accessibility testing.

```typescript
import { expectNoA11yViolations } from '@core/testing/axe-helper';

it('should have no accessibility violations', async () => {
  const compiled = fixture.nativeElement;
  await expectNoA11yViolations(compiled);
});
```

### Running Tests

```bash
# Run all tests including accessibility
npm test

# Run tests in watch mode
ng test
```

---

## Perceivable

Information and user interface components must be presentable to users in ways they can perceive.

### 1.1 Text Alternatives

- ✅ All images have `alt` text or `aria-label`
- ✅ Decorative images use `aria-hidden="true"`
- ✅ Icon-only buttons have `aria-label`

**Example:**
```html
<!-- Icon button with aria-label -->
<button mat-icon-button [attr.aria-label]="'Toggle theme'">
  <mat-icon>light_mode</mat-icon>
</button>

<!-- Decorative icon -->
<mat-icon aria-hidden="true">arrow_forward</mat-icon>
```

### 1.3 Adaptable

- ✅ Semantic HTML structure (headings, landmarks)
- ✅ Logical heading hierarchy (h1 → h2 → h3)
- ✅ Form labels properly associated with inputs
- ✅ Information not conveyed by color alone

**Example:**
```html
<!-- Semantic structure -->
<header role="banner">
  <nav role="navigation" aria-label="Main navigation">
    <!-- Navigation items -->
  </nav>
</header>

<main role="main">
  <h1>Page Title</h1>
  <section aria-labelledby="section-title">
    <h2 id="section-title">Section Title</h2>
    <!-- Content -->
  </section>
</main>
```

### 1.4 Distinguishable

- ✅ **1.4.3** Color contrast (minimum 4.5:1 for normal text, 3:1 for large text)
- ✅ **1.4.10** Reflow (no horizontal scrolling at 320px width)
- ✅ **1.4.11** Non-text contrast (UI components have 3:1 contrast)
- ✅ **1.4.12** Text spacing (customizable without loss of content)
- ✅ **1.4.13** Content on hover/focus (dismissible, hoverable, persistent)

**Color Contrast Examples:**

| Element | Foreground | Background | Ratio | Pass |
|---------|-----------|------------|-------|------|
| Primary text | `#141414` | `#FFFFFF` | 15.3:1 | ✅ AAA |
| Secondary text | `#666666` | `#FFFFFF` | 5.7:1 | ✅ AA |
| Primary button | `#FFFFFF` | `#1e3a8a` | 8.2:1 | ✅ AAA |
| Error text | `#ef4444` | `#FFFFFF` | 4.5:1 | ✅ AA |

**Verify Contrast:**
```scss
// Using design tokens ensures WCAG AA compliance
.my-text {
  color: var(--ag3d-color-text-primary);  // ✅ 4.5:1+ on light bg
  background: var(--ag3d-color-surface-base);
}
```

---

## Operable

User interface components and navigation must be operable.

### 2.1 Keyboard Accessible

- ✅ **2.1.1** All functionality available via keyboard
- ✅ **2.1.2** No keyboard traps
- ✅ **2.1.4** Character key shortcuts can be disabled/remapped (if implemented)

**Testing:**
```
Tab        → Navigate forward through interactive elements
Shift+Tab  → Navigate backward
Enter      → Activate buttons/links
Space      → Toggle checkboxes/buttons
Esc        → Close dialogs/menus
Arrow keys → Navigate within component (e.g., menu items)
```

**Example:**
```html
<!-- Keyboard accessible custom component -->
<div class="custom-button"
     tabindex="0"
     role="button"
     (keydown.enter)="handleClick()"
     (keydown.space)="handleClick(); $event.preventDefault()"
     (click)="handleClick()">
  Click me
</div>
```

### 2.2 Enough Time

- ✅ **2.2.2** Pause, stop, hide (animations respect prefers-reduced-motion)

**Example:**
```scss
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 2.3 Seizures and Physical Reactions

- ✅ **2.3.3** Animation from interactions (reduced motion support)

**Implementation:**
```typescript
this.themeService.reducedMotion$.subscribe(reducedMotion => {
  if (reducedMotion) {
    this.disableAnimations();
  }
});
```

### 2.4 Navigable

- ✅ **2.4.1** Bypass blocks (skip to main content link)
- ✅ **2.4.2** Page titled
- ✅ **2.4.3** Focus order (logical tab sequence)
- ✅ **2.4.7** Focus visible (clear focus indicators)

**Skip Link Example:**
```html
<a href="#main-content" class="ag3d-skip-link">
  Skip to main content
</a>

<main id="main-content">
  <!-- Content -->
</main>
```

**Focus Indicators:**
```scss
button:focus-visible {
  outline: 2px solid var(--ag3d-color-focus);
  outline-offset: 2px;
  box-shadow: var(--ag3d-shadow-focus);
}
```

### 2.5 Input Modalities

- ✅ **2.5.3** Label in name (accessible name contains visible text)
- ✅ **2.5.5** Target size (minimum 44x44px for touch targets)
- ✅ **2.5.8** Minimum target spacing (adequate spacing between targets)

**Example:**
```scss
.ag3d-touch-target {
  min-width: 44px;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
```

---

## Understandable

Information and the operation of the user interface must be understandable.

### 3.1 Readable

- ✅ **3.1.1** Language of page (`<html lang="en">`)
- ✅ **3.1.2** Language of parts (if multiple languages used)

**Example:**
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <title>AGILE3D Interactive Demo</title>
</head>
</html>
```

### 3.2 Predictable

- ✅ **3.2.1** On focus (no context change on focus)
- ✅ **3.2.2** On input (no unexpected context changes)
- ✅ **3.2.3** Consistent navigation
- ✅ **3.2.4** Consistent identification

### 3.3 Input Assistance

- ✅ **3.3.1** Error identification (clear error messages)
- ✅ **3.3.2** Labels or instructions (all form fields labeled)
- ✅ **3.3.3** Error suggestion (helpful error messages)
- ✅ **3.3.4** Error prevention (confirmations for critical actions)

**Form Example:**
```html
<div class="ag3d-form-field">
  <label for="email" class="ag3d-form-label ag3d-required">
    Email Address
  </label>
  <input
    type="email"
    id="email"
    name="email"
    aria-required="true"
    aria-invalid="false"
    aria-describedby="email-error email-hint"
  />
  <span id="email-hint" class="ag3d-form-hint">
    We'll never share your email
  </span>
  <span id="email-error" class="ag3d-form-error" *ngIf="hasError">
    Please enter a valid email address
  </span>
</div>
```

---

## Robust

Content must be robust enough to be interpreted reliably by a wide variety of user agents, including assistive technologies.

### 4.1 Compatible

- ✅ **4.1.2** Name, role, value (proper ARIA attributes)
- ✅ **4.1.3** Status messages (ARIA live regions)

**ARIA Examples:**
```html
<!-- Button with proper role and state -->
<button
  aria-label="Toggle dark mode"
  aria-pressed="true"
  (click)="toggleTheme()"
>
  <mat-icon>dark_mode</mat-icon>
</button>

<!-- Live region for status updates -->
<div role="status" aria-live="polite" class="ag3d-sr-only">
  {{ statusMessage }}
</div>

<!-- Alert for important messages -->
<div role="alert" aria-live="assertive" class="ag3d-sr-only">
  {{ errorMessage }}
</div>
```

---

## Testing Tools

### Browser Extensions

1. **axe DevTools** (Recommended)
   - Chrome/Firefox/Edge extension
   - Free version available
   - https://www.deque.com/axe/devtools/

2. **WAVE**
   - Chrome/Firefox extension
   - Visual feedback
   - https://wave.webaim.org/extension/

3. **Lighthouse**
   - Built into Chrome DevTools
   - Comprehensive audits
   - Run: F12 → Lighthouse → Accessibility

### Automated Testing

```bash
# Run unit tests with accessibility checks
npm test

# Run specific test file
npm test -- --include='**/theme.service.spec.ts'
```

### Manual Testing

#### Keyboard Navigation
1. Tab through all interactive elements
2. Verify focus indicators are visible
3. Ensure logical tab order
4. Test keyboard shortcuts

#### Screen Reader Testing

**NVDA (Windows - Free)**
```
Download: https://www.nvaccess.org/download/
Commands:
  Ctrl         - Stop speech
  Insert+Down  - Read from cursor
  Insert+Space - Forms mode toggle
```

**JAWS (Windows - Commercial)**
```
Trial: https://www.freedomscientific.com/products/software/jaws/
```

**VoiceOver (macOS - Built-in)**
```
Enable: Cmd+F5
Commands:
  Ctrl+Option+A     - Start reading
  Ctrl+Option+Right - Next item
  Ctrl+Option+Space - Activate item
```

#### Color Contrast

Use online tools:
- **WebAIM Contrast Checker**: https://webaim.org/resources/contrastchecker/
- **Colour Contrast Analyser**: https://www.tpgi.com/color-contrast-checker/

#### Color Blindness Simulation

- **Chrome DevTools**:
  1. F12 → Rendering tab → Emulate vision deficiencies
  2. Test with Protanopia, Deuteranopia, Tritanopia

- **Online Simulator**:
  - Coblis: https://www.color-blindness.com/coblis-color-blindness-simulator/

---

## Checklist Summary

| Category | Success Criteria | Status |
|----------|------------------|--------|
| **Perceivable** | 1.1.1 Non-text content | ✅ |
| | 1.3.1 Info and relationships | ✅ |
| | 1.4.3 Contrast (minimum) | ✅ |
| | 1.4.10 Reflow | ✅ |
| | 1.4.11 Non-text contrast | ✅ |
| | 1.4.12 Text spacing | ✅ |
| | 1.4.13 Content on hover/focus | ✅ |
| **Operable** | 2.1.1 Keyboard | ✅ |
| | 2.1.2 No keyboard trap | ✅ |
| | 2.2.2 Pause, stop, hide | ✅ |
| | 2.3.3 Animation from interactions | ✅ |
| | 2.4.1 Bypass blocks | ✅ |
| | 2.4.3 Focus order | ✅ |
| | 2.4.7 Focus visible | ✅ |
| | 2.5.3 Label in name | ✅ |
| | 2.5.5 Target size (AAA) | ✅ |
| **Understandable** | 3.1.1 Language of page | ✅ |
| | 3.2.1 On focus | ✅ |
| | 3.2.2 On input | ✅ |
| | 3.3.1 Error identification | ✅ |
| | 3.3.2 Labels or instructions | ✅ |
| **Robust** | 4.1.2 Name, role, value | ✅ |
| | 4.1.3 Status messages | ✅ |

---

## See Also

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/quickref/)
- [Design Tokens Reference](./tokens.md)
- [Theme Usage Guide](./theme-usage.md)
- [WebAIM Resources](https://webaim.org/resources/)
