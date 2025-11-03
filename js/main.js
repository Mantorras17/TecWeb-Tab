import SoundManager from './soundmanager.js'
import TabGame from './tabgame.js'



document.addEventListener('DOMContentLoaded', () => {

  let game;
  let lastGameMessageBeforeSettings = null;
  let sfx = null;
  let cpuBusy = false;
  let cpuTimer = null;
  let messageTimer = null;
  let instructionPages = [];
  let instructionIndex = 0; 

  let scores = {
    player1: { wins: 0, losses: 0, name: 'Player 1' },
    player2: { wins: 0, losses: 0, name: 'Player 2' },
    cpu:     { wins: 0, losses: 0, name: 'Computer' }
  };



  window.game = null;
  window.sfx = null;
  window.gameMessage = setMessage;



  const ROLL_NAME = { 
    1: 'Tâb',
    2: 'Itneyn', 
    3: 'Teláteh', 
    4: "Arba'ah", 
    6: 'Sitteh' 
  };

  // Tracks stick roll animation state and deferred tasks.
  const sticksUI = { busy: false, queue: [] };

  // UI/AI timing constants for animations and delays.
  const TIMING = {
    flipAnimMs: 1100,
    cpuStartMs: 500,
    cpuThinkMs: 2500,
    cpuAfterPlayMs: 2500,
    cpuChainMs: 1200,
    humanToCpuMs: 1000,
    skipMsgDelayMs: 1000,
    pvpPromptDelayMs: 2200
  };

  // Keep a reference to original openInstructions before it’s wrapped later.
  const _openInstr = openInstructions;



  const sizeInput = document.getElementById('board-size');
  const intro = document.getElementById('intro-screen');
  const modeScreen = document.getElementById('mode-screen');
  const introStartBtn = document.getElementById('intro-start');
  const boardEl = document.getElementById('board');
  const rollBtn = document.getElementById('throw-sticks');
  const sticksEl = document.getElementById('sticks-result');
  const startSideBtn = document.getElementById('start-game');
  const quitBtn = document.getElementById('quit-game');
  const msgEl = document.getElementById('messages');
  const instrOpen = document.getElementById('show-instructions');
  const instrPanel = document.getElementById('instructions');
  const menuBtn = document.getElementById('menu-btn');
  const sidePanel = document.getElementById('sidePanel');
  const openSidePanelBtn = document.getElementById('open-sidepanel');
  const scoreboardBtn = document.getElementById('scoreboard-btn');
  const scoreboardPanel = document.getElementById('scoreboard-panel');
  const mainGrid = document.getElementById('main-grid');
  const firstPlayerInput = document.getElementById('first-player');
  const gameModeInput = document.getElementById('game-mode');
  const difficultyInput = document.getElementById('difficulty');
  const closePanelBtn = document.getElementById('closePanel');
  const scoreboardBody = document.getElementById('scoreboard-body');
  const noScoresMsg = document.getElementById('no-scores-msg');
  const audioToggle = document.getElementById('audio-toggle');
  const audioVol = document.getElementById('audio-vol');
  const audioVolOut = document.getElementById('audio-vol-out');
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');
  const instrScrim = document.getElementById('instructions-scrim');
  const insPagesWrap = document.getElementById('ins-pages');
  const insCounter = document.getElementById('ins-counter');
  const insDotsWrap = document.getElementById('ins-dots');
  const insPrev = document.getElementById('ins-prev');
  const insNext = document.getElementById('ins-next');
  const userAvatar = document.getElementById('user-avatar');
  const userMenu = document.getElementById('user-menu');
  const menuMain = document.getElementById('menu-main');
  const menuLogin = document.getElementById('menu-login');
  const menuSignup = document.getElementById('menu-signup');
  const loginBtn = document.getElementById('btn-login');
  const signupBtn = document.getElementById('btn-signup');



  boardEl?.addEventListener('click', (e) => {
    if (!game || game.over) return;
    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.name === 'cpu' && !game.isVsPlayer) {
      setMessage('Wait for Player 2');
      return;
    }
    const cell = e.target.closest('.board-cell');
    if (!cell) return;
    const r = +cell.dataset.row;
    const c = +cell.dataset.col;
    if (game.stickValue == null) {
      setMessage('Throw sticks first!'); 
      return;
    }
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
    const pieceAtClick = game.getCurrentPlayer().getPieceAt(r, c);
    if (pieceAtClick) {
      if (game.selectedPiece === pieceAtClick) {
        game.clearSelection();
        updateBoardHighlights();
        return;
      }
      game.selectPieceAt(r, c);
      updateBoardHighlights();
    } else {
      if (!game.selectedPiece) {
        return;
      }
      const moveWasSuccessful = game.moveSelectedTo(r, c);
      if (moveWasSuccessful) {
        renderAll({ updateSticks: false }); 
        sticksToGrey(0);
        if (checkGameOver()) return; 

        const nextPlayer = game.getCurrentPlayer();
        if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
          setMessage("Player 2's turn.");
          // MERGE: usa queueAfterFlip
          queueAfterFlip(() => maybeCpuTurn(false), TIMING.humanToCpuMs);
        } else {
          if (nextPlayer === currentPlayer) {
            if (game.isVsPlayer) {
              const P1_name = game.players[0].name;
              setMessage(`${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, play again!`);
            } else {
              setMessage("Play again!");
            }
          } else {
            if (game.isVsPlayer) {
              const P1_name = game.players[0].name;
              setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);          
            }
          }
        }
      }
    }
  });


  introStartBtn?.addEventListener('click', () => {
    showGame();
    openSidePanel();
    setMessage('Choose the configurations and click "Start" to play the game!');
    show(menuBtn);
    show(scoreboardBtn);
    setCloseBlocked(true);
  });


  startSideBtn?.addEventListener('click', async () => {
    lastGameMessageBeforeSettings = null;
    if (window.game) {
      const confirmed = await showModal(
        'New game?',
        'Starting a new game will cancel the current one. Are you sure?',
        'Yes, Start New',
        'No, Cancel'
      );
      if (!confirmed) return;
    }
    try { sfx?.stopBgm(); } catch {}
    const gameMode = gameModeInput?.value || 'pvc';
    const cols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;
    const firstPlayer = firstPlayerInput ? firstPlayerInput.value : 'player1';
    const difficulty = difficultyInput ? difficultyInput.value : 'easy';

    game = new TabGame(cols);
    window.game = game;

    try {
      sfx?.play('start');
      setTimeout(() => sfx?.playBgm(), 60);
    } catch {}

    setCloseBlocked(false); 

    game.isVsPlayer = (gameMode === 'pvp');

    game.players[0].name = 'player1';
    if (game.isVsPlayer) {
      game.players[1].name = 'player2';
    } else {
      game.players[1].name = 'cpu';
      game.difficultyLevel = ({easy: 0, medium: 1, hard: 2}[difficulty]) ?? 0;
    }

    if (firstPlayer === 'cpu' || firstPlayer === 'player2') {
      game.curPlayerIdx = 1;
    } else {
      game.curPlayerIdx = 0;
    }
    
    if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
    if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
    cpuBusy = false;

    show(rollBtn);
    updateRollBtn();
    hardShowScoreboard();

    if (sticksEl) {
      sticksEl.classList.remove('hidden');
      sticksEl.style.display = '';
    }

    renderSticks(null);
    buildBoard();
    updateBoardHighlights();
    updateBoardRotation();
    closeSidePanel();
    closeScoreboardPanelIfOpen();

    const currentPlayer = game.getCurrentPlayer();
    if (currentPlayer.name === 'cpu') {
      setMessage('Game started. Player 2 plays first!');
      setTimeout(maybeCpuTurn, TIMING.cpuStartMs);
    } else if (currentPlayer.name === 'player1') {
      setMessage('Game started. Player 1, your turn!');
    } else if (currentPlayer.name === 'player2') {
      setMessage('Game started. Player 2, your turn!');
    }
  });


  closePanelBtn?.addEventListener('click', () => {
    if (lastGameMessageBeforeSettings) {
      setMessage(lastGameMessageBeforeSettings);
      lastGameMessageBeforeSettings = null;
    }
    // Fecha o painel
    closeSidePanel();
  });


  rollBtn?.addEventListener('click', () => {
    const currentPlayer = game.getCurrentPlayer();
    if (!canPlayerRoll()) {
      const turn = currentPlayer?.name;
      if (turn === 'cpu') setMessage("Wait — Player 2's turn.");
      else if (sticksUI.busy) setMessage('Throwing sticks in progress…');
      else setMessage('You already threw. Move a piece!');
      return;
    }

    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }

    const val = game.startTurn();
    try { sfx.play('sticks'); } catch {}
    updateRollBtn(); 
    renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });
    queueAfterFlip(() => announceRoll(currentPlayer?.name ?? 'Player', val));

    const skipped = game.autoSkipIfNoMoves(); 
    
    if (skipped) {
      queueAfterFlip(() => {
        const nextPlayer = game.getCurrentPlayer();
        let skipMessage = "";

        if (nextPlayer === currentPlayer) {
          if (game.isVsPlayer) {
            const P1_name = game.players[0].name;
            skipMessage = `${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'} has no moves. Throw sticks again!`;
          } else {
            skipMessage = "No possible moves. Throw sticks again!";
          }
          setMessage(skipMessage);
          renderAll();

        } else {
          if (game.isVsPlayer) {
            const P1_name = game.players[0].name;
            skipMessage = `No possible moves. ${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`;
          } else {
            skipMessage = "No possible moves. Turn passed.";
          }
          
          setMessage(skipMessage);
          renderAll();
          
          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            messageTimer = setTimeout(() => {
              setMessage("Player 2's turn");
              maybeCpuTurn(false); 
            }, 1500);
          }
        }
      }, TIMING.flipAnimMs + 200);
      return; 
    }
    
    msgAfterFlip('Choose a piece to move!', 600);
    renderAll({ updateSticks: false });
  });


  quitBtn?.addEventListener('click', async () => {
    let quitMessage = 'Game quit.';
    const confirmed = await showModal(
      'Quit?',
      'Are you sure you want to quit? This action will count as a loss.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;
    if (!window.game) { try { sfx?.stopBgm(); } catch {} }

    if (window.game && !game.over) {
      const winnerPlayer = game.getOpponentPlayer();
      handleGameOver(winnerPlayer);
      let winnerDisplay = winnerPlayer.name.toUpperCase();
      if (winnerPlayer.name === 'player1') winnerDisplay = 'Player 1';
      if (winnerPlayer.name === 'player2') winnerDisplay = 'Player 2';
    }
    window.game = null;
    if (boardEl) boardEl.innerHTML = '';
    if (sticksEl) sticksEl.innerHTML = '';
    
    hide(rollBtn);
    
    setMessage(quitMessage);
    closeSidePanel();    
    setTimeout(() => {
      if (!window.game) {
        setMessage('Choose the configurations and click "Start" to play the game.');
        setCloseBlocked(true);
      }
    }, 3000); 
  });


  instrOpen?.addEventListener('click', openInstructions);

  instrPanel?.addEventListener('click', (e) => {
    if (e.target.closest('.ins-close')) closeInstructions();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && instrPanel?.classList.contains('open')) {
      closeInstructions();
    }
  });

  instrScrim?.addEventListener('click', closeInstructions);

  insPrev?.addEventListener('click', prevPage);
  insNext?.addEventListener('click', nextPage);

  document.addEventListener('keydown', (e) => {
    if (!instrPanel?.classList.contains('open')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); nextPage(); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); prevPage(); }
    if (e.key === 'Home')       { e.preventDefault(); goToPage(0); }
    if (e.key === 'End')        { e.preventDefault(); goToPage(instructionPages.length - 1); }
  });


  if (scoreboardBtn && scoreboardPanel) {
    scoreboardBtn.addEventListener('click', () => {
      const isOpen = scoreboardPanel.classList.toggle('open');
      scoreboardBtn.innerHTML = isOpen ? '&times;' : '🏆';
      if (isOpen) setTimeout(() => scoreboardPanel.focus(), 100);
    });
    scoreboardPanel.addEventListener('click', (e) => {
      if (e.target === scoreboardPanel) {
        scoreboardPanel.classList.remove('open');
        scoreboardBtn.innerHTML = '🏆';
      }
    });
  }


  if (menuBtn && sidePanel) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sidePanel.classList.contains('open');
      if (isOpen) closeSidePanel();
      else openSidePanel();
    });
  }

  openSidePanelBtn?.addEventListener('click', openSidePanel);


  sizeInput?.addEventListener('change', settingChangeListener);

  firstPlayerInput?.addEventListener('change', settingChangeListener);

  difficultyInput?.addEventListener('change', settingChangeListener);

  gameModeInput?.addEventListener('change', () => {
    updateFirstPlayerOptions();
    settingChangeListener();
  });

  audioToggle?.addEventListener('click', () => {
    sfx?.toggleMute();
    syncAudioUI();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key?.toLowerCase() === 'm') {
      sfx?.toggleMute();
      syncAudioUI();
    }
  });

  audioVol?.addEventListener('input', (e) => {
    const pct = Math.max(0, Math.min(100, Number(e.target.value || 0)));
    const v = pct / 100;
    sfx?.setMasterVolume(v);
    audioVol.style.setProperty('--vol', pct + '%');
    if (audioVolOut) audioVolOut.textContent = pct + '%';
  });


  if (userAvatar && userMenu) {
    userAvatar.addEventListener('click', () => {
      userMenu.classList.toggle('hidden');
    });
  }

  loginBtn?.addEventListener('click', () => {
    menuMain.classList.add('hidden');
    menuLogin.classList.remove('hidden');
  });

  signupBtn?.addEventListener('click', () => {
    menuMain.classList.add('hidden');
    menuSignup.classList.remove('hidden');
  });

  menuLogin.querySelector('.back-btn')?.addEventListener('click', () => {
    menuLogin.classList.add('hidden');
    menuMain.classList.remove('hidden');
  });

  menuSignup.querySelector('.back-btn')?.addEventListener('click', () => {
    menuSignup.classList.add('hidden');
    menuMain.classList.remove('hidden');
  });

  document.addEventListener('click', (e) => {
    if (userMenu && userAvatar && !userMenu.contains(e.target) && !userAvatar.contains(e.target)) {
      userMenu.classList.add('hidden');
    }
  });



  // Audio setup
  // Initializes the sound manager and loads all SFX/BGM assets.
  (function initAudio() {
    sfx = new SoundManager('audio/');
    window.sfx = sfx;
    sfx.add('background', 'background.mp3',  { loop: true, volume: 0.30 });
    sfx.add('sticks',     'sticks.mp3',      { volume: 0.3 });
    sfx.add('move',       'move.mp3',        { volume: 0.9 });
    sfx.add('capture',    'capture.mp3',     { volume: 0.9 });
    sfx.add('start',      'gameStart.mp3',   { volume: 0.9 });
    sfx.add('end',        'gameEnd.mp3',     { volume: 0.95 });
  })();


  // === Group: UI helpers and panels ===

  /**
   * Enable/disable the side panel close button (and sync aria state).
   */
  function setCloseBlocked(block) {
    if (!closePanelBtn) return;
    closePanelBtn.disabled = !!block;
    closePanelBtn.setAttribute('aria-disabled', String(!!block));
  }


  /**
   * Open the left side configuration panel.
   */
  function openSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    sidePanel.style.width = 'min(360px, 90vw)';
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 100);
  }


  /**
   * Close the left side configuration panel.
   */
  function closeSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    sidePanel.style.width = '0';
    menuBtn.innerHTML = '&#9776;';
  }


  /**
   * Update the "First Player" select options based on game mode (PvP vs PvC).
   */
  function updateFirstPlayerOptions() {
    if (!gameModeInput || !firstPlayerInput) return;
    const selectedMode = gameModeInput.value;
    const currentFirstPlayer = firstPlayerInput.value;
    firstPlayerInput.innerHTML = '';

    let options = [];
    if (selectedMode === 'pvp') {
      options = [
        { value: 'player1', text: 'Player 1' },
        { value: 'player2', text: 'Player 2' }
      ];
    } else {
      options = [
        { value: 'player1', text: 'Player 1' },
        { value: 'cpu', text: 'Computer (Player 2)' }
      ];
    }
    options.forEach(opt => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.text;
      firstPlayerInput.appendChild(optionEl);
    });
    
    if (currentFirstPlayer === 'player1') {
      firstPlayerInput.value = 'player1';
    } else if (selectedMode === 'pvp' && currentFirstPlayer === 'cpu') {
      firstPlayerInput.value = 'player2';
    } else if (selectedMode === 'pvc' && currentFirstPlayer === 'player2') {
      firstPlayerInput.value = 'cpu';
    }
  }


  /**
   * Hide any element by adding 'hidden' and setting display: none.
   */
  function hide(el){ if(el){ el.classList.add('hidden'); el.style.display = 'none'; }}


  /**
   * Show any element by removing 'hidden' and restoring display.
   */
  function show(el){ if(el){ el.classList.remove('hidden'); el.style.display = ''; }}


  /**
   * Show intro screen and hide the game grid.
   */
  function showIntro() {
    if (intro) {
      intro.classList.remove('hidden');
      intro.hidden = false;
      intro.style.display = 'grid';
    }
    if (modeScreen) {
      modeScreen.classList.add('hidden');
      modeScreen.hidden = true;
      modeScreen.style.display = 'none';
    }
    if (mainGrid) mainGrid.style.display = 'none';
    hide(menuBtn);
    hide(rollBtn);
  }


  /**
   * Show the game grid and hide intro/mode screens.
   */
  function showGame() {
    if (intro) {
      intro.classList.add('hidden');
      intro.hidden = true;
      intro.style.display = 'none';
    }
    if (modeScreen) {
      modeScreen.classList.add('hidden');
      modeScreen.hidden = true;
      modeScreen.style.display = 'none';
    }
    if (mainGrid) {
      mainGrid.style.display = 'grid';
    }
    show(menuBtn);    
    hide(rollBtn)
  }


  /**
   * If the scoreboard panel is open, close it and reset the button icon.
   */
  function closeScoreboardPanelIfOpen() {
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('open');
    if (scoreboardBtn) scoreboardBtn.innerHTML = '🏆';
  }


  /**
   * Ensure scoreboard panel is visible and accessible.
   */
  function hardShowScoreboard() {
    if (!scoreboardPanel) return;
    scoreboardPanel.style.display = '';
    scoreboardPanel.removeAttribute('aria-hidden');
  }


  // === Group: Messaging and sticks UI ===

  /**
   * Announce a roll result using localized names and current player's label.
   */
  function announceRoll(playerName, value) {
    const name = ROLL_NAME[value] ?? String(value);
    const who =
      playerName === 'player1' ? 'Player 1' :
      playerName === 'player2' ? 'Player 2' :
      playerName === 'cpu'     ? 'Player 2' : 'Player';
    setMessage(`${who} rolled a ${name} (${value})!`);
  }


  /**
   * Reset the stick display to neutral (grey/inactive) after a delay.
   */
  function sticksToGrey(delayMs = 0) {
    setTimeout(() => renderSticks(null, { force: true, animate: false }), delayMs);
  }


  /**
   * Queue a callback to run after the sticks animation (or run now if idle).
   */
  function queueAfterFlip(cb, delay = 0) {
    if (!sticksUI.busy) {
      setTimeout(cb, delay);
      return;
    }
    sticksUI.queue.push(() => setTimeout(cb, delay));
  }


  /**
   * Queue a message update to run after the sticks animation.
   */
  function msgAfterFlip(text, delay = 0) {
    queueAfterFlip(() => setMessage(text), delay);
  }


  /**
   * Set the single-line status message displayed to the player(s).
   */
  function setMessage(text) {
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }


  /**
   * Determine if the human player is allowed to roll the sticks now.
   */
  function canPlayerRoll() {
    if (!game) return false;
    if (sticksUI.busy) return false;
    const cur = game.getCurrentPlayer();
    if (!cur) return false;
    if (cur.name === 'cpu') return false;
    return game.stickValue == null;
  }


  /**
   * Enable/disable the roll button based on current turn and state.
   */
  function updateRollBtn() {
    if (!rollBtn) return;
    const enabled = canPlayerRoll();
    rollBtn.disabled = !enabled;
    rollBtn.setAttribute('aria-disabled', String(!enabled));
  }


  /**
   * Render the sticks (neutral or showing a roll) and animate if requested.
   */
  function renderSticks(valueOrResult, opts = {}) {
    if (!sticksEl) return;
    sticksEl.classList.remove('hidden');
    sticksEl.style.display = '';
    const force = opts.force === true;
    const animate = opts.animate !== false;

    if (sticksUI.busy && !force) return;

    sticksEl.innerHTML = '';

    const hasValue =
      typeof valueOrResult === 'number' ||
      (valueOrResult && valueOrResult.value != null);

    if (!hasValue) {
      const strip = document.createElement('div');
      strip.className = 'stick-strip';
      strip.style.perspective = '1000px';
      for (let i = 0; i < 4; i++) {
        const img = document.createElement('img');
        img.className = 'stick-img inactive';
        img.src = 'img/darkpiece.jpg';
        strip.appendChild(img);
      }
      const label = document.createElement('div');
      label.className = 'sticks-label';
      sticksEl.appendChild(strip);
      sticksEl.appendChild(label);
      return;
    }

    sticksUI.busy = animate;

    const value = typeof valueOrResult === 'number'
      ? valueOrResult
      : valueOrResult.value;

    const faces =
      typeof valueOrResult === 'object' && valueOrResult.sticks
        ? valueOrResult.sticks
        : window.game?.lastSticks?.length
        ? window.game.lastSticks
        : [0, 0, 0, 0];

    const strip = document.createElement('div');
    strip.className = 'stick-strip';
    strip.style.perspective = '1000px';

    faces.forEach(() => {
      const img = document.createElement('img');
      img.className = 'stick-img inactive';
      img.src = 'img/darkpiece.jpg';
      if (animate) {
        img.style.animation = 'none';
        void img.offsetWidth;
        img.style.animation = `stickFlip ${TIMING.flipAnimMs}ms ease-in-out forwards`;
      }
      strip.appendChild(img);
    });

    const label = document.createElement('div');
    label.className = 'sticks-label';
    label.innerHTML = animate ? '<i>Rolling...</i>' : `&rarr; <b>${value}</b>`;

    sticksEl.appendChild(strip);
    sticksEl.appendChild(label);

    const reveal = () => {
      strip.innerHTML = '';
      faces.forEach((v) => {
        const img = document.createElement('img');
        img.className = 'stick-img ' + (v === 1 ? 'light' : 'dark') + ' active';
        img.alt = v === 1 ? 'Flat side (light)' : 'Round side (dark)';
        img.src = v === 1 ? 'img/lightpiece.jpg' : 'img/darkpiece.jpg';
        strip.appendChild(img);
      });
      if (value === 1) {
        label.innerHTML = `<b>${value} move</b>`;
      }
      else {
        label.innerHTML = `<b>${value} moves</b>`;
      }
      sticksUI.busy = false;
      const tasks = sticksUI.queue.splice(0, sticksUI.queue.length);
      tasks.forEach(fn => fn());
    };

    if (animate) setTimeout(reveal, TIMING.flipAnimMs);
    else reveal();
  }


  // === Group: Board rendering and highlighting ===

  /**
   * Update board rotation (PvP only) so current player sees their side upright.
   */
  function updateBoardRotation() {
    if (!game || !boardEl) return;

    const boardBox = boardEl.querySelector('.board-box');
    if (!boardBox) return;

    if (game.isVsPlayer && game.curPlayerIdx === 1) {
      boardBox.classList.add('rotated');
    } else {
      boardBox.classList.remove('rotated');
    }
  }

  
  /**
   * Build the board DOM (cells and any pieces on them) from game state.
   */
  function buildBoard() {
    if (!boardEl || !game) return;
    boardEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'board-box';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'stretch';
    container.style.gap = '2px';

    const mePlayer = game.getCurrentPlayer();
    const oppPlayer = game.getOpponentPlayer();
    const meSkin = (mePlayer.name === 'player1') ? 'p1' : 'p2';
    const oppSkin = (oppPlayer.name === 'player1') ? 'p1' : 'p2';

    for (let r = 0; r < game.rows; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'board-row';
      for (let c = 0; c < game.columns; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

  // Add flow arrows by row per requested angles (row index 0=bottom .. 3=top):
  // - Rows 0 and 2: 0° (right) until the last cell which is diagonal(s)
  // - Rows 1 and 3: 180° (left) with the very first cell being a diagonal
  // This matches the directed path defined in Board.buildPath().
        const flowClass = (r === 0 || r === 2) ? 'flow-left' : 'flow-right';
        cell.classList.add('flow', flowClass);

        // Corner diagonals per requested layout (row index 0=bottom .. 3=top)
        if (r === 0 && c === 0) {
          // row 0 (bottom), last col: up-right (45°)
          cell.classList.add('flow-diag-135');
        }
        if (r === 1 && c === game.columns - 1) {
          // row 2, last col: up-right (45°) and down-right (315°)
          cell.classList.add('flow-diag-right-both');
        }
        if (r === 2 && c === 0) {
          cell.classList.add('flow-diag-225');
        }
        if (r === 3 && c === game.columns - 1) {
          cell.classList.add('flow-diag-315');
        }

        const me = mePlayer.getPieceAt(r, c);
        const opp = oppPlayer.getPieceAt(r, c);

        if (me || opp) {
          const piece = document.createElement('div');
          piece.className = 'piece ' + (me ? meSkin : oppSkin) + ' ' + (me || opp).state;
          piece.title = `${me ? mePlayer.name : oppPlayer.name} (${(me || opp).state})`;
          cell.appendChild(piece);
        }
        rowDiv.appendChild(cell);
      }
      container.appendChild(rowDiv);
      if (r < game.rows - 1) {
        const sep = document.createElement('div');
        sep.className = 'row-sep';
        container.appendChild(sep);
      }
    }
    box.appendChild(container);
    boardEl.appendChild(box);
  }


  /**
   * Highlight selectable pieces and legal move targets for the current selection.
   */
  function updateBoardHighlights() {
    if (!boardEl || !game) return;
    boardEl.querySelectorAll('.board-cell').forEach(cell => {
      cell.classList.remove('selected', 'highlight', 'mine', 'opp');
    });
    boardEl.querySelectorAll('.piece.selected').forEach(piece => {
      piece.classList.remove('selected');
    });
    for (let r = 0; r < game.rows; r++) {
      for (let c = 0; c < game.columns; c++) {
        const cell = boardEl.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`);
        if (!cell) continue;
        const me = game.getCurrentPlayer().getPieceAt(r, c);
        const opp = game.getOpponentPlayer().getPieceAt(r, c);
        if (me) cell.classList.add('mine');
        if (opp) cell.classList.add('opp');
        if (game.selectedPiece && game.selectedPiece.row === r && game.selectedPiece.col === c) {
          const pieceEl = cell.querySelector('.piece');
          if (pieceEl) pieceEl.classList.add('selected');
        }
        if (game.getSelectedMoves().some(p => p.row === r && p.col === c)) {
          cell.classList.add('highlight');
        }
      }
    }
  }


  /**
   * Full UI refresh: board, highlights, sticks (optionally), roll button, and rotation.
   */
  function renderAll(opts = { updateSticks: true }) {
    if (!window.game) return;
    
    buildBoard();
    updateBoardHighlights();
    
    if (opts.updateSticks) {
      renderSticks(game.stickValue ?? null, { animate: false }); 
    }

    updateRollBtn(); 

    const currentPlayer = game.getCurrentPlayer();
    const isCpuTurn = (currentPlayer.name === 'cpu' && !game.isVsPlayer);

    if (boardEl) {
      if (isCpuTurn) {
        boardEl.classList.add('disabled-board');
      } else {
        boardEl.classList.remove('disabled-board');
      }
    }
    updateBoardRotation();
  }


  // === Group: Turn flow and CPU behavior ===

  /**
   * Drive the CPU turn: roll, decide, possibly skip, move, and chain extra turns.
   * Honors timing constants to simulate thinking/animation delays.
   */
  function maybeCpuTurn(isExtraTurn = false) {
    if (!game || game.over) return;
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu' || game.isVsPlayer) return;

    cpuBusy = true;
    queueAfterFlip(updateRollBtn);

    renderSticks(null, { force: true, animate: false });

    const run = () => {
      cpuTimer = null;
      if (!game || game.over || game.getCurrentPlayer().name !== 'cpu' || game.isVsPlayer) {
        cpuBusy = false;
        return;
      }
      const val = game.startTurn();
      try { sfx.play('sticks'); } catch {}
      queueAfterFlip(updateRollBtn);
      renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });

      queueAfterFlip(() => {
        renderAll({ updateSticks: false });
        announceRoll(game.getCurrentPlayer()?.name ?? 'CPU', val);
      });

      queueAfterFlip(() => {
        setTimeout(() => {
          const skipped = game.autoSkipIfNoMoves();

          if (skipped) {
            const nextPlayer = game.getCurrentPlayer();
            const skipMessage =
              (nextPlayer === cur)
                ? "No possible moves. Throwing sticks again."
                : "No possible moves. Turn passed.";

            msgAfterFlip(skipMessage, 0);
  
            setTimeout(() => {
              renderAll({ updateSticks: false });
              sticksToGrey(0);

              if (nextPlayer.name === 'cpu') {
                setTimeout(maybeCpuTurn(true), TIMING.cpuChainMs);
              } else {
                setTimeout(() => {
                  msgAfterFlip("Your turn, player 1!");
                  queueAfterFlip(updateRollBtn);
                  cpuBusy = false;
                }, TIMING.skipMsgDelayMs);
              }
            }, TIMING.skipMsgDelayMs);
            return;
          }

          game.cpuMove();
          renderAll({ updateSticks: false });
          sticksToGrey(0);
          msgAfterFlip('Player 2 played.');

          setTimeout(() => {
            if (game.getCurrentPlayer().name === 'cpu') {
              msgAfterFlip('Player 2 plays again.');
              setTimeout(maybeCpuTurn, TIMING.cpuChainMs);
            } else {
              msgAfterFlip('Your turn, player 1!');
              queueAfterFlip(updateRollBtn);
              cpuBusy = false;
            }
          }, TIMING.cpuAfterPlayMs);
        }, TIMING.cpuThinkMs);
      });
    };
  
    setTimeout(run, TIMING.cpuStartMs);
  }


  /**
   * Check whether the game is over and trigger end-game handling if so.
   */
  function checkGameOver() {
    if (!game) return false;
    const { over, winner } = game.checkGameOver();
    if (over) {
      handleGameOver(winner);
      return true;
    }
    return false;
  }


  // === Group: Scoreboard and end-game ===

  /**
   * Rebuild the scoreboard table and "no scores" message based on tracked stats.
   */
  function updateScoreboardView() {
    if (!scoreboardBody || !noScoresMsg) return;
    scoreboardBody.innerHTML = '';
    const totalGames = scores.player1.wins + scores.player1.losses + 
                        scores.player2.wins + scores.player2.losses + 
                        scores.cpu.wins + scores.cpu.losses;
    if (totalGames === 0) {
      noScoresMsg.style.display = 'block';
      return;
    }
    noScoresMsg.style.display = 'none';
    const stats = [
      { name: 'Player 1', ...scores.player1 },
      { name: 'Player 2', ...scores.player2 },
      { name: 'Computer', ...scores.cpu }
    ];
    stats.sort((a, b) => b.wins - a.wins);
    const getRatio = (wins, losses) => {
      if (losses === 0) return wins > 0 ? String(wins.toFixed(2)) : '0.00';
      return (wins / losses).toFixed(2);
    };
    stats.forEach((stat, index) => {
      const row = scoreboardBody.insertRow();
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${stat.name}</td>
        <td>${stat.wins}</td>
        <td>${stat.losses}</td>
        <td>${getRatio(stat.wins, stat.losses)}</td>
      `;
    });
  }


  /**
   * Handle end of game: sounds, stats, UI disable, auto-redirect back to setup.
   */
  function handleGameOver(winner) {
    if (!winner) return;
    try { sfx?.play('end'); sfx?.stopBgm(); } catch {}

    const winnerName = winner.name;
    const loserPlayer = (winner === game.players[0]) ? game.players[1] : game.players[0];
    const loserName = loserPlayer.name;

    if (scores[winnerName]) scores[winnerName].wins++;
    if (scores[loserName]) scores[loserName].losses++;
    updateScoreboardView();

    let winnerDisplay = winnerName.toUpperCase();
    if (winnerName === 'player1') winnerDisplay = 'Player 1';
    if (winnerName === 'player2') winnerDisplay = 'Player 2';
    msgAfterFlip(`Game Over! ${winnerDisplay} won!`);

    rollBtn && (rollBtn.disabled = true);
    boardEl && boardEl.classList.add('disabled-board');

    if (sticksEl) {
      sticksEl.innerHTML = '';
      sticksEl.classList.add('hidden');
      sticksEl.style.display = 'none';
    } hide && hide(sticksEl);

    if (scoreboardPanel) {
      scoreboardPanel.classList.add('open');
      if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      setTimeout(() => scoreboardPanel.focus(), 100);
    }

    const CLEANUP_DELAY = 2200;
    setTimeout(() => {
      if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
      if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
      window.game = null;
      game = null;

      if (boardEl) boardEl.innerHTML = '';
      hide && hide(rollBtn);
      hide && hide(sticksEl);
      showGame && showGame();
      openSidePanel && openSidePanel();

      buildBoard && buildBoard();
      updateBoardHighlights && updateBoardHighlights();

      setMessage('Choose the configurations and click "Start" to play the game.');
      setCloseBlocked(true);
      
      if (scoreboardPanel) {
        scoreboardPanel.classList.add('open');
        if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      }
    }, CLEANUP_DELAY);
  }


  // === Group: Modal helpers ===

  /**
   * Show a simple confirm/cancel modal and resolve a promise with the choice.
   */
  function showModal(title, text, confirmText = 'Yes', cancelText = 'No') {
    return new Promise((resolve) => {
      modalTitle.textContent = title;
      modalText.textContent = text;
      modalConfirm.textContent = confirmText;
      modalCancel.textContent = cancelText;
      modalOverlay.classList.remove('hidden');
      modalOverlay.style.display = 'grid';
      const close = (value) => {
        modalOverlay.style.display = 'none';
        modalOverlay.classList.add('hidden');
        modalConfirm.onclick = null;
        modalCancel.onclick = null;
        resolve(value);
      };
      modalConfirm.onclick = () => close(true);
      modalCancel.onclick = () => close(false);
    });
  }


  // === Group: Instructions overlay (pager) ===

  /**
   * Open the instructions panel, collecting pages if needed and focusing page 1.
   */
  function openInstructions() {
    if (!instrPanel || !instrScrim) return;

    if (!instructionPages.length) collectPages();
    goToPage(0);

    instrPanel.classList.add('open');
    instrPanel.setAttribute('aria-hidden', 'false');
    instrScrim.classList.add('visible');
    document.body.classList.add('instructions-open');
  }


  /**
   * Close the instructions panel and remove related body state.
   */
  function closeInstructions() {
    if (!instrPanel || !instrScrim) return;
    instrPanel.classList.remove('open');
    instrPanel.setAttribute('aria-hidden', 'true');
    instrScrim.classList.remove('visible');
    document.body.classList.remove('instructions-open');
  }


  /**
   * Collect instruction pages, reset to first page, and build the navigation dots.
   */
  function collectPages() {
    instructionPages = Array.from(insPagesWrap?.querySelectorAll('.ins-page') || []);
    instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== 0));
    instructionIndex = 0;
    buildDots();
    updatePager();
  }


  /**
   * Build clickable dot navigation for the instructions pager.
   */
  function buildDots() {
    if (!insDotsWrap) return;
    insDotsWrap.innerHTML = '';
    instructionPages.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'ins-dot';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Page ${i+1}`);
      dot.setAttribute('aria-selected', i === instructionIndex ? 'true' : 'false');
      dot.addEventListener('click', () => goToPage(i));
      insDotsWrap.appendChild(dot);
    });
  }


  /**
   * Update the pager UI (counter, page visibility, dot selection, prev/next state).
   */
  function updatePager() {
    const total = instructionPages.length || 1;
    const page  = instructionIndex + 1;
    if (insCounter) insCounter.textContent = `Page ${page} of ${total}`;
    instructionPages.forEach((p, i) => p.toggleAttribute('hidden', i !== instructionIndex));
    Array.from(insDotsWrap?.children || []).forEach((dot, i) =>
      dot.setAttribute('aria-selected', i === instructionIndex ? 'true' : 'false')
    );
    if (insPrev) insPrev.disabled = (instructionIndex === 0);
    if (insNext) insNext.disabled = (instructionIndex === total - 1);
  }


  /**
   * Navigate to a specific instruction page index and focus its first focusable.
   */
  function goToPage(i) {
    if (!instructionPages.length) return;
    instructionIndex = Math.max(0, Math.min(i, instructionPages.length - 1));
    updatePager();
    const firstHeading = instructionPages[instructionIndex].querySelector('h1,h2,h3,h4,h5,h6,button,[tabindex]');
    if (firstHeading) firstHeading.focus({ preventScroll: true });
  }


  /**
   * Navigate to the next instruction page.
   */
  function nextPage() { goToPage(instructionIndex + 1); }


  /**
   * Navigate to the previous instruction page.
   */
  function prevPage() { goToPage(instructionIndex - 1); }


  /**
   * Wrap openInstructions to always reset to page 0 even if called externally.
   */
  openInstructions = function() {
    _openInstr();
    goToPage(0);
  };


  // === Group: Settings and audio UI sync ===

  /**
   * When a setting changes during a game, inform the user a restart is required.
   */
  function settingChangeListener() {
    if (window.game) {
      const currentMsgBox = msgEl.querySelector('.msg-box');
      if (currentMsgBox) {
        const currentMsgText = currentMsgBox.textContent || '';
        if (currentMsgText !== 'Setting changed. Click "Start" to begin a new game with this setting.') {
          lastGameMessageBeforeSettings = currentMsgText;
        }
      }

      setMessage('Setting changed. Click "Start" to begin a new game with this setting.');
    }
  }


  /**
   * Sync the audio mute toggle and volume slider text/value with SoundManager.
   */
  function syncAudioUI() {
    if (!audioToggle || !sfx) return;
    audioToggle.setAttribute('aria-pressed', String(sfx.muted));
    audioToggle.textContent = sfx.muted ? '🔇' : '🔊';
    const pct = Math.round((sfx.master ?? 0.8) * 100);
    if (audioVol) {
      audioVol.value = String(pct);
      audioVol.style.setProperty('--vol', pct + '%');
    }
    if (audioVolOut) audioVolOut.textContent = pct + '%';
  }

  /*
  MAIN PROGRAM 
  */

  hide(rollBtn);
  collectPages();
  updateScoreboardView();
  updateFirstPlayerOptions(); 
  showIntro();
  setMessage('Welcome to Tâb! Click Start to begin');
  syncAudioUI();
});
