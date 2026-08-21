# BGSL public donation form anti-abuse findings

**Date:** 2026-08-21

**Scope:** Public raffle/in-kind donation form; primary sources only: official Cloudflare Turnstile documentation and OWASP guidance.

## Finding

The most elegant design for BGSL is a layered, graduated pipeline—not a single “spam filter”:

```text
request
  → schema/size checks + honeypot
  → edge/IP and application rate limits
  → server-side Turnstile verification
  → application risk decision
       low risk       → save NEW + send admin email
       suspicious     → save NEEDS_FOLLOW_UP + do not send immediate email
       confirmed bot  → silently reject/no-op
```

This follows OWASP’s three-layer model: edge controls, application controls such as rate limits and honeypots, and backend/business controls such as anomaly detection, fraud scoring, and asynchronous review queues. OWASP also recommends graduated responses instead of hard-blocking on the first weak signal. ([OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html))

## What each layer should do

### 1. Validate the request on the server

Keep schema validation, length limits, normalization, and semantic checks on the server before the submission reaches downstream work. OWASP says server-side validation must happen before application functions process the data; allowlists should be primary, while denylists may supplement them. ([OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html))

For this form, that means accepting ordinary names and free-form item descriptions without trying to define a “valid human” vocabulary. Validate shape and size first; treat spam-language and machine-like text as later risk signals.

### 2. Keep both edge and application rate limits

Use an IP-based edge limit as a cheap floor and an application-level limit keyed independently by IP and normalized email. OWASP recommends endpoint-specific limits at multiple keys and prefers token-bucket or sliding-window behavior over fixed-window counters. ([OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html); [OWASP API4:2023](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/))

The edge limit protects the application and the Turnstile verification call from floods. The email-bound limit prevents one person or bot from rotating IPs to submit repeatedly. Keep responses generic when a limit is reached.

### 3. Treat Turnstile as a server-side gate, not a content verdict

Cloudflare requires a backend call to `POST https://challenges.cloudflare.com/turnstile/v0/siteverify`; the widget in the browser alone is not protection. Tokens can be forged, expire after five minutes, and are single-use. The backend should require `success`, check the expected `action` and `hostname`, and keep the secret key server-only. ([Cloudflare: Validate the token](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/))

The widget should also be restricted to the production hostname in Turnstile Hostname Management. ([Cloudflare: Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/))

**Important inference:** a valid Turnstile result proves that the token passed Cloudflare’s verification; it does not prove that the donor name or item description is legitimate. A browser-like bot can still submit nonsense, so Turnstile should be one positive signal in the larger decision.

### 4. Keep the honeypot

The hidden field is a standard, low-cost layer. OWASP specifically recommends a hidden form field, checked on the server, with a non-empty value silently dropped or routed away from the normal path. ([OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html))

BGSL’s current “successful no-op” behavior is the right user experience: do not tell a bot which signal identified it.

## Is content heuristics a normal pattern?

Yes—as a supplementary signal, not as the primary defense. OWASP explicitly lists behavioral signals, anomaly detection, fraud scoring, delayed publishing, and asynchronous review as application/business-layer controls. It also says denylisting should only add coverage; it should not be the main validation strategy. ([OWASP Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html); [OWASP Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html))

There is no official rule that says a particular string such as `CLqvtNXtXfyZCkfEisg` is spam. For BGSL, use a small, explainable score built from several signals: repeated velocity, duplicate email/item, placeholder or disposable data, links or known spam language, and unusually synthetic-looking combinations of fields. This is an application-specific inference from the layered-defense guidance.

Recommended local policy:

- Never quarantine on one weak text heuristic alone.
- Quarantine when multiple independent signals agree, or when one high-confidence signal appears.
- Preserve the record and the reasons for review; do not delete suspected abuse immediately.
- Revisit the rules using false-positive/false-negative observations rather than continually adding brittle phrases.

## Fit to the current repo

BGSL already has most of the foundation:

- [Turnstile verification](../../../src/lib/golf-tournament/turnstile.ts) calls Siteverify and checks the form action and expected hostname.
- [Rate limiting and client-IP handling](../../../src/lib/golf-tournament/in-kind-protection.ts) maintain separate email and IP limits.
- The public form and action implement a [honeypot](../../../src/app/golf-tournament/page.tsx) with a silent no-op.
- [Deployment notes](../../../README.md) call for an additional edge rate limit.
- The existing [spam scanner](../../../src/lib/golf-tournament/in-kind-spam.ts) and `NEEDS_FOLLOW_UP` status already provide a quarantine destination.

The gap is ordering: [the submission action](../../../src/actions/golf-tournament-actions.ts) inserts the record and sends the admin email, while the scanner is only run later by an admin cleanup action. The scanner is therefore a review tool, not an admission-control step.

The smallest elegant change is to run the risk assessment after the hard gates but before the insert/notification side effect. Save suspicious submissions as `NEEDS_FOLLOW_UP` with structured reasons, return the same generic success page, and send the admin email only for low-risk `NEW` submissions. That preserves legitimate donations, removes inbox noise, and gives BGSL a review trail.

## Sources

- [Cloudflare Turnstile — Validate the token](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
- [Cloudflare Turnstile — Hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)
- [OWASP — Bot Management and Anti-Automation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Bot_Management_and_Anti-Automation_Cheat_Sheet.html)
- [OWASP — Input Validation Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [OWASP API Security Top 10 — API4:2023 Unrestricted Resource Consumption](https://owasp.org/API-Security/editions/2023/en/0xa4-unrestricted-resource-consumption/)
- [OWASP — Automated Threats to Web Applications](https://owasp.org/www-project-automated-threats-to-web-applications/)
