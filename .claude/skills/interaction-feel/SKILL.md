---
name: interaction-feel
description: How UI should look, move and respond — type and spacing that drive the layout, muted color, continuity between states, quiet motion timing, selection styling, and where delight belongs. Use when building or reviewing any screen, dialog, form or list, any animation, transition, state change or selected style, or "make it feel nicer" polish. Pairs with transitions-dev, which has the recipes; this skill decides what should move and how much.
---

# Interaction feel

Motion explains a change. It shows what changed, where things went, and that the app understood the user. If an animation does none of these, leave it out.

## Look: type and spacing make the layout

Screens are calm. Type, spacing and alignment carry the design, not color or decoration.

- **A short scale.** Titles are 16px, 600, in the strong color. Field labels are 13px medium, fine print is 12px, and buttons are 15px semibold. Dense tool panels can stay at 13–14px. What goes under a title depends on how much there is (next point).
- **Don't be afraid of small text.** 12px muted text suits text that's plentiful but not critical: footers, acknowledgements, legal lines, "added 32 days ago" details. A heading for a block like that stays at 12px and stands out only by using the strong color, not by being bigger or bolder.
- **One big title is fine where it earns it.** A landing hero or an empty state can use a single display title (around 40px, bold, tracked tight) over a muted 18–20px line. Leave clear space between them.
- **Size the content by how much of it there is.** A short title over a short line, like "Welcome back" over "Log in or sign up to get started", keeps both at the same size (or the line 1px smaller). The title's weight and color are enough, and a smaller line under it looks oddly timid. When a title leads into real content, like a paragraph, a list or rows of settings, step the content down to 14px so the title still leads. If a list row or a button reads as big as the title, the hierarchy is broken. Either way, don't invent extra sizes to make things distinct.
- **Get spacing and line height exact.** With Inter: 40px on a 44px line at −0.022em for a hero title, 16px on 24px at −0.011em, 15px on 20px at −0.009em, 14px on 20px at −0.006em, 13px on 18px at −0.003em, and 12px at 1.4× line height at 0. Letter spacing tightens as size grows, and line heights sit on a 4px grid, except fine print.
- **Let wrapped text breathe.** Single-line labels can sit on a tight line. Paragraphs need room: about 1.5× the size for body text. Fine print is the exception: 12px reads best a little tighter, at about 1.4×, so a block of it stays together. Space between paragraphs is about three quarters of a line, and space between blocks is bigger than space between lines.
- **Links inside text stay the text color.** Mark them with a thin, low-contrast underline set slightly below the text, not with blue or bold.
- **Color only where it carries meaning.** Most of the UI is greys: strong for titles, muted for everything else. Color is for real content (logos, avatars, photos), one primary action, and true status (an "on" switch, a success check). No decorative colored icons, badges or eyebrow labels.
- **Icons are monochrome.** They share one size and one stroke, use the text color or muted, and line up in a column.
- **List rows have two lines.** A dark label sits over a muted detail line, with a muted value or a chevron on the right. Rows in a list share one height. Dividers start where the text starts, not at the icon.
- **Generous, consistent insets.** About 24px from a dialog's edge to its content. Leave more space between groups than inside a group: 16px between fields, 6px between a label and its field. Everything aligns to one left edge.
- **One button system.** Every button has one height in a given context, and there's at most one primary per view. Buttons are pills by default (`rounded`). Full-width actions in dialogs and forms use squarer corners (`rounded={false}`), 48px tall to match the fields, with 15px semibold text. Things you choose between, like sign-in methods, are taller rounded rows, not buttons. A button that's working shows a spinner over its middle while its label fades out but keeps its space, so the button never changes size. It ignores clicks until it's done.
- **Inputs: a muted fill, and a 1.5px inset line only when it means something.** The line has one width and only changes color. Hover doesn't change anything, so nothing flickers. No outer ring, no shadow.
  - **At rest:** just the theme's muted surface as the fill (the raised grey, `#f6f7f9` on white or `#383838` on dark), with no visible line.
  - **On focus:** the line turns the brand color, or the text color if there's no brand.
  - **On error:** the line turns red, and a short message folds open under the field. It says what to do ("Enter an email address like name@example.com"), not what went wrong. Focus goes to the first wrong field.
  - **Size:** a 48px field with 15px text (16px on touch screens, so iOS doesn't zoom on focus). The 13px medium label sits 6px above the field, in the normal text color, not muted. It names the field, so it has to read clearly.

## Continuity: animate only what changes

- **Whatever stays across a change stays still.** Swapping a palette recolors the same swatches in place. Changing "Download PNG" to "Download JPG" leaves "Download" alone. Never re-render a whole region when only part of it changed.
- **Fold away extra parts, don't pop them in or out.** When one state has more controls than another, the shared ones stay put and the extras open and close in height (the accordion recipe). Things beside a folding element slide over to fill the space rather than jumping.
- **Morph text by the letters it shares.** Letters in both the old and new string glide to their new place. The others fade, with a 2px blur. Pair them by longest common subsequence.
- **Keep spatial logic.** Things leave toward where they're going and arrive from where they came. A control that opens a panel is where the panel comes from.
- **Hold the frame still through steps of the same thing.** In a carousel or tutorial where the user keeps pressing Next, the container keeps its size and only its content changes. Write the steps to the same shape and similar length, and size the content area to the tallest step, so Next never moves out from under the pointer. This is a strong default, not an absolute: if one step truly needs more room, let it grow. Height changes are for going somewhere new, like a nested page in a login.
- **Pick slide or dissolve by what the change means.**
  - **Slide:** for a sequence the user reads in order, like a tutorial or onboarding steps. Forward goes left, back goes right. If every step shows the same object, morph that object instead (see below). That's stronger than sliding.
  - **Dissolve:** for a multi-step flow with nested pages in one container, like a login or a wallet connect popover. This is the Family ConnectKit pattern:
    - The box resizes width and height from its center.
    - The old content fades out in place in about 100ms.
    - The new content starts 20–30ms later and fades in while scaling from 0.97 to 1 (150ms `ease`).
    - Old and new overlap, so the box is never empty.
    - The frame stays still: the close button and header keep their places, and only their text and icons crossfade.
- **Morph objects that are the same thing from one view to the next.** This is the ConnectKit "About Wallets" carousel. If two views show the same object, like the same wallet, screenshot or icon, it carries over and changes shape instead of crossfading:
  - **The shared object is the hub.** Its position, size and container shape ease to their new values: the wallet's circle stretches into an address pill. Old pieces shrink back into it and fade. New pieces grow out from behind it.
  - **Secondary pieces trade places.** One leaves a spot as the next arrives in it. The key recedes from the bottom-right corner just as the compass badge appears there.
  - **The main move takes about 150–200ms with ease-out.** One small follow-through can come after it, like the key settling its angle or the compass needle swinging and coming to rest. Keep that for illustrations in rarely seen places, like onboarding or explainers, never routine controls.
  - **Only the illustration morphs.** The text below it still dissolves. Between views with no shared object, like Connect Wallet and About Wallets, fall back to the plain dissolve.
  - **Don't force it.** Morph only when it's honestly the same object. If you have to invent the connection, dissolve instead.

## Feel: quick and quiet

- **Timing:** 150–250ms with a smooth ease-out (`cubic-bezier(0.22, 1, 0.36, 1)`). Closing is about as fast as opening, or faster.
- **Overshoot:** at most 1–2px or a few percent. If you can see the bounce, it's too much. Use springy pops only for rare moments (see below), never for routine controls.
- **Pressed state:** a slight dip to 97% scale is enough feedback for a press. Don't add a second effect on top of it.
- **Selection:** a calm grey ring outside the item, with a thin gap in the surface color so the item stays fully visible. It opens out from the item's edge in about 150ms. Avoid default-looking black outlines and checkmarks that cover what's selected.
- **Animate only in response to the user.** Nothing moves on page load, when a panel mounts, or when state is restored from storage. Wire one-off effects to the event, such as a click, not to the state. That way they don't replay when the state is reached some other way.

## Delight goes where actions are rare

The more often something happens, the plainer it should be. Routine controls like sliders, swatches and tabs get polish but no flourish. Rare moments can carry more: a first image, the first export, finishing setup. Even then, keep it brief, and don't repeat it every time.

## Mechanics

- **Recipes:** use transitions-dev recipes as written. Change only their tunable variables, and note any deviation in a comment.
- **Reduced motion:** every animation has a `prefers-reduced-motion` path that jumps straight to the final state.
- **Animate cheap properties:** opacity, transform, filter, and `grid-template-rows` for height. Fading between two gradients means animating their color stops through registered `@property` colors, because gradient images can't interpolate.
- **Hidden content:** content that is folded away or fading out gets `inert` or `aria-hidden`, so it can't be focused or read. Clipping must not cut off focus rings or selection rings. Give them room with matching padding and negative margin.
- **Clipping a resizing box:** use `overflow: clip`, not `hidden`, and focus new content with `focus({ preventScroll: true })`. A `hidden` box can still be scrolled. Focusing a control past its current edge, before it has grown, scrolls the content and makes it jump.
- **Verify the middle of the animation,** not just its ends. Capture frames partway through, check that layout sizes match before and after, and confirm nothing jumps at the start or end.
