# Eval results

## Verifier (planted lies), Sat Oct 17 2026, 6:42pm
Source: samples/leon-coffee-house-about.txt
Verifier model: gemini-3.7-flash (strong), writer: gemini-3.5-flash-lite
Correct: 15/15 (6 true hooks passed, 9 planted lies blocked)
Lies that got through: 0
True hooks blocked: 0## Sat Oct 17, 2026 (night)

### Verifier (`ai/eval/run-verifier.ts --make`, 15 planted cases on the Leon Coffee House source)

- Correct: 14/15
- Lies that got through: 0
- True hooks blocked: 0
- API errors: 1 (`p1-basic-true`, a 503 demand spike on both strong models, even after one 65-second retry; this case passed in the earlier run the same day)
- The 9 planted lies were all blocked: 5 by the rule layer (wrong years 2015 and 2019, "best", "award", "only") and 4 by the model (invented "organic" and "fair-trade", "roasts all beans in-house", an invented founder, "official coffee partner").
- All 5 other true hooks that ran passed, including a paraphrase and a latte-art claim.
- `makeHook` on the real source: verified hook with no unsupported claims. `makeHook` on a no-story source: `hook: null` with no error.
- Earlier the same day: 15/15 on the same source.

What changed during tuning: the eval originally fired calls back to back and hit free-tier 429s (5 of 15 errored, then 10 of 15). The runner now waits 15 seconds between API calls, retries once after a 65-second wait, and stops early if two cases in a row fail. This is what produced the clean run above. Errors are never counted as wrong answers, and an unverified hook is never shown.

### Matching (Leon Coffee House menu, 36 items)

- 30 of 36 items matched a concept at 0.75 or above. The other 6 show only as "closest found" or not at all.
- Judgment calls left as they are: Cold Brew Americano to `cold_brew` (0.85); Crema de Leche to `macchiato` (0.7, below the search threshold).
- The 20-query matching set has not been run yet.

### Query parsing

- Code alias path checked on the 74-concept list: "psl", "pumpkin spice chai", "pumpkin cream cold brew", "iced tea", "oat milk chai", "latte".
- Gemini fallback checked: "something sweet" asks a clarifying question, "a hot toddy" returns no match, "tea" maps to `hot_tea`.
- Known: "cold brew americano" resolves to `americano` (tie, first in the list wins).

### Fallback pipeline (`scripts/build-fallback.ts`)

- Leon Coffee House: 36 items, 0 errors, verified hook, geofence message with the `{minutes}` placeholder intact.
- Price comparison is not yet exercised on real data: the Leon menu has no prices. Waiting on menus with prices from teammates.
## Sun Oct 18, 2026: verifier, clean rerun

Command: `npx tsx ai/eval/run-verifier.ts --make` (15 planted cases on the Leon Coffee House source, calls spaced out).

- Correct: **15/15**
- Lies that got through: **0**
- True hooks blocked: **0**
- API errors: **0**
- All 9 planted lies were blocked: 5 by the rule layer (wrong years 2015 and 2019, "best", "award", "only") and 4 by the model (invented "organic" and "fair-trade", "roasts all of its own beans in-house", an invented founder, "official coffee partner of the Neptune Theatre").
- All 6 true hooks passed, including the paraphrase, the opening line, the latte-art claim, the attributed press fact and the decor line.
- Two transient API errors during the run (a 403 and a 503 on `gemini-3.7-flash`) were absorbed by the retry inside `generateJson`, and the affected cases then returned correct verdicts.

Progression on this test set: earlier runs lost cases to free-tier rate limits (10/15 with 5 API errors, then 5/15 with 10 errors, then 14/15 with 1 error). The fixes were spacing the calls out (15 seconds between API calls, one 65-second retry, early stop if two cases in a row fail) and a key with quota for the verifier model. Throughout, no planted lie got through and no true hook was blocked; errors only ever made the verifier refuse to answer, never approve.

## Sun Oct 18, 2026: menu photo extraction (Leon Coffee House)

Command: `AI_REAL=1 npx tsx ai/try-extract-image.ts "Leon Coffee House" samples/leon-coffee-house-menu.jpg`, then `AI_REAL=1 npx tsx scripts/build-fallback.ts`.

- Input: one phone photo of the printed menu (resized to 1600 px, jpeg).
- Model: `gemini-3.7-flash` (vision). About 38 seconds for the full menu.
- Items read: **56**. Items with a price: **56**. API errors: **0**.
- Price comparisons produced: **5**, all on 16 oz items, each against a chain reference row.
- Hand spot-check against the photo: 5 rows checked (Latte or Cappuccino at 8, 12 and 16 oz: $4.20, $4.60, $4.90; Americano any size: $3.80; Deleite Espresso: $5.90). **All 5 matched.**
- This was a spot-check of 5 of 56 rows, not a full audit. The other 51 prices were not individually checked.
- The extractor returns `null` for any price it cannot read, rather than guessing. On this photo that did not trigger, because every price was legible.
