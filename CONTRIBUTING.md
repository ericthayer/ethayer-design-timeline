# Contributing

Spec-driven workflow first: read [`CLAUDE.md`](CLAUDE.md) and [`specs/constitution.md`](specs/constitution.md) before changing anything.

## Commits and releases

Commits and PR titles follow [Conventional Commits](https://www.conventionalcommits.org/). A `commit-msg` hook (commitlint, installed by `npm install`) checks commits locally, and CI checks PR titles. [release-please](https://github.com/googleapis/release-please) reads the commits on `main` to pick the next version, write `CHANGELOG.md` and tag `vX.Y.Z`. Don't edit the version or `CHANGELOG.md` by hand.

| Commit | Release |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `feat!:` / `BREAKING CHANGE:` footer | major (minor while < 1.0) |
| `docs` `style` `refactor` `perf` `test` `build` `ci` `chore` | none on its own |

Scopes are optional. Use the module or spec the change belongs to: `content-json`, `admin-auth`, `media-pipeline`, `components`, `core`, `styles`, `content`, `ci`, or a spec number such as `004`. Keep citing the task ID in the subject or body, for example `feat(admin-auth): refuse read-only tokens (T351)`.

Flow: branch → PR with a conventional title → squash merge → release-please updates its release PR → merge it to release.
