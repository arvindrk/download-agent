# download-agent

Scheduled Trigger.dev task that validates production download/install flows for:

- npm package: `extract-design-system`
- skill install: `https://skills.sh/arvindrk/extract-design-system/extract-design-system`

## What it does

On each cron run, the task:

1. Creates a fresh E2B sandbox.
2. Runs `npm view extract-design-system version`.
3. Runs `npm pack extract-design-system`.
4. Runs `npm install extract-design-system` in a clean temp project.
5. Runs `npx --yes skills add https://github.com/arvindrk/extract-design-system --skill extract-design-system`.
6. Runs `npx --yes skills --help` as a smoke check.
7. Sends email via Resend on final failed retry attempt.

## Setup

1. Copy `.env.example` into your own environment manager.
2. Install dependencies:

```bash
npm install
```

3. Configure Trigger.dev:
   - Set `TRIGGER_PROJECT_REF`.
   - Set `TRIGGER_SECRET_KEY`.
4. Configure E2B:
   - Set `E2B_API_KEY`.
5. Configure Resend:
   - Set `RESEND_API_KEY`.
   - Set `ALERT_EMAIL_FROM` (verified sender domain).
   - Set `ALERT_EMAIL_TO` (comma-separated recipients).

## Local verification

```bash
npm run typecheck
npm run run:local
```

## Trigger.dev commands

```bash
npm run dev:trigger
npm run deploy:trigger
```

## Schedule config

Frequency is deploy-time configurable:

- `DOWNLOAD_AGENT_CRON` (e.g. `0 */6 * * *`)
- `DOWNLOAD_AGENT_TIMEZONE` (IANA timezone, e.g. `UTC`)
