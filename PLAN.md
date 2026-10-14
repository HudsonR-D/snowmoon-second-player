# PLAN — SNOWMOON: Second Player build log (newest last)

## S1 — context
- Fetched all 32 chapters via 4 reader subagents; STORY-BIBLE.md locked.
- Game direction locked: Hybrid Dual Campaign, Web TS+Canvas, GPL pipeline.

## S2 — storyboards + slice
- `storyboards/zei-path.md` (M-Z1..M-Z6), `storyboards/gladias-path.md` (M-G1..M-G6), `storyboards/tech-arch.md`.
- Vertical slice: M-Z1 silent-coop tutorial + M-G1 Dreadknot escape.

## S3 — blind review + full tactics + Veridia acts + campaign pass
- Blind-review fixes: snapshot rewind, two-phase patrol, input guards, 44px targets, aria.
- M-Z2 factories+transcript (energy, build-wall, Gun foe clock).
- M-Z3 axial hex vs hunter Bo (hold-8-with-●, 3 charges cover U AND transcript).
- M-Z4 shrine-XOR siege (OFF seals shrines, toggles /6t, F flips for 2 energy).
- M-Z5 lethal lure (contact kills, local jammers J ≤3 freeze 6t, crush wins).
- M-Z6 DOG escort (Deluin 2-turn trail shadow, vision + LOS, stickers, spots).
- Veridia M-G1..M-G6: dialogue-boss, Prediction ticker, Trace meter, Seila board, 1M poll pulses, WATER/ICE + epilogue.
- Campaign pass: ghost ally pass-through, hub board (order + ★ pips + stamps), cross-flags (G3_DEFER→M-Z4 energy+line, MOV burn→M-Z5 line + M-G4 Trace 20), WebAudio synth SFX, Pages deploy live.

## S4 — bots, fairness, mobile
- `npm test`: snapshot-DFS solver (1-ply lookahead, fetch-form heuristics, iterative deepening, Z5 staging) proves all 9 map missions winnable within limits; determinism; 600-op rewind fuzz ×2; dialogue link/reachability/cond checks; G6 pulse math.
- Bot-caught bugs: heuristic pickup cliff, dirty sim on winning search paths (new Sim.snapshot/restore), M-Z6 unwinnable → proactive facing paint, 3x3 area cover, vision r=3, DOG1 loop east, spot limit 7.
- Cross-flag echoes in M-Z3 + M-Z6. Responsive layout (grouped buttons, phone/tablet breakpoints, forgiving tap-to-move).

## S5 — soften H1 (gently, shipped)
- H1 loop x3-7 → x3-5: same lethality/hp, same rock-lane matchup, faster cycle, east half safe. Bot 60/60, ALL CHECKS PASS.

## S6 — mute persistence + tidy (this session)
- [x] Mute persists via localStorage (`snowmoon-second-player-muted-v1`), label+aria sync on load, private-mode safe.
- [x] PLAN.md rewritten chronologically; stale specs removed (see tech-arch + SOURCES for frozen specs).

## Next — pick one
- [ ] New-story content (Freetown corps arc?) — needs a design session first.
- [ ] Playtest-driven tuning (Z5 59/60 is the hot spot; next lever: jammer 6→8t).
- [ ] Polish: canvas DPR scaling, focus traps in poll/dialogue, reduced-motion respect.

Acceptance (standing): <3s load, 60fps, keyboard+touch pass, save resume, share URL, `npm test` green.
