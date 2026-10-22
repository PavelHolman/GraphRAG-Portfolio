# CI and deploy workflow spec

Decisions from [Decide: CI and deploy workflow](https://github.com/PavelHolman/GraphRAG/issues/25). Deploy per ADR 0006, tooling per `docs/spec/tooling.md`, authoring per `docs/spec/authoring.md`, evals per `docs/spec/evals.md`.

## Shape

One workflow, `.github/workflows/ci.yml`, on pull requests and pushes to `master`. Four jobs:

| Job       | Runs on                                           | Does                                                                                                                                                                                                                                                                                                             |
| --------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check`   | every PR and push                                 | Bun install (cached), `content:check`, artifact verification against the committed cache, `lint`, `format:check`, `typecheck`, unit tests, `bun eval` (retrieval tier), commitlint on the PR title; on content or print-route changes also build + `content:render` verification (PDF text and image dimensions) |
| `e2e`     | code PRs and pushes; skipped for content-only PRs | build, Playwright against the preview build with the recorded LLM layer                                                                                                                                                                                                                                          |
| `preview` | PRs, after `check` (and `e2e` when it ran)        | `wrangler versions upload`, sticky PR comment with the preview URL                                                                                                                                                                                                                                               |
| `deploy`  | pushes to `master`, after `e2e`                   | `wrangler deploy`                                                                                                                                                                                                                                                                                                |

Content-only PR = changes limited to `content/**` and `packages/graph-index/generated/**` (and `.cache/**`). Path filtering uses `dorny/paths-filter`; the `e2e` job still reports success when skipped so the required check is satisfied.

## Merge gates

Branch protection on `master`: required checks `check` and `e2e`; squash merges only; PR title must be a conventional commit (commitlint in `check`); no direct pushes. Renovate weekly, grouped, with `oxlint`, `oxfmt` and `oxlint-plugin-eslint` as one group; nothing auto-merges.

## Secrets

| Where                      | Name                                                        | Purpose                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Actions             | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`             | preview and deploy                                                                                                                         |
| wrangler secrets (runtime) | `WORKERS_AI_TOKEN`                                          | LLM calls via the OpenAI-compatible REST endpoint until a binding-backed adapter exists; embeddings use the `AI` binding and need no token |
| wrangler secrets (runtime) | `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS` | telemetry backend                                                                                                                          |
| local only                 | `WORKERS_AI_TOKEN`                                          | `content:index` embedding cache misses; CI never embeds                                                                                    |

No Anthropic key anywhere. It appears only if the paid upgrade path is adopted, as a wrangler secret.

## Workflow file

```yaml
name: ci
on:
  pull_request:
  push:
    branches: [master]
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
permissions:
  contents: read
  pull-requests: write

jobs:
  check:
    runs-on: ubuntu-latest
    outputs:
      content_only: ${{ steps.filter.outputs.content_only }}
      render: ${{ steps.filter.outputs.render }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            code:
              - '!(content/**|packages/graph-index/generated/**|packages/graph-index/.cache/**)'
            render:
              - 'content/**'
              - 'apps/web/src/routes/print/**'
              - 'apps/web/src/lib/sections/**'
        # content_only = not code
      - run: echo "content_only=${{ steps.filter.outputs.code == 'false' }}" >> "$GITHUB_OUTPUT"
        id: co
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: bun-${{ runner.os }}-${{ hashFiles('bun.lock') }}
      - run: bun install --frozen-lockfile
      - run: bun content:check
      - run: bun content:index --verify # rebuild from the committed cache, fail on miss or diff
      - run: bun lint
      - run: bun format:check
      - run: bun typecheck
      - run: bun test
      - run: bun eval
      - if: github.event_name == 'pull_request'
        run: echo "${{ github.event.pull_request.title }}" | bunx commitlint
      - if: steps.filter.outputs.render == 'true'
        run: bun run build && bun playwright:install && bun content:render --verify

  e2e:
    needs: check
    if: needs.check.outputs.content_only != 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bun playwright:install
      - run: bun test:e2e

  preview:
    needs: [check, e2e]
    if: github.event_name == 'pull_request' && always() && needs.check.result == 'success' && (needs.e2e.result == 'success' || needs.e2e.result == 'skipped')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - run: bun run build
      - id: upload
        run: |
          url=$(bunx wrangler versions upload --config apps/web/wrangler.jsonc --json | jq -r '.previewUrl // .preview_url')
          echo "url=$url" >> "$GITHUB_OUTPUT"
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
      - uses: marocchino/sticky-pull-request-comment@v2
        with:
          message: 'Preview: ${{ steps.upload.outputs.url }}'

  deploy:
    needs: [check, e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/master'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: .bun-version
      - run: bun install --frozen-lockfile
      - run: bun run build
      - run: bunx wrangler deploy --config apps/web/wrangler.jsonc
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

Notes for the implementer: `content:index --verify` and `content:render --verify` are the diff modes described in the authoring and page specs; the `e2e` skip for content-only PRs must still satisfy branch protection, so `preview` uses `always()` with explicit result checks; the wrangler `versions upload` JSON field name should be confirmed against the installed wrangler version.

## Rejected

Workers Builds GitHub integration (cannot run the indexer verification first); live eval in CI (cost, flakiness); Dependabot (weaker grouping for the oxc lockstep); embedding in CI (needs a token; the cache makes it unnecessary).
