# Security Policy

## Supported Versions

Only the latest release of Mailcatcher receives security fixes.  
Older versions are not actively maintained.

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |
| older   | :x:                |

---

## Reporting a Vulnerability

We take security issues seriously. If you discover a vulnerability, please **do not** open a public GitHub issue. Instead, follow the responsible disclosure process described below.

### How to Report

1. **GitHub Private Vulnerability Reporting (preferred)**  
   Use GitHub's built-in private reporting feature:  
   [Report a vulnerability](https://github.com/erkenes/mailcatcher/security/advisories/new)

2. **Email (alternative)**  
   If you prefer e-mail, send a message to the maintainer. You can find the contact address in the GitHub profile of [@erkenes](https://github.com/erkenes).

### What to Include

Please provide as much detail as possible to help us reproduce and assess the issue:

- A clear description of the vulnerability
- The component or file(s) affected
- Step-by-step instructions to reproduce the issue
- Potential impact (e.g., data exposure, denial of service)
- Any suggested fix or mitigation (optional but appreciated)

### What to Expect

| Step                        | Timeframe          |
|-----------------------------|--------------------|
| Acknowledgement of report   | Within **48 hours**  |
| Status update               | Within **7 days**    |
| Fix or mitigation released  | As soon as possible  |

We will keep you informed of our progress. Once the vulnerability is fixed, we will credit you in the release notes (unless you prefer to remain anonymous).

---

## Scope

The following are considered **in scope**:

- The SMTP server (`src/smtp.js` and related modules)
- The web UI and HTTP server (`src/web.js` and related modules)
- Email parsing and storage logic
- Docker image configuration (`Dockerfile`, `docker-compose.yml`)
- Dependency vulnerabilities that affect a production deployment

The following are generally **out of scope**:

- Vulnerabilities in development-only dependencies
- Issues in third-party services or infrastructure not controlled by this project
- Reports without a reproducible proof of concept

---

## Security Best Practices for Deployers

Mailcatcher is intended for **development and testing environments only**. It does **not** implement TLS, authentication, or access controls.

- **Do not expose** the SMTP port (default `2525`) or the web UI port (default `3000`) to the public internet.
- Run the service inside a private network or behind a firewall/reverse proxy.
- Use Docker network isolation to limit which services can reach the SMTP port.
- Rotate or delete stored emails regularly by configuring `MAIL_RETENTION_DAYS`.

---

## Disclosure Policy

We follow a **coordinated disclosure** model. We ask that you give us a reasonable amount of time to fix the issue before making any public disclosure. We will work with you to agree on a disclosure timeline that is fair to both parties.

Thank you for helping keep Mailcatcher and its users safe!
