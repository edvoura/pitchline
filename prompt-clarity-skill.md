# Prompt Clarity Skill — Website & Demo Generation

## Core Principle

AI responds to clarity, not adjectives. "Make it look premium" produces generic output.
A layered, intentional structure produces a premium result. This document is the
required thinking pattern behind every prompt this system generates — for demo
websites, landing pages, or full app builds.

The goal of a website is not to be beautiful. The goal is to **guide attention and
create an experience**. Beauty is a side effect of good structure and direction, not
the target itself.

---

## 1. Prompt Architecture (Think in Layers)

Before writing any prompt, answer these in order. Skipping a layer produces vague output.

1. What is this website about?
2. What visual style do I want?
3. What feeling should it create?
4. What sections should exist?
5. What animation style should it use?
6. How should the typography feel?
7. What should the CTA focus on?
8. Should the design feel minimal, bold, luxury, dark, futuristic, corporate, or playful?

The more intentional the structure, the stronger the AI output. Never skip straight
to "build me a website for X."

---

## 2. Structured Prompt Inputs (Required Fields)

Every generated prompt must define these explicitly — never leave them implicit:

- **Goal** — what should this site accomplish?
- **Target audience** — who is this for, specifically?
- **Feeling** — what should the visitor feel in the first 3 seconds?
- **Action** — what should the visitor do next?
- **Brand style / mood** — minimal, luxury, futuristic, bold, corporate, cinematic, playful
- **Typography direction** — serif/sans pairing, weight contrast, scale
- **Layout** — grid-based vs asymmetric, full-bleed vs contained
- **Colour direction** — palette logic, contrast, accent usage
- **Animation / interaction feel** — subtle fade-ins, scroll-triggered reveals, none
- **Visual references** — anchor to real examples ("like Linear.app but warmer")
- **Sections** — explicit list, in order
- **CTA focus** — what the call-to-action should prioritize

---

## 3. Website Structure (Every Section Has a Purpose)

Standard section flow — do not add a section without a defined job:

| Section | Purpose |
|---|---|
| Hero | Immediate clarity: what this is + emotional hook |
| Supporting section | Context, elaboration on the hero promise |
| Features | Concrete capability, tied to a user outcome, not a feature list |
| Social proof | Trust transfer — testimonials, logos, numbers |
| CTA | Singular, unambiguous next action |
| Closing section | Reinforce the feeling, remove final hesitation |

---

## 4. Visual Direction

Direction is the difference between a generic AI output and a premium one. It covers:

- **Mood** — the emotional register of the whole site
- **Typography** — how type should *feel*, not just which font
- **Spacing** — density vs breathing room
- **Atmosphere** — the implied environment (editorial, lab, boutique, terminal, gallery)
- **Movement** — how much motion, how fast, how it should feel (snappy vs slow/cinematic)

---

## 5. The SNAP Framework (Copy & Messaging)

**S**tory → **N**eed → **A**nswer → **P**roof

- Emotion creates attention
- Clarity creates conversion
- Proof creates trust

**Emotional journey:**
- Story: "I feel understood"
- Need: "This problem matters"
- Answer: "This could help me"
- Proof: "I believe this works"

**Voice rule:** Do not write like a marketer. Write like someone who deeply
understands the audience. Great copy doesn't feel manipulative — it feels accurate.

When visuals and emotion work together, a website stops feeling like a page and
starts feeling like an experience people remember.

**Best fit for:** landing pages, sales funnels, hero sections, AI products,
cinematic websites, creative brands.

---

## 6. Standard Workflow

1. **Idea** — define goal, audience, key features
2. **Sitemap** — map pages and user flow structure
3. **Prompt architecture** — build the structured prompt using sections 1–5 above
4. **AI builder** — generate using Claude/Gemini (demo stage) or Lovable/Antigravity (real build)
5. **Refinement** — review and improve content, design, UX
6. **Deployment** — ship to a live domain

Premium/cinematic quality = refinement + structure + direction. Not a better model,
not a longer prompt — a more intentional one.

---

## 7. Master Prompt Template (Auto-Fill Skeleton)

Use this as the compiled output of the prompt generator:

```
BUSINESS: [name, industry, one-line description]
GOAL: [what this site must accomplish]
AUDIENCE: [who this is for]
FEELING: [emotional response on arrival]
MOOD: [minimal / luxury / futuristic / bold / corporate / cinematic / playful]
LAYOUT: [grid / asymmetric, full-bleed / contained]
TYPOGRAPHY: [pairing + weight/scale direction]
COLOR: [palette logic + accent]
ANIMATION: [style + intensity]
VISUAL REFERENCE: [named comparable site/brand]

SECTIONS (in order):
1. Hero — [specific hook for this business]
2. [Supporting section] — [purpose]
3. Features — [outcome-framed, not feature-listed]
4. Social proof — [what kind: testimonials/logos/numbers]
5. CTA — [single focused action]
6. Closing — [final feeling to leave]

COPY DIRECTION (SNAP):
Story: [what makes the audience feel understood]
Need: [the problem that matters to them]
Answer: [how this offering helps]
Proof: [what builds belief]
```

---

## Usage Note

This file governs every prompt this system (or Claude, when assisting Ark directly)
generates for website/app demos. Reference alongside `architecture.md`, `rules.md`,
and `agents.md` when handing structured prompts to Lovable or Antigravity.
