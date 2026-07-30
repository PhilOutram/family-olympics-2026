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
Badminton, Pétanque, Mölkky, Boules, Zoggies. Tap a cell to record that the *row* team beat the
*column* team; the mirror cell fills in automatically (winner `1`, loser `0`).

**Team-combination matches** (**3 pts per win** to every team on the winning side) —
Volleyball, Ultimate Frisbee, Football. Tap the winning side.

**Ranked events** (finish 1st–5th → **5-4-3-2-1**) — TT Around the World, Obstacle
Relay, Synchro Pool Jumping, Swimming Relay. Tap each team's finishing position.

## Notes

- Scores are saved in the browser's `localStorage`, so keep the running tally on **one
  device** (whichever phone you're using to record).
- Pure static site — plain HTML/CSS/JS, no build step. Served on GitHub Pages.
- The football line-ups weren't on the original sheet, so match 1 is a placeholder split.

## Run locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```
