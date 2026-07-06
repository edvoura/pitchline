# Pitchline — Demo Refinement & Baseline Quality Addendum

Follow-up to `prompt-clarity-skill.md` and `generation-quality-options.md`. This
covers two things: (1) making sure animation and aesthetic polish are never
optional/missing by default, and (2) how to give the Refine feature clear
feedback when a demo comes out weak.

---

## Part 1: Bake Animation & Aesthetic Polish Into Every Generation

Don't rely on the operator remembering to fill "Animation: expressive" every
time. Add this as a **baseline clause** inside the system instruction from
`generation-quality-options.md` (Option 1), so it applies even when the
Animation field is left at "none" or "subtle" by default:

```
Baseline quality bar — apply even if not explicitly requested:
- Include tasteful micro-interactions: hover states on buttons/cards, smooth
  scroll-triggered fade-ins on section entry, subtle transitions — never a
  static, flat page with zero motion, unless "no animation" is explicitly and
  deliberately requested.
- Visual hierarchy must be obvious at a glance: clear spacing rhythm, intentional
  contrast, no cramped or uniform-looking blocks of text.
- Never default to a generic template look (centered text + stock gradient +
  Bootstrap-like buttons). If mood is unspecified, choose a specific point of
  view (e.g. lean minimal-editorial) rather than a safe middle-ground default.
- Every demo should look like it took a designer a day, not like a form was
  auto-filled into a template.
```

This becomes a permanent floor under the Direction fields — the operator's
inputs still steer style, but this stops any demo from shipping "boring" as an
option.

---

## Part 2: Giving Useful Refine Feedback

The Refine field is free text appended to the original brief — but vague feedback
gets vague fixes. Use this structure when something's off:

**Bad feedback (too vague):** "make it better" / "not good enough"

**Good feedback (specific + tied to the framework):**
- *Structural issue:* "The Features section reads like a spec sheet — reframe
  each item around the outcome for the customer, not the feature itself."
- *Mood mismatch:* "This looks generic-corporate, but I asked for luxury —
  increase whitespace, use a serif headline font, reduce the accent color's
  saturation."
- *Copy issue:* "The hero copy sounds like a marketer wrote it. Rewrite so it
  sounds like someone who understands a small restaurant owner's actual daily
  problem."
- *Animation/motion issue:* "There's no motion at all — add scroll-triggered
  fade-ins per section and a hover state on the CTA button."
- *Missing proof:* "There's no social proof section — add one, even a
  placeholder-style testimonial block, since this industry buys on trust."

**Rule of thumb:** name *which layer* is failing (Structure / Direction / Copy /
Animation) before describing the fix — this maps directly to the framework, so
the model has something concrete to correct rather than reinterpreting a mood
word from scratch.

---

## Part 3: Quick Pre-Send Quality Checklist (For You, Before Marking "Ready & Send")

Before sending any demo to a prospect, scan for:

- [ ] Does the Hero communicate what this is within 3 seconds?
- [ ] Is there visible motion (not a flat, static page)?
- [ ] Does every section have a clear, single purpose?
- [ ] Does the copy sound specific to this business, not generic filler?
- [ ] Is there a single, obvious CTA — not competing buttons?
- [ ] Does the mood match what you intended (not defaulted to generic-corporate)?

If two or more boxes fail, don't send — hit Refine with specific feedback per
Part 2 first.

---

## Part 4: Automated Post-Generation Checklist Prompt (Build This In)

Once a demo finishes generating (or re-generates after a Refine), the app surfaces
a short confirmation checklist alongside the Preview screen.

```
Quick check before this goes further:
[ ] Hero communicates what this is within 3 seconds
[ ] Visible motion/animation present (not flat/static)
[ ] Every section has a clear, single purpose
[ ] Copy sounds specific to this business, not generic
[ ] Single, obvious CTA — no competing buttons
[ ] Mood matches what was intended
```

- If unchecked items remain → shows a soft nudge ("N item(s) unchecked — consider hitting Refine first")
- Provides quick-refine suggestions to jump straight into giving specific feedback per Part 2.
