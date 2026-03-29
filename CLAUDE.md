@AGENTS.md

## Commit Convention

Always use **Conventional Commits** format:

```
<type>(<scope>): <description>

[optional body]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`

Examples:
- `feat(hero): add parallax depth to star sprites`
- `fix(contact): reset hCaptcha token after successful submit`
- `chore: remove unused wrangler dependency`

## Versioning

Follow **Semantic Versioning 2.0.0** (`MAJOR.MINOR.PATCH`):
- `MAJOR` — breaking changes
- `MINOR` — new features, backwards compatible
- `PATCH` — bug fixes, backwards compatible
