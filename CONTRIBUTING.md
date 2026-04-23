# Contributing to Mailcatcher

Thank you for considering contributing to Mailcatcher! This document explains how you can help and what guidelines to follow.

---

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Running Tests](#running-tests)
- [Commit Message Convention](#commit-message-convention)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Code Style](#code-style)

---

## Ways to Contribute

- **Report bugs** by opening an issue
- **Suggest new features** or improvements
- **Fix bugs** or implement features by submitting a pull request
- **Improve documentation** (README, code comments, this file)
- **Write or improve tests**

---

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/mailcatcher.git
   cd mailcatcher
   ```
3. **Create a new branch** for your change:
   ```bash
   git checkout -b feat/my-new-feature
   ```
4. Make your changes, commit them following the [Commit Message Convention](#commit-message-convention), and push to your fork.
5. Open a **Pull Request** against the `main` branch.

---

## Development Setup

Requires **Node.js** (see `.nvmrc` for the recommended version).

```bash
# Install dependencies
npm install

# Start the application
npm start
```

Alternatively, use Docker Compose:

```bash
docker compose up --build -d
```

---

## Running Tests

```bash
npm test
```

Make sure all existing tests pass before submitting a pull request. If you add new functionality, please add corresponding tests.

---

## Commit Message Convention

This project follows **[Conventional Commits](https://www.conventionalcommits.org/)**.  
Every commit message **must** follow this format:

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer(s)]
```

### Types

| Type       | When to use                                                        |
|------------|--------------------------------------------------------------------|
| `feat`     | A new feature                                                      |
| `fix`      | A bug fix                                                          |
| `docs`     | Documentation changes only                                         |
| `style`    | Formatting, missing semicolons, whitespace – no logic change       |
| `refactor` | Code change that neither fixes a bug nor adds a feature            |
| `perf`     | Performance improvement                                            |
| `test`     | Adding or updating tests                                           |
| `build`    | Changes to the build system or external dependencies               |
| `ci`       | Changes to CI/CD configuration files and scripts                   |
| `chore`    | Maintenance tasks that don't modify src or test files              |
| `revert`   | Reverts a previous commit                                          |

### Examples

```
feat(smtp): add STARTTLS support
fix(web): correct attachment download filename encoding
docs: update environment variable table in README
test(mail-parser): add edge-case tests for HTML emails
chore: bump dependencies to latest patch versions
```

### Breaking Changes

Append `!` after the type/scope **and** add a `BREAKING CHANGE:` footer when introducing a breaking change:

```
feat(api)!: rename /reload endpoint to /mails/reload

BREAKING CHANGE: The previous /reload endpoint has been removed.
```

Commits that do not follow this convention will be asked to be amended before merging.

---

## Pull Request Process

1. Ensure your branch is up to date with `main` before opening the PR.
2. Fill in the pull request template (if present) with a clear description of what and why.
3. Reference any related issues (e.g., `Closes #42`).
4. All commits must follow the [Commit Message Convention](#commit-message-convention).
5. At least one maintainer review is required before merging.
6. Squash-merge or rebase-merge may be used to keep the history clean.

---

## Reporting Bugs

Please open a [GitHub Issue](https://github.com/erkenes/mailcatcher/issues) and include:

- A clear and descriptive title
- Steps to reproduce the problem
- Expected vs. actual behaviour
- Your environment (OS, Node.js version, Docker version if applicable)
- Relevant log output or screenshots

---

## Suggesting Features

Open a [GitHub Issue](https://github.com/erkenes/mailcatcher/issues) with the label **enhancement** and describe:

- The problem your feature would solve
- Your proposed solution or idea
- Any alternatives you have considered

---

## Code Style

- Follow the existing code style found in the `src/` directory.
- Keep functions small and focused on a single responsibility.
- Avoid introducing new runtime dependencies unless absolutely necessary – open an issue first to discuss.
- All new public-facing behaviour should be covered by tests.
