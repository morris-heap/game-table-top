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
| [data/](data/) | Machine-readable game numbers used by the app. Must match the rules files |

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

## Git and Jira

- Default branch `main`. Commit only when the user asks.
- Work is tracked in Jira project **KAN** (Table Top Game). Name branches `KAN-<n>-short-slug`,
  and mention the KAN key(s) in commit messages and PR titles.
- Write commit messages in the imperative and say which rules changed (for example "Rebalance Hexer Grit to 8 + 3/level").

## Companion app (`/app`)

Vite + React + TypeScript static site, deployed to https://morris-heap.github.io/virtual-table-top-ember-reach/
by `.github/workflows/app.yml` on pushes to `main`. See [docs/adr/0001-companion-app-stack.md](docs/adr/0001-companion-app-stack.md).

- Commands (run in `app/`): `npm install`, `npm run dev`, `npm test`, `npm run lint`, `npm run build`.
  **Run test, lint and build before you commit app changes.**
- Game logic goes in `app/src/engine/` as pure functions with an injectable RNG, and every rule gets unit tests.
- **Game numbers come from `/data/*.json`, never hard-coded.** When a rule's numbers change,
  update `rules/*.md` **and** `/data` in the same change (this is part of the ripple check above).
- Vite `base` is `/virtual-table-top-ember-reach/`. Use relative or base-aware paths for assets.
