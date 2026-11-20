# AGENTS.md — instructions for AI coding agents

This file is the **single source of agent instructions** for this repo.
Codex reads `AGENTS.md` directly. Claude Code reads `CLAUDE.md`, which imports this file.
**Put every rule here, not in CLAUDE.md**, so both agents always stay in sync.

## Project

**Emberreach** (working title) is an original fantasy tabletop RPG in the classic dungeon-crawl
structure: a GM, 3–5 players, d20 Tests, ancestries, callings (classes), and levels 1–10.
The repo is mostly Markdown game design for now. Code (a dice roller, character builder, and so on) may come later.

## Read before changing anything

The game's established rules live in these files. **They are the source of truth.** Read the
relevant ones before answering design questions or making edits:

| File | Contains |
|---|---|
| [README.md](README.md) | Pitch, design pillars, roadmap |
| [docs/decisions.md](docs/decisions.md) | **Locked design decisions.** Don't contradict these without the user's approval |
| [rules/core-rules.md](rules/core-rules.md) | Core mechanics: Tests, characters, callings, magic, combat, gear, advancement, open questions |
| [rules/gm-guide.md](rules/gm-guide.md) | Foe stat blocks, encounter budgets, starter adventure |
| [sheets/character-sheet.md](sheets/character-sheet.md) | Character sheet template (must match the rules) |

## How we establish rules (workflow)

1. **Proposal:** new ideas go to the user first, or into *Open questions* at the end of
   `rules/core-rules.md`.
2. **Decision:** when the user approves a rule, add a dated entry to `docs/decisions.md`
   (newest at the top) **and** update the rules file it affects, in the same change.
3. **Ripple check:** when a rule changes, search for every place it's referenced and update all of them:
   the core rules, GM guide stat blocks and number tables, the character sheet, and the README.
   Numbers must agree everywhere (DCs, Grit formulas, Momentum costs, and so on).
4. **Open questions:** once a question is decided, remove it from the list and log it as a decision.
5. **Version:** rules files carry a version in their title (`v0.1`). Bump the minor version when you make
   a batch of rule changes, and note it in the decision entry.

## Design guardrails

- **Original content only.** Use genre-standard mechanics (d20, classes, hit points-style stamina,
  advantage-like modifiers) but never copy names, text, spells, monsters, settings, or trademarked
  terms from existing games (no "Dungeons & Dragons", "D&D", SRD wording, beholders, and so on).
  Use our own terms: Test, Boon/Bane, Grit, Wounds, Ember, Momentum, Dread, Calling.
- **Respect the pillars** in README.md: players roll all dice (the GM never rolls in combat),
  fail forward (success at a cost), one core roll, tactical but not fiddly.
- **Keep the terminology consistent.** Capitalize game terms (Test, Boon, Bane, Grit, Wound, Ember,
  Momentum, Dread, Strong success). Don't introduce synonyms.
- **Show the math.** When you propose balance changes, show the expected numbers
  (for example, hit chance at level 1 vs a typical Defense).

## Writing style

- Markdown, using tables for stats. Keep rules text short and in the imperative, addressed to the player as "you".
- Mark placeholders clearly: *(to be written for v0.x)*.
- Use relative links between docs.

## Git

- Default branch `main`. Commit only when the user asks.
- Write commit messages in the imperative and say which rules changed (for example "Rebalance Hexer Grit to 8 + 3/level").

## If code is added later

Put it under `/app` or `/tools` with its own README. Any game numbers in code must be read from
or checked against the rules docs, never hard-coded in a way that silently drifts. Add build and test
commands to this file when they exist.
