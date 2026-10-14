# Zei Path — M-Z1..M-Z6 (tactics)

## Core loop: PROGRAM-WATCH-ADAPT (30-60s)
OBSERVE 10s paused (scrub replay, read transcript, fog ghosts) -> PROGRAM 15s (spend Matter: Wall 3, Glider 5, Spaceship 9, Factory 12, Trigger 8, Jammer 10) -> UNFOLD 20s (25-50 turns/sec, 500-1000 turns, 1x Emergency Wall allowed) -> ADAPT.

Vision: 30x30 per factory/avatar/glider union. Fog: grey ghost + ? pulse + ripple. Transcript mutual from M-Z2: `T412 Bo: FACTORY-A east` clickable to replay.

## M-Z1 Silent Quarter (ch4) — tutorial walls+coop
48x48, you west + Bai east vs Pan/Dza north streams. Shared 60-wall pool. No chat, 3 Pings/loop. Win: combined pop > enemy at T1000. Lose: HQ dies -> auto-replay Bai correct wall, refund 30%.

## M-Z2 Transparent Final (ch7) — factories+transcript
64x64 open, start down 20v80. Factory 16 presets (Gun, Eater, LWSS...). Win: lead 200 turns before T3000. Beat: switch to Eater+LWSS at T1800 scripted comeback.

## M-Z3 Bo Qualifier (ch12) — hex+rewind
Hex R37 B2/S34H, hold center 9 for 300 turns. 3x Rewind -200 turns keeping ghosts. Bo predicts lanes -> pre-wall after rewind.

## M-Z4 Shrine Siege (ch14) — XOR
56x56 4 shrines 5x5, rule inside: live if (neighbors==3 XOR signal ON, toggles 150t). Hold 3/4 at T2000. Unlock signal-edge Trigger.

## M-Z5 Redshire Lure (ch22) — play dead
72x48 corridor, 6 hunters with 30x12 cones. Jammer 11x11 fakes dead. Hexagon wall trap + 6-side glider flood. Kill 6, lose 0 factories.

## M-Z6 Elenar + DOG (ch29-30) — stealth escort
80x80 forest, vision cut to 8, trees eat gliders. Sticker paint 3x3 fools DOG AI 400t. Escort Deluin numbers (ally-only paint) to east exit T3500, spotted <3x. Callback to M-Z1 silent coop, now fluent.

## Progression
Unlocks per mission, Matter -20%/mission, transcript detail up. No hard fail: keep at T-200, Adaptation % bar, Mu 1-of-3 hints after 2 losses.

## Canvas greybox
1280x720, layers: terrain/fog/live/structures/vision/FX. Cyan you, red enemy, grey wall, pulse factory, gold shrine. Sim separate: 1 turn = move walls/spaceships/gliders + factory/trigger + pickup/crush/shrine. Store diffs for scrubber. Entities: Cell{alive,wall,factoryId,jammed,stickerT} Factory Trigger TranscriptEvent.
