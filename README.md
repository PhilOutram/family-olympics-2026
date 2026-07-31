# 🏅 Family Olympics 2026

A scoreboard app for our two-family holiday Olympics. Eleven of us, five teams, a
pile of events, and a live medal tally with all the pomp of the real thing (Olympic
rings, gold gradients, and the anthem on load).

**Live app:** https://philoutram.github.io/family-olympics-2026/

## The teams (the five ring colours)

| Team | Ring | Members |
|------|--------|-------------------|
| 1 | Blue | Rick, Cara, Jo |
| 2 | Yellow | Phil, Hal |
| 3 | Black | Kezi, Cam |
| 4 | Green | Claire, Max |
| 5 | Red | Zoe, Benny |

## Events & scoring

Every event feeds the medal tally on the home tab.

**Round-robin grids** (everyone plays everyone, **1 pt per win**) — Table Tennis,
Badminton, Pétanque, Mölkky, Zoggies. Tap a cell to record that the *row* team beat the
*column* team; the mirror cell fills in automatically (winner `1`, loser `0`).

**Team-combination matches** (**3 pts per win** to every team on the winning side) —
Volleyball, Ultimate Frisbee, Football. Tap the winning side.

**Ranked events** (finish 1st–5th → **5-4-3-2-1**) — Obstacle Relay, Synchro Pool
Jumping, Swimming Relay. Tap each team's finishing position.

**TT Around the World** (5 games) — for each game, pick who came **1st** (1 pt) and **2nd**
(½ pt). Each team's total across the 5 games is **rounded up** before it feeds the tally.

## Notes

- **Scores are shared and live.** They're stored in **Firebase Realtime Database**, so
  every phone sees the same scoreboard and updates the instant anyone records a result.
  `localStorage` is kept only as an offline cache. The footer shows the live sync status.
- Pure static site — plain HTML/CSS/JS, no build step. Served on GitHub Pages; the
  Firebase config is a public client config (access is governed by database rules).
- The football line-ups weren't on the original sheet, so match 1 is a placeholder split.

### Firebase database rules

The DB was started in *test mode*, whose open rules **expire ~30 days** after creation.
To keep it working, paste these into **Firebase console → Realtime Database → Rules**:

```json
{
  "rules": {
    "olympics2026": { ".read": true, ".write": true },
    "$other": { ".read": false, ".write": false }
  }
}
```

## Run locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```
