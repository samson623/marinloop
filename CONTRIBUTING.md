# Contributing to MarinLoop

Thank you for your interest in contributing to MarinLoop. This guide covers the development setup, conventions, and pull request process.

## Development Setup

1. **Clone and install:**
   ```bash
   git clone <repo-url>
   cd marinloop
   npm install
   cp .env.example .env
   ```

2. **Configure environment:** Fill in `.env` with your Supabase project credentials. See the [Quick Start](README.md#quick-start) in the README for full details.

3. **Start the dev server:**
   ```bash
   npm run dev
   ```

## Branch Naming

Use descriptive branch names with a prefix:

| Prefix | Use |
|--------|-----|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `refactor/` | Code restructuring without behavior changes |
| `docs/` | Documentation only |
| `ci/` | CI/CD pipeline changes |
| `test/` | Test additions or fixes |

Examples: `feat/vitals-chart`, `fix/push-notification-retry`, `docs/update-setup-guide`

## Commit Conventions

Write clear, imperative commit messages:

- **Do:** `Add vital threshold alerts to health view`
- **Do:** `Fix duplicate push notification on schedule overlap`
- **Don't:** `Updated stuff` / `WIP` / `fix`

Keep commits focused. One logical change per commit.

## Running Checks

Before opening a PR, run the full check suite locally:

```bash
npm run typecheck   # TypeScript strict mode
npm run lint        # ESLint
npm test            # Vitest unit tests
npm run build       # Production build
```

For end-to-end tests (requires configured Supabase credentials):

```bash
npm run test:e2e
```

## Pull Request Process

1. Create a branch from `main` using the naming convention above.
2. Make your changes with passing tests and no lint errors.
3. Push your branch and open a pull request against `main`.
4. Fill out the PR template — describe the change, check the boxes, and include screenshots for UI changes.
5. CI must pass (typecheck, lint, test, build, bundle size check) before merge.
6. At least one review approval is required.

## Security Vulnerabilities

**Do not open a public issue for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for responsible disclosure instructions.

## Code of Conduct

Be respectful and constructive. MarinLoop is a healthcare-adjacent project — accuracy and user safety matter. When in doubt, ask questions before making assumptions.
