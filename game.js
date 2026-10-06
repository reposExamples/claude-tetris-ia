'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');
const startScreen = document.getElementById('start-screen');
const startTop = document.getElementById('start-top');
const startStats = document.getElementById('start-stats');
const playBtn = document.getElementById('play-btn');
const clearRecordsBtn = document.getElementById('clear-records-btn');
const overlayRecord = document.getElementById('overlay-record');
const nameForm = document.getElementById('name-form');
const nameInput = document.getElementById('name-input');
const overlayRecords = document.getElementById('overlay-records');
const overlayTop = document.getElementById('overlay-top');
const overlayStats = document.getElementById('overlay-stats');

const TOP_SIZE = 5;
const RECORDS_KEY = 'tetris.records';
const NAME_KEY = 'tetris.lastName';

let gridColor = '#22222e';

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeBtn.textContent = theme === 'light' ? '☀️ Claro' : '🌙 Oscuro';
  themeBtn.setAttribute('aria-pressed', String(theme === 'light'));
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  // el bucle no redibuja en pausa/game over
  if (current && next) { draw(); drawNext(); }
}

let board, current, next, score, lines, level, combo, maxCombo, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

// ---- Récords (localStorage) ----
function loadRecords() {
  const rec = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || typeof data !== 'object') return rec;
    if (Array.isArray(data.top)) {
      rec.top = data.top
        .filter(e => e && typeof e === 'object' && Number.isFinite(e.score))
        .map(e => ({
          name: String(e.name ?? '').slice(0, 12),
          score: e.score,
          lines: Number.isFinite(e.lines) ? e.lines : 0,
          level: Number.isFinite(e.level) ? e.level : 1,
          date: String(e.date ?? ''),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, TOP_SIZE);
    }
    if (Number.isFinite(data.bestCombo)) rec.bestCombo = data.bestCombo;
    if (Number.isFinite(data.maxLines)) rec.maxLines = data.maxLines;
  } catch (e) {}
  return rec;
}

function saveRecords(rec) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(rec)); } catch (e) {}
}

function qualifies(rec) {
  return score > 0 && (rec.top.length < TOP_SIZE || score > rec.top[rec.top.length - 1].score);
}

// highlight: entrada del top a resaltar (o null)
function renderTop(ol, top, highlight) {
  ol.textContent = '';
  for (let i = 0; i < TOP_SIZE; i++) {
    const li = document.createElement('li');
    const e = top[i];
    const pos = document.createElement('span');
    pos.className = 'rec-pos';
    pos.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'rec-name';
    const pts = document.createElement('span');
    pts.className = 'rec-score';
    if (e) {
      name.textContent = e.name || 'Anónimo';
      pts.textContent = e.score.toLocaleString();
      li.title = `${e.lines} líneas · nivel ${e.level}${e.date ? ' · ' + e.date : ''}`;
      if (e === highlight) li.className = 'highlight';
    } else {
      name.textContent = '—';
      li.className = 'empty';
    }
    li.append(pos, name, pts);
    ol.appendChild(li);
  }
}

function statsText(rec) {
  return `Mejor combo: ${rec.bestCombo} · Líneas máx.: ${rec.maxLines}`;
}

function showStartScreen() {
  const rec = loadRecords();
  renderTop(startTop, rec.top, null);
  startStats.textContent = statsText(rec);
  startScreen.classList.remove('hidden');
  playBtn.focus();
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (!cleared) combo = 0;
  else {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayRecord.classList.add('hidden');
  nameForm.classList.add('hidden');

  const rec = loadRecords();
  rec.bestCombo = Math.max(rec.bestCombo, maxCombo);
  rec.maxLines = Math.max(rec.maxLines, lines);
  saveRecords(rec);

  overlayRecords.classList.remove('hidden');
  overlayStats.textContent = statsText(rec);
  renderTop(overlayTop, rec.top, null);
  overlay.classList.remove('hidden');
  if (qualifies(rec)) {
    overlayRecord.classList.remove('hidden');
    nameForm.classList.remove('hidden');
    try { nameInput.value = localStorage.getItem(NAME_KEY) || ''; } catch (e) { nameInput.value = ''; }
    nameInput.focus();
    nameInput.select();
  }
}

function saveName() {
  if (nameForm.classList.contains('hidden')) return;
  const name = nameInput.value.trim().slice(0, 12) || 'Anónimo';
  const rec = loadRecords(); // relee por si otra pestaña lo cambió
  const entry = { name, score, lines, level, date: new Date().toISOString().slice(0, 10) };
  rec.top.push(entry);
  rec.top.sort((a, b) => b.score - a.score); // estable: a igualdad queda detrás
  rec.top = rec.top.slice(0, TOP_SIZE);
  saveRecords(rec);
  try { localStorage.setItem(NAME_KEY, name); } catch (e) {}
  nameForm.classList.add('hidden');
  overlayRecord.classList.add('hidden');
  renderTop(overlayTop, rec.top, entry);
  restartBtn.focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayRecord.classList.add('hidden');
  nameForm.classList.add('hidden');
  overlayRecords.classList.add('hidden');
  startScreen.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (!startScreen.classList.contains('hidden')) {
    if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); init(); }
    return;
  }
  if (!current) return; // aún no ha empezado ninguna partida
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => { init(); restartBtn.blur(); });

playBtn.addEventListener('click', () => { init(); playBtn.blur(); });

clearRecordsBtn.addEventListener('click', () => {
  if (confirm('¿Borrar todos los récords?')) {
    try { localStorage.removeItem(RECORDS_KEY); } catch (e) {}
    showStartScreen();
  }
  clearRecordsBtn.blur();
});

nameForm.addEventListener('submit', e => { e.preventDefault(); saveName(); });

themeBtn.addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  try { localStorage.setItem('theme', theme); } catch (e) {}
  applyTheme(theme);
  themeBtn.blur(); // evita que Space/Enter reactiven el botón durante el juego
});

applyTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');

showStartScreen();
