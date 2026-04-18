# Security

## Reporting a vulnerability

Email `security@divineskins.gg`. Include:

- What you found
- How to reproduce it
- What impact you think it has

Do not open a public GitHub Issue for security bugs.

## Scope

This policy covers:

- The wiki site itself (`wiki.divineskins.gg`)
- The in-site contribute editor at `/contribute`
- The Cloudflare Worker that opens pull requests on behalf of logged-in contributors. Source lives at `workers/submit-pr/`.

## What we care about most

- XSS in rendered MDX content
- Auth bypass or privilege escalation in the `/contribute` flow
- Anything that lets a contributor open PRs as another GitHub user
- Rate-limit bypass on the Worker

## Response

We aim to acknowledge reports within 2 business days. Real fix timelines vary.
