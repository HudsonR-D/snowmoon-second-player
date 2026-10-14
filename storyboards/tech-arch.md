# Tech Arch + Vertical Slice (TS+Canvas, GPL)

## Repo (20 files max slice)
package.json, tsconfig strict, vite.config base path, LICENSE GPLv3, README, index.html
src/main.ts (boot/resize/loop), game.ts (router+save), config.ts (tuning)
minpentai/sim.ts, board.ts, rng.ts (mulberry32 mapgen+gameplay streams), history.ts (200-ring deltas for rewind), render.ts (batched atlas, dirty cells)
narrative/dialogue.ts (flags store), deduction.ts, poll.ts
content/m-z1.json, m-g1.json
ui/hud.ts, audio.ts (WebAudio bleeps+mute)
assets/ one atlas + one font. pipeline/ below.

## Sim spec (slice: 11x11 -> scale to 48+ later)
Cell: terrain empty/shrine + 1 piece + 1 symbol. Pieces: Glider 1-step pawn pushes rock picks symbol dies to spaceship, Factory spawns glider/4t if hold symbol, Wall blocker, Mirror/Moving Wall shifts /2t reflects rock 90deg, Spaceship 2HP 2-step killer, Rock pushable crushes spaceship if mirrored, Symbol key, Shrine win if glider+symbol ends on it.
Order: intents -> moving walls -> spaceships -> gliders+push -> factory -> pickup/crush/shrine -> RNG++. Priority wall>spaceship>rock>glider. Deterministic seed `M-Z1-042`. Turn <1.5ms, render <6ms, 25t/s unfold cap 1000/unfold.

Rewind hook: store delta {ids, from/to, RNG, flags} ring 200. Rewind applies inverse, replay reapplies intents. Enables M-Z3 debugging + slice undo 10 steps.

## Narrative spec
Node {id, scene, speaker, side, portrait, text<=240ch, choices[{label, cond, fx, next}], next}. Flags global str->bool/int persisted. Silent choice timer default wins. Deduction: clues[] + links[] -> correct/partial/wrong + hints. Poll: 2-3 big buttons 10s bar, ghost suggestion after 4s, touch-first, ESC abstain.

## GPL pipeline/
pipeline/prompts/ (dialogue/level/sprite prompts + date), harness/ (gen/review/import steps), seeds/ (seed+RNG ver), storyboard/ (sources + rejected), SOURCES.md (models/tools/human edits), Makefile regenerate+verify. Rule: no opaque asset — every shipped JSON/png has prompt+seed+diff.

## Vertical slice (next build)
M-Z1 7x7: 1 glider each, move/push/mirror/shrine in 8 turns, Second Player mirrors after 3s, win <3min. M-G1 9x9 + 12-node dialogue: Dreadknot interrogation, 3 clues 1 link to exit, rock stall, poll bribe/run flag.
Accept: <3s load, 60fps laptop, keyboard+touch completable, rewind 10 steps, save resume, share URL + mute, pipeline/ complete.

## Ordered tasks
1 sim+board+rng, 2 history, 3 renderer+HUD, 4 m-z1.json+tutorial, 5 dialogue+flags, 6 poll UI, 7 deduction, 8 m-g1.json+map, 9 audio+save+hub, 10 Vite Pages build + SOURCES audit + playtest.
