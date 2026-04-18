# Contributing

Thanks for helping out. Here's how it works.

## Three ways to contribute

| Way | Who it's for | Where |
|---|---|---|
| Visual editor | Everyone. No Git needed. | `wiki.divineskins.gg/contribute` |
| Fork and PR | Devs comfortable with Git | GitHub |
| Discord feedback | Quick reports, typos | `#wiki-feedback` on Discord |

## Write a guide in the editor

1. Go to `/contribute`.
2. Click Sign in with GitHub.
3. Write your guide in the editor. Drafts save to your browser.
4. Click Submit. The site opens a pull request on your behalf.
5. A maintainer reviews it. If they ask for changes, you get a GitHub notification.
6. When the PR is merged, your guide goes live.

## Manual fork and PR workflow

For devs who want to work locally.

Prerequisites: Bun, Node 22+, Git.

1. Fork `DivineSkins/divine-wiki` on GitHub.
2. Clone your fork: `git clone https://github.com/<your-user>/divine-wiki.git`
3. Install: `cd divine-wiki && bun install`
4. Run: `bun run dev` — confirm the site runs on http://localhost:3000.
5. Create a branch: `git checkout -b <slug>` (e.g. `new-vfx-guide`).
6. Add your `.mdx` under `content/docs/en/<category>/`. Use kebab-case filenames.
7. Update `content/docs/en/<category>/meta.json` to add your page to the sidebar order.
8. Commit. Conventional Commit style preferred but not required.
9. Push and open a PR to `main`.

## Before big changes, talk first

For new categories, moving files, renaming, or structural rewrites — start a thread in Discord `#wiki-proposals` first. Saves you from doing work that gets rejected.

## Style and voice

Read [`docs/voice.md`](./docs/voice.md) and [`docs/playbook.md`](./docs/playbook.md) before you write. Vale will flag voice violations in CI; fix them before merge.

## What gets rejected

- Banned terms from `docs/voice.md` (skin hack, undetectable, buy, etc.)
- Plagiarism or uncredited work
- Region advice that tells people to use custom skins on Korean or Chinese servers
- Images without `alt` text
- Images over 2 MB
- Marketing-speak or hype

## Recognition

Git history is the author log. Merged-PR count syncs to a Discord role (set up by maintainers).

## Help

Ask in Discord `discord.gg/divineskins` or open an Issue.
