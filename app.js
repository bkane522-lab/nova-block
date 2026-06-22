const STORAGE = {
  best: 'novaBlockBest',
  sound: 'novaBlockSound',
  vibration: 'novaBlockVibration',
  tips: 'novaBlockTips'
};

const COLORS = [
  ['#77e7ff', '#4fbdff', 'rgba(79,189,255,.30)'],
  ['#8df3d2', '#39d9aa', 'rgba(57,217,170,.28)'],
  ['#b08cff', '#7c67ff', 'rgba(124,103,255,.28)'],
  ['#ffc58a', '#ff9f59', 'rgba(255,159,89,.26)'],
  ['#ff9dd8', '#ff67d5', 'rgba(255,103,213,.26)']
];

const SHAPES = [
  [[1]],
  [[1,1]],
  [[1,1,1]],
  [[1],[1]],
  [[1],[1],[1]],
  [[1,1],[1,1]],
  [[1,0],[1,1]],
  [[0,1],[1,1]],
  [[1,1,1],[0,1,0]],
  [[1,1,1],[1,0,0]],
  [[1,1,1],[0,0,1]],
  [[1,1,1,1]],
  [[1],[1],[1],[1]],
  [[1,1,0],[0,1,1]],
  [[0,1,1],[1,1,0]]
];

let grid = [];
let pieces = [];
let selectedPieceIndex = null;
let score = 0;
let bestScore = parseInt(localStorage.getItem(STORAGE.best) || '0', 10);
let combo = 0;
let stars = 0;
let energy = 0;
let pulseMode = false;
let dragState = null;

const settings = {
  sound: localStorage.getItem(STORAGE.sound) !== 'off',
  vibration: localStorage.getItem(STORAGE.vibration) !== 'off',
  tips: localStorage.getItem(STORAGE.tips) !== 'off'
};

const homeScreen = document.getElementById('homeScreen');
const gameScreen = document.getElementById('gameScreen');
const optionsScreen = document.getElementById('optionsScreen');
const modal = document.getElementById('gameOverModal');
const boardEl = document.getElementById('board');
const piecesEl = document.getElementById('pieces');
const messageEl = document.getElementById('message');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const comboValue = document.getElementById('comboValue');
const energyText = document.getElementById('energyText');
const energyFill = document.getElementById('energyFill');
const starsCount = document.getElementById('starsCount');
const miniGalaxy = document.getElementById('miniGalaxy');
const pulseBtn = document.getElementById('pulseBtn');

function showScreen(name) {
  [homeScreen, gameScreen, optionsScreen].forEach(screen => screen.classList.remove('is-active'));
  if (name === 'home') homeScreen.classList.add('is-active');
  if (name === 'game') gameScreen.classList.add('is-active');
  if (name === 'options') optionsScreen.classList.add('is-active');
  if (name !== 'game') cancelDrag();
}

function sound(type = 'tap') {
  if (!settings.sound) return;
  try {
    const audio = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    const base = { tap: 460, place: 600, clear: 760, fail: 180, pulse: 900 }[type] || 420;
    osc.type = type === 'fail' ? 'square' : 'sine';
    osc.frequency.value = base;
    gain.gain.value = .035;
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start();
    osc.frequency.exponentialRampToValueAtTime(base * (type === 'clear' ? 1.2 : 0.8), audio.currentTime + .08);
    gain.gain.exponentialRampToValueAtTime(.0001, audio.currentTime + .13);
    osc.stop(audio.currentTime + .14);
  } catch (e) {}
}

function vibrate(ms = 16) {
  if (settings.vibration && navigator.vibrate) navigator.vibrate(ms);
}

function createEmptyGrid() {
  return Array.from({ length: 8 }, () => Array(8).fill(null));
}

function generatePieces() {
  const list = [];
  while (list.length < 3) {
    const shape = JSON.parse(JSON.stringify(SHAPES[Math.floor(Math.random() * SHAPES.length)]));
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    list.push({ shape, color, used: false });
  }
  return list;
}

function newGame() {
  grid = createEmptyGrid();
  pieces = generatePieces();
  selectedPieceIndex = null;
  score = 0;
  combo = 0;
  stars = 0;
  energy = 0;
  pulseMode = false;
  cancelDrag();
  modal.classList.remove('is-active');
  setMessage('Fais glisser un bloc vers la grille, ou touche un bloc puis une case.');
  render();
}

function render() {
  scoreValue.textContent = score;
  bestValue.textContent = bestScore;
  comboValue.textContent = `x${combo}`;
  energyText.textContent = `${Math.round(energy)}%`;
  energyFill.style.width = `${Math.min(100, energy)}%`;
  starsCount.textContent = `${stars} ${stars > 1 ? 'étoiles' : 'étoile'}`;
  pulseBtn.disabled = energy < 100;
  pulseBtn.textContent = pulseMode ? 'Annuler Pulse' : 'Nova Pulse';

  let preview = [];
  let badPreview = false;
  if (dragState && dragState.boardCell && pieces[dragState.pieceIndex] && !pieces[dragState.pieceIndex].used) {
    const piece = pieces[dragState.pieceIndex];
    preview = getPreviewCells(piece.shape, dragState.boardCell.row, dragState.boardCell.col);
    badPreview = !canPlace(piece.shape, dragState.boardCell.row, dragState.boardCell.col);
  }
  renderBoard(preview, badPreview);
  renderPieces();
  renderGalaxy();
}

function renderBoard(previewCells = [], badPreview = false) {
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.type = 'button';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.setAttribute('aria-label', `Case ${r + 1}-${c + 1}`);
      const data = grid[r][c];
      if (data) {
        cell.classList.add('filled');
        cell.style.setProperty('--block-a', data.color[0]);
        cell.style.setProperty('--block-b', data.color[1]);
        cell.style.setProperty('--glow', data.color[2]);
      }
      const isPreview = previewCells.some(p => p.r === r && p.c === c);
      if (isPreview) cell.classList.add(badPreview ? 'bad-preview' : 'preview');
      if (pulseMode) cell.classList.add('pulse-target');
      cell.addEventListener('click', () => onBoardTap(r, c));
      boardEl.appendChild(cell);
    }
  }
}

function renderPieces() {
  piecesEl.innerHTML = '';
  pieces.forEach((piece, idx) => {
    const card = document.createElement('button');
    card.className = 'piece-card';
    card.type = 'button';
    card.dataset.index = idx;
    if (idx === selectedPieceIndex) card.classList.add('selected');
    if (piece.used) card.classList.add('used');
    if (dragState && dragState.pieceIndex === idx) card.classList.add('dragging');
    card.addEventListener('click', () => selectPiece(idx));
    bindDragEvents(card, idx);

    const rows = piece.shape.length;
    const cols = Math.max(...piece.shape.map(row => row.length));
    const mini = document.createElement('div');
    mini.className = 'piece-grid';
    mini.style.gridTemplateColumns = `repeat(${cols}, 14px)`;
    mini.style.gridTemplateRows = `repeat(${rows}, 14px)`;

    piece.shape.forEach(row => {
      for (let c = 0; c < cols; c++) {
        const dot = document.createElement('span');
        dot.className = 'mini-cell';
        if (row[c]) {
          dot.classList.add('on');
          dot.style.setProperty('--block-a', piece.color[0]);
          dot.style.setProperty('--block-b', piece.color[1]);
          dot.style.setProperty('--glow', piece.color[2]);
        }
        mini.appendChild(dot);
      }
    });
    card.appendChild(mini);
    piecesEl.appendChild(card);
  });
}

function renderGalaxy() {
  miniGalaxy.innerHTML = '';
  const count = Math.min(stars, 38);
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    dot.className = 'star-dot';
    if (i % 7 === 0) dot.classList.add('big');
    const x = pseudoRandom(i * 17 + stars * 3) * 94 + 3;
    const y = pseudoRandom(i * 31 + stars * 5) * 84 + 8;
    dot.style.left = `${x}%`;
    dot.style.top = `${y}%`;
    dot.style.animationDelay = `${(i % 9) * .17}s`;
    miniGalaxy.appendChild(dot);
  }
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function selectPiece(idx) {
  if (pieces[idx].used) return;
  pulseMode = false;
  selectedPieceIndex = idx;
  sound('tap');
  vibrate(12);
  setMessage('Bloc sélectionné. Touche une case de la grille, ou fais-le glisser.');
  render();
}

function onBoardTap(row, col) {
  if (pulseMode) {
    usePulse(row, col);
    return;
  }
  if (selectedPieceIndex === null || pieces[selectedPieceIndex].used) {
    setMessage('Choisis d’abord une pièce en bas.');
    sound('fail');
    vibrate(50);
    return;
  }
  const piece = pieces[selectedPieceIndex];
  if (!canPlace(piece.shape, row, col)) {
    setMessage('Placement impossible ici. Essaie une autre case.');
    sound('fail');
    vibrate(55);
    return;
  }
  placePiece(selectedPieceIndex, row, col);
}

function getPreviewCells(shape, row, col) {
  const cells = [];
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      cells.push({ r: row + r, c: col + c });
    }
  }
  return cells.filter(p => p.r >= 0 && p.r < 8 && p.c >= 0 && p.c < 8);
}

function canPlace(shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const rr = row + r;
      const cc = col + c;
      if (rr < 0 || rr >= 8 || cc < 0 || cc >= 8 || grid[rr][cc]) return false;
    }
  }
  return true;
}

function placePiece(pieceIndex, row, col) {
  const piece = pieces[pieceIndex];
  let cells = 0;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      grid[row + r][col + c] = { color: piece.color };
      cells++;
    }
  }
  pieces[pieceIndex].used = true;
  selectedPieceIndex = null;
  score += cells * 10;
  energy = Math.min(100, energy + cells * 3);
  sound('place');
  vibrate(18);

  const cleared = clearLines();
  if (cleared > 0) {
    combo += 1;
    const gained = cleared * 100 * combo;
    const starGain = cleared + combo;
    score += gained;
    energy = Math.min(100, energy + cleared * 18 + combo * 4);
    stars += starGain;
    setMessage(`Combo x${combo} ! +${gained} points, +${starGain} étoiles.`);
    sound('clear');
    vibrate(38);
  } else {
    combo = 0;
    if (settings.tips && energy >= 100) setMessage('Nova Pulse prêt : utilise-le pour libérer de la place.');
    else setMessage('Bien joué. Continue à préparer les lignes.');
  }

  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(STORAGE.best, String(bestScore));
  }

  if (pieces.every(p => p.used)) pieces = generatePieces();
  render();
  if (!hasAnyMove()) endGame();
}

function clearLines() {
  const rows = [];
  const cols = [];
  for (let r = 0; r < 8; r++) {
    if (grid[r].every(Boolean)) rows.push(r);
  }
  for (let c = 0; c < 8; c++) {
    let full = true;
    for (let r = 0; r < 8; r++) {
      if (!grid[r][c]) { full = false; break; }
    }
    if (full) cols.push(c);
  }
  rows.forEach(r => { for (let c = 0; c < 8; c++) grid[r][c] = null; });
  cols.forEach(c => { for (let r = 0; r < 8; r++) grid[r][c] = null; });
  return rows.length + cols.length;
}

function hasAnyMove() {
  const available = pieces.filter(p => !p.used);
  for (const piece of available) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (canPlace(piece.shape, r, c)) return true;
      }
    }
  }
  return false;
}

function usePulse(row, col) {
  if (energy < 100) return;
  let removed = 0;
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r < 0 || r >= 8 || c < 0 || c >= 8) continue;
      if (grid[r][c]) removed++;
      grid[r][c] = null;
    }
  }
  pulseMode = false;
  energy = 0;
  combo = 0;
  const bonus = 120 + removed * 20;
  score += bonus;
  stars += Math.max(1, Math.ceil(removed / 2));
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem(STORAGE.best, String(bestScore));
  }
  setMessage(`Nova Pulse activé ! ${removed} blocs libérés, +${bonus} points.`);
  sound('pulse');
  vibrate(90);
  render();
}

function endGame() {
  document.getElementById('finalScore').textContent = `Score : ${score}`;
  document.getElementById('finalStars').textContent = `Étoiles créées : ${stars}`;
  document.getElementById('finalRank').textContent = `Rang : ${getRank(score, stars)}`;
  modal.classList.add('is-active');
  sound('fail');
}

function getRank(score, stars) {
  if (score >= 15000 || stars >= 80) return 'Architecte Galactique';
  if (score >= 8000 || stars >= 45) return 'Maître Nova';
  if (score >= 4000 || stars >= 24) return 'Pilote Stellaire';
  if (score >= 1500 || stars >= 10) return 'Explorateur Nova';
  return 'Apprenti des étoiles';
}

function setMessage(text) {
  messageEl.textContent = text;
}

function updateToggle(btn, key, storageKey) {
  btn.textContent = settings[key] ? 'ON' : 'OFF';
  btn.classList.toggle('off', !settings[key]);
  btn.setAttribute('aria-pressed', String(settings[key]));
  localStorage.setItem(storageKey, settings[key] ? 'on' : 'off');
}

function initOptions() {
  const soundBtn = document.getElementById('soundBtn');
  const vibrationBtn = document.getElementById('vibrationBtn');
  const tipsBtn = document.getElementById('tipsBtn');
  updateToggle(soundBtn, 'sound', STORAGE.sound);
  updateToggle(vibrationBtn, 'vibration', STORAGE.vibration);
  updateToggle(tipsBtn, 'tips', STORAGE.tips);

  soundBtn.addEventListener('click', () => { settings.sound = !settings.sound; updateToggle(soundBtn, 'sound', STORAGE.sound); sound('tap'); });
  vibrationBtn.addEventListener('click', () => { settings.vibration = !settings.vibration; updateToggle(vibrationBtn, 'vibration', STORAGE.vibration); vibrate(30); });
  tipsBtn.addEventListener('click', () => { settings.tips = !settings.tips; updateToggle(tipsBtn, 'tips', STORAGE.tips); });
}

function bindButtons() {
  document.getElementById('startBtn').addEventListener('click', () => { sound('tap'); showScreen('game'); newGame(); });
  document.getElementById('homeOptionsBtn').addEventListener('click', () => { sound('tap'); showScreen('options'); });
  document.getElementById('closeOptionsBtn').addEventListener('click', () => { sound('tap'); showScreen('home'); });
  document.getElementById('backHomeBtn').addEventListener('click', () => { sound('tap'); showScreen('home'); });
  document.getElementById('newGameBtn').addEventListener('click', () => { sound('tap'); newGame(); });
  document.getElementById('restartBtn').addEventListener('click', () => { sound('tap'); newGame(); showScreen('game'); });
  document.getElementById('modalHomeBtn').addEventListener('click', () => { modal.classList.remove('is-active'); showScreen('home'); });
  document.getElementById('resetBestBtn').addEventListener('click', () => {
    bestScore = 0;
    localStorage.setItem(STORAGE.best, '0');
    sound('tap');
    render();
    setMessage('Meilleur score réinitialisé.');
  });
  pulseBtn.addEventListener('click', () => {
    if (energy < 100) return;
    pulseMode = !pulseMode;
    selectedPieceIndex = null;
    cancelDrag();
    sound('tap');
    setMessage(pulseMode ? 'Touche une zone de la grille pour déclencher Nova Pulse.' : 'Nova Pulse annulé.');
    render();
  });
}

function bindDragEvents(card, idx) {
  card.addEventListener('pointerdown', (e) => startDrag(e, idx, card));
}

function startDrag(e, idx, card) {
  if (pieces[idx].used) return;
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  pulseMode = false;
  selectedPieceIndex = idx;
  const ghost = buildGhost(pieces[idx]);
  document.body.appendChild(ghost);
  dragState = { pieceIndex: idx, ghost, pointerId: e.pointerId, boardCell: null };
  updateGhostPosition(e.clientX, e.clientY);
  updateBoardHover(e.clientX, e.clientY);
  if (card.setPointerCapture) card.setPointerCapture(e.pointerId);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  setMessage('Fais glisser le bloc sur la grille puis relâche.');
  render();
}

function buildGhost(piece) {
  const rows = piece.shape.length;
  const cols = Math.max(...piece.shape.map(row => row.length));
  const ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  const mini = document.createElement('div');
  mini.className = 'piece-grid';
  mini.style.gridTemplateColumns = `repeat(${cols}, 18px)`;
  mini.style.gridTemplateRows = `repeat(${rows}, 18px)`;
  piece.shape.forEach(row => {
    for (let c = 0; c < cols; c++) {
      const dot = document.createElement('span');
      dot.className = 'mini-cell';
      dot.style.width = '18px';
      dot.style.height = '18px';
      if (row[c]) {
        dot.classList.add('on');
        dot.style.setProperty('--block-a', piece.color[0]);
        dot.style.setProperty('--block-b', piece.color[1]);
        dot.style.setProperty('--glow', piece.color[2]);
      }
      mini.appendChild(dot);
    }
  });
  ghost.appendChild(mini);
  return ghost;
}

function updateGhostPosition(x, y) {
  if (!dragState?.ghost) return;
  dragState.ghost.style.left = `${x}px`;
  dragState.ghost.style.top = `${y}px`;
}

function getBoardCellFromPoint(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el?.closest('.cell');
  if (!cell) return null;
  return {
    row: parseInt(cell.dataset.row, 10),
    col: parseInt(cell.dataset.col, 10)
  };
}

function updateBoardHover(x, y) {
  if (!dragState) return;
  dragState.boardCell = getBoardCellFromPoint(x, y);
  render();
}

function onPointerMove(e) {
  if (!dragState) return;
  updateGhostPosition(e.clientX, e.clientY);
  updateBoardHover(e.clientX, e.clientY);
}

function onPointerUp(e) {
  if (!dragState) return;
  const pieceIndex = dragState.pieceIndex;
  const boardCell = getBoardCellFromPoint(e.clientX, e.clientY) || dragState.boardCell;
  const canDrop = boardCell && canPlace(pieces[pieceIndex].shape, boardCell.row, boardCell.col);
  cancelDrag();
  if (canDrop) {
    placePiece(pieceIndex, boardCell.row, boardCell.col);
  } else {
    setMessage('Bloc relâché hors zone valable. Réessaie.');
    render();
  }
}

function cancelDrag() {
  if (dragState?.ghost && dragState.ghost.parentNode) dragState.ghost.parentNode.removeChild(dragState.ghost);
  dragState = null;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
}

function boot() {
  initOptions();
  bindButtons();
  grid = createEmptyGrid();
  pieces = generatePieces();
  bestValue.textContent = bestScore;
  render();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
