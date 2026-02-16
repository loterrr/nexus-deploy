# Contributing to The Archive

Thank you for your interest in contributing to The Archive! This document provides guidelines and instructions for contributing.

## Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/nexus-deploy.git
   cd nexus-deploy
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Development Server**
   ```bash
   npm run dev
   ```

## Code Style

- **TypeScript**: We use strict TypeScript mode. All code must pass type checking.
- **Formatting**: Code is automatically formatted using Prettier on commit via Husky hooks.
- **Linting**: Run `npm run lint` before committing.

## Commit Guidelines

- Use clear, descriptive commit messages
- Follow conventional commits format: `type(scope): message`
  - Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
  - Example: `feat(chat): add export functionality`

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes and commit them
3. Push to your fork: `git push origin feature/your-feature-name`
4. Open a Pull Request with:
   - Clear description of changes
   - Screenshots for UI changes
   - Reference to related issues

## Testing

- Write unit tests for new features
- Ensure all tests pass: `npm test`
- Test manually in the browser

## Code Review

- All PRs require at least one review
- Address review comments promptly
- Keep PRs focused and reasonably sized

## Questions?

Open an issue or reach out to the maintainers.

Thank you for contributing! 🎉
