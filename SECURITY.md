# Security Policy

heystack is built to run on your own hardware and keep your data local. If you
find a security issue, please report it responsibly.

## Reporting a vulnerability

Please do **not** open a public issue for security problems. Instead, use GitHub's
private vulnerability reporting (the repository's **Security** tab ->
**Report a vulnerability**), or email **kallinos.loizos@gmail.com**. We will
respond as soon as we can.

## Good to know

- By default everything (documents, embeddings, chat) stays on your machine.
  The optional cloud fallback only sends data to a provider if you set an API key.
- A public or shared instance should run with `NEXT_PUBLIC_DEMO_MODE=true` (which
  disables filesystem scanning) and sit behind rate limiting, since every
  question runs an LLM.
