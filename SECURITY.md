# Security Policy

## Supported versions

| Version                                           | Supported                         |
| ------------------------------------------------- | --------------------------------- |
| Latest release on `main` (App Store / Play Store) | Yes                               |
| Development builds from `develop`                 | Best effort                       |
| Older store builds                                | No — update to the latest release |

## Reporting a vulnerability

**Do not** open a public GitHub issue for security problems.

Please report vulnerabilities privately using one of these channels:

1. **GitHub Private Vulnerability Reporting** (preferred):  
   [Report a vulnerability](https://github.com/Japegomez/jugaMUS/security/advisories/new)
2. **Email:** [japenago@gmail.com](mailto:japenago@gmail.com) with subject  
   `[jugaMUS] Security vulnerability`

Include as much detail as you can:

- Description of the issue and potential impact
- Steps to reproduce (PoC, screenshots, or request/response samples)
- Affected version, platform (iOS / Android / web), and environment
- Whether you have a suggested fix

### Scope (examples)

In scope:

- Authentication / session issues (including OAuth)
- Unauthorized data access (RLS / API / Edge Functions)
- Injection, XSS, or similar client/server flaws
- Secrets exposure in the repo or client builds
- Privilege escalation (e.g. gaining `admin` without authorization)

Out of scope:

- Social engineering / physical attacks
- Denial of service against third-party providers
- Issues only present on rooted/jailbroken devices or modified clients
- Vulnerabilities in dependencies already fixed in a newer release we have not yet shipped (Dependabot / security updates handle tracking)

## What to expect

| Step                      | Target                                               |
| ------------------------- | ---------------------------------------------------- |
| Acknowledgement           | Within **72 hours**                                  |
| Initial triage / severity | Within **7 days**                                    |
| Fix or mitigation plan    | Depends on severity; critical issues are prioritized |

If the report is accepted, we will credit you in the advisory (unless you prefer to remain anonymous). If it is declined, we will explain why.

Please give us reasonable time to investigate and ship a fix before any public disclosure.

## Dependency security

This repository uses:

- **Dependabot** alerts and version updates (see `.github/dependabot.yml`)
- **`npm audit`** in CI (`quality` workflow, high severity and above), with an allowlist only for unpatched `image-size` advisories transitive via Metro/Expo SDK 54 (`scripts/npm-audit-ci.mjs`)

Security-related dependency fixes may land on the default branch (`main`); routine version updates are reviewed via Dependabot PRs.

## Safe harbor

We welcome good-faith security research. If you follow this policy, avoid privacy violations and service disruption, and report findings promptly, we will not pursue legal action related to that research.
