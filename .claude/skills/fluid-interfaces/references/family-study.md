# Family wallet onboarding: frame study

This is the source for the rules in SKILL.md. It comes from a 108s iPhone screen recording of the Family wallet onboarding (886×1920 at 60fps; 1pt ≈ 2.25px), measured frame by frame. The times are seconds into that recording. Distances are in points (pt).

## Splash → "Add an Existing Wallet" (0.48–0.85s)

- **Splash.** The sticker collage and "Welcome" block fade out in about 80ms (ink drops from 21 to 4 between 0.48 and 0.58), drifting up a few points.
- **Title.** It moves from the splash title's spot to its new one, crossfading "Welcome to Family" → "Add an Existing Wallet" in the first ~70ms.
  - Fitted curve: `cubic-bezier(0.22, 1, 0.36, 1)` over 460ms, which is the same as a critically damped spring with a 0.3s response.
  - Progress: 37% at 50ms, 68% at 100ms, 85% at 150ms and 94% at 200ms.
- **Wallet stack.** It rises out of a "pocket": the header's bottom edge clips it, so it appears from behind that edge.
  - It starts about 40ms after the title.
  - Fitted as a spring with a 0.38s response and 0.85 damping, overshooting about 1% (green card top: 217 → 221 half-px).
- **Rows.** Each one slides up about 20pt and fades in, about 30ms apart (Import, then No Backup, then Watch).
- **Totals.** About 300ms of visible motion, settled by 350ms.
- **Back.** The exact reverse. The wallet sinks into the pocket, the title moves back down and crossfades, and the stickers fade back in with a slight drift.

## Picking "Import" (3.63–4.1s)

- The row darkens on press.
- The list below the header is replaced vertically: the old rows slide up and fade, and the new rows slide up from below. It's settled in about 300ms.
- The title stays put. The subtitle crossfades in place.
- **Wallet stack.** The green card (the same color as the Import icon) comes forward to the front as the blue and yellow cards slide down into the pocket.
  - About 100ms later, a dark download badge pops in at the card's top-right corner with a small rotation.

## Picking "Secret Recovery Phrase" (4.88–5.25s)

- The green header card grows and moves down to become the big paste card of the next page. "Paste from Clipboard" fades in on top of it.
- The new left-aligned title "Import Wallet" fades in at the top.
- The old centered title and the rows fade out while drifting down with the card.
- The badge shrinks into its corner.
- Settled in about 270ms.

## Info sheet "Watching Wallets" (14.0–15.2s)

- **Shape.** A floating sheet about 8pt inside the screen, with large concentric corners and a solid colored header holding an illustration.
- **Open.** The sheet rises from off-screen to rest in about 170ms, with an overshoot of ~2px. The grey scrim fades in over the same 150ms, and the keyboard drops at the same time.
- **Close.** The sheet falls out in about 110ms, accelerating. The scrim follows over ~170ms, then the keyboard comes back.

## Create flow: steps (22.7–48s)

- **"Create a New Wallet" → "Name Your Wallet."** The primary button is the shared object.
  - It rides up on the keyboard while its label crossfades to "Continue".
  - The new title and field rise about 35pt into place while fading in.
  - The stickers fade, and the progress dashes fade in at the top.
  - Settled in about 250ms.
- **Step to step** (Name → Color → Image → Permissions → Terms): a horizontal overlapping slide.
  - The old content slides left and fades in about 100ms. The new content arrives from about +90pt (a quarter of the width).
  - Fitted for the color grid: travel 94pt, a critically damped spring with a 0.22s response, which matches `--ease-smooth-out` over about 320ms. It's 95% there at 155ms.
  - The Continue button stays. The close ✕ becomes a back ‹.
  - Leaving the avatar step, the avatar fades while scaling up slightly, as if moving toward you.
- **Color selection.**
  - The ring (a gap plus a ring in the swatch's color) appears on the frame you tap.
  - The Continue button and the active progress dash crossfade to the chosen color in about 150ms, or 50–80ms when you change your mind.
  - The chosen color becomes the accent for the rest of the flow, including the avatar background and the wallet card.
- **Icon sheet → emoji sheet.**
  - The pressed row fills.
  - The sheet grows upward from its fixed bottom in about 220ms. "Select Icon" crossfades to "Choose an Emoji" in place, and the rows dissolve into the grid.
  - Picking an emoji drops the sheet in about 100ms. The dashed placeholder fills with the colored circle and the emoji, and an edit badge pops on its corner.
- **Permissions and terms.**
  - A granted permission fills its check circle with a small pop.
  - Each checkbox fills and checks in under 100ms.

## Wallet creation moment (47.4–51.5s)

1. All content fades (about 200ms), and the screen holds blank for about 200ms.
2. "Creating Your Wallet" rises into place, with "Doing some cryptographic magic…" under it.
3. A faint grid card fades in, and thin accent lines trace across it (ambient, low contrast).
4. A gradient semicircle rises from the bottom of the card like a sunrise and expands to fill it. It then resolves into the user's colored card with their emoji, name, "0 ETH" and an address. This takes about 300ms.
5. The headline crossfades to "Your wallet is ready." with "ready." underlined in a hand-drawn purple stroke.
6. "Back Up Now" fades in on the card. About 500ms later, a dark tooltip scales out from it.

## Backup sheet (58.5–68s)

- **Card → sheet.** "Back Up Now" grows the card itself into a full sheet. The card's blue becomes the sheet's header, and the shield illustration emerges inside it. The white body slides in under it, and the scrim darkens. About 220ms.
- **Six explainer steps.**
  - The sheet height and the black Continue button never change.
  - The text slides left out and right in, overlapping, in about 200ms.
  - **Illustration.** A constant phone silhouette stays as the backdrop. Each step's subject swaps on top of it with a shrink-and-fade out and a grow-from-center in. The previous subject can stay as support: the word list slides down and shrinks under the new key badge, with coins orbiting out.
  - **Last step.** The button label crossfades from "Continue" to "Continue To Back Up".
- **Sheet → card.** The reverse morph shrinks the sheet back into the card at the top of the page.
- **Card flip.** The card rotates in 3D around Y (about 400ms, with perspective) to reveal the recovery phrase on the back. The words then fill in one by one.

## Password, backup and home (77–100s)

- **Strength label.** It crossfades with a small vertical roll (Weak in red → Moderate in yellow → Strong in green), and the bars fill to match. A green "Passwords Match" pill fades in.
- **Backup.**
  - After Continue, the form fades out. The card scales up from small near the top into the center while the keyboard drops, and the button label crossfades to "View Wallet".
  - The status pill swaps "Backing Up" (spinner) for "Backed Up" (check) in place. "iCloud Backup Completed" rises in above it.
- **"View Wallet."**
  - The card shrinks and flies down into the wallet tab icon.
  - The home page fades in behind it in order: header, token row, empty state, then buttons, with about 60ms between groups.
- **Token row → detail.**
  - The row expands into a full card/page in about 200ms, and the home page recedes behind it.
  - The price chart draws in after the page has settled (about 200ms later).

## Look notes (iPhone, in pt)

- **Titles.** About 24–28pt, medium weight (not bold), near black. They're left-aligned in steps and centered under a hero. Subtitles are about 17pt in muted grey with a ~1.3 line height. The title-to-subtitle size ratio is about 1.5:1, and the gap between them is tight (~8pt).
- **Fine print.** About 13pt, muted, sitting directly above the bottom button.
- **Rows.** Filled cards (very light grey, hairline border, ~20pt radius, ~16pt padding):
  - a colored 36pt icon circle
  - a 17pt medium label
  - a two-line muted detail at about 15pt
  - an overflow "⋮" on the right

  Rows are about 12pt apart.
- **Buttons.**
  - The primary button is a full-width pill about 50pt tall: brand blue on pages, black inside sheets. When disabled, it's a pale tint of its color, not grey.
  - Secondary buttons are a grey pill.
- **Emphasis.** In explainer copy, one accent-colored word gets a hand-drawn or gradient underline. It's used only on rare screens.
- **Color.** Almost everything is greys. Color goes to the hero illustration, category icons, the user's chosen accent, and status (red, yellow and green for strength).
