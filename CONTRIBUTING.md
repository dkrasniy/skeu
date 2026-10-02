# Contributing to Skeu

Thanks for your interest in contributing!

## Before You Start

Open an issue first, especially for larger changes. It helps talk through the approach and avoids wasted effort.

## What's Welcome

- **Bug fixes** — Always welcome.
- **Export fidelity** — Anything that makes the download match the canvas more exactly.
- **Small, focused features** — Things that solve common screenshot problems without adding a control.
- **Visual and animation improvements** — Welcome, but have a high bar. Open an issue to discuss first.

## What's Harder to Merge

- **New controls** — The panel is intentionally short. A new slider has to earn its place.
- **More configuration** — Opinionated defaults over flexibility. The defaults are meant to look good untouched.
- **Accounts, uploads or a backend** — Skeu runs entirely in the browser by design. Images never leave the device.

## Code Style

- Match existing patterns
- Keep PRs focused (one change per PR)
- Run `npm run typecheck` and `npm run lint` before opening one

## A Few Things That Will Bite You

Some rules in the editor aren't obvious from reading it:

- **A gesture is one undo step.** Drags, pinches and held keys wrap their changes in `begin()` and `end()`. Call `change()` without them and every pointer move becomes its own undo.
- **A drag can end without a pointerup.** Every drag checks `e.buttons` on move and treats `lostpointercapture` as a release. Otherwise a release outside the window leaves the control following the mouse.
- **Sizes are relative.** Padding, roundness and shadow scale with the canvas (`unit`); the window frame scales with the card (`chrome`). Hard-code a pixel value and it looks right at one size only.
- **Saved style is untrusted.** Anything read from storage goes through `sanitizeSettings` before it reaches CSS or the canvas.
- **Motion comes from transitions.dev.** The recipes in `src/styles/transitions.css` are copied verbatim. Tune them with their CSS variables rather than editing the recipe.

## Development

```bash
npm install
npm run dev
```

## Questions?

Open an issue. Happy to talk through ideas.
