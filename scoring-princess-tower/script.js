/* ============================================================
   Princess Tower — script.js
   Vanilla ES6+, no dependencies.

   Asset convention (all optional; CSS/emoji fallbacks are built in):
     assets/cards/<suit>-<rank>.png   e.g. assets/cards/crown-ace.png
     assets/card-back.png
     assets/dice-green.png
     assets/dice-red.png
     assets/princess.png
     assets/background.jpg            game-screen backdrop
     assets/tower-block.png           stone texture layered into the tower blocks
   ============================================================ */

(() => {
  'use strict';

  /* ------------------------------------------------------------
     Constants
     ------------------------------------------------------------ */

  const SUITS = {
    crown: { name: 'Crown', symbol: '#icon-crown' },
    shield: { name: 'Shield', symbol: '#icon-shield' },
    sword: { name: 'Sword', symbol: '#icon-sword' },
    flame: { name: 'Flame', symbol: '#icon-flame' },
  };

  const MEMORY_SHAPES = [
    { icon: 'shape-circle', name: 'circle', color: '#ffd166' },
    { icon: 'shape-triangle', name: 'triangle', color: '#7ee08a' },
    { icon: 'shape-square', name: 'square', color: '#8eb9ff' },
    { icon: 'shape-diamond', name: 'diamond', color: '#ff9ebd' },
    { icon: 'shape-star', name: 'star', color: '#f7a467' },
    { icon: 'shape-cross', name: 'cross', color: '#b98be8' },
    { icon: 'shape-heart', name: 'heart', color: '#ff7789' },
    { icon: 'shape-moon', name: 'moon', color: '#dbe7ff' },
    { icon: 'shape-hex', name: 'hexagon', color: '#7ee0d0' },
  ];

  const SUIT_KEYS = Object.keys(SUITS);
  const RANKS = ['ace', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'jack', 'queen', 'king'];
  const RANK_VALUE = Object.fromEntries(RANKS.map((rank, index) => [rank, index + 1]));
  const RANK_SHORT = { ace: 'A', jack: 'J', queen: 'Q', king: 'K' };
  const RANK_NAME = { ace: 'Ace', jack: 'Jack', queen: 'Queen', king: 'King' };
  const DECK_IDS = SUIT_KEYS.flatMap((suit) => RANKS.map((rank) => `${suit}-${rank}`));

  const MAX_LIVES = 5;
  const MAX_BLOCK_LOSS = 3;
  const WOBBLE_EVERY = 3;
  const WOBBLE_SEQUENCE_MIN = 3;
  const WOBBLE_SEQUENCE_MAX = 6;
  const SAVE_VERSION = 1;

  const STORAGE_LEADERBOARD = 'princessTower.leaderboard.v1';
  const STORAGE_PLAYER = 'princessTower.playerName';
  const STORAGE_SOUND = 'princessTower.sound';

  const ASSETS = {
    card: (suit, rank) => `assets/cards/${suit}-${rank}.png`,
    diceGreen: 'assets/dice-green.png',
    diceRed: 'assets/dice-red.png',
  };

  const DEFAULT_PROMPT = 'Will the next card be higher or lower?';
  const GAMEOVER_LINES = [
    'The princess landed safely in a soft bush.',
    'A royal tumble! The kingdom applauds the attempt.',
    'Dust off the crown. The tower will rise again.',
    'The stones have spoken. One more climb?',
  ];

  /* ------------------------------------------------------------
     DOM
     ------------------------------------------------------------ */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const els = {
    screenMenu: $('#screen-menu'),
    screenGame: $('#screen-game'),

    btnNewGame: $('#btn-new-game'),
    btnHowToMenu: $('#btn-how-to-menu'),
    btnImportMenu: $('#btn-import-menu'),
    leaderboardList: $('#leaderboard-list'),
    leaderboardEmpty: $('#leaderboard-empty'),

    btnPause: $('#btn-pause'),
    statHeight: $('#stat-height'),
    statStreak: $('#stat-streak'),
    hearts: $('#hearts'),

    towerScene: $('#tower-scene'),
    tower: $('#tower'),
    towerSway: $('#tower-sway'),
    towerBlocks: $('#tower-blocks'),
    towerPrincess: $('#tower-princess'),
    towerCaption: $('#tower-caption'),

    card: $('#card'),
    cardFront: $('#card-front'),
    cardLabel: $('#card-label'),
    cardTitle: $('#card-title'),

    promptText: $('#prompt-text'),
    btnHigher: $('#btn-higher'),
    btnLower: $('#btn-lower'),

    resultBanner: $('#result-banner'),
    resultMain: $('#result-main'),
    resultSub: $('#result-sub'),
    fxLayer: $('#fx-layer'),

    dicePopup: $('#dice-popup'),
    diceLabel: $('#dice-label'),
    dieVisual: $('#die-visual'),
    dieFallback: $('#die-fallback'),
    dieImg: $('#die-img'),
    dieValue: $('#die-value'),

    overlayWobble: $('#overlay-wobble'),
    wobbleInstruction: $('#wobble-instruction'),
    wobbleStatus: $('#wobble-status'),
    memoryGrid: $('#memory-grid'),
    sequenceDots: $('#sequence-dots'),
    btnWobblePause: $('#btn-wobble-pause'),
    btnWobbleStart: $('#btn-wobble-start'),

    overlayPause: $('#overlay-pause'),
    btnResume: $('#btn-resume'),
    btnSave: $('#btn-save'),
    btnImport: $('#btn-import'),
    btnRestart: $('#btn-restart'),
    btnQuit: $('#btn-quit'),

    overlayGameover: $('#overlay-gameover'),
    gameoverModal: $('#gameover-modal'),
    finalHeight: $('#final-height'),
    gameoverMessage: $('#gameover-message'),
    scoreForm: $('#score-form'),
    playerName: $('#player-name'),
    btnSaveScore: $('#btn-save-score'),
    scoreSaved: $('#score-saved'),
    btnPlayAgain: $('#btn-play-again'),
    btnMenu: $('#btn-menu'),

    overlayHowto: $('#overlay-howto'),
    btnHowtoClose: $('#btn-howto-close'),

    toast: $('#toast'),
    importFile: $('#import-file'),
  };

  /* ------------------------------------------------------------
     State
     ------------------------------------------------------------ */

  const state = {
    phase: 'menu', // menu | guess | reveal | wobble-show | wobble-input | wobble-resolve | paused | gameover
    deck: [],
    currentCard: null,
    towerHeight: 0,
    lives: MAX_LIVES,
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    wobbleCounter: 0,
    wobble: null,
    scoreSaved: false,
  };

  let sessionId = 0;
  let pausedFrom = null;
  let lastRenderedLives = MAX_LIVES;
  let lastRenderedHeight = 0;
  let toastTimer = 0;
  let towerShift = 0;
  let towerShiftTimer = 0;

  let diceToken = 0;
  let diceInterval = 0;
  let diceTimeout = 0;
  let diceResolve = null;

  /* ------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------ */

  const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));
  const clampInt = (value, min, max, fallback = min) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, Math.floor(number)));
  };
  const randomDie = () => 1 + Math.floor(Math.random() * 6);
  const prefersReducedMotion = () =>
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function cardInfo(id) {
    if (typeof id !== 'string') return null;
    const parts = id.split('-');
    if (parts.length !== 2) return null;
    const [suit, rank] = parts;
    if (!SUITS[suit] || !RANKS.includes(rank)) return null;
    return {
      id,
      suit,
      rank,
      value: RANK_VALUE[rank],
      short: RANK_SHORT[rank] || rank,
      rankName: RANK_NAME[rank] || rank,
      suitName: SUITS[suit].name,
      title: `${RANK_NAME[rank] || rank} of ${SUITS[suit].name}`,
    };
  }

  function sanitizeName(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16);
  }

  function readBool(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return fallback;
      return raw === 'true';
    } catch (error) {
      return fallback;
    }
  }

  function writeBool(key, value) {
    try {
      window.localStorage.setItem(key, value ? 'true' : 'false');
    } catch (error) {
      /* Storage can be blocked; the game still works. */
    }
  }

  function readPlayerName() {
    try {
      return sanitizeName(window.localStorage.getItem(STORAGE_PLAYER) || '');
    } catch (error) {
      return '';
    }
  }

  function writePlayerName(name) {
    try {
      window.localStorage.setItem(STORAGE_PLAYER, name);
    } catch (error) {
      /* Ignore blocked storage. */
    }
  }

  function toast(message, isError = false) {
    els.toast.textContent = message;
    els.toast.classList.toggle('is-error', Boolean(isError));
    els.toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      els.toast.classList.remove('is-visible');
    }, 3800);
  }

  /* ------------------------------------------------------------
     Sound (tiny WebAudio synth — no audio files needed)
     ------------------------------------------------------------ */

  const sound = {
    enabled: readBool(STORAGE_SOUND, true),
    ctx: null,

    ensure() {
      if (!this.ctx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        try {
          this.ctx = new AudioContextClass();
        } catch (error) {
          return null;
        }
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    },

    tone(frequency, duration = 0.12, type = 'sine', volume = 0.035, delay = 0) {
      if (!this.enabled) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const start = ctx.currentTime + delay;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    },

    click() {
      this.tone(520, 0.06, 'triangle', 0.025);
    },
    flip() {
      this.tone(300, 0.09, 'triangle', 0.022);
      this.tone(470, 0.08, 'triangle', 0.018, 0.055);
    },
    correct() {
      [523, 659, 784].forEach((frequency, index) => {
        this.tone(frequency, 0.15, 'triangle', 0.04, index * 0.075);
      });
    },
    wrong() {
      this.tone(175, 0.26, 'sawtooth', 0.03);
      this.tone(125, 0.3, 'sawtooth', 0.026, 0.12);
    },
    wobbleCell(index) {
      this.tone(380 + index * 42, 0.13, 'sine', 0.04);
    },
    success() {
      [392, 523, 659, 784, 1047].forEach((frequency, index) => {
        this.tone(frequency, 0.18, 'triangle', 0.038, index * 0.07);
      });
    },
    fail() {
      this.tone(220, 0.2, 'square', 0.028);
      this.tone(155, 0.35, 'square', 0.024, 0.14);
    },
    diceTick() {
      this.tone(760, 0.035, 'square', 0.012);
    },
    diceLand() {
      this.tone(240, 0.1, 'triangle', 0.035);
      this.tone(510, 0.1, 'triangle', 0.03, 0.06);
    },
    collapse() {
      [150, 110, 80].forEach((frequency, index) => {
        this.tone(frequency, 0.5, 'sawtooth', 0.032, index * 0.17);
      });
    },
  };

  function updateSoundUI() {
    $$('.sound-btn').forEach((button) => {
      const use = button.querySelector('use');
      if (use) {
        use.setAttribute('href', sound.enabled ? '#icon-sound-on' : '#icon-sound-off');
      }
      button.setAttribute('aria-label', sound.enabled ? 'Mute sound' : 'Enable sound');
      button.title = sound.enabled ? 'Mute sound' : 'Enable sound';
    });
  }

  function toggleSound() {
    sound.enabled = !sound.enabled;
    writeBool(STORAGE_SOUND, sound.enabled);
    updateSoundUI();
    if (sound.enabled) sound.click();
  }

  /* ------------------------------------------------------------
     Leaderboard
     ------------------------------------------------------------ */

  function compareScores(a, b) {
    return b.height - a.height || a.date - b.date;
  }

  function loadScores() {
    try {
      const raw = window.localStorage.getItem(STORAGE_LEADERBOARD);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((entry) => entry && typeof entry === 'object' && Number.isFinite(Number(entry.height)))
        .map((entry) => ({
          name: sanitizeName(entry.name) || 'Princess',
          height: Math.max(0, Math.floor(Number(entry.height))),
          date: Number(entry.date) || 0,
        }))
        .sort(compareScores);
    } catch (error) {
      return [];
    }
  }

  function saveScore(name, height) {
    const scores = loadScores();
    scores.push({
      name: sanitizeName(name) || 'Princess',
      height: Math.max(0, Math.floor(height)),
      date: Date.now(),
    });
    scores.sort(compareScores);
    try {
      window.localStorage.setItem(STORAGE_LEADERBOARD, JSON.stringify(scores.slice(0, 50)));
      return true;
    } catch (error) {
      return false;
    }
  }

  function renderLeaderboard() {
    const scores = loadScores().slice(0, 5);
    els.leaderboardList.replaceChildren();
    els.leaderboardList.hidden = scores.length === 0;
    els.leaderboardEmpty.hidden = scores.length > 0;

    scores.forEach((entry, index) => {
      const row = document.createElement('li');
      row.className = 'lb-row';

      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      rank.textContent = String(index + 1);

      const name = document.createElement('span');
      name.className = 'lb-name';
      name.textContent = entry.name;
      name.title = entry.name;

      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = String(entry.height);
      const unit = document.createElement('span');
      unit.className = 'unit';
      unit.textContent = 'stones';
      score.appendChild(unit);

      row.append(rank, name, score);
      els.leaderboardList.appendChild(row);
    });
  }

  /* ------------------------------------------------------------
     Rendering
     ------------------------------------------------------------ */

  function showScreen(name) {
    const menu = name === 'menu';
    els.screenMenu.classList.toggle('is-active', menu);
    els.screenGame.classList.toggle('is-active', !menu);
  }

  function openOverlay(overlay, focusTarget) {
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    if (focusTarget) {
      window.setTimeout(() => {
        try {
          focusTarget.focus({ preventScroll: true });
        } catch (error) {
          focusTarget.focus();
        }
      }, 70);
    }
  }

  function closeOverlay(overlay) {
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  function closeAllOverlays() {
    [els.overlayWobble, els.overlayPause, els.overlayGameover, els.overlayHowto].forEach(closeOverlay);
  }

  function updatePrompt(text, tone = '') {
    els.promptText.textContent = text;
    els.promptText.classList.toggle('is-good', tone === 'good');
    els.promptText.classList.toggle('is-bad', tone === 'bad');
  }

  let resultTimer = 0;

  function hideResult() {
    window.clearTimeout(resultTimer);
    resultTimer = 0;
    if (els.resultBanner) els.resultBanner.classList.remove('is-show');
  }

  function showResult(mainText, subText = '', tone = '') {
    if (!els.resultBanner) return;

    els.resultMain.textContent = mainText;
    els.resultSub.textContent = subText;
    els.resultBanner.className = 'result-banner';
    void els.resultBanner.offsetWidth;
    els.resultBanner.classList.add(
      'is-show',
      tone === 'good' ? 'is-good' : tone === 'bad' ? 'is-bad' : 'is-neutral'
    );

    window.clearTimeout(resultTimer);
    resultTimer = window.setTimeout(
      () => els.resultBanner.classList.remove('is-show'),
      prefersReducedMotion() ? 700 : 1600
    );
  }

  function spawnFloat(text, tone = '') {
    if (!els.fxLayer || prefersReducedMotion()) return;

    const princess = els.towerPrincess.getBoundingClientRect();
    const node = document.createElement('span');
    node.className = `fx-float${tone ? ` is-${tone}` : ''}`;
    node.textContent = text;
    node.style.left = `${princess.left + princess.width / 2}px`;
    node.style.top = `${Math.max(princess.top - 4, 76)}px`;
    els.fxLayer.appendChild(node);
    node.addEventListener('animationend', () => node.remove(), { once: true });
  }

  function spawnSparks(targetRect, tone = 'gold') {
    if (!els.fxLayer || prefersReducedMotion() || !targetRect) return;

    const count = 10;
    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement('span');
      spark.className = `fx-spark is-${tone}`;
      const spread = (index / count) * targetRect.width;
      spark.style.left = `${targetRect.left + spread + Math.random() * 12}px`;
      spark.style.top = `${targetRect.top + 4}px`;
      spark.style.setProperty('--dx', `${(Math.random() - 0.5) * 70}px`);
      spark.style.setProperty('--dy', `${18 + Math.random() * 42}px`);
      spark.style.animationDelay = `${Math.random() * 0.16}s`;
      els.fxLayer.appendChild(spark);
      spark.addEventListener('animationend', () => spark.remove(), { once: true });
    }
  }

  function shakeStage() {
    if (!els.screenGame || prefersReducedMotion()) return;
    els.screenGame.classList.remove('is-impact');
    void els.screenGame.offsetWidth;
    els.screenGame.classList.add('is-impact');
  }

  function bumpStat(element) {
    if (!element || prefersReducedMotion()) return;
    element.classList.remove('is-bumped');
    void element.offsetWidth;
    element.classList.add('is-bumped');
  }

  function setGuessEnabled(enabled) {
    els.btnHigher.disabled = !enabled;
    els.btnLower.disabled = !enabled;
  }

  function setPauseEnabled(enabled) {
    els.btnPause.disabled = !enabled;
    els.btnWobblePause.disabled = !enabled;
  }

  function renderHearts() {
    els.hearts.replaceChildren();
    for (let index = 0; index < MAX_LIVES; index += 1) {
      const heart = document.createElement('span');
      heart.className = 'heart';
      if (index < state.lives) {
        heart.classList.add('is-full');
      } else {
        heart.classList.add('is-empty');
        if (index < lastRenderedLives) heart.classList.add('is-lost');
      }
      heart.textContent = '♥';
      els.hearts.appendChild(heart);
    }
    els.hearts.setAttribute('aria-label', `${state.lives} of ${MAX_LIVES} hearts`);
    lastRenderedLives = state.lives;
  }

  function renderHUD() {
    els.statHeight.textContent = String(state.towerHeight);
    els.statStreak.textContent = String(state.streak);
    if (state.towerHeight !== lastRenderedHeight) {
      bumpStat(els.statHeight);
      lastRenderedHeight = state.towerHeight;
    }
    renderHearts();
  }

  function renderTower(options = {}) {
    const animateNew = Boolean(options.animateNew);
    const newCount = Math.max(1, Number(options.newCount) || 1);
    const height = state.towerHeight;
    const fragment = document.createDocumentFragment();

    for (let index = 0; index < height; index += 1) {
      const block = document.createElement('span');
      block.className = 'block';
      block.style.setProperty('--i', String(index));
      const tone = 0.92 + ((Math.sin(index * 2.7) + 1) / 2) * 0.16;
      block.style.setProperty('--stone-tone', tone.toFixed(3));
      block.style.setProperty('--tex-x', `${(index * 37) % 100}%`);
      block.style.setProperty('--tex-y', `${(index * 13) % 8}%`);

      if (animateNew && index >= height - newCount) {
        block.classList.add('is-new');
        block.style.animationDelay = `${(index - (height - newCount)) * 0.11}s`;
      }

      fragment.appendChild(block);
    }

    els.towerBlocks.replaceChildren(fragment);

    if (animateNew) {
      const topBlock = els.towerBlocks.lastElementChild;
      if (topBlock) {
        window.setTimeout(() => {
          if (topBlock.isConnected) spawnSparks(topBlock.getBoundingClientRect(), 'gold');
        }, 800);
      }
    }

    const resolveLength = (property, fallback) => {
      const probe = document.createElement('span');
      probe.style.position = 'absolute';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.width = `var(${property})`;
      probe.style.height = `var(${property})`;
      els.tower.appendChild(probe);
      const resolved = probe.getBoundingClientRect().height;
      probe.remove();
      return resolved || fallback;
    };

    const blockStep = resolveLength('--block-step', 48);
    const blockHeight = resolveLength('--block-height', 44);
    const topMargin = resolveLength('--tower-top-margin', 40);
    const towerBottom = parseFloat(getComputedStyle(els.tower).bottom) || 30;
    const princessHeight = els.towerPrincess.offsetHeight || 108;
    const sceneHeight = els.towerScene.clientHeight || 380;

    const princessBottom = height
      ? height * blockStep - blockStep + blockHeight + 10
      : 0;
    els.towerPrincess.style.bottom = `${princessBottom}px`;

    // Keep the princess near the top of the scene and let the tower scroll
    // beneath her. The unused lower blocks stay off-screen but still exist.
    const stackTop = towerBottom + princessBottom + princessHeight;
    const targetTop = sceneHeight - topMargin;
    const nextShift = Math.max(0, stackTop - targetTop);

    if (towerShiftTimer) {
      window.clearTimeout(towerShiftTimer);
      towerShiftTimer = 0;
    }

    const applyShift = (value) => {
      towerShift = value;
      els.tower.style.setProperty('--tower-shift', `${value.toFixed(1)}px`);
    };

    if (height === 0 || nextShift >= towerShift) {
      applyShift(nextShift);
    } else {
      // Let the princess drop for a beat before the camera follows her down.
      towerShiftTimer = window.setTimeout(() => {
        applyShift(nextShift);
        towerShiftTimer = 0;
      }, 320);
    }

    els.towerCaption.textContent = `${height} stone${height === 1 ? '' : 's'} high`;
  }

  function renderCard(cardId) {
    const info = cardInfo(cardId);
    if (!info) return;

    const front = els.cardFront;
    front.className = `card-face card-front suit-${info.suit}`;
    front.innerHTML = `
      <div class="card-corner card-corner-tl">
        <span>${info.short}</span>
        <svg class="suit-mini" aria-hidden="true"><use href="${SUITS[info.suit].symbol}"></use></svg>
      </div>
      <div class="card-center">
        <svg class="suit-big" aria-hidden="true"><use href="${SUITS[info.suit].symbol}"></use></svg>
        <span class="rank-big">${info.short}</span>
      </div>
      <div class="card-corner card-corner-br">
        <span>${info.short}</span>
        <svg class="suit-mini" aria-hidden="true"><use href="${SUITS[info.suit].symbol}"></use></svg>
      </div>
    `;

    const art = document.createElement('img');
    art.className = 'card-art';
    art.alt = '';
    art.src = ASSETS.card(info.suit, info.rank);
    art.addEventListener('error', () => art.remove(), { once: true });
    front.appendChild(art);

    els.cardTitle.textContent = info.title;
    els.card.setAttribute('aria-label', `${info.title}, current card`);
  }

  async function flipToCard(cardId, run) {
    if (prefersReducedMotion()) {
      renderCard(cardId);
      await sleep(180);
      return;
    }

    els.card.classList.add('is-flipping');
    sound.flip();
    await sleep(460);
    if (run !== sessionId) return;

    renderCard(cardId);
    await sleep(90);
    els.card.classList.remove('is-flipping');
    await sleep(460);
  }

  function shakeTower() {
    const sway = els.towerSway;
    sway.classList.remove('is-wobbling');
    void sway.offsetWidth;
    sway.classList.add('is-wobbling');

    const done = (event) => {
      if (event.target !== sway) return;
      sway.classList.remove('is-wobbling');
      sway.removeEventListener('animationend', done);
    };
    sway.addEventListener('animationend', done);
  }

  /* ------------------------------------------------------------
     Dice
     ------------------------------------------------------------ */

  function hideDice() {
    diceToken += 1;
    if (diceInterval) window.clearInterval(diceInterval);
    if (diceTimeout) window.clearTimeout(diceTimeout);
    diceInterval = 0;
    diceTimeout = 0;

    if (diceResolve) {
      const resolve = diceResolve;
      diceResolve = null;
      resolve(0);
    }

    els.dicePopup.classList.remove('is-visible', 'is-settled', 'is-green', 'is-red');
  }

  function rollDice(color, run) {
    return new Promise((resolve) => {
      const token = ++diceToken;

      if (diceResolve) {
        const previousResolve = diceResolve;
        diceResolve = null;
        previousResolve(0);
      }
      diceResolve = resolve;

      if (diceInterval) window.clearInterval(diceInterval);
      if (diceTimeout) window.clearTimeout(diceTimeout);

      const popup = els.dicePopup;
      popup.classList.remove('is-visible', 'is-settled', 'is-green', 'is-red');
      void popup.offsetWidth;
      popup.classList.add(color === 'green' ? 'is-green' : 'is-red', 'is-visible');
      els.diceLabel.textContent = color === 'green' ? 'Reward roll' : 'Penalty roll';

      els.dieImg.classList.remove('is-missing');
      els.dieImg.src = color === 'green' ? ASSETS.diceGreen : ASSETS.diceRed;

      const paint = () => {
        const value = randomDie();
        els.dieFallback.textContent = String(value);
        els.dieValue.textContent = String(value);
      };

      paint();

      let ticks = 0;
      diceInterval = window.setInterval(() => {
        if (token !== diceToken) return;
        paint();
        if (ticks % 2 === 0) sound.diceTick();
        ticks += 1;
      }, 150);

      diceTimeout = window.setTimeout(() => {
        if (token !== diceToken) {
          if (diceResolve === resolve) diceResolve = null;
          resolve(0);
          return;
        }

        window.clearInterval(diceInterval);
        diceInterval = 0;

        const value = randomDie();
        els.dieFallback.textContent = String(value);
        els.dieValue.textContent = String(value);
        popup.classList.add('is-settled');
        sound.diceLand();

        if (diceResolve === resolve) diceResolve = null;
        resolve(value);

        window.setTimeout(() => {
          if (token === diceToken) {
            popup.classList.remove('is-visible', 'is-settled', 'is-green', 'is-red');
          }
        }, 1500);
      }, 2000);
    });
  }

  /* ------------------------------------------------------------
     Game flow
     ------------------------------------------------------------ */

  function drawCard() {
    if (!state.deck.length) {
      state.deck = shuffle(DECK_IDS.filter((id) => id !== state.currentCard));
    }
    return state.deck.pop();
  }

  function startGame(save = null) {
    sessionId += 1;
    const run = sessionId;

    closeAllOverlays();
    hideDice();
    hideResult();
    if (els.fxLayer) els.fxLayer.replaceChildren();
    pausedFrom = null;

    els.towerSway.classList.remove('is-collapsing', 'is-wobbling');
    els.card.classList.remove('is-flipping');
    els.screenGame.classList.remove('is-impact');
    els.overlayWobble.classList.remove('is-winning', 'is-failing');
    els.memoryGrid.classList.remove('is-locked', 'is-preview');
    els.btnWobbleStart.hidden = true;
    els.cardLabel.textContent = 'Current card';

    if (towerShiftTimer) {
      window.clearTimeout(towerShiftTimer);
      towerShiftTimer = 0;
    }
    towerShift = 0;
    els.tower.style.setProperty('--tower-shift', '0px');

    if (save) {
      state.deck = save.deck;
      state.currentCard = save.currentCard;
      state.towerHeight = save.towerHeight;
      state.lives = save.lives;
      state.streak = save.streak;
      state.bestStreak = save.bestStreak;
      state.correctCount = save.correctCount;
      state.wobbleCounter = save.wobbleCounter;
      state.wobble = save.wobble;
    } else {
      state.deck = shuffle(DECK_IDS);
      state.currentCard = state.deck.pop();
      state.towerHeight = 0;
      state.lives = MAX_LIVES;
      state.streak = 0;
      state.bestStreak = 0;
      state.correctCount = 0;
      state.wobbleCounter = 0;
      state.wobble = null;
    }

    state.scoreSaved = false;
    state.phase = 'guess';
    lastRenderedLives = state.lives;
    lastRenderedHeight = state.towerHeight;

    showScreen('game');
    renderHUD();
    renderTower();
    // Recalculate the tower scale once the game screen has layout (e.g. after
    // importing a save while the menu was showing). Resize events only fix it later.
    window.requestAnimationFrame(() => {
      if (run === sessionId) renderTower();
    });
    renderCard(state.currentCard);
    setGuessEnabled(!state.wobble);
    setPauseEnabled(true);
    updateSoundUI();

    if (state.wobble) {
      openOverlay(els.overlayWobble, els.btnWobbleStart);
      renderWobbleGrid();
      updateWobbleDots();
      enterWobbleReady();
    } else {
      updatePrompt(DEFAULT_PROMPT);
    }
  }

  async function makeGuess(choice) {
    if (state.phase !== 'guess') return;

    const run = sessionId;
    state.phase = 'reveal';
    setGuessEnabled(false);
    setPauseEnabled(false);

    const previous = cardInfo(state.currentCard);
    if (!previous) {
      state.phase = 'guess';
      setGuessEnabled(true);
      setPauseEnabled(true);
      return;
    }

    els.cardLabel.textContent = 'Next card…';
    const nextId = drawCard();
    await flipToCard(nextId, run);
    if (run !== sessionId) return;

    const next = cardInfo(nextId);
    if (!next) {
      state.phase = 'guess';
      setGuessEnabled(true);
      setPauseEnabled(true);
      return;
    }

    state.currentCard = nextId;
    els.cardLabel.textContent = 'Current card';

    const difference = next.value - previous.value;

    if (difference === 0) {
      sound.tone(620, 0.12, 'triangle', 0.03);
      showResult('TIE', 'safe — the tower holds', 'neutral');
      updatePrompt(`A tie — ${next.title}! The tower holds steady.`, '');
      renderHUD();
      await sleep(1500);
      if (run !== sessionId) return;
      state.phase = 'guess';
      setGuessEnabled(true);
      setPauseEnabled(true);
      updatePrompt(DEFAULT_PROMPT);
      return;
    }

    const isCorrect =
      (choice === 'higher' && difference > 0) || (choice === 'lower' && difference < 0);

    if (isCorrect) {
      state.streak += 1;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      state.correctCount += 1;
      state.wobbleCounter += 1;

      sound.correct();
      const word = difference > 0 ? 'Higher' : 'Lower';
      showResult('CORRECT!', `${word} — rolling the green die`, 'good');
      updatePrompt(`${word}! Rolling the green die…`, 'good');
      renderHUD();
      await sleep(720);
      if (run !== sessionId) return;

      const roll = await rollDice('green', run);
      if (run !== sessionId) return;

      state.towerHeight += roll;
      renderTower({ animateNew: true, newCount: roll });
      renderHUD();
      spawnFloat(`+${roll}`, 'good');
      showResult(`+${roll}`, roll === 1 ? 'stone added' : 'stones added', 'good');
      updatePrompt(
        `${word}! Green die: ${roll} — +${roll} stone${roll === 1 ? '' : 's'} — ${state.towerHeight} high.`,
        'good'
      );
      await sleep(1700);
      if (run !== sessionId) return;

      if (state.wobbleCounter >= WOBBLE_EVERY) {
        startWobble(run);
        return;
      }

      state.phase = 'guess';
      setGuessEnabled(true);
      setPauseEnabled(true);
      updatePrompt(DEFAULT_PROMPT);
      return;
    }

    // Wrong guess
    state.streak = 0;
    state.wobbleCounter = 0;
    sound.wrong();
    shakeTower();
    shakeStage();
    showResult('WRONG!', `${next.title} — the tower cracks`, 'bad');
    updatePrompt(`Wrong — it was ${next.title}. The tower cracks!`, 'bad');
    renderHUD();
    await sleep(720);
    if (run !== sessionId) return;

    const roll = await rollDice('red', run);
    if (run !== sessionId) return;

    // One mistake = one heart, regardless of the red die value.
    const blocksLost = Math.min(MAX_BLOCK_LOSS, roll, state.towerHeight);
    state.lives = Math.max(0, state.lives - 1);
    state.towerHeight = Math.max(0, state.towerHeight - blocksLost);
    renderHUD();
    renderTower();
    shakeTower();
    shakeStage();

    spawnFloat('−1♥', 'bad');
    showResult(
      '−1 HEART',
      blocksLost ? `−${blocksLost} stone${blocksLost === 1 ? '' : 's'}` : 'the tower shudders',
      'bad'
    );
    updatePrompt(
      blocksLost
        ? `Red die: ${roll}. You lose 1 heart and ${blocksLost} stone${blocksLost === 1 ? '' : 's'}.`
        : `Red die: ${roll}. You lose 1 heart.`,
      'bad'
    );
    await sleep(1650);
    if (run !== sessionId) return;

    if (state.lives <= 0) {
      gameOver(run);
      return;
    }

    state.phase = 'guess';
    setGuessEnabled(true);
    setPauseEnabled(true);
    updatePrompt(DEFAULT_PROMPT);
  }

  async function gameOver(run) {
    if (run !== sessionId) return;

    state.phase = 'gameover';
    setGuessEnabled(false);
    setPauseEnabled(false);
    closeOverlay(els.overlayWobble);
    closeOverlay(els.overlayPause);
    state.wobble = null;

    els.towerSway.classList.remove('is-wobbling');
    void els.towerSway.offsetWidth;
    els.towerSway.classList.add('is-collapsing');
    showResult('THE TOWER FALLS', 'the princess tumbles…', 'bad');
    updatePrompt('The tower falls!', 'bad');
    sound.collapse();
    shakeStage();

    await sleep(1750);
    if (run !== sessionId) return;
    showGameOver();
  }

  function showGameOver() {
    const scores = loadScores();
    const isRecord = state.towerHeight > 0 && state.towerHeight > (scores[0] ? scores[0].height : -1);

    state.scoreSaved = false;
    els.finalHeight.textContent = String(state.towerHeight);
    els.gameoverModal.classList.toggle('is-record', isRecord);
    els.gameoverMessage.textContent = isRecord
      ? 'A new royal record! The whole kingdom is watching.'
      : GAMEOVER_LINES[Math.floor(Math.random() * GAMEOVER_LINES.length)];

    els.scoreForm.hidden = false;
    els.scoreSaved.hidden = true;
    els.btnSaveScore.disabled = false;
    els.playerName.value = readPlayerName();

    renderLeaderboard();
    openOverlay(els.overlayGameover, els.playerName);
  }

  function submitScore(event) {
    event.preventDefault();
    if (state.scoreSaved) return;

    const name = sanitizeName(els.playerName.value) || 'Princess';
    const saved = saveScore(name, state.towerHeight);

    if (!saved) {
      toast('The leaderboard is unavailable in this browser.', true);
      return;
    }

    writePlayerName(name);
    state.scoreSaved = true;
    els.scoreForm.hidden = true;
    els.scoreSaved.hidden = false;
    els.btnSaveScore.disabled = true;
    renderLeaderboard();
    sound.success();
    toast('Score saved to the royal leaderboard.');
  }

  function goMenu() {
    sessionId += 1;
    state.phase = 'menu';
    closeAllOverlays();
    hideDice();
    hideResult();
    if (els.fxLayer) els.fxLayer.replaceChildren();
    pausedFrom = null;
    els.towerSway.classList.remove('is-collapsing', 'is-wobbling');
    els.card.classList.remove('is-flipping');
    els.screenGame.classList.remove('is-impact');
    els.overlayWobble.classList.remove('is-winning', 'is-failing');
    showScreen('menu');
    renderLeaderboard();
  }

  /* ------------------------------------------------------------
     Wobble / memory challenge
     ------------------------------------------------------------ */

  function buildSequence(length, gridSize) {
    const cells = gridSize * gridSize;
    const sequence = [];
    let previous = -1;

    for (let index = 0; index < length; index += 1) {
      let cell = Math.floor(Math.random() * cells);
      while (cell === previous) {
        cell = Math.floor(Math.random() * cells);
      }
      sequence.push(cell);
      previous = cell;
    }
    return sequence;
  }

  function startWobble(run) {
    if (run !== sessionId) return;

    const length = Math.min(
      WOBBLE_SEQUENCE_MAX,
      WOBBLE_SEQUENCE_MIN + Math.floor(state.towerHeight / 12)
    );
    state.wobbleCounter = 0;
    state.wobble = {
      gridSize: 3,
      sequence: buildSequence(length, 3),
      progress: 0,
    };

    setGuessEnabled(false);
    els.overlayWobble.classList.remove('is-winning', 'is-failing');
    openOverlay(els.overlayWobble, els.btnWobbleStart);
    renderWobbleGrid();
    updateWobbleDots();
    enterWobbleReady();
  }

  // The board is visible but nothing is shown until the player opts in.
  function enterWobbleReady() {
    state.phase = 'wobble-ready';
    els.memoryGrid.classList.remove('is-locked');
    els.memoryGrid.classList.add('is-preview');
    els.btnWobbleStart.hidden = false;
    els.wobbleInstruction.textContent =
      'Study the shapes on the stones — press Start when you are ready.';
    els.wobbleStatus.textContent = 'Ready when you are';
    setPauseEnabled(true);
  }

  function beginWobbleShow() {
    if (state.phase !== 'wobble-ready' || !state.wobble) return;
    els.btnWobbleStart.hidden = true;
    els.memoryGrid.classList.remove('is-preview');
    state.phase = 'wobble-show';
    playWobbleSequence(sessionId);
  }

  function renderWobbleGrid() {
    const size = state.wobble ? state.wobble.gridSize : 3;
    els.memoryGrid.style.setProperty('--grid-size', String(size));
    els.memoryGrid.replaceChildren();

    const fragment = document.createDocumentFragment();
    for (let index = 0; index < size * size; index += 1) {
      const shape = MEMORY_SHAPES[index % MEMORY_SHAPES.length];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'memory-cell';
      cell.dataset.index = String(index);
      cell.style.setProperty('--shape-color', shape.color);
      cell.setAttribute('aria-label', `${shape.name} stone`);
      cell.innerHTML =
        `<svg class="memory-shape" viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
        `<use href="#${shape.icon}"></use></svg>`;
      fragment.appendChild(cell);
    }
    els.memoryGrid.appendChild(fragment);
  }

  function updateWobbleDots() {
    els.sequenceDots.replaceChildren();
    if (!state.wobble) return;

    const fragment = document.createDocumentFragment();
    state.wobble.sequence.forEach((_, index) => {
      const dot = document.createElement('span');
      dot.className = 'seq-dot';
      if (index < state.wobble.progress) dot.classList.add('is-filled');
      fragment.appendChild(dot);
    });
    els.sequenceDots.appendChild(fragment);
  }

  async function playWobbleSequence(run) {
    if (!state.wobble) return;

    setPauseEnabled(false);
    els.memoryGrid.classList.add('is-locked');
    els.wobbleInstruction.textContent = 'Watch the stones glow, one by one.';
    els.wobbleStatus.textContent = 'Watch closely…';
    updateWobbleDots();

    await sleep(500);
    if (run !== sessionId || !state.wobble) return;

    // On an imported mid-wobble save, resume from the saved progress so the
    // replayed steps match the steps the player still has to enter.
    for (let index = state.wobble.progress; index < state.wobble.sequence.length; index += 1) {
      if (run !== sessionId || !state.wobble) return;

      const cell = els.memoryGrid.querySelector(
        `.memory-cell[data-index="${state.wobble.sequence[index]}"]`
      );
      if (!cell) return;

      cell.classList.add('is-lit');
      sound.wobbleCell(index);
      await sleep(620);
      if (run !== sessionId) return;
      cell.classList.remove('is-lit');
      await sleep(260);
    }

    if (run !== sessionId || !state.wobble) return;

    state.phase = 'wobble-input';
    els.memoryGrid.classList.remove('is-locked');
    els.wobbleInstruction.textContent = 'Your turn! Tap the stones in the same order.';
    els.wobbleStatus.textContent = `${state.wobble.progress} / ${state.wobble.sequence.length}`;
    setPauseEnabled(true);
    updateWobbleDots();
  }

  function flashCell(cell, className) {
    cell.classList.remove('is-good', 'is-bad');
    void cell.offsetWidth;
    cell.classList.add(className);
    window.setTimeout(() => cell.classList.remove(className), 550);
  }

  function handleMemoryClick(event) {
    const cell = event.target.closest('.memory-cell');
    if (!cell) return;
    if (state.phase !== 'wobble-input' || !state.wobble) return;

    const index = Number(cell.dataset.index);
    const expected = state.wobble.sequence[state.wobble.progress];

    if (index !== expected) {
      flashCell(cell, 'is-bad');
      sound.wobbleCell(index);
      wobbleFail(sessionId);
      return;
    }

    flashCell(cell, 'is-good');
    sound.wobbleCell(index);
    state.wobble.progress += 1;
    updateWobbleDots();

    if (state.wobble.progress >= state.wobble.sequence.length) {
      wobbleSuccess(sessionId);
      return;
    }

    els.wobbleStatus.textContent = `${state.wobble.progress} / ${state.wobble.sequence.length}`;
  }

  async function wobbleSuccess(run) {
    if (state.phase !== 'wobble-input') return;

    state.phase = 'wobble-resolve';
    setPauseEnabled(false);
    els.memoryGrid.classList.add('is-locked');
    els.overlayWobble.classList.add('is-winning');
    els.wobbleStatus.textContent = 'Perfect! The tower steadies…';
    updatePrompt('Wobble mastered!', 'good');
    sound.success();

    await sleep(1150);
    if (run !== sessionId) return;

    closeOverlay(els.overlayWobble);
    els.overlayWobble.classList.remove('is-winning', 'is-failing');
    els.memoryGrid.classList.remove('is-locked');
    state.wobble = null;

    const roll = await rollDice('green', run);
    if (run !== sessionId) return;

    state.towerHeight += roll;
    renderTower({ animateNew: true, newCount: roll });
    renderHUD();
    spawnFloat(`+${roll}`, 'good');
    showResult(`+${roll} BONUS`, roll === 1 ? 'stone added' : 'stones added', 'good');
    updatePrompt(`Green die: ${roll}! +${roll} bonus stone${roll === 1 ? '' : 's'}.`, 'good');

    await sleep(1700);
    if (run !== sessionId) return;

    state.phase = 'guess';
    setGuessEnabled(true);
    setPauseEnabled(true);
    updatePrompt(DEFAULT_PROMPT);
  }

  async function wobbleFail(run) {
    if (state.phase !== 'wobble-input') return;

    state.phase = 'wobble-resolve';
    setPauseEnabled(false);
    els.memoryGrid.classList.add('is-locked');
    els.overlayWobble.classList.add('is-failing');
    els.wobbleStatus.textContent = 'Wrong stone! The tower cracks…';
    sound.fail();

    state.wobble = null;
    state.lives = Math.max(0, state.lives - 1);
    renderHUD();

    await sleep(1500);
    if (run !== sessionId) return;

    closeOverlay(els.overlayWobble);
    els.overlayWobble.classList.remove('is-winning', 'is-failing');
    els.memoryGrid.classList.remove('is-locked');

    shakeTower();
    shakeStage();
    spawnFloat('−1♥', 'bad');
    showResult('−1 HEART', 'the tower shudders', 'bad');

    if (state.lives <= 0) {
      gameOver(run);
      return;
    }

    state.phase = 'guess';
    setGuessEnabled(true);
    setPauseEnabled(true);
    updatePrompt('The pattern slipped — one heart lost. Try the next card.', 'bad');
  }

  /* ------------------------------------------------------------
     Pause, restart, menu
     ------------------------------------------------------------ */

  function openPause() {
    if (
      state.phase !== 'guess' &&
      state.phase !== 'wobble-input' &&
      state.phase !== 'wobble-ready'
    ) {
      return;
    }

    pausedFrom = state.phase;
    state.phase = 'paused';
    setPauseEnabled(false);
    openOverlay(els.overlayPause, els.btnResume);
  }

  function closePause() {
    if (!els.overlayPause.classList.contains('is-open')) return;

    closeOverlay(els.overlayPause);
    if (pausedFrom) state.phase = pausedFrom;
    pausedFrom = null;

    if (els.screenGame.classList.contains('is-active') && state.phase !== 'gameover') {
      setPauseEnabled(true);
    }
  }

  function restartGame() {
    if (!window.confirm('Restart this tower? Your current progress will be lost.')) return;
    startGame();
  }

  function quitToMenu() {
    if (!window.confirm('Quit to the main menu? Your current progress will be lost.')) return;
    goMenu();
  }

  function openHowTo() {
    openOverlay(els.overlayHowto, els.btnHowtoClose);
  }

  function closeHowTo() {
    closeOverlay(els.overlayHowto);
  }

  /* ------------------------------------------------------------
     Save / import
     ------------------------------------------------------------ */

  function buildSaveData() {
    return {
      app: 'princess-tower',
      version: SAVE_VERSION,
      savedAt: new Date().toISOString(),
      state: {
        currentCard: state.currentCard,
        deck: [...state.deck],
        towerHeight: state.towerHeight,
        lives: state.lives,
        streak: state.streak,
        bestStreak: state.bestStreak,
        correctCount: state.correctCount,
        wobbleCounter: state.wobbleCounter,
        wobble: state.wobble
          ? {
              gridSize: state.wobble.gridSize,
              sequence: [...state.wobble.sequence],
              progress: state.wobble.progress,
            }
          : null,
        playerName: readPlayerName(),
      },
    };
  }

  function saveProgress() {
    if (!state.currentCard) {
      toast('Start a game before saving.', true);
      return;
    }

    const data = buildSaveData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    link.href = url;
    link.download = `princess-tower-save-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    toast('Progress saved to your downloads.');
  }

  function sanitizeSave(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('That file is not a Princess Tower save.');
    }
    // SAVE_VERSION is currently 1. If it is bumped, migrate older versions
    // here rather than rejecting every save that is not the current version.
    const version = data.version;
    if (!Number.isInteger(version) || version < 1) {
      throw new Error('That save file has no valid version.');
    }
    if (version > SAVE_VERSION) {
      throw new Error('That save is from a newer version of the game. Update and try again.');
    }
    if (version < SAVE_VERSION) {
      throw new Error('That save version is too old to import.');
    }

    const raw = data.state;
    if (!raw || typeof raw !== 'object') {
      throw new Error('The save file is missing its game state.');
    }

    if (!cardInfo(raw.currentCard)) {
      throw new Error('The save file has no valid current card.');
    }

    const deck = Array.isArray(raw.deck) ? raw.deck.filter((id) => cardInfo(id)) : [];
    const lives = clampInt(raw.lives, 1, MAX_LIVES, MAX_LIVES);
    const streak = clampInt(raw.streak, 0, 9999, 0);
    const bestStreak = Math.max(streak, clampInt(raw.bestStreak, 0, 9999, streak));

    let wobble = null;
    if (raw.wobble && typeof raw.wobble === 'object' && Array.isArray(raw.wobble.sequence)) {
      const source = raw.wobble.sequence;
      const sequence = source.filter(
        (value) => Number.isInteger(value) && value >= 0 && value < 9
      );
      if (
        sequence.length === source.length &&
        sequence.length >= WOBBLE_SEQUENCE_MIN &&
        sequence.length <= WOBBLE_SEQUENCE_MAX
      ) {
        wobble = {
          gridSize: 3,
          sequence,
          progress: clampInt(raw.wobble.progress, 0, sequence.length - 1, 0),
        };
      }
    }

    return {
      deck,
      currentCard: raw.currentCard,
      towerHeight: clampInt(raw.towerHeight, 0, 999, 0),
      lives,
      streak,
      bestStreak,
      correctCount: clampInt(raw.correctCount, 0, 999999, 0),
      wobbleCounter: clampInt(raw.wobbleCounter, 0, WOBBLE_EVERY, 0),
      wobble,
      playerName: sanitizeName(raw.playerName || ''),
    };
  }

  async function importFile(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const save = sanitizeSave(data);

      if (save.playerName) writePlayerName(save.playerName);
      startGame(save);
      renderLeaderboard();
      toast('Progress restored. Welcome back!');
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? 'That file is not valid JSON.'
          : error && error.message
            ? error.message
            : 'Could not import that save.';
      toast(message, true);
    } finally {
      els.importFile.value = '';
    }
  }

  /* ------------------------------------------------------------
     Assets
     ------------------------------------------------------------ */

  function attachAssetFallbacks() {
    $$('img.asset-img, img.die-img').forEach((image) => {
      const markMissing = () => {
        image.classList.add('is-missing');
        if (image === els.dieImg) els.dieVisual.classList.remove('has-die-art');
      };

      image.addEventListener('error', markMissing);
      image.addEventListener('load', () => {
        image.classList.remove('is-missing');
        if (image === els.dieImg) els.dieVisual.classList.add('has-die-art');
      });

      if (image.complete && image.naturalWidth === 0) markMissing();
    });
  }

  /* ------------------------------------------------------------
     Event wiring
     ------------------------------------------------------------ */

  function bindEvents() {
    els.btnNewGame.addEventListener('click', () => {
      sound.click();
      startGame();
    });
    els.btnHowToMenu.addEventListener('click', openHowTo);
    els.btnImportMenu.addEventListener('click', () => els.importFile.click());

    $$('.sound-btn').forEach((button) => button.addEventListener('click', toggleSound));

    els.btnPause.addEventListener('click', openPause);
    els.btnWobblePause.addEventListener('click', openPause);
    els.btnWobbleStart.addEventListener('click', beginWobbleShow);
    els.btnResume.addEventListener('click', closePause);
    els.btnSave.addEventListener('click', saveProgress);
    els.btnImport.addEventListener('click', () => els.importFile.click());
    els.btnRestart.addEventListener('click', restartGame);
    els.btnQuit.addEventListener('click', quitToMenu);

    els.btnHigher.addEventListener('click', () => makeGuess('higher'));
    els.btnLower.addEventListener('click', () => makeGuess('lower'));

    els.memoryGrid.addEventListener('click', handleMemoryClick);
    els.scoreForm.addEventListener('submit', submitScore);
    els.btnPlayAgain.addEventListener('click', () => startGame());
    els.btnMenu.addEventListener('click', goMenu);

    els.btnHowtoClose.addEventListener('click', closeHowTo);

    els.importFile.addEventListener('change', () => {
      const file = els.importFile.files && els.importFile.files[0];
      if (file) importFile(file);
    });

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        if (els.screenGame.classList.contains('is-active')) renderTower();
      }, 120);
    });

    document.addEventListener('keydown', (event) => {
      const tag = event.target && event.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (event.key === 'Escape') {
        if (els.overlayHowto.classList.contains('is-open')) {
          closeHowTo();
          return;
        }
        if (els.overlayPause.classList.contains('is-open')) {
          closePause();
          return;
        }
        if (
          els.screenGame.classList.contains('is-active') &&
          (state.phase === 'guess' ||
            state.phase === 'wobble-input' ||
            state.phase === 'wobble-ready')
        ) {
          openPause();
        }
        return;
      }

      if (document.querySelector('.overlay.is-open')) return;
      if (!els.screenGame.classList.contains('is-active') || state.phase !== 'guess') return;

      const key = event.key.toLowerCase();
      if (key === 'arrowup' || key === 'h') {
        event.preventDefault();
        makeGuess('higher');
      } else if (key === 'arrowdown' || key === 'l') {
        event.preventDefault();
        makeGuess('lower');
      }
    });
  }

  /* ------------------------------------------------------------
     Init
     ------------------------------------------------------------ */

  function init() {
    bindEvents();
    attachAssetFallbacks();
    renderLeaderboard();
    renderWobbleGrid();
    updateSoundUI();
    setGuessEnabled(false);
    setPauseEnabled(false);
    showScreen('menu');
  }

  init();
})();
