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

- `index.html` — fixed DOM the script depends on by id: `board` (300×600 canvas), `next-canvas` (120×120), `score`/`lines`/`level`, and the `overlay` / `overlay-title` / `overlay-score` / `restart-btn` group. Renaming an id requires updating the lookups at the top of `game.js`.
- `style.css` — layout and theming only.
- `game.js` — all game logic, using module-level mutable globals (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, ...) that `init()` resets.

Key points in `game.js`:

- Board is a `ROWS×COLS` matrix of ints; `0` is empty, `1–7` index into both `PIECES` and the active skin's `colors` (so piece type id == color id). `COLORS` is just the Retro palette (`SKINS.retro.colors`). Keep `PIECES` and every skin's `colors` array in sync when changing pieces.
- Skins: `SKINS` (`retro`, `neon`, `pastel`, `pixel`) each define `colors`, `drawBlock(context, px, py, size, color, alpha)` and optionally `boardBg`/`grid`. `drawBlock(context, x, y, colorIndex, size, alpha)` delegates to the active `skin`; `draw()`/`drawNext()` paint `boardBg` or `clearRect`. `applySkin(name)` redraws immediately; preference is stored in `localStorage` key `skin` (select `#skin-select`).
- Pieces are `{type, shape, x, y}`; shapes are square matrices rotated with `rotateCW` (rotation is clockwise only, with horizontal kicks `[0,-1,1,-2,2]` in `tryRotate`). `collide(shape, ox, oy)` is the single collision check used by movement, rotation, ghost, and spawn; it allows `ny < 0`.
- Game loop: `loop(ts)` via `requestAnimationFrame` accumulates `dropAccum` and applies gravity when it exceeds `dropInterval`; it also calls `draw()` every frame. Pause/game over work by `cancelAnimationFrame(animId)` and restarting `loop`; `init()` cancels any existing frame before scheduling a new one.
- Piece lifecycle: `lockPiece()` → `merge()` → `clearLines()` (updates lines/score/level/`dropInterval`) → `spawn()` (promotes `next`, game over if the spawn collides). Soft/hard drop award points directly (1/cell and 2/cell); line-clear scoring is `LINE_SCORES[n] * level`.
- Input is a single `keydown` handler at the bottom; `KeyP` is handled before the paused/gameOver guard.
- Piece generation is plain `Math.random()` per piece (no 7-bag).
