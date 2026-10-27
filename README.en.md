# dsh-kaomoji

Adds mood-aware Japanese kaomoji to DeepSeek Harness replies through a curated system-prompt contribution. See [Chinese documentation](./README.md), [compatibility evidence](./COMPATIBILITY.md), and [maintainer handoff](./HANDOFF.md).

## Install

```sh
dsh plugin --profile web add dsh-kaomoji@0.3.0
```

Restart the Host and reload the client after updating. Edit the card under Settings → General in Web or Desktop. Modes: off/auto/frequent; placement: inline/end; limit: 1–5 (default 1); custom guidance: at most 4000 characters. Changes apply to the next reply. Both plugins can coexist.

## Native settings and migration

Supports the nine published Harness releases from 0.2.0-rc.2 through 0.2.1-rc.3, including alpha.1–alpha.5 and rc.1–rc.3. Later versions require separate validation.

Uses Harness remote.settings and volatile Config fields, with no private HTTP routes or webServer dependency. The active profile stores settings; no browser-local persistence is used.

On first load, import schemaVersion 1 dsh-kaomoji.json from the Host data directory, a legacy nested DSH_HOME/.dsh path, or the configured settingsFile. Existing native user fields win. Original JSON is preserved; the same native write commits the migrationVersion marker. Failed imports log a warning and retry after restart. Reset retains the marker, so old data does not return. Migration is per profile; moving to another machine/data directory requires transferring the source data or profile.

## Development

Run npm ci --legacy-peer-deps, npm test, npm run test:compat, then npm pack --dry-run. The compatibility suite installs official packages in .compat (or DSH_COMPAT_HOME) and starts isolated configuration trees; it never changes live profiles. publish.cmd runs tests before npm publishing.

## Market synchronization

The repository is already listed. The upstream catalog periodically probes npm versions. After publishing and pushing, run sync-market.cmd to compare GitHub, npm latest and the catalog. Exit code 2 means the catalog is pending. A new release can also be held by the market's fresh-release policy.

After the release and repository are at least 24 hours old, sync-market.cmd --request-refresh can open a deduplicated upstream issue if the catalog is still stale. It requires GH_TOKEN or GITHUB_TOKEN. It does not bypass market policy or submit duplicate plugin entries.

## License

[MIT](./LICENSE). Kaomoji source: [kaomojiya.org](https://www.kaomojiya.org/).
