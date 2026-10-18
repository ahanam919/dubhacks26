# Local Swap: AI module

Everything Gemini does in Local Swap lives in `ai/`. Gemini turns messy inputs (menu text, shop descriptions, search queries) into structured data and short sourced text. It never supplies facts about the world on its own: shops, prices and distances come from the database and Maps. Every sentence shown to a user passes a separate verifier first.

All functions are pure TypeScript with no database access, never throw, and return `null`, empty arrays or an `error` field on failure. Bad or unverified text fails closed (it is not shown). Set `AI_REAL=1` to use real Gemini calls; without it the app gets stub data in the same shapes.

## What each part does, and which model it uses

Models are set in one place, `ai/config.ts`.

| Function | What it does | Model |
|----------|--------------|-------|
| `extractMenu` | Turns a shop's menu text or menu photos into structured items (name, description, price in cents, size, confidence). Prices are never guessed: anything unreadable, blurred or missing means `null`. Photos are sent as image bytes (jpeg, png or webp). | `gemini-3.5-flash-lite` for text, `gemini-3.7-flash` (vision) for photos, structured JSON output |
| `matchConcept` | Maps each menu item to one of our drink concepts (for example "Great Pumpkin Latte" to `pumpkin_spice_latte`) with a confidence score and attributes. Search only trusts 0.75 and above. | `gemini-3.5-flash-lite`, structured JSON output |
| `parseQuery` | Turns a search like "PSL", "oat milk chai" or "something sweet" into a concept, dietary needs, size and chain. Common queries are resolved by code first; Gemini is called only when code finds no match, and it can ask a clarifying question. | `gemini-3.5-flash-lite`, structured JSON output |
| `writeHook` | Writes a one or two sentence "why go" story using only facts in the supplied source text. If there is no real story it returns nothing. | `gemini-3.5-flash-lite` |
| `verifyHook` | Checks every claim in a hook against the source. A rule layer blocks wrong numbers and unsupported superlatives ("best", "only", "award"). A separate model call then requires supporting evidence for each remaining claim and defaults to reject. | `gemini-3.7-flash`, falling back to `gemini-flash-latest` |
| `makeHook` | Runs `writeHook` and then `verifyHook`. A hook is returned only if it is verified. | both of the above |

## Parts that deliberately do not use a model

- `comparePrice` compares a local item to the chain reference (size matching, price difference, verdict, one-line sentence) in plain code. Money math should be exact, so it is not left to a language model. It returns `null` when a price is missing or sizes don't match, rather than forcing a number. Chain prices that are estimates are marked "est." in the sentence, say "about", and use a wider band for "similar", so the app never shows a precise-looking number built on a guess.
- `writeGeofenceMessage` fills a fixed template from structured fields, so prices and walk minutes cannot drift. It adds the first sentence of a verified hook only if the message stays within 140 characters.

## Safety and honesty rules

- No invented stories. "No story" is a valid result and the app falls back to plain facts.
- Hooks must be supported by the source, with no superlatives that the source doesn't use and no implied affiliation or endorsement.
- Press-based hooks cite the article as their source.
- No Instagram scraping. Only text and images from the shop's own pages, or menu photos the team took, are used.
- The Gemini key lives in `.env` on the server only.

## Running things

```
AI_REAL=1 npx tsx scripts/build-fallback.ts
npx tsx ai/eval/run-verifier.ts --make
npx tsx ai/try-parse.ts "psl"
AI_REAL=1 npx tsx ai/try-extract-image.ts "Shop Name" path/to/menu.jpg
npx tsx ai/probe-models.ts
```

- `scripts/build-fallback.ts` runs the whole pipeline on every `samples/<slug>-menu.txt` or menu photo `samples/<slug>-menu.jpg` (plus `-about.txt` and `-url.txt` if present) and writes one JSON per shop to `out/`. When a shop has a menu photo, the photo is used. This is the demo fallback if live calls fail.
- `ai/try-extract-image.ts` runs menu photo extraction on one or more image files and prints the items and prices it read.
- `ai/eval/run-verifier.ts` runs planted-lie test cases against the verifier and prints a scoreboard. Calls are spaced out to respect rate limits.
- `ai/probe-models.ts` checks which models currently respond. Run it before a demo.

Results from each test pass are recorded in `ai/eval/RESULTS.md`.

## Not built yet

`scoreAspects` (review-based scores), `selectPhotos` (photo carousel) and embeddings are stubs.