const STORAGE = {
  best: 'novaBlock.bestScore.v1',
  sound: 'novaBlock.sound.v1',
  vibration: 'novaBlock.vibration.v1',
  tips: 'novaBlock.tips.v1'
};

const boardEl = document.getElementById('board');
const piecesEl = document.getElementById('pieces');
const scoreValue = document.getElementById('scoreValue');
const bestValue = document.getElementById('bestValue');
const comboValue = document.getElementById('comboValue');
const energyText = document.getElementById('energyText');
const energyFill = document.getElementById('energyFill');
const pulseBtn = document.getElementById('pulseBtn');
const messageEl = document.getElementById('message');
const starsCountEl = document.getElementById('starsCount');
const miniGalaxy = document.getElementById('miniGalaxy');
const modal = document.getElementById('gameOverModal');

const screens = {
  home: document.getElementById('homeScreen'),
  game: document.getElementById('gameScreen'),
  options: document.getElementById('optionsScreen')
};

const SHAPES = [
  [[1]],
  [[1,1]],
  [[1],[1]],
  [[1,1,1]],
  [[1],[1],[1]],
  [[1,1],[1,1]],
  [[1,1,0],[0,1,1]],
  [[0,1,1],[1,1,0]],
  [[1,0],[1,1]],
  [[0,1],[1,1]],
  [[1,1],[1,0]],
  [[1,1],[0,1]],
  [[1,1,1],[0,1,0]],
  [[1,0,0],[1,1,1]],
  [[0,0,1],[1,1,1]],
  [[1,1,1,1]],
  [[1],[1],[1],[1]],
  [[1,1,1],[1,1,1]],
  [[1,1,1],[1,0,0],[1,0,0]],
  [[1,1,1],[0,0,1],[0,0,1]]
];

const COLORS = [
  ['#34f5ff', '#5b7cff', 'rgba(52,245,255,.65)'],
  ['#ff4fe3', '#b24cff', 'rgba(255,79,227,.65)'],
  ['#54ffb3', '#34f5ff', 'rgba(84,255,179,.65)'],
  ['#ffe078', '#ff8d4f', 'rgba(255,224,120,.65)'],
  ['#8d7cff', '#34f5ff', 'rgba(141,124,255,.65)']
];

let grid;
let pieces;
let selectedPieceIndex = null;
let score = 0;
let bestScore = Number(localStorage.getItem(STORAGE.best) || 0);
let combo = 0;
let energy = 0;
let stars = 0;
let pulseMode = false;
let settings = {
  sound: localStorage.getItem(STORAGE.sound) !== 'off',
  vibration: localStorage.getItem(STORAGE.vibration) !== 'off',
  tips: localStorage.getItem(STORAGE.tips) !== 'off'
};

let audioCtx = null;

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('is-active'));
  screens[name].classList.add('is-active');
}

function vibrate(ms = 24) {
  if (settings.vibration && navigator.vibrate) navigator.vibrate(ms);
}

function sound(type = 'tap') {
  if (!settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const now = audioCtx.currentTime;
    const map = {
      tap: [420, 0.04, 'sine'],
      place: [620, 0.07, 'triangle'],
      clear: [880, 0.13, 'sine'],
      pulse: [160, 0.22, 'sawtooth'],
      fail: [120, 0.12, 'square']
    };
    const [freq, dur, wave] = map[type] || map.tap;
    osc.type = wave;
    osc.frequency.setValueAtTime(freq, now);
    if (type === 'pulse') osc.frequency.exponentialRampToValueAtTime(620, now + dur);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + dur + 0.02);
  } catch (e) {}
}

function newGame() {
  grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  pieces = generatePieces();
  selectedPieceIndex = null;
  score = 0;
  combo = 0;
  energy = 0;
  stars = 0;
  pulseMode = false;
  modal.classList.remove('is-active');
  setMessage('Sélectionne une pièce, puis touche la grille.');
  render();
}

function generatePieces() {
  return Array.from({ length: 3 }, () => {
    const shape = cloneShape(SHAPES[Math.floor(Math.random() * SHAPES.length)]);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    return { shape, color, used: false };
  });
}

function cloneShape(shape) {
  return shape.map(row => [...row]);
}

function render() {
  scoreValue.textContent = score;
  bestValue.textContent = bestScore;
  comboValue.textContent = `x${combo}`;
  energyText.textContent = `${Math.floor(energy)}%`;
  energyFill.style.width = `${Math.min(100, energy)}%`;
  pulseBtn.disabled = energy < 100;
  pulseBtn.textContent = pulseMode ? 'Choisis zone' : 'Nova Pulse';
  starsCountEl.textContent = `${stars} étoile${stars > 1 ? 's' : ''}`;
  renderBoard();
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
    if (idx === selectedPieceIndex) card.classList.add('selected');
    if (piece.used) card.classList.add('used');
    card.addEventListener('click', () => selectPiece(idx));

    const rows = piece.shape.length;
    const cols = Math.max(...piece.shape.map(row => row.length));
    const mini = document.createElement('div');
    mini.className = 'piece-grid';
    mini.style.gridTemplateColumns = `repeat(${cols}, 16px)`;
    mini.style.gridTemplateRows = `repeat(${rows}, 16px)`;

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
  setMessage('Maintenant touche la grille pour poser le bloc.');
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
    vibrate(60);
    return;
  }
  const piece = pieces[selectedPieceIndex];
  if (!canPlace(piece.shape, row, col)) {
    setMessage('Placement impossible ici. Essaie une autre case.');
    sound('fail');
    vibrate(70);
    return;
  }
  placePiece(piece, row, col);
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

function placePiece(piece, row, col) {
  let cells = 0;
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      if (!piece.shape[r][c]) continue;
      grid[row + r][col + c] = { color: piece.color };
      cells++;
    }
  }
  pieces[selectedPieceIndex].used = true;
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
    vibrate(40);
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
  rows.forEach(r => {
    for (let c = 0; c < 8; c++) grid[r][c] = null;
  });
  cols.forEach(c => {
    for (let r = 0; r < 8; r++) grid[r][c] = null;
  });
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
    sound('tap');
    setMessage(pulseMode ? 'Touche une zone de la grille pour déclencher Nova Pulse.' : 'Nova Pulse annulé.');
    render();
  });
}

function boot() {
  initOptions();
  bindButtons();
  grid = Array.from({ length: 8 }, () => Array(8).fill(null));
  pieces = generatePieces();
  bestValue.textContent = bestScore;
  render();
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
}

boot();
