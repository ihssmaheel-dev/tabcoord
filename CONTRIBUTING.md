# Contributing to TabCoord

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/ihssmaheel-dev/tabcoord.git
cd tabcoord

# Install dependencies
pnpm install

# Run all tests
pnpm test

# Run build
pnpm build
```

## Project Structure

```
packages/
  core/       tabcoord       — The main library
  react/      tabcoord-react — React hooks (re-exports core)

demos/
  shared-cart/     — Shopping cart demo
  auth-sync/       — Auth sync demo
  background-sync/ — Leader election demo
  distributed-form/— Field merge demo
  ssr-smoke/       — SSR test
```

## Making Changes

1. **Create a branch** from `main`
2. **Make your changes** in `packages/core/src/` or `packages/react/src/`
3. **Add tests** in `packages/core/src/__tests__/` or `packages/react/src/__tests__/`
4. **Run tests** with `pnpm test`
5. **Run build** with `pnpm build`
6. **Submit a PR** with a clear description

## Code Style

- TypeScript strict mode
- No semicolons
- Single quotes
- 100 char line width
- Run `pnpm run lint` to check formatting

## Testing

```bash
# Run all tests
pnpm test

# Run just core tests
pnpm --filter tabcoord test

# Run just react tests
pnpm --filter tabcoord-react test

# Run E2E tests
pnpm test:e2e
```

## Questions?

Open an issue on GitHub. We're happy to help!
