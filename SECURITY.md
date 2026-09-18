# Security Policy

AgentPlace will handle financial actions, so security defects should not be disclosed in public issues when exploitation could put users or funds at risk.

## Supported versions

The latest `main` branch and current tagged release receive security fixes during active development.

## Reporting a vulnerability

Use GitHub private vulnerability reporting when enabled for the repository. Do not include private keys, seed phrases, real production credentials, or unnecessary personal/financial data in a report.

If private reporting is temporarily unavailable, contact the repository owner through a private channel before publishing technical exploit details.

## Repository rules

- Never commit `.env`, private keys, seed phrases, signing files or production credentials.
- Example configuration must contain placeholders/safe defaults only.
- Mainnet execution/autonomy remain disabled unless an explicit production gate enables them.
- Dependencies with unresolved High/Critical findings block production-readiness gates unless formally risk-accepted and documented.
- Changes to authority, signing, billing, execution or verification require focused security review.
