# Pitchline — Generation Quality Options

Ways to make sure every AI-generated demo hits the clarity/direction bar from
`prompt-clarity-skill.md`, regardless of how thorough the operator is when filling
the form. These aren't mutually exclusive — pick a combination based on how much
control vs. speed you want.

---

## Option 1: Baked-In System Instruction (Recommended — Implemented)

Every call to `generateDemo()` wraps the compiled prompt in a fixed system
instruction that encodes the framework's non-negotiables, independent of what the
operator filled in:

```
You are building a single-page website demo. Follow these rules regardless of
how much detail is given below:
- Every section must have one clear purpose (Hero: immediate clarity + hook.
  Features: outcome-framed, not a feature list. Social proof: trust transfer.
  CTA: one unambiguous action. Closing: reinforce feeling.)
- Write copy using Story → Need → Answer → Proof. Never write like a marketer —
  write like someone who understands this exact audience.
- Respect the stated mood precisely — do not default to generic "modern clean"
  design if a specific mood (luxury, futuristic, dark, playful, etc.) is given.
- Output one self-contained HTML file, inline CSS/JS, no external build step.
```

**Why do this:** it's a one-time change, applies to every generation
automatically, and protects quality even if the operator rushes through the form.

---

## Option 2: Smart Defaults Instead of Blank Fields (Implemented)

If the operator leaves a Direction field empty, don't send it as blank/omitted —
have the compile step fill a sensible default based on industry:

- Dentist/medical → mood: clean, corporate; typography: sans-serif, high
  legibility
- Restaurant/cafe → mood: warm, luxury or cozy; typography: serif accents
- SaaS/tech → mood: minimal, futuristic; typography: geometric sans

**Why do this:** prevents the model from guessing wildly on an empty field —
guided defaults beat an unconstrained blank every time.

---

## Option 3: Two-Stage Generation (Plan → Build)

Instead of one call that goes straight from compiled prompt to final HTML, split
it in two:

1. **Stage 1 — Plan:** ask the model to output a short structured plan (section
   list with one-line purpose each, copy outline per SNAP, color/type choices) as
   JSON
2. **Stage 2 — Build:** feed that plan back in as additional context, ask for the
   final HTML

**Why do this:** catches vague or off-direction output at the cheap, fast
planning stage before spending tokens on a full HTML build. Adds latency and
complexity — worth it once volume is high enough that occasional bad demos become
costly, not necessary on day one.

---

## Option 4: Self-Critique Pass

After generation, run one more call: "Review this output against the following
checklist — does every section have a clear purpose? Does the copy follow Story/
Need/Answer/Proof? Does it match the stated mood? Fix anything that doesn't."

**Why do this:** genuinely improves consistency, but doubles token cost and
generation time per demo. Best used selectively — e.g. only for high-value
leads, not every single one.

---

## Option 5: Few-Shot Anchor Example

Include one short, concrete example of a well-executed section (not a full page —
just one Hero example) directly in the system instruction, so the model has a
concrete quality bar to pattern-match against rather than an abstract description.

**Why do this:** models generally follow a shown example more reliably than a
described one. Costs a bit of prompt length/tokens on every call.

---

## Option 6: Provider-Specific Tuning

Claude and Gemini may respond differently to the same instruction — one might
need more explicit repetition of "respect the exact mood given" while the other
follows it fine on the first pass. Once you've run demos through both for a
while, adjust each provider module's system instruction slightly based on
observed drift, rather than assuming one instruction set works identically for
both.

---

## Status / Recommendation

Option 1 (baked-in system instruction) + Option 2 (smart defaults) are active in
the system. Both provide cheap, zero-latency quality guardrails for every generation.
