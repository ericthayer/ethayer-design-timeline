# Agent guide

This repo uses spec-driven development. Before you change anything:

1. Read `specs/constitution.md`. Its rules are non-negotiable (design lock, zero runtime dependencies, no `innerHTML`, WCAG 2.2 AA, performance budgets).
2. Find the active feature under `specs/<NNN-name>/`. `spec.md` says what and why, `plan.md` says how, and `tasks.md` is the ordered work.
3. Work one task at a time, in order, and cite its `T###` ID in the commit message.
4. Don't start a task that comes after an unapproved `CP*` checkpoint.
5. Never update a visual baseline under `tests/visual/` unless the owner has explicitly approved it.
6. If you need to change behavior, update `spec.md` first.
