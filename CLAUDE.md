# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Language

Always respond to the user in Spanish in this project.

## Project

Tetris in vanilla JavaScript + HTML5 Canvas + CSS. No dependencies, no build step, no tests, no linter. README and UI text are in Spanish.

## Running

- Open `index.html` directly (`open index.html`), or serve the folder, e.g. `python3 -m http.server 8000`.
- There is no test or lint command; verify changes by playing in the browser.

## Architecture

Three files, loaded by `index.html` via a plain `<script src="game.js">` (no modules, `'use strict'`):

- `index.html` — fixed DOM the script depends on by id: `board` (300×600 canvas), `next-canvas` (120×120), `score`/`lines`/`level`, and the `overlay` / `overlay-title` / `overlay-score` / `restart-btn` group, the records ids (`start-screen`, `start-top`, `start-stats`, `play-btn`, `clear-records-btn`, `overlay-record`, `name-form`, `name-input`, `overlay-records`, `overlay-top`, `overlay-stats`). Renaming an id requires updating the lookups at the top of `game.js`.
- `style.css` — layout and theming only.
- `game.js` — all game logic, using module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) that `init()` resets.

Key points in `game.js`:

- Board is a `ROWS×COLS` matrix of ints; `0` is empty, `1–7` index into both `COLORS` and `PIECES` (so piece type id == color id). Keep the three in sync when changing pieces.
- Pieces are `{type, shape, x, y}`; shapes are square matrices rotated with `rotateCW` (rotation is clockwise only, with horizontal kicks `[0,-1,1,-2,2]` in `tryRotate`). `collide(shape, ox, oy)` is the single collision check used by movement, rotation, ghost, and spawn; it allows `ny < 0`.
- Game loop: `loop(ts)` via `requestAnimationFrame` accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`; it also calls `draw()` every frame. Pause/game over work by `cancelAnimationFrame(animId)` and restarting `loop`; `init()` cancels any existing frame before scheduling a new one.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, game over if the spawn collides). Soft/hard drop award points directly (1/cell and 2/cell); line-clear scoring is `LINE_SCORES[n] * level`.
- Records: `localStorage` key `tetris.records` (`{top[≤5], bestCombo, maxLines}`) and `tetris.lastName`, via `loadRecords`/`saveRecords`. `init()` is NOT called on load: `showStartScreen()` is, so `current`/`board` are undefined until Play; `keydown` ignores input targets and returns while there is no game. `combo`/`maxCombo` are updated in `clearLines`; `endGame` shows the table and name form.
- Input is a single `keydown` handler at the bottom; `KeyP` is handled before the paused/gameOver guard.
- Piece generation is plain `Math.random()` per piece (no 7-bag).
