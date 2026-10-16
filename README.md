# Count Room

A Hi-Lo card-counting trainer with a playable blackjack simulator. Educational use only: virtual chips and a fictional bankroll, no real-money play.

## Run it

No install needed. Open `dist/index.html` in any modern browser (double-click it). Progress is saved in that browser's local storage.

To rebuild after editing the source (Node 18+):

```bash
node build.js              # writes dist/index.html and dist/count-room.html
node tests/engine.test.js  # 71 engine tests
```

Optional local server instead of opening the file directly:

```bash
npx serve dist             # or: python3 -m http.server -d dist 8080
```

## Deploy to Vercel

`site/` is a ready-to-serve static site (no build step). From this folder:

```bash
npx vercel deploy site            # preview deployment
npx vercel deploy site --prod     # production
```

To regenerate `site/` after editing `src/`, run `node build.js` and copy `src/` files as in the build order (or rerun the snippet used to create it).

## Supabase (cloud save + leaderboard)

Project: `count-room` (khisyazijnxpmszkbkmb). Tables `progress` and `leaderboard` with row-level security, plus the `submit_score` function.
Dashboard steps still needed (Authentication settings):
1. Sign In / Providers: turn on **Allow anonymous sign-ins**.
2. Turn on **Allow manual linking** (lets an anonymous account attach Google without losing progress).
3. Providers > Google: paste a Google OAuth Client ID and Secret, and add the Supabase callback URL shown there to the Google client.
4. URL Configuration: set Site URL and add your Vercel URL to Redirect URLs.

Without these the app still works; it just keeps progress in the browser only.

## Layout

```
src/engine/counting.js    Cards, seeded RNG, shoes, Hi-Lo tags, running/true count, deck estimates
src/engine/blackjack.js   Hand totals, dealer rules, round state machine, payouts, basic strategy
src/engine/betting.js     True-count ramp, suggested bets, bet/config validation, spread, exposure
src/engine/exercises.js   Question generators for drills and the 7 tests
src/store.js              Local progress: events, tests, bests, streaks, recommendations
src/ui/core.js            DOM helper, card/chip rendering, inputs, modal, toast, SVG charts, router
src/ui/*.js               One file per section (dashboard, learn, count-trainer, true-count,
                          table, betting, tests, analytics, settings) plus main.js (shell)
src/styles.css            All styling and animations (reduced-motion aware)
tests/engine.test.js      Deterministic engine tests (rigged shoes, seeded RNG)
build.js                  Inlines everything into a single HTML file
```

## Verify the main features

1. Count Trainer: Start a Beginner drill, enter the count, check the card-by-card breakdown.
2. True Count Trainer: enter running count, decks and true count; switch conventions and compare.
3. Blackjack Table: deal rounds in Training mode and watch the count update only as cards turn face up; switch to Challenge to get a count review after each round.
4. Betting Coach: submit an invalid bet (below the minimum) to see validation, then a valid one to see the ramp comparison.
5. Tests: finish any test to see the score, skill breakdown and review of wrong answers.
6. Analytics: confirm the numbers match what you just did.

## Notes and limits

- Built with plain JavaScript and CSS instead of React/TypeScript/Vite so it runs as one file with no build step for the user. The engine is still split into separate modules with tests.
- Basic strategy chart: multi-deck, DAS, late surrender when enabled, S17/H17 variants. Not offered at the table: insurance and even money, re-splitting aces.
- The variance lesson uses a simplified normal-approximation model to show swings, not to estimate real returns.
