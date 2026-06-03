# shadcn/ui components

This folder contains shadcn/ui components installed via the shadcn CLI. They are
plain React + Tailwind v4 source files — own them, edit them.

## Add more components

```bash
npx shadcn@latest add <component>      # e.g. accordion, calendar, hover-card
npx shadcn@latest add --all            # everything available in the registry
npx shadcn@latest view <component>     # preview source before installing
npx shadcn@latest docs <component>     # docs / examples for agent context
```

Config lives in `/components.json` at the repo root. The style is `radix-nova`
on a `neutral` base color with the `radix` primitive library. Icons use
`lucide-react`.

## Path alias

All shadcn components import via the `@/` alias mapped to `src/`. The alias is
configured in:

- `tsconfig.json` — `compilerOptions.paths`
- `vite.config.ts` — `resolve.alias`
- `components.json` — `aliases.*`

## Theming

Design tokens are CSS variables in `src/index.css`:

- `:root` — light mode tokens (`--background`, `--foreground`, `--primary`, ...)
- `.dark` — dark mode tokens
- `@theme inline` — maps the tokens to Tailwind v4 utilities so classes like
  `bg-background`, `text-foreground`, `border-border` work everywhere.

To switch to dark mode add `class="dark"` on `<html>` (or use `next-themes`).

## Wired-up providers

`src/main.tsx` already wraps the app with:

- `TooltipProvider` from `@/components/ui/tooltip`
- `Toaster` from `@/components/ui/sonner` — call `toast(...)` from `sonner`
  anywhere.

## Legacy components

The previous custom UI primitives (`Button`, `Card`, `Badge`, `StatCard`,
`States`) were moved to `src/components/legacy-ui/` so they don't collide with
shadcn's lowercase filenames on case-insensitive filesystems. Existing pages
keep using them until migrated to shadcn equivalents.

Suggested migration mapping:

| Legacy                          | shadcn replacement              |
| ------------------------------- | ------------------------------- |
| `legacy-ui/Button`              | `@/components/ui/button`        |
| `legacy-ui/Card` + Header/Body  | `@/components/ui/card` (Card, CardHeader, CardContent, ...) |
| `legacy-ui/Badge`               | `@/components/ui/badge`         |
| `legacy-ui/StatCard`            | compose with `Card` + `CardHeader` + numeric content |
| `legacy-ui/States` (Skeleton/EmptyState) | `@/components/ui/skeleton` + a small empty-state composition |
