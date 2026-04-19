# UX Guidelines

Prompt To API is a developer-facing tool: quick to scan, mobile-ready, dark-only.

## Design tokens

Defined in [tailwind.config.js](../tailwind.config.js) and used via utility classes.

### Colours

| Token         | Hex       | Use                                    |
| ------------- | --------- | -------------------------------------- |
| `ink-950`     | `#07070a` | Page background                        |
| `ink-900`     | `#0d0d12` | Card surface                           |
| `ink-800`     | `#14141a` | Raised surface, input background       |
| `ink-700`     | `#1f1f28` | Border                                 |
| `ink-600`     | `#2a2a36` | Hover border / separator               |
| `accent-400`  | `#8b8cff` | Emphasised links, code highlights      |
| `accent-500`  | `#6366f1` | Primary focus ring                     |
| `accent-600`  | `#4f46e5` | Primary button, brand mark             |
| `neutral-100` | tailwind  | Primary text                           |
| `neutral-300` | tailwind  | Secondary text                         |
| `neutral-400` | tailwind  | Tertiary text / supporting copy        |
| `neutral-500` | tailwind  | Low-emphasis labels / timestamps       |

Semantic states use Tailwind’s built-in `red-*`, `emerald-*`, `yellow-*`.

### Typography

- Sans: **Inter** → system fallback
- Mono: system mono stack (`ui-monospace`, `SFMono-Regular`, `Menlo`)
- Heading sizes: `text-2xl` for page, `text-3xl–6xl` for marketing hero
- Body: `text-sm` default, `text-xs` for meta

### Spacing

- Content columns capped at `max-w-6xl` for marketing, `max-w-5xl` for app, `max-w-sm–lg` for forms.
- Vertical rhythm: use `space-y-4` / `space-y-6` between cards.
- Mobile-first: all layouts work down to 375px.

## Component inventory

All components live under [src/lib/components/](../src/lib/components/) or as
Tailwind utility classes in [src/app.css](../src/app.css).

- **Button** — `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger`
- **Input / Textarea** — `.input`, pair with `.label`
- **Card** — `.card`
- **Badge** — `.badge`
- **CodeBlock** — [CodeBlock.svelte](../src/lib/components/CodeBlock.svelte)
  with copy-to-clipboard button
- **Tabs** — inline in the assistant detail page; promote to a component if
  reused.
- **Modal** — inline overlay pattern in `/app/assistants` (create dialog);
  promote to a component if reused.

## Accessibility

- **Focus rings** — global `:focus-visible` rule in `src/app.css` forces a
  visible `ring-2 ring-accent-500` on every interactive element.
- **Contrast** — minimum AA for body text (`neutral-100` on `ink-950`,
  `neutral-400` on `ink-900` etc.).
- **Keyboard** — modals must close on click-outside or Escape; forms submit on
  Enter; buttons always have text labels (no icon-only without `aria-label`).
- **Motion** — subtle transitions only (`transition` class). Respect
  `prefers-reduced-motion` when we add animations later.
- **Colour** — never the only signal. Revoked tokens show a text badge plus a
  red tint.

## Copy tone

- Direct, developer-to-developer.
- Second person ("you").
- No emoji in production UI.
- Prefer examples over explanations. Show the snippet.
