# SNOWMOON: Second Player
Hybrid Dual Campaign — Web TypeScript + Canvas

> **Play it:** https://hudsonr-d.github.io/snowmoon-second-player/ (auto-deployed from `dist/` via `gh-pages` branch)

## Premise
Two small privacy-first democracies vs Arctic Empire. Gladias (Veridia Order) gets socially engineered. Zei (Dzego Minpentai champ) gets drafted into shadow defense. Win by coordination, not conquest.

## License — GPL v3
Vitalik releases Snowmoon under GPL v3 with open-pipeline theory: if you adapt it, open-source prompts/scripts/harness.
This repo does that from day 1: see `pipeline/` plan in `storyboards/tech-arch.md` and keep all generation artifacts.

## Campaign (all 12 playable)
- Zei tactics: M-Z1 silent-coop · M-Z2 factories+transcript · M-Z3 hex vs Bo (3 charges) · M-Z4 XOR siege (flip) · M-Z5 lethal lure (jammers) · M-Z6 DOG escort (stickers, vision)
- Veridia acts: M-G1 dreadknot · M-G2 pitch · M-G3 debates (Prediction) · M-G4 ghost-net (Trace) · M-G5 houses (Seila board) · M-G6 poll+coup (WATER/ICE)
- `STORY-BIBLE.md` — characters, arcs, systems, themes.
- `PLAN.md` — build log + next sessions.

## Run
`npm run dev` for local, `npm run build` for static. Deploy: push `main`, then `git subtree push --prefix dist origin gh-pages`.

## Session log
- S1: fetched 32 chapters, 4 subagents, story bible + game direction locked (Hybrid + we pick stack).
- S2: storyboards locked. Built M-Z1 + M-G1 greybox.
- S3: blind review fixes, M-Z2..M-Z6 tactics, full Veridia acts, campaign pass (ghost ally, cross-flags, synth audio), Pages deploy.
- S4: bot playtesting (`npm test`: solver proves all 12 winnable within limits + fuzz + dialogue checks), proactive area stickers, r=3 vision, responsive mobile layout.
