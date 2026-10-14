# PLAN — from storyboards to build

## Done S2
- [x] Zei M-Z1..M-Z6 loop + missions
- [x] Gladias M-G1..M-G6 loops + persistence
- [x] Tech arch + GPL pipeline + slice acceptance

## Shipped since (slice+)
- [x] M-Z1 silent-coop tutorial (par 12, folded ally, honest turns)
- [x] M-G1 Dreadknot (poll matters, retryable deduction, persistent objective)
- [x] Blind review fixes (snapshot rewind, two-phase patrol, input guards, 44px, aria)
- [x] M-Z2 factories+transcript (energy, build-wall, Gun pressure, click-to-rewind)
- [x] M-Z3 hex vs Bo (axial grid, hunter, hold-8-with-●, 3 charges cover U AND transcript)

## Charge economy (locked)
- M-Z1/M-G1/M-Z2: unlimited study rewinds.
- M-Z3/M-Z4/M-Z5/M-Z6 tournament rules: 3 charges; U = 1, transcript jump = 1, no-op clicks free; post-win/loss board frozen (must U/R); R resets.

## Shipped: M-Z5 Redshire lure + M-Z6 DOG escort (this session)
- [x] Sim: lethal hunters (contact kills), local jammers (J, ≤3 freeze 6t), escort (Deluin 2-turn trail shadow), DOG vision (r4 + Bresenham LOS, stickers hide), spots (3 = blown), crush marks hunters dead instantly
- [x] `m-z5.json` 11x11: 3 hp1 hunters on loops, 3 rocks, 2 jammers, limit 60 — win = all crushed
- [x] `m-z6.json` 13x11 forest maze: 2 DOG loops, Deluin trail escort, 3 stickers, exit (11,5), win = on exit with D ≤3
- [x] V paints (S kept for move-down), J drops, B is ghost-fiction (invisible to DOGs), MZ5_DONE/MZ6_DONE

## Next session — Veridia acts (M-G2..M-G6)
- [x] M-G2 GPH Pitch: 3-Keeper dialogue-boss, MOV_HIDDEN persists
- [x] M-G3 debates: Prediction ticker (live score, 55+ gates the bet; bet needs DEFER)
- [x] M-G4 ghost network: stealth map + Trace meter (+20 adjacency, 60 wakes sleeper), robe = local freeze
- [x] M-G5 three houses: Seila evidence board, retryable pairs, LILY_HIGH choice
- [x] M-G6 poll (3 pulses to 1M, must go loud ≥1) + lethal lockdown escape + WATER/ICE + hub epilogue
- [x] Shared: generic runNodes, tour tools extended (mg4/mg6), save stamps, 5 buttons
- [x] Rebuild + validate: 30 modules, all node links + map bounds pass

## Next session — full-campaign pass: difficulty curve, cross-flag payoffs (MOV_HIDDEN/G3_DEFER in Zei text), audio, Pages deploy
- [x] (shipped, see S3 summary above + hub board)

## S4 pass (this session) — bots, fairness, mobile
- [x] `npm test`: snapshot-DFS solver (1-ply lookahead, fetch-form heuristics, iterative deepening, Z5 staging) proves all 9 map missions winnable within limits; determinism; 600-op rewind fuzz ×2; dialogue link/reachability/cond checks; G6 pulse math
- [x] Bugs the bots caught: heuristic pickup cliff (greedy refused grabs), dirty sim on winning search paths (new Sim.snapshot/restore), M-Z6 unwinnable (single-cell stickers + r=4 open east) → proactive facing paint, area cover (3x3), vision r=3, DOG1 loop east, limit 7
- [x] Cross-flag echoes in M-Z3 (glass/clean) + M-Z6 (backdoor hum/whispers)
- [x] Responsive: grouped buttons, phone/tablet breakpoints, forgiving tap-to-move, manipulation touch-action

## Next session — audio polish (mute persistence), Pages deploy check, new-story content (Freetown corps?)

## S5 micro-pass — soften H1 (gently)
- H1 loop x3-7 → x3-5 (`[(3,3),(5,3),(5,4),(3,4)]`): same lethality/hp, same rock-lane matchup, faster cycle (more kill windows), east half safe ground. Bot: 60/60 within limit, ALL CHECKS PASS. Shipped to Pages.
- [x] Ghost ally pass-through (fixes N-seal softlock class in G4/G6/Z6)
- [x] Hub campaign board: suggested order + ★ pips + per-mission stamps
- [x] Cross-flags: G3_DEFER→M-Z4 +2 energy + Verdow line; MOV burn→M-Z5 Fin line; MOV burn→M-G4 Trace 20
- [x] Synth SFX: move/click/build/rewind/win/lose/notice (WebAudio, resume-safe, mute persisted per session)
- [x] Deploy: HudsonR-D/snowmoon-second-player, gh-pages subtree, Pages building → https://hudsonr-d.github.io/snowmoon-second-player/

## Next session — M-Z4 shrine-XOR siege vs Gun
- [x] `xor rule` in square sim (zoneMode: OFF seals shrines, toggles every 6t)
- [x] `m-z4.json` 11x11: 4 2x2 zones, 2 Gun waypoint hunters, limit 48, need 3
- [x] `signal-edge` verb: F flips for 2 energy (M-Z2 energy concept, charges while holding ●)
- [x] Tournament charges (3, U + transcript), `MZ4_DONE`, claim/hold transcript lines
- [x] Rebuild + balance: optimal ~29t of 48, one flip needed, hunters plug lanes

## Next session — M-Z5 Redshire lure + M-Z6 DOG escort, then Freetown/Veridia acts

Acceptance: <3s load, 60fps, keyboard+touch pass, save resume, share URL.

Say `build slice` to start. I keep STORY-BIBLE + storyboards in context.
