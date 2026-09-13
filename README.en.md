# dsh-kaomoji

> Add Japanese kaomoji to [DeepSeek Harness](https://github.com/deepseek-ai) (dsh) replies.

[![npm](https://img.shields.io/npm/v/dsh-kaomoji.svg)](https://www.npmjs.com/package/dsh-kaomoji)
[![license](https://img.shields.io/github/license/TianJie52009/dsh-kaomoji.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/dsh-kaomoji.svg)](https://nodejs.org)

> 🤖 **Pure Codex generation** — the code and docs in this repository were
> generated entirely by OpenAI Codex and have not been human-reviewed. Please
> read and test before use.

`dsh-kaomoji` is a zero-dependency dsh plugin. Before a model call it injects a
“mood → kaomoji” whitelist rule into the system prompt, so the model copies a
real, well-formed kaomoji verbatim at the right moment. The curated library is
based on [顔文字屋 kaomojiya.org](https://www.kaomojiya.org/), one of the
largest Japanese kaomoji sites.

[简体中文](./README.md) | English

## Features

- **Prompt-only design** — no stream rewriting, no extra model calls, stable
  for KV caches.
- **Whitelist prevents garbled output** — the model copies characters exactly
  instead of inventing malformed faces.
- **12 mood buckets** — happy, love, sad, cry, angry, surprised, confused,
  shy, playful, encourage, thanks, sorry.
- **Three frequency modes** — `auto` (default; greetings, casual chat, recommendations and empathetic replies get one), `frequent`, `off`.
- **Placement control** — `inline` after the mood-matching sentence (default)
  or `end` of the reply.
- **Visual settings card** under Settings → General, saved live without a restart.
- **No third-party runtime dependencies** — only the dsh `systemPrompt`
  service and Node built-ins.

## How it works

1. On startup the plugin registers a prompt section named
   `dsh-kaomoji:guidance` (order `176`) via `ctx.systemPrompt.section()`.
2. On every prompt assembly the section contributes:
   - the active mode and placement rules;
   - the mood-categorized kaomoji whitelist;
   - an optional user `customPrompt`.
3. The model emits one of the listed kaomoji where it fits. Because kaomoji
   are plain text, no custom rendering is needed in the chat UI.

Settings use a dedicated loopback RPC channel (`/dsh-kaomoji-settings`):

1. The Settings → General card reads/writes `~/.dsh/dsh-kaomoji.json`.
2. The Host updates the prompt section and emits `system-prompt/change`
   immediately, so the next reply follows the new settings without a restart.

Prompt injection is preferred over post-processing the stream because it avoids
stream parsing, sentence-boundary guessing, and keyword-based sentiment
guessing, and it follows the same mechanism as plugins like `dsh-emoji`.

## Install

Prerequisites: a dsh Web Profile with `@deepseek-ai/dsh-system-prompt`,
Node.js `^22.19.0 || >=24.0.0`, pnpm 11.

```powershell
cd "$env:USERPROFILE\.dsh\profiles\web"

# Option A: install from npm (recommended)
dsh plugin --profile web add dsh-kaomoji

# Option B: install straight from GitHub (no npm release needed)
dsh plugin --profile web add github:TianJie52009/dsh-kaomoji

# Local development build
pnpm add file:C:\path\to\dsh-kaomoji
```

> If you install with pnpm manually, make sure `"dsh-kaomoji"` is listed in
> `dsh.profile.bundles` inside `package.json`.

Restart the Web Host afterwards (or let `dsh-hot-reload` mount it live).
The Host starts injecting the guidance; the Web client adds the
“Kaomoji (dsh-kaomoji)” card at the bottom of **Settings → General**.

## Configuration

Defaults are ready to use (`mode: auto`). There are two settings layers:

1. **Deployment defaults**: override `config` for `id: dsh-kaomoji` in the
   profile’s `cordis.patch.yml`;
2. **User settings**: edited in the Settings → General card and stored in
   `~/.dsh/dsh-kaomoji.json`; user settings win. “Reset to defaults” removes
   the user layer and falls back to the deployment defaults.

Example `cordis.patch.yml`:

```yaml
- id: dsh-kaomoji
  config:
    mode: frequent     # off | auto | frequent
    placement: end     # inline | end
    maxPerTurn: 2
    customPrompt: "Keep it professional; prefer thanks/encourage kaomoji"
```

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `mode` | `'off' \| 'auto' \| 'frequent'` | `'auto'` | `off` disables; `auto` adds one to greetings, casual chat, recommendations and empathetic replies; `frequent` adds one to every conversational reply (code-only/formal replies excluded) |
| `placement` | `'inline' \| 'end'` | `'inline'` | Put the kaomoji after the best-matching sentence, or at the reply end |
| `maxPerTurn` | `number` (1–5) | `1` | Max kaomoji per reply; `frequent` distributes that many across different sentences (fewer in very short replies) |
| `customPrompt` | `string` | `''` | Extra style/scene guidance; cannot change mode, whitelist or limits |
| `settingsFile` | `string` | `~/.dsh/dsh-kaomoji.json` | (advanced) user-settings file path |
| `settingsAuthority` | `'trusted-host' \| 'loopback'` | `'trusted-host'` | Settings RPC trust scope: by default the local Host plus declared trusted hosts (Tailscale/LAN) may write; set `loopback` to restrict to the local machine |

Card edits take effect immediately; deployment-default edits in
`cordis.patch.yml` require a dsh restart.

### Remote access (Tailscale / LAN)

- If the dsh page is reachable remotely, the Host already trusts that origin;
  with the default `settingsAuthority: trusted-host` the General card can save
  settings from the remote session.
- If the card reports that the origin is not trusted, add the host to the
  server’s `trustedHosts` (dsh-client-connection) or temporarily switch to
  `settingsAuthority: loopback` and edit on the server itself.

## Kaomoji library & attribution

The built-in library lives in [`data/catalog.json`](./data/catalog.json), with a
source URL per category:

| Mood | Source page |
| --- | --- |
| happy | [happy-kaomoji](https://www.kaomojiya.org/happy-kaomoji) |
| love | [love-kaomoji](https://www.kaomojiya.org/love-kaomoji) |
| sad | [sad-kaomoji](https://www.kaomojiya.org/sad-kaomoji) |
| cry | [cry-kaomoji](https://www.kaomojiya.org/cry-kaomoji) |
| angry | [angry-kaomoji](https://www.kaomojiya.org/angry-kaomoji) |
| surprised | [odoroiteru-kaomoji](https://www.kaomojiya.org/odoroiteru-kaomoji) |
| confused | [komaru-kaomoji](https://www.kaomojiya.org/komaru-kaomoji) |
| shy / playful | [shy-kaomoji](https://www.kaomojiya.org/shy-kaomoji) |
| encourage | [hagemasu-kaomoji](https://www.kaomojiya.org/hagemasu-kaomoji) |
| thanks | [thanks-kaomoji](https://www.kaomojiya.org/thanks-kaomoji) |
| sorry | [sorry-kaomoji](https://www.kaomojiya.org/sorry-kaomoji) |

Kaomojiya states the pages are free to use (no registration required, personal
and commercial use allowed). This plugin ships a small hand-picked subset and
keeps the source attribution. The plugin code itself is MIT-licensed.

To extend the library, update both `data/catalog.json` (full catalog) and the
`CATALOG` constant in `lib/index.js` (the prompt whitelist).

## Development

```text
dsh-kaomoji/
├── lib/
│   ├── index.js       # Host: config, guidance builder, section registration, settings RPC
│   ├── client.js      # Web: Settings → General card (ModuleLoader format)
│   └── index.d.ts     # TypeScript declarations
├── data/
│   └── catalog.json   # curated kaomoji library with source URLs
├── test/
│   ├── plugin.test.mjs# Host unit tests (guidance + settings RPC)
│   └── client.test.mjs# Client ModuleLoader/store tests
├── cordis.patch.yml   # dsh bundle patch
├── package.json
├── README.md / README.en.md
├── CHANGELOG.md
└── LICENSE
```

```powershell
npm test   # run unit tests
npm pack   # verify the publish payload (runs npm test via prepack)
```

Inspect the injected guidance quickly:

```powershell
node -e "import('./lib/index.js').then((m) => console.log(m.buildGuidance({ mode: 'frequent', placement: 'end' })))"
```

### Publishing to npm (maintainers)

The bare-name install (`dsh plugin --profile web add dsh-kaomoji`) requires a
real npm release. `registry.npmmirror.com` is a read-only mirror and cannot
publish, so log in to the official registry once:

```powershell
npm login --registry https://registry.npmjs.org
npm publish --access public --registry https://registry.npmjs.org
```

`package.json` already pins `publishConfig.registry` to
`https://registry.npmjs.org/`.

## Compatibility

- Targets the npm `@deepseek-ai/dsh` rc.7 runtime line.
- Peer deps: `@deepseek-ai/cordis`, `@deepseek-ai/dsh-system-prompt`, plus the
  Web client peers (`dsh-client-*`, `react`) — all optional, provided by the
  Web Profile shared runtime.
- Coexists with [dsh-emoji](https://github.com/hellodigua/dsh-emoji): different
  prompt section names/orders (`dsh-emoji:guidance` @175 vs
  `dsh-kaomoji:guidance` @176), settings namespace, RPC channel, and card slot
  (Plugins page vs General). Kaomoji are plain text, so dsh-emoji’s stream
  rewrite (which handles canonical Unicode emoji only) never touches them.

## FAQ

- **No kaomoji in replies?** Check, in order: (1) the Host half is mounted —
  `dsh plugin --profile web add dsh-kaomoji` writes both `dependencies` and
  `dsh.profile.bundles`; a bare `pnpm add` only loads the client card, so
  re-install with the dsh CLI or add the `insert` row to `cordis.patch.yml`
  and restart (the log should show `[dsh-kaomoji] 已挂载（mode=...）`);
  (2) the mode — `auto` only fires on friendly/casual/empathetic replies, use
  `frequent` for one per conversational reply; (3) the settings card status —
  “Host not loaded” / “origin not trusted” also means the guidance is absent.
- **Why does the model sometimes skip kaomoji in `auto` mode?** That is by
  design. Only `frequent` requires one per conversational reply.
- **Can I use kaomoji outside the whitelist?** Yes — put the exact string in
  `customPrompt`; explicit user requests are an exception to the whitelist.
- **Will code replies be polluted?** No. The rules forbid kaomoji inside code
  blocks, inline code, links, tables, and tool output.
- **Where is the settings card?** At the bottom of Settings → General (after
  language, appearance, composer rows). Changes save live; “Reset to defaults”
  is available in the card.
- **Does it conflict with dsh-emoji?** No technical conflict (see
  Compatibility). If both run in `frequent` mode a reply may contain an emoji
  and a kaomoji — keep one of them in `auto` (or turn one off) for the cleanest
  look.

## License

[MIT](./LICENSE)

Kaomoji characters are sourced from [顔文字屋 kaomojiya.org](https://www.kaomojiya.org/)
(free for personal and commercial use per the site).
