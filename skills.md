# Pitchline — skills.md

Reusable patterns and logic the system should follow. This file connects the
backend implementation to the prompt-clarity framework (`prompt-clarity-skill.md`)
so the Prompt Generator's compiled output is never a vague AI request.

## Prompt Compilation Skill

When the operator fills the Prompt Generator form and hits "Compile Prompt," the
backend (or a shared utility function, callable from both the compile step and the
generation step) must assemble the structured template — never pass the raw form
fields straight to the AI provider as loose JSON or a casual sentence.

Compiled prompt shape (matches `prompts` table columns):

```
BUSINESS: {business}, {industry}, {location}
GOAL: [derived from industry + CTA focus]
MOOD: {mood}
LAYOUT: {layout_style}
TYPOGRAPHY: {typography}
COLOR: {color_direction}
ANIMATION: {animation}
VISUAL REFERENCE: {visual_reference}

SECTIONS (in order):
{sections list, including any custom entries}

CTA FOCUS: {cta_focus}

COPY DIRECTION (SNAP):
Story: {story}
Need: {need}
Answer: {answer}
Proof: {proof}
```

This compiled string is what gets saved to `prompts.compiled` and sent to
`generateDemo()`. Never let the raw form object go to the provider unformatted —
clarity of structure is what produces a usable first-pass demo instead of a
generic template.

## Provider Call Skill

Each provider module (`lib/providers/claude.ts`, `lib/providers/gemini.ts`) should:

1. Accept the compiled prompt string
2. Wrap it in a system instruction that tells the model to output a single
   self-contained HTML file (inline CSS/JS, no external build step) so it can be
   rendered directly in the Preview iframe
3. Parse the response to strip any markdown code fences before storing
4. Return `{ html, tokensUsed, generationMs }` per the shared interface in
   `rules.md`

## Refinement Skill

When the operator uses the "Refine" action in Preview, the follow-up instruction
should be appended as additional context to the *original* compiled prompt, not
sent as a bare instruction on its own — the model should always see the full
original direction plus the specific refinement request, so it doesn't drift from
the original mood/structure while making the requested change.

## Template Application Skill

When a saved template is applied in the Prompt Generator, it should populate every
Direction field (mood, layout, typography, color, animation, sections) but leave
business-specific fields (business name, industry, location, SNAP inputs) empty —
templates carry *direction*, never copy. This keeps every generated demo's
messaging specific to the actual lead, even when the visual direction is reused.

## Reference

Full prompting philosophy, section-purpose breakdown, and SNAP framework detail
live in `prompt-clarity-skill.md` — treat that file as the source of truth for
*why* the compiled prompt is structured this way; this file covers *where* that
logic is implemented in code.
