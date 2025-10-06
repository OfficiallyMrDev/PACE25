
/* Configurable image source (change to your local project path) */
const IMAGE_SRC_DEFAULT = 'assets/logorm.png'; // <-- change this if needed
const GRID = 3;

const boardEl = document.getElementById('board');
const movesEl = document.getElementById('moves');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');
const completeBox = document.getElementById('completeBox');
const imageInput = document.getElementById('imageInput');
const applyImgBtn = document.getElementById('applyImg');
const imgPathDisplay = document.getElementById('imgPath');

let IMAGE_SRC = IMAGE_SRC_DEFAULT;
if (imageInput) imageInput.value = IMAGE_SRC_DEFAULT;
if (imgPathDisplay) imgPathDisplay.textContent = IMAGE_SRC_DEFAULT;

let sizePx = 0;
let tileSize = 0;
let tiles = []; // { index, r, c, el }
let moves = 0;
let selectedTile = null;
let solvedPositions = [];
let isAnimating = false;
let draggedTileObj = null;

function idx(r, c) { return r * GRID + c; }
function rc(i) { return { r: Math.floor(i / GRID), c: i % GRID }; }

function initBoard(src) {
  IMAGE_SRC = src || IMAGE_SRC_DEFAULT;
  if (imageInput) imageInput.value = IMAGE_SRC;
  if (imgPathDisplay) imgPathDisplay.textContent = IMAGE_SRC;
  resetState();

  const img = new Image();
  img.src = IMAGE_SRC;
  img.onload = () => {
    setupTiles(img);
    setTimeout(() => shuffleToSolvable(180), 220);
  };
  img.onerror = () => {
    alert('Failed to load image at "' + IMAGE_SRC + '". Make sure path is correct and file is accessible.');
    setupTiles();
  };
}

function resetState() {
  tiles = [];
  moves = 0;
  if (movesEl) movesEl.textContent = 'Moves: 0';
  selectedTile = null;
  completeBox.classList.remove('show-complete');
  boardEl.innerHTML = '';
  boardEl.classList.remove('solved');
}

function setupTiles(img) {
  const rect = boardEl.getBoundingClientRect();
  const width = rect.width || Math.min(window.innerWidth * 0.8, 560);
  const height = rect.height || width;
  sizePx = Math.min(width, height);
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-gap')) || 6;
  tileSize = (sizePx - ((GRID + 1) * gap)) / GRID;

  boardEl.innerHTML = '';
  solvedPositions = [];
  const bgSize = sizePx + 'px ' + sizePx + 'px';

  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const i = idx(r, c);
      const tile = document.createElement('div');
      tile.className = 'tile';
      tile.setAttribute('data-index', i);
      tile.setAttribute('role', 'button');
      tile.setAttribute('tabindex', '-1');
      tile.style.width = tileSize + 'px';
      tile.style.height = tileSize + 'px';
      tile.style.borderRadius = getComputedStyle(document.documentElement).getPropertyValue('--tile-radius');
      tile.style.left = (c * (tileSize + gap)) + 'px';
      tile.style.top = (r * (tileSize + gap)) + 'px';
      tile.style.transform = 'translate3d(0,0,0)';

      if (img && img.naturalWidth) {
        tile.style.backgroundImage = `url("${IMAGE_SRC}")`;
        tile.style.backgroundSize = bgSize;
        const xPercent = (c / (GRID - 1)) * 100;
        const yPercent = (r / (GRID - 1)) * 100;
        tile.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
        tile.style.backgroundRepeat = 'no-repeat';
      } else {
        tile.style.background = `linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.005))`;
      }

      const tObj = { index: i, r: r, c: c, el: tile };
      tiles.push(tObj);
      solvedPositions[i] = { r: r, c: c };

      tile.addEventListener('click', () => onTileClick(tObj));
      tile.addEventListener('touchstart', (ev) => { ev.preventDefault(); onTileClick(tObj); }, { passive: false });

      tile.setAttribute('draggable', 'true');
      tile.addEventListener('dragstart', (e) => handleDragStart(e, tObj));
      tile.addEventListener('dragover', (e) => handleDragOver(e, tObj));
      tile.addEventListener('drop', (e) => handleDrop(e, tObj));
      tile.addEventListener('dragend', (e) => handleDragEnd(e, tObj));

      boardEl.appendChild(tile);
    }
  }

  const totalSize = GRID * tileSize + (GRID + 1) * gap;
  boardEl.style.width = totalSize + 'px';
  boardEl.style.height = totalSize + 'px';
  positionTilesInstant();
}

function positionTilesInstant() {
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-gap')) || 6;
  for (const t of tiles) {
    const left = t.c * (tileSize + gap);
    const top = t.r * (tileSize + gap);
    t.el.style.transition = 'none';
    t.el.style.left = left + 'px';
    t.el.style.top = top + 'px';
    t.el.classList.remove('selected');
  }
  setTimeout(() => {
    for (const t of tiles) t.el.style.transition = '';
  }, 40);
}

function positionTileAnimated(t) {
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-gap')) || 6;
  const left = t.c * (tileSize + gap);
  const top = t.r * (tileSize + gap);
  t.el.style.left = left + 'px';
  t.el.style.top = top + 'px';
}

function onTileClick(t) {
  if (isAnimating) return;
  if (selectedTile === t) {
    selectedTile.el.classList.remove('selected');
    selectedTile = null;
  } else {
    selectTile(t);
  }
}

function selectTile(t) {
  if (selectedTile) selectedTile.el.classList.remove('selected');
  selectedTile = t;
  t.el.classList.add('selected');
  boardEl.focus();
}

function areAdjacent(tileA, tileB) {
  const dr = Math.abs(tileA.r - tileB.r);
  const dc = Math.abs(tileA.c - tileB.c);
  return (dr + dc === 1);
}

function swapTiles(t1, t2, recordMove = true) {
  if (isAnimating) return false;
  isAnimating = true;
  const r1 = t1.r, c1 = t1.c;
  t1.r = t2.r; t1.c = t2.c;
  t2.r = r1; t2.c = c1;

  positionTileAnimated(t1);
  positionTileAnimated(t2);

  setTimeout(() => {
    isAnimating = false;
    if (recordMove) {
      moves++;
      if (movesEl) movesEl.textContent = 'Moves: ' + moves;
    }
    if (selectedTile) selectedTile.el.classList.remove('selected');
    selectedTile = t1;
    selectedTile.el.classList.add('selected');
    checkSolved();
  }, 300);
  return true;
}

document.addEventListener('keydown', (e) => {
  if (!selectedTile) return;
  let dr = 0, dc = 0;
  const key = e.key;
  if (key === 'ArrowUp') dr = -1;
  else if (key === 'ArrowDown') dr = 1;
  else if (key === 'ArrowLeft') dc = -1;
  else if (key === 'ArrowRight') dc = 1;
  else return;
  e.preventDefault();
  const targetR = selectedTile.r + dr;
  const targetC = selectedTile.c + dc;
  if (targetR >= 0 && targetR < GRID && targetC >= 0 && targetC < GRID) {
    const targetTile = tiles.find(t => t.r === targetR && t.c === targetC);
    if (targetTile) {
      swapTiles(selectedTile, targetTile);
    }
  }
});

function flashInvalid(el) {
  el.style.transition = 'transform .08s ease';
  el.style.transform = 'translateY(-4px)';
  setTimeout(() => { el.style.transform = ''; }, 120);
  setTimeout(() => { el.style.transition = ''; }, 220);
}

function checkSolved() {
  for (const t of tiles) {
    const correct = solvedPositions[t.index];
    if (!(t.r === correct.r && t.c === correct.c)) return false;
  }
  doCompleteAnimation();
  return true;
}

function doCompleteAnimation() {
  boardEl.classList.add('solved');
  let reveal = document.createElement('div');
  reveal.className = 'reveal';
  boardEl.appendChild(reveal);
  completeBox.classList.add('show-complete');
  // Snappier finish animation
  for (const t of tiles) {
    t.el.style.transition = 'transform .32s cubic-bezier(.2,.9,.25,1), opacity .32s ease';
    t.el.style.transform += ' scale(1.01)';
  }
  setTimeout(() => {
    for (const t of tiles) {
      t.el.style.transform = t.el.style.transform.replace(' scale(1.01)', '');
    }
    // Smooth fade-to-black, then redirect to finale page
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.inset = '0';
    overlay.style.background = '#000';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 800ms ease';
    overlay.style.pointerEvents = 'none';
    overlay.style.zIndex = '9999';
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    setTimeout(() => { window.location.href = 'final.html'; }, 1100);
  }, 400);
}

function createBlackoutAndConfettiBurst() {
  // Blackout overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = '#000';
  overlay.style.opacity = '0';
  overlay.style.transition = 'opacity 180ms ease';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '9998';
  document.body.appendChild(overlay);
  requestAnimationFrame(() => { overlay.style.opacity = '0.8'; });

  // Fade out and cleanup overlay
  setTimeout(() => {
    overlay.style.opacity = '0';
    setTimeout(() => { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
  }, 260);
}

/* Shuffle: perform many random swaps between pairs of tiles */
function shuffleToSolvable(movesCount = 120) {
  const n = tiles.length;
  for (let i = 0; i < movesCount; i++) {
    const idx1 = Math.floor(Math.random() * n);
    let idx2 = Math.floor(Math.random() * n);
    while (idx2 === idx1) {
      idx2 = Math.floor(Math.random() * n);
    }
    const t1 = tiles[idx1];
    const t2 = tiles[idx2];
    // Swap positions instantly without animation or move count
    const r1 = t1.r, c1 = t1.c;
    t1.r = t2.r; t1.c = t2.c;
    t2.r = r1; t2.c = c1;
  }
  positionTilesInstant();
  moves = 0;
  if (movesEl) movesEl.textContent = 'Moves: 0';
  selectedTile = null;
  completeBox.classList.remove('show-complete');
}

// Removed unused alternative shuffle and solvability check for brevity

function resetToSolved() {
  for (const t of tiles) {
    const correct = solvedPositions[t.index];
    t.r = correct.r; t.c = correct.c;
  }
  positionTilesInstant();
  moves = 0; if (movesEl) movesEl.textContent = 'Moves: 0';
  completeBox.classList.remove('show-complete');
}

/* Responsive: recompute sizes on resize */
window.addEventListener('resize', () => {
  if (!tiles.length) return;
  // Recompute tile sizes and reposition without changing order
  setupTiles({ naturalWidth: 1 });
});

/* UI bindings */
if (shuffleBtn) shuffleBtn.addEventListener('click', () => shuffleToSolvable(160));
if (resetBtn) resetBtn.addEventListener('click', () => resetToSolved());
if (applyImgBtn && imageInput) {
  applyImgBtn.addEventListener('click', () => {
    const val = imageInput.value.trim();
    if (!val) return;
    initBoard(val);
  });
}

/* Drag-and-drop handlers */
function handleDragStart(e, tObj) {
  if (isAnimating) { e.preventDefault(); return; }
  draggedTileObj = tObj;
  tObj.el.classList.add('selected');
  if (e.dataTransfer) {
    e.dataTransfer.setData('text/plain', tObj.index);
  }
}

function handleDragOver(e, tObj) {
  if (!draggedTileObj) return;
  e.preventDefault();
  if (tObj !== draggedTileObj) {
    tObj.el.classList.add('highlight');
  }
}

function handleDrop(e, tObj) {
  if (!draggedTileObj) return;
  tiles.forEach(t => t.el.classList.remove('highlight'));
  if (tObj !== draggedTileObj) {
    swapTiles(draggedTileObj, tObj);
  }
  draggedTileObj = null;
}

function handleDragEnd(e, tObj) {
  tiles.forEach(t => t.el.classList.remove('highlight'));
  if (draggedTileObj && draggedTileObj.el) draggedTileObj.el.classList.remove('selected');
  draggedTileObj = null;
}

/* Show completion popup with full image, message, and confetti */
function showCompletionPopup() {
  // If popup already exists, do nothing
  if (document.getElementById('completionPopup')) return;

  const popup = document.createElement('div');
  popup.id = 'completionPopup';
  popup.style.position = 'fixed';
  popup.style.top = '0';
  popup.style.left = '0';
  popup.style.width = '100vw';
  popup.style.height = '100vh';
  popup.style.backgroundColor = '#000';
  popup.style.display = 'flex';
  popup.style.flexDirection = 'column';
  popup.style.justifyContent = 'center';
  popup.style.alignItems = 'center';
  popup.style.zIndex = '9999';
  popup.style.opacity = '0';
  popup.style.transform = 'scale(0.8)';
  popup.style.transition = 'opacity 0.4s ease, transform 0.4s ease';

  // Container for content
  const content = document.createElement('div');
  content.style.position = 'relative';
  content.style.backgroundColor = '#000000';
  content.style.borderRadius = '14px';
  content.style.padding = '28px 22px';
  content.style.maxWidth = '90vw';
  content.style.maxHeight = '90vh';
  content.style.boxShadow = '0 8px 20px rgba(0,0,0,0.3)';
  content.style.display = 'flex';
  content.style.flexDirection = 'column';
  content.style.alignItems = 'center';

  // Hero title: PACE / SILVIORA
  const heroSub = document.createElement('div');
  heroSub.textContent = 'PACE';
  heroSub.style.margin = '0';
  heroSub.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  heroSub.style.fontSize = 'clamp(18px, 3vw, 28px)';
  heroSub.style.fontWeight = '800';
  heroSub.style.letterSpacing = '0.45em';
  heroSub.style.textTransform = 'uppercase';
  heroSub.style.color = '#8fdad0';
  heroSub.style.opacity = '0.9';
  // PACE flies in from opposite direction (right-bottom) slower
  heroSub.animate([
    { transform: 'translate(40vw, 20vh) scale(0.96)', opacity: 0 },
    { transform: 'translate(0, 0) scale(1)', opacity: 1 }
  ], { duration: 1200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  content.appendChild(heroSub);

  const heroTitle = document.createElement('h1');
  heroTitle.textContent = 'SILVIORA';
  heroTitle.style.margin = '6px 0 10px 0';
  heroTitle.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  heroTitle.style.fontWeight = '900';
  heroTitle.style.fontSize = 'clamp(38px, 6vw, 72px)';
  heroTitle.style.letterSpacing = '0.18em';
  heroTitle.style.textTransform = 'uppercase';
  heroTitle.style.background = 'linear-gradient(90deg, #e9fffb, #b6fff3, #e9fffb)';
  heroTitle.style.webkitBackgroundClip = 'text';
  heroTitle.style.backgroundClip = 'text';
  heroTitle.style.color = 'transparent';
  heroTitle.style.filter = 'drop-shadow(0 2px 10px rgba(0, 210, 195, 0.35))';
  // Entrance fly-in from off-screen (left-top) + gentle float loop (slower)
  heroTitle.animate([
    { transform: 'translate(-50vw, -30vh) scale(0.9)', opacity: 0 },
    { transform: 'translate(0, 0) scale(1)', opacity: 1 }
  ], { duration: 1200, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  setTimeout(() => {
    heroTitle.animate([
      { transform: 'translateY(0)' },
      { transform: 'translateY(-6px)' },
      { transform: 'translateY(0)' }
    ], { duration: 2800, easing: 'ease-in-out', iterations: Infinity });
  }, 1250);
  content.appendChild(heroTitle);

  // Tagline with typing effect (after 1s)
  const tagline = document.createElement('div');
  tagline.id = 'popupTagline';
  tagline.style.marginTop = '8px';
  tagline.style.color = '#bfeef0';
  tagline.style.minHeight = '1.6em';
  tagline.style.fontFamily = 'Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial';
  tagline.style.fontSize = 'clamp(14px, 2.2vw, 20px)';
  tagline.style.letterSpacing = '0.02em';
  tagline.style.opacity = '0';
  tagline.style.transition = 'opacity 0.3s ease';
  tagline.style.whiteSpace = 'nowrap';
  tagline.style.overflow = 'hidden';
  tagline.style.borderRight = '2px solid rgba(182, 255, 243, 0.8)';
  tagline.style.boxSizing = 'border-box';
  content.appendChild(tagline);

  // Full puzzle image
  const fullImage = document.createElement('img');
  fullImage.src = IMAGE_SRC;
  fullImage.alt = 'Completed Puzzle';
  fullImage.style.maxWidth = '100%';
  fullImage.style.maxHeight = '60vh';
  fullImage.style.borderRadius = '8px';
  fullImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
  content.appendChild(fullImage);

  // start tagline typing after fade-in
  setTimeout(() => {
    const el = document.getElementById('popupTagline');
    if (!el) return;
    el.style.opacity = '1';
    const text = 'Honoring A Legacy, Huminating The Future';
    let i = 0;
    const speed = 38;
    const tick = () => {
      el.textContent = text.slice(0, i++);
      if (i <= text.length) setTimeout(tick, speed);
      else el.style.borderRightColor = 'transparent';
    };
    tick();
  }, 1000);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close';
  closeBtn.style.marginTop = '12px';
  closeBtn.style.padding = '8px 16px';
  closeBtn.style.fontSize = '16px';
  closeBtn.style.border = 'none';
  closeBtn.style.borderRadius = '6px';
  closeBtn.style.backgroundColor = '#007bff';
  closeBtn.style.color = '#fff';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.transition = 'background-color 0.3s ease';
  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.backgroundColor = '#0056b3';
  });
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.backgroundColor = '#007bff';
  });
  closeBtn.addEventListener('click', () => {
    popup.style.opacity = '0';
    popup.style.transform = 'scale(0.8)';
    setTimeout(() => {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 400);
  });
  content.appendChild(closeBtn);

  popup.appendChild(content);

  // Create confetti containers on left and right
  const confettiLeft = document.createElement('div');
  confettiLeft.style.position = 'fixed';
  confettiLeft.style.top = '0';
  confettiLeft.style.left = '0';
  confettiLeft.style.height = '100vh';
  confettiLeft.style.width = '60px';
  confettiLeft.style.overflow = 'visible';
  confettiLeft.style.pointerEvents = 'none';
  popup.appendChild(confettiLeft);

  const confettiRight = document.createElement('div');
  confettiRight.style.position = 'fixed';
  confettiRight.style.top = '0';
  confettiRight.style.right = '0';
  confettiRight.style.height = '100vh';
  confettiRight.style.width = '60px';
  confettiRight.style.overflow = 'visible';
  confettiRight.style.pointerEvents = 'none';
  popup.appendChild(confettiRight);

  // Generate confetti pieces
  const confettiColors = ['#ff595e', '#1982c4', '#6a4c93', '#ffca3a', '#8ac926'];
  const confettiCount = 20;

  function createConfettiPiece() {
    const confetti = document.createElement('div');
    confetti.style.position = 'absolute';
    confetti.style.width = '8px';
    confetti.style.height = '16px';
    confetti.style.backgroundColor = confettiColors[Math.floor(Math.random() * confettiColors.length)];
    confetti.style.borderRadius = '2px';
    confetti.style.opacity = '0.9';
    confetti.style.top = Math.random() * 100 + 'vh';
    confetti.style.left = '0';
    confetti.style.willChange = 'transform, opacity';
    confetti.style.transform = 'translateX(0) rotate(0deg)';
    return confetti;
  }

  // Animate confetti sliding from left to right
  for (let i = 0; i < confettiCount; i++) {
    const confettiL = createConfettiPiece();
    confettiL.style.top = (Math.random() * 100) + 'vh';
    confettiL.style.left = '-20px';
    confettiLeft.appendChild(confettiL);

    const delay = Math.random() * 2000;
    const duration = 3000 + Math.random() * 2000;

    confettiL.animate([
      { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
      { transform: 'translateX(80px) rotate(360deg)', opacity: 0 }
    ], {
      delay: delay,
      duration: duration,
      iterations: Infinity,
      easing: 'linear'
    });

    const confettiR = createConfettiPiece();
    confettiR.style.top = (Math.random() * 100) + 'vh';
    confettiR.style.right = '-20px';
    confettiRight.appendChild(confettiR);

    confettiR.animate([
      { transform: 'translateX(0) rotate(0deg)', opacity: 1 },
      { transform: 'translateX(-80px) rotate(-360deg)', opacity: 0 }
    ], {
      delay: delay,
      duration: duration,
      iterations: Infinity,
      easing: 'linear'
    });
  }

  document.body.appendChild(popup);

  // Trigger fade-in and scale-up
  requestAnimationFrame(() => {
    popup.style.opacity = '1';
    popup.style.transform = 'scale(1)';
  });
  // Start celebration confetti using canvas-confetti if available (load if needed)
  ensureConfettiAndCelebrate();
}

// Load canvas-confetti from CDN once, then run the provided celebration pattern
function ensureConfettiAndCelebrate(){
  function celebrateSuccess(){
    var end = Date.now() + (5 * 1000);
    var colors = ['#00ff88', '#ffffff', '#203a43'];
    (function frame() {
      if (window.confetti) {
        window.confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: colors
        });
        window.confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: colors
        });
      }
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }

  if (window.confetti) {
    celebrateSuccess();
    return;
  }
  if (document.getElementById('canvas-confetti-lib')) {
    // library is loading; retry shortly
    setTimeout(celebrateSuccess, 300);
    return;
  }
  var s = document.createElement('script');
  s.id = 'canvas-confetti-lib';
  s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
  s.async = true;
  s.onload = celebrateSuccess;
  document.head.appendChild(s);
}

/* Initialize */
initBoard(IMAGE_SRC_DEFAULT);