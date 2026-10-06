# Studying a reference recording

Use this when the user shares a screen recording of an app whose motion they like. The goal is numbers you can build from, not adjectives.

1. **Find the moments.** Run `node scripts/frames.mjs scan <video>`. It lists every stretch where pixels change, with its length. Ignore single-frame blips; they're compression noise or a blinking cursor.
2. **Overview.** Make a sheet with one frame per second (`sheet <video> ov.jpg "0.5-35.5@1" 12 160`) to map the screens.
3. **Read each moment.** For each segment, make a sheet at 30fps (`@0.0333`), or 60fps (`@0.0167`) for anything under 300ms. Crop to the area that moves so the details are readable. Look for:
   - What stays, what's shared, what's new and what's gone (SKILL.md section 1).
   - The order things start in (the stagger), and which element lands last.
   - Where new things come from: an edge, an anchor, the tapped element.
   - Whether opacity and position finish at the same time. They usually don't: the fade finishes well before the move.
4. **Measure curves when it matters.** Track one feature's position per frame:
   - **Where to read it:** a colored edge, the first row of dark text in a band, or the left edge of saturated pixels.
   - **Normalize:** convert each position to 0–1 progress.
   - **Fit:** try `cubic-bezier(0.22, 1, 0.36, 1)` at several durations, plus damped springs (response 0.2–0.5s, damping 0.7–1). Those two families cover nearly all native iOS motion.
   - **Record:** the start delay, the duration to 95%, and any overshoot.
5. **Convert units.** iPhone recordings are pt × scale: an 886px-wide recording of a 393pt phone is 2.25px per pt. Page-level distances on a phone shrink for a desktop dialog: keep the fraction of the container, not the points.
6. **Write it down** in a `references/<app>-study.md` next to this one: timings per moment, what's shared, and look notes (type sizes, weights, spacing, color). Then fold any new rule into SKILL.md.

The recordings are often several minutes of 60fps video. Keep sheets small (≤ 2000px wide) and read them in batches rather than extracting thousands of frames.
