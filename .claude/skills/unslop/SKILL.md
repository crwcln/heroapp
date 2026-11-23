---
name: unslop
description: "Enforce the Linear Precision design system and eliminate generic AI UI slop. Use when building, refactoring, or reviewing frontend interfaces."
---

<!-- unslop:start -->
# unslop · Linear Precision

Obsidian dark craft with adjacent neutral surfaces, translucent luminance hairlines, compact type, and tabular operational precision.

These rules are mandatory whenever you create, refactor, or review frontend code. Preserve product behavior and content while enforcing this visual system. Do not substitute a generic component-library theme for these tokens.

## 1. Design physics

1. **Hierarchy before decoration.** Establish meaning through composition, type, spacing, and contrast before color, shadows, or animation.
2. **One grid.** Align every edge and baseline to the spacing contract. Arbitrary values require a documented semantic reason.
3. **One accent.** Use the accent for action, focus, selection, or a deliberate data encoding—not ambient decoration.
4. **Optical alignment.** Account for glyph overhang, icon bounds, border thickness, and shadow offset; mathematical sameness is not always visual alignment.
5. **Accessible by construction.** Maintain WCAG AA contrast, visible keyboard focus, 44px touch targets where space allows, semantic HTML, and reduced-motion behavior.
6. **Content-specific composition.** Never default to a centered hero, purple gradient, three emoji cards, and a final call-to-action. Derive layout from the information architecture.

## 2. Color contract

| Semantic token | Value |
| --- | --- |
| background | `#08090a` |
| surface | `#0f1011` |
| surface-elevated | `#161719` |
| text | `#f7f8f8` |
| text-muted | `#9297a1` |
| border | `rgba(255,255,255,0.09)` |
| accent | `#5e6ad2` |
| accent-text | `#ffffff` |
| interactive | `#1c1e22` |
| success | `#4cb782` |
| warning | `#d7a642` |
| danger | `#eb5757` |
| info | `#70a5eb` |
| focus | `#5e6ad2` |

- Page color scheme: **dark**.
- Never invent raw hex, RGB, HSL, or opacity values when a semantic token exists.
- Use text-muted only for secondary copy that still meets contrast requirements.
- Verify WCAG 2.1 contrast with real sRGB luminance after alpha compositing: normal text requires 4.5:1; large text (24px, or 18.66px at 700+) requires 3:1. Resolve every slop/low-contrast finding.
- No purple/indigo gradient clichés, neon cyber-glows, rainbow accent palettes, or color-only status communication.

## 3. Typography contract

Display stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`
Body stack: `Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif`
Monospace stack: `Berkeley Mono, SFMono-Regular, Consolas, monospace`
Display tracking: `-0.045em`; body tracking: `-0.011em`.

| Scale step | Size |
| --- | --- |
| xs | `0.75rem` |
| sm | `0.875rem` |
| base | `0.875rem` |
| lg | `1.125rem` |
| xl | `1.25rem` |
| 2xl | `1.5rem` |
| 3xl | `clamp(1.75rem, 2.4vw, 2.25rem)` |
| 4xl | `clamp(2.25rem, 5vw, 2.75rem)` |

Available weights: regular 400, medium 500, semibold 600, bold 700.
- Display headings require tight tracking, deliberate line-height, balanced wrapping, and a constrained measure.
- Body copy stays between 60 and 70 characters per line; Tailwind max-w-prose is normally 65ch. Do not center long-form copy.
- Use `font-variant-numeric: tabular-nums` for prices, metrics, counters, clocks, identifiers, and data columns.
- Use at most three font weights in a component tree. Prefer size, spacing, and color over additional weights.

## 4. Geometry and spacing

- Base spacing grid: **4px**.
- Allowed spacing stops: **0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64px**.
- Content maximum: **1200px**; grid: **12 columns**; gap: **16px**; inline inset: **24px**.
- Default border width: **1px**.
- No same-element spacing or radius utility conflicts. Responsive changes must use explicit responsive variants.
- Group related controls with smaller gaps and separate regions with larger gaps; do not distribute everything evenly by default.
- Nested corner radii must account for the padding between outer and inner surfaces.

| Radius token | Value |
| --- | --- |
| sm | `4px` |
| md | `6px` |
| lg | `8px` |
| xl | `12px` |
| full | `9999px` |

## 5. Elevation and material

| Elevation token | Value |
| --- | --- |
| sm | `0 1px 2px rgba(0,0,0,0.24)` |
| md | `0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28)` |
| lg | `0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.36)` |

- Anchor elevated surfaces with the border token. Never add raw `shadow-xl`/`shadow-2xl` without an intentional border and layered elevation decision.
- Do not stack multiple elevated cards inside one another. Prefer whitespace and hairline separators for ordinary grouping.

## 6. Motion contract

- Duration: `140ms`; easing: `cubic-bezier(0.25,0.46,0.45,0.94)`.
- Spring: mass 0.8, stiffness 320, damping 28.
- Animate only properties that communicate causality. Prefer transform and opacity; avoid layout thrashing.
- Under `prefers-reduced-motion: reduce`, remove spatial and ambient motion and preserve immediate state feedback.

## 7. Preset-specific laws

1. Build elevation from adjacent neutral surfaces and one-pixel luminance borders before adding shadow.
2. Reserve indigo for primary actions, current selection, and keyboard focus—not decorative washes.
3. Keep product UI compact at 13–16px while preserving 1.45–1.6 body line-height.
4. Use tabular figures for metrics, timestamps, identifiers, issue counts, and financial values.
5. Align labels, controls, and values to shared edges on the four-pixel grid.
6. Prefer 6px and 8px radii; reserve full radii for compact status pills and avatars.
7. Never introduce neon glows, glass blur, purple gradients, or ambient floating animation.
8. Focus rings must remain visible against every dark surface and finish without layout shift.
9. Use 32–40px control heights and explicit hover, active, disabled, and loading states.
10. Direct manipulation feedback should complete within 140ms and disappear under reduced motion.

## 8. CSS token source of truth

Use these variables directly or map them once into Tailwind, CSS Modules, styled-components, or the host design system. Do not create a second competing token scale. For Tailwind v4 @theme plus :root and .dark variables, run `npx -y unslop-mcp export-tokens --preset linear-precision --out tokens.css`.

```css
:root {
  color-scheme: dark;
  --unslop-color-background: #08090a;
  --unslop-color-surface: #0f1011;
  --unslop-color-surface-elevated: #161719;
  --unslop-color-text: #f7f8f8;
  --unslop-color-text-muted: #9297a1;
  --unslop-color-border: rgba(255,255,255,0.09);
  --unslop-color-accent: #5e6ad2;
  --unslop-color-accent-text: #ffffff;
  --unslop-color-interactive: #1c1e22;
  --unslop-color-success: #4cb782;
  --unslop-color-warning: #d7a642;
  --unslop-color-danger: #eb5757;
  --unslop-color-info: #70a5eb;
  --unslop-color-focus: #5e6ad2;
  --unslop-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --unslop-font-display: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --unslop-font-body: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  --unslop-font-mono: Berkeley Mono, SFMono-Regular, Consolas, monospace;
  --unslop-text-xs: 0.75rem;
  --unslop-text-sm: 0.875rem;
  --unslop-text-base: 0.875rem;
  --unslop-text-lg: 1.125rem;
  --unslop-text-xl: 1.25rem;
  --unslop-text-2xl: 1.5rem;
  --unslop-text-3xl: clamp(1.75rem, 2.4vw, 2.25rem);
  --unslop-text-4xl: clamp(2.25rem, 5vw, 2.75rem);
  --unslop-tracking-display: -0.045em;
  --unslop-tracking-body: -0.011em;
  --unslop-radius-sm: 4px;
  --unslop-radius-md: 6px;
  --unslop-radius-lg: 8px;
  --unslop-radius-xl: 12px;
  --unslop-radius-full: 9999px;
  --unslop-shadow-sm: 0 1px 2px rgba(0,0,0,0.24);
  --unslop-shadow-md: 0 0 0 1px rgba(255,255,255,0.04), 0 8px 24px rgba(0,0,0,0.28);
  --unslop-shadow-lg: 0 0 0 1px rgba(255,255,255,0.06), 0 16px 48px rgba(0,0,0,0.36);
  --unslop-space-0: 0px;
  --unslop-space-4: 4px;
  --unslop-space-8: 8px;
  --unslop-space-12: 12px;
  --unslop-space-16: 16px;
  --unslop-space-20: 20px;
  --unslop-space-24: 24px;
  --unslop-space-32: 32px;
  --unslop-space-40: 40px;
  --unslop-space-48: 48px;
  --unslop-space-64: 64px;
  --unslop-duration: 140ms;
  --unslop-easing: cubic-bezier(0.25,0.46,0.45,0.94);
  --unslop-content-max: 1200px;
  --unslop-border-width: 1px;
  --unslop-grid-gap: 16px;
  --unslop-content-inset: 24px;
}
```

## Deterministic Before → After Transformations

Use the project's semantic primitives and preserve real copy, data, links, handlers, DOM reading order, and accessible names. The examples use semantic tokens exported for the selected preset in the token foundation step; import that file first, or map these names to the equivalent existing semantic tokens. They are templates to adapt, not blind replacements or a reason to invent new content.

### 1. Gradient hero and decorative glow → type, semantic surfaces, and hairline

Before:

```tsx
<section className="relative bg-gradient-to-r from-purple-500 to-indigo-500 text-center">
  <div aria-hidden="true" className="absolute blur-3xl opacity-30" />
  <h1 className="text-6xl">{title}</h1>
  <p>{description}</p>
</section>
```

After:

```tsx
<section className="border border-[var(--border-subtle)] bg-[var(--surface-1)] px-6 py-12 text-[var(--text-primary)]">
  <h1 className="max-w-[20ch] text-4xl font-semibold leading-tight tracking-[var(--tracking-display)] md:text-5xl">{title}</h1>
  <p className="mt-4 max-w-prose leading-relaxed text-[var(--text-primary)]">{description}</p>
</section>
```

Remove the decorative blob element, not merely its blur; preserve any meaningful content or interaction separately. Remove gradient text utilities such as `bg-clip-text text-transparent` from the heading so text remains visible. The `border` utility is a 1px hairline using the chosen theme's luminance border token. Do not assume the token contrast is compliant until measured.

### 2. Three equal centered cards → content-led composition

Before:

```tsx
<div className="grid grid-cols-1 gap-6 text-center md:grid-cols-3">
  <article><IconA /><h2>{firstTitle}</h2><p>{firstDetail}</p></article>
  <article><IconB /><h2>{secondTitle}</h2><p>{secondDetail}</p></article>
  <article><IconC /><h2>{thirdTitle}</h2><p>{thirdDetail}</p></article>
</div>
```

After, for unequal feature importance:

```tsx
<div className="grid grid-cols-1 gap-6 md:grid-cols-12">
  <article className="border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-left md:col-span-7"><IconA /><h2>{firstTitle}</h2><p className="max-w-prose">{firstDetail}</p></article>
  <article className="border border-[var(--border-subtle)] bg-[var(--surface-1)] p-6 text-left md:col-span-5"><IconB /><h2>{secondTitle}</h2><p className="max-w-prose">{secondDetail}</p></article>
  <article className="border-t border-[var(--border-subtle)] pt-6 text-left md:col-span-12"><IconC /><h2>{thirdTitle}</h2><p className="max-w-prose">{thirdDetail}</p></article>
</div>
```

Retain all three items and their source order on mobile and desktop. Choose a semantic `<table>` with caption and column/row headers for comparable values, or a responsive split screen for explanatory copy alongside a real product preview. Use the bento layout only when the content supports unequal emphasis; do not fabricate a product preview or comparison data.

### 3. Body measure and changing numbers → readable and stable

Before: `<p className="w-full">{body}</p>` and `<span>{price}</span>`.

After: `<p className="max-w-prose leading-relaxed">{body}</p>` and `<span className="tabular-nums">{price}</span>`. Apply `tabular-nums` to every metric, price, counter, and comparable numeric column; right-align columns where comparison benefits. Tailwind's default `max-w-prose` is 65ch: ensure the project's configured value is 60ch–70ch, or use `max-w-[65ch]` when it has been overridden.

### 4. Light and dark contrast → measured token pairs

For **each** theme, check every foreground/background pair (including muted text, links, focus indicators and alpha-composited surfaces) against the actual rendered background. WCAG AA requires at least **4.5:1** for normal text and **3:1** for large text; AAA requires **7:1** for normal text and **4.5:1** for large text. Large text is at least 24px regular or 18.66px bold. Essential non-text UI and focus indicators need at least **3:1** against adjacent colors. Adjust the semantic token values for each theme until the applicable target is met; never assert that a preset or class alone guarantees AA/AAA. Recheck keyboard focus, content order, responsive stacking, and both themes after transformation.

## 9. Principal design engineering loop

1. Baseline the Design Craft Score with `npx -y unslop-mcp audit . --json`; review all seven SLOP-COLOR, SLOP-TYPE, SLOP-LAYOUT, SLOP-SURFACE, SLOP-COPY, SLOP-UX, and SLOP-TOKEN pillars.
2. Inspect existing components and reuse their semantic primitives before creating new ones. Keep this archetype as the only token source of truth.
3. Generate `npx -y unslop-mcp refactor-plan . --report UNSLOP-REPORT.md` and apply its exact before/after translations in P0, P1, P2 order.
4. Write the information hierarchy and responsive grid first; implement typography and spacing before visual effects. Replace generic three-card clones with content-led compositions.
5. Implement all interaction states: default, hover, focus-visible, active, disabled, loading, empty, error, and success where applicable. Use explicit transitions and reduced-motion behavior.
6. Run `npx -y unslop-mcp audit . --fail-under 95` and resolve every reported location without suppressing rules.
7. Manually verify narrow and wide viewports, keyboard navigation, both themes, contrast, reduced motion, numeric alignment, and content overflow before claiming 95–100/100 (A+).

A passing audit is necessary but not sufficient: never claim visual excellence without checking the rendered result.
<!-- unslop:end -->
