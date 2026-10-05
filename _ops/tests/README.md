# Tests that run with nothing but node

    node _ops/tests/lane.mjs
    node _ops/tests/lane-fails-closed.mjs
    node _ops/tests/words-pictures-video.mjs

One of them imports `meta-post.mjs`, which reaches `_vault.mjs`, which imports
`@vercel/blob`. If that package is not installed where you are running, `npm i` in the repo
first — nothing in the test ever calls it.

`_ops/` never deploys, so none of this ships.

## What is here

| file | what it holds down | assertions |
| --- | --- | --- |
| `lane.mjs` | Who may name a workspace: a stranger who types `?ws=nd` is refused, the lane with the right key is not, a browser is pinned to the workspace in its own cookie, `?workspace=` is no back door, and a browser from before the vault still works while naming nobody. | 14 |
| `lane-fails-closed.mjs` | If the query cannot be rewritten, the caller is refused rather than let through — and nothing throws. | 3 |
| `words-pictures-video.mjs` | Telling a picture from a video, including from an AE OS signed link with no file name on it, and what happens when the HEAD that settles it is refused. | 13 |

## Why `lane.mjs` exists

For two days in October 2026 these doors took `?ws=` from anyone. Before the vault, the only
way in was the cookie this browser got when it connected, so naming someone else's account
was not expressible. The vault made it expressible and nothing was asked of whoever typed
it. Nothing was connected yet, so nothing happened — but "nothing was connected yet" is not
a safeguard, it is luck. Every line in `lane.mjs` is one way that could have gone wrong.
