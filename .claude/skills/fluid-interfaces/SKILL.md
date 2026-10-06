---
name: fluid-interfaces
description: Choreography for fluid, delightful interfaces — what moves when a screen or step changes, in what order, from which direction, and for how long. Covers entering and leaving content (the staggered slide-up), step-to-step slides, shared objects that morph between views, sheets and popovers, in-place state feedback, and rare "moment" animations, with measured timings and CSS recipes. Use when building or reviewing onboarding, multi-step flows, dialogs, sheets, empty states, page or panel transitions, or anything that should "feel fluid", "slide in nicely" or "morph". Pairs with interaction-feel (look, type, spacing) and transitions-dev (component recipes).
---

# Fluid interfaces

A fluid interface never cuts. Every change shows where things came from and where they went, so the user never has to find their place again. Studied frame by frame from the Family wallet onboarding (see `references/family-study.md` for the measurements).

## 1. Sort every element before animating anything

When a screen, step or state changes, put each element in exactly one of four groups. The group decides the motion.

| Group | What it is | What it does |
|---|---|---|
| **Stays** | Same element, same job: nav buttons, a title that doesn't change, the primary button, progress dots | Doesn't move. Only its text or color crossfades if those change. |
| **Same thing, new role** | One object in both views: the tapped row's icon and the hero card, a card and the sheet it opens, a button whose label changes | Morphs: position, size and shape ease to the new values. Text inside it crossfades. |
| **New** | Only in the new view | Enters: fades in fast while it slides in from the direction of travel. |
| **Gone** | Only in the old view | Leaves: fades out faster than the new content arrives, drifting the same way everything is going. |

Only morph objects that really are the same thing. If you have to invent the connection, the element is New and Gone, not shared.

Examples from Family:
- **Same thing, new role:**
  - Tapping "Import" (a green icon) brings the green wallet to the front of the stack.
  - Tapping "Secret Recovery Phrase" grows that green card down into the big paste card on the next page.
  - "Back Up Now" opens a sheet whose blue header *is* the wallet card.
  - "View Wallet" shrinks the card into the wallet tab icon, so the user sees where it lives.
  - Tapping a token row expands that row into the detail page.
- **Stays:** "Add an Existing Wallet" stays put while the list under it changes. The Continue button rides the keyboard and only crossfades its label ("Create a New Wallet" → "Continue").

## 2. Entering: fade fast, move long

This is the slide-up seen when content appears after the splash screen, and the core of the whole feel.

- **Opacity is quick.** New content reaches full opacity in about 120–150ms, with an ease-out curve.
- **Movement is long.** Its position eases over about 350–450ms with a strong ease-out, but 90% of the travel is done in the first ~150ms. The long tail is a soft landing the eye barely notices, which reads as "smooth", not "slow".
- **Old content clears first.** It fades in about 80ms while drifting 8–12px the same way. New content starts as old content finishes, with a ~30ms overlap, so the screen is never empty and never shows two layouts fighting.
- **Stagger by role, not by DOM order.**
  - Title and text start first. Rows follow 30ms apart, and the button comes last.
  - The hero picture arrives about 50ms after the text, so it lands as the finishing touch.
  - Cap the whole stagger at about 150ms. Past 5 items, start the rest together.
- **Heroes settle, text glides.**
  - Text and rows use a critically damped curve, with no overshoot.
  - A hero illustration may overshoot by 1–2%, then settle. Nothing else bounces.
- **Reveal from somewhere real.** New things come out from behind an edge that explains them:
  - A wallet rises out of its pocket, clipped by the header's bottom edge.
  - A sheet comes up from the screen's bottom.
  - A chart draws left to right after the page settles.
  - A badge grows from its corner.

  Don't fade things in from nowhere when a source edge exists.

**How far things travel:**
- **Moving up within a page:** 16–24px for items, up to about 40px for a whole block.
- **Page-level slides:** about a quarter of the container's width. Family moves ~90pt on a 393pt phone. Use 24–40px in a 400px dialog.
- **Never a full-width push** for steps in one container. The old and new content overlap while they crossfade.

## 3. Direction says what happened

- **Forward through a sequence** (onboarding steps, a carousel): the new step comes in from the right and the old one leaves to the left. Back reverses it.
- **Deeper into the same place** (you picked an option and the list is replaced by its sub-options): vertical. The old list slides up and out, and the new one slides up from below. The header above it stays.
- **First real screen after a splash:** content rises up into place.
- **Sheets and popovers:** they come up from the bottom, or from their anchor.
  - Close faster than you open: about 110ms with an ease-in curve, against about 180ms to open.
  - The scrim fades on the same clock.
- **Finishing:** the object goes where it lives (the card flies into its tab). Going back is the exact reverse of going forward.

## 4. Same slots on every screen

Morphs and still frames only work if screens share a skeleton. Give every step of a flow the same slots in the same places:
- the nav row (close or back, progress, help)
- a title, then a muted line under it
- the content
- a footnote
- one primary button pinned to the bottom

With matching slots:
- A step change is a crossfade inside each slot plus one slide, not a re-layout.
- The title of step 3 lands exactly where step 2's was.
- The button never moves.

Titles sit left-aligned in sequential steps. They're centered only under a hero illustration.

## 5. Containers: hold still or resize with intent

- **Steps of the same thing keep the frame still.**
  - The six explainer steps in Family's backup sheet keep one height and one button position. Only the hero illustration and the text change.
  - The button can change its label in place ("Continue" → "Continue To Back Up").
- **Switching to different content resizes the container from its anchored edge.**
  - In the bottom sheet, "Select Icon" turns into "Choose an Emoji": the sheet grows upward from its fixed bottom over about 220ms.
  - The title crossfades in place, and the list dissolves into the emoji grid.
- **Sheets:**
  - A sheet floats about 8px inside the screen. Its corners are concentric with the screen's (see interaction-feel).
  - It opens with at most 1–2px of overshoot.
  - The scrim is a plain grey dim, with no blur on routine sheets.
- **Illustrations inside a still frame:**
  - Keep a constant backdrop, like the phone silhouette.
  - The step's subject swaps on top of it: the old subject shrinks and fades as the new one grows from the center.
  - When the previous subject is still relevant, it steps back into a supporting role (the word list slides down and shrinks under the key) instead of leaving.

## 6. Feedback inside a page

Small changes happen in place, instantly, and in proportion.

- **Selection:**
  - The ring appears on the frame you tap. Don't wait for an animation to show the choice.
  - Anything the choice tints (the primary button, progress) crossfades in about 150ms.
  - Changing your mind quickly crossfades in 50–80ms.
- **A choice shows up everywhere at once.** A color you pick tints the button, the progress and the avatar right away, and becomes the card later. The user's choice is the accent from then on.
- **Checkboxes and toggles:** fill and check in under 100ms, with a slight scale pop.
- **Status text that changes level** (Weak → Moderate → Strong): crossfades with a small vertical roll. Its color carries the meaning.
- **Async status:** stays in the same pill and swaps its icon and text in place ("Backing Up" with a spinner → "Backed Up" with a check). Never replace the whole card.
- **Secondary content waits for the page to land:** a chart line draws in, or a list fills, about 150–200ms after the container settles.

## 7. Moments

Rare, once-per-user events earn a little theatre. This never applies to routine actions.

- **Pause before the reveal.** After "I Understand, Continue" everything fades and the screen holds empty for about 200ms. Then "Creating Your Wallet" rises in.
- **Ambient progress is quiet.** A thin grid with lines tracing across it, in the accent color at low opacity.
- **The result lands big.** A gradient rises like a sunrise and resolves into the user's card in their color and with their avatar. Then the headline crossfades to "Your wallet is ready." with one word underlined by hand.
- **The next step follows after a beat.** About 500ms after the result settles, a dark tooltip scales out from the button it points at.
- **Turning something over shows what's on the back.** The card flips in 3D (about 400ms) to reveal the recovery phrase, and the words fill in one by one.

Keep each moment to one idea and under a second of motion, and never repeat it on a revisit.

## 8. Timing tokens

These are the measured values, mapped to CSS. `--ease-smooth-out` is `cubic-bezier(0.22, 1, 0.36, 1)` from transitions-dev.

| Use | Duration | Curve |
|---|---|---|
| Fade in (new content) | 120–150ms | `ease-out` |
| Fade out (old content) | 80–100ms | `ease-out` |
| Move in or morph (text, rows, containers) | 350–450ms | `--ease-smooth-out` |
| Step slide (horizontal, overlapping) | 300–350ms move, 150ms fade | `--ease-smooth-out` |
| Hero settle (1–2% overshoot) | 480ms | `--ease-settle` (below) |
| Sheet open | ~180ms move, 150ms scrim | `--ease-smooth-out` |
| Sheet close | ~110ms | `cubic-bezier(0.4, 0, 1, 1)` |
| Container resize (anchored) | ~220ms | `--ease-smooth-out` |
| Selection ring, check, tint | 0ms ring, 100–150ms tint | `ease-out` |
| Stagger step | 30ms, capped at ~150ms total | — |

```css
/* Damped spring, 1.5% overshoot, settles in 480ms. Measured from the Family wallet header. */
--ease-settle: linear(0, 0.086, 0.267, 0.464, 0.639, 0.776, 0.875, 0.941, 0.981, 1.003, 1.012, 1.015, 1.014, 1.011, 1.008, 1.006, 1);
```

## 9. Recipes (web)

**Enter with separate fade and move clocks.** This is the one pattern to reach for.
```css
.enter { opacity: 0; transform: translateY(var(--rise, 20px));
  transition: opacity 140ms ease-out calc(var(--i, 0) * 30ms), transform 420ms var(--ease-smooth-out) calc(var(--i, 0) * 30ms); }
.enter.is-in { opacity: 1; transform: none; }
.leave { opacity: 0; transform: translateY(-10px); transition: opacity 90ms ease-out, transform 90ms ease-out; }
```
Set `--i` per element by role: title 0, text 1, rows 2, 3, 4, button 5. For a step slide, use `translateX(±var(--slide, 32px))` instead.

**Reveal from an edge.** Put the object in a wrapper with `overflow: clip`, and start it at `translateY(100%)` inside that wrapper. The edge does the masking.

**Morph a shared object.**
- Within one page, prefer FLIP: measure the old rect, apply the new layout, then animate a transform from old to new.
- Across routes, the View Transitions API with a matching `view-transition-name` works too.
- Animate the box, not the text inside it. Crossfade the text, or use letter morphing (MorphText) where letters are shared.

**Crossfade a label in place.** Stack the old and new labels in one grid cell. The new one fades in at 150ms while the old one fades out at 90ms. The button never changes size.

**Reduced motion.** Keep the opacity changes, drop every translate, scale and flip, and keep the order of appearance.

## 10. Don't

- Animate everything with the same duration and curve. Hierarchy comes from the different clocks.
- Fade slowly. Opacity over about 200ms reads as lag, whatever the movement is doing.
- Bounce text, rows or buttons. Overshoot is only for a hero illustration, and only 1–2%.
- Morph unrelated things because it looks cool.
- Push a whole step off-screen inside a dialog, or slide it full width.
- Stagger long lists item by item.
- Animate on page load, on restore, or on anything the user didn't just do. The moments in section 7 are the user finishing something.

## 11. Check it

- Record or step through the transition at 10–25% speed. With CDP that's `Animation.setPlaybackRate`, or use the DevTools Animations panel.
- Capture frames every 16ms and confirm:
  - The screen is never empty.
  - No element jumps on the first or last frame.
  - The four groups behave as sorted.
- To study a reference recording the same way, see `references/study-a-recording.md`.
