# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x-beta (current) | Yes |
| < 1.0.0-beta | No |

## Reporting a Vulnerability

If you discover a security vulnerability in MarinLoop, please report it responsibly. **Do not open a public GitHub issue.**

1. Email **security@marinloop.com** with a description of the vulnerability, steps to reproduce, and the potential impact.
2. You will receive an acknowledgment within **48 hours**.
3. We will work with you to understand and validate the issue, and aim to provide a fix or mitigation within **7 business days** of confirmation.
4. Once resolved, we will publicly credit you (unless you prefer to remain anonymous).

## Scope

The following are in scope for security reports:

- The MarinLoop web application and PWA
- Supabase Edge Functions (`openai-chat`, `extract-label`, `send-push`, `cron-dispatch-push`)
- Database Row Level Security policies
- Authentication and authorization flows
- AI consent and data handling

## Out of Scope

- Third-party services (Supabase infrastructure, Vercel hosting, OpenAI API)
- Denial of service attacks
- Social engineering

## Security Practices

- All database tables enforce Row Level Security (RLS).
- AI features require explicit per-user consent stored in the database.
- Sentry error reporting strips `user.email` and `user.username` before transmission.
- The OpenAI API key is never exposed to the client; all AI calls run server-side in Edge Functions.
- CORS is fail-closed: if `ALLOWED_ORIGINS` is unset, all cross-origin requests to AI endpoints are rejected with 403.
- Secrets are stored in Supabase Vault, Supabase secrets, and Vercel environment variables — never committed to the repository.
- CI runs a gitleaks secret scan on every push and pull request.

## Responsible Disclosure

We ask that you give us a reasonable amount of time to address the issue before making any information public. We are committed to working with security researchers and will not pursue legal action against anyone who reports vulnerabilities in good faith.
