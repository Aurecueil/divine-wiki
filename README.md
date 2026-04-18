# Divine Skins Wiki

Community-written guides for making custom skins for League of Legends. Live at https://wiki.divineskins.gg.

## Who this is for

Creators who use Maya, Blender, and VFX tools to build custom LoL skins. End-users who only install skins should ask in Discord — the wiki is for makers.

## Contribute

Three ways, pick what fits you:

- **Visual editor** at `/contribute`. Sign in with GitHub, write, submit. You never touch Git.
- **Fork and PR** on GitHub. For devs. See [CONTRIBUTING.md](./CONTRIBUTING.md).
- **Suggest edits** in Discord `#wiki-feedback`.

## Local dev

Prerequisites: Bun (`npm install -g bun`), Node 22+, Git.

```bash
git clone https://github.com/DivineSkins/divine-wiki.git
cd divine-wiki
bun install
bun run dev
```

Open http://localhost:3000.

## Content layout

Guides live in `content/docs/en/<category>/*.mdx`. Each category has a `meta.json` that controls sidebar order.

The eight categories:

- `guided-walkthrough`
- `tools`
- `maya`
- `blender`
- `animations`
- `vfx-bins`
- `assets-library`
- `errors`

## Stack

- Next.js 16 (App Router)
- Fumadocs (MDX engine, sidebar, search)
- Tailwind v4
- shadcn/ui
- Cloudflare Pages hosting
- Crowdin i18n

## Links

- Divine Skins: https://divineskins.gg
- Celestial launcher: download from divineskins.gg
- Discord: https://discord.gg/divineskins

## License

MIT. See [LICENSE](./LICENSE).
