/**
 * Handles all DOM manipulation and UI state management
 */
export default class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.lastGameMessageBeforeSettings = null;
    this.scoreManager = null;
  }

  initializeElements() {
    return {
      sizeInput: document.getElementById('board-size'),
      intro: document.getElementById('intro-screen'),
      modeScreen: document.getElementById('mode-screen'),
      introStartBtn: document.getElementById('intro-start'),
      boardEl: document.getElementById('board'),
      rollBtn: document.getElementById('throw-sticks'),
      sticksEl: document.getElementById('sticks-canvas'),
      startSideBtn: document.getElementById('start-game'),
      quitBtn: document.getElementById('quit-game'),
      msgEl: document.getElementById('messages'),
      instrOpen: document.getElementById('show-instructions'),
      instrPanel: document.getElementById('instructions'),
      menuBtn: document.getElementById('menu-btn'),
      sidePanel: document.getElementById('sidePanel'),
      openSidePanelBtn: document.getElementById('open-sidepanel'),
      scoreboardBtn: document.getElementById('scoreboard-btn'),
      scoreboardPanel: document.getElementById('scoreboard-panel'),
      mainGrid: document.getElementById('main-grid'),
      firstPlayerInput: document.getElementById('first-player'),
      gameModeInput: document.getElementById('game-mode'),
      difficultyInput: document.getElementById('difficulty'),
      closePanelBtn: document.getElementById('closePanel'),
      scoreboardBody: document.getElementById('scoreboard-body'),
      modalOverlay: document.getElementById('modal-overlay'),
      modalTitle: document.getElementById('modal-title'),
      modalText: document.getElementById('modal-text'),
      modalConfirm: document.getElementById('modal-confirm'),
      modalCancel: document.getElementById('modal-cancel'),
      instrScrim: document.getElementById('instructions-scrim'),
      insPagesWrap: document.getElementById('ins-pages'),
      insCounter: document.getElementById('ins-counter'),
      insDotsWrap: document.getElementById('ins-dots'),
      insPrev: document.getElementById('ins-prev'),
      insNext: document.getElementById('ins-next'),
      userAvatar: document.getElementById('user-avatar'),
      userMenu: document.getElementById('user-menu'),
      userIdSpan: document.getElementById('user-id'),
      menuMain: document.getElementById('menu-main'),
      menuLogin: document.getElementById('menu-login'),
      menuSignup: document.getElementById('menu-signup'),
      loginBtn: document.getElementById('btn-login'),
      signupBtn: document.getElementById('btn-signup'),
      passTurnBtn: document.getElementById('pass-turn'),
    };
  }

  /**
   * Hide any element by adding 'hidden' and setting display: none via class.
   */
  hide(el) {
    if (el) { 
      el.classList.add('hidden', 'display-none');
    }
  }

  /**
   * Show any element by removing 'hidden' and restoring display via class.
   */
  show(el) {
    if (el) {
      el.classList.remove('hidden', 'display-none');
    }
  }

  /**
   * Show intro screen and hide the game grid.
   */
  showIntro() {
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn, passTurnBtn } = this.elements;
    
    if (intro) {
      this.show(intro);
      intro.removeAttribute('hidden');
    }
    if (modeScreen) {
      this.hide(modeScreen);
      modeScreen.setAttribute('hidden', '');
    }
    if (mainGrid) {
      mainGrid.classList.add('hidden');
      mainGrid.classList.remove('visible');
    }
    this.hide(menuBtn);
    this.hide(rollBtn);
    this.hide(passTurnBtn);
  }

  /**
   * Show the game grid and hide intro/mode screens.
   */
  showGame() {
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn, passTurnBtn } = this.elements;
    
    if (intro) {
      this.hide(intro);
      intro.setAttribute('hidden', '');
    }
    if (modeScreen) {
      this.hide(modeScreen);
      modeScreen.setAttribute('hidden', '');
    }
    if (mainGrid) {
      mainGrid.classList.remove('hidden');
      mainGrid.classList.add('visible');
    }
    this.show(menuBtn);    
    this.hide(rollBtn);
    this.hide(passTurnBtn);
  }

  /**
   * Set the single-line status message displayed to the player(s).
   */
  setMessage(text) {
    const { msgEl } = this.elements;
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }

  /**
   * Enable/disable the roll button based on current turn and state.
   */
  updateRollBtn(enabled) {
    const { rollBtn } = this.elements;
    if (!rollBtn) return;
    rollBtn.disabled = !enabled;
    rollBtn.setAttribute('aria-disabled', String(!enabled));
  }

  /**
   * Update board rotation (PvP only) so current player sees their side upright.
   * - Online: Rotates if i am player 2, regardless of turn.
   */
  updateBoardRotation(game, forceRotate = null) {
    const { boardEl } = this.elements;
    if (!game || !boardEl) return;

    const boardBox = boardEl.querySelector('.board-box');
    if (!boardBox) return;

    let shouldRotate = false;
    if (game.isOnline) {
      shouldRotate = !!forceRotate;
    } else {
      if (game.isVsPlayer && game.curPlayerIdx === 1) {
        shouldRotate = true;
      }
    }

    if (shouldRotate) {
      boardBox.classList.add('rotated');
    } else {
      boardBox.classList.remove('rotated');
    }
  }

  /**
   * Build the board DOM (cells and any pieces on them) from game state.
   */
  buildBoard(game) {
    const { boardEl } = this.elements;
    if (!boardEl || !game) return;
    
    let box = boardEl.querySelector('.board-box');
    if (!box) {
        box = document.createElement('div');
        box.className = 'board-box';
        boardEl.appendChild(box);
    }
    box.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'board-container';

    const getSkinClass = (p) => {
      if (p.skin === 'blue') return 'p1';
      if (p.skin === 'red') return 'p2';
      return (p.name === 'player1') ? 'p1' : 'p2';
    };

    for (let r = 0; r < game.rows; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'board-row';
      
      for (let c = 0; c < game.columns; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);
        
        const flowClass = (r === 0 || r === 2) ? 'flow-left' : 'flow-right';
        cell.classList.add('flow', flowClass);
        if (r === 0 && c === 0) cell.classList.add('flow-diag-225');
        if (r === 1 && c === game.columns - 1) cell.classList.add('flow-diag-right-both');
        if (r === 2 && c === 0) cell.classList.add('flow-diag-135');
        if (r === 3 && c === game.columns - 1) cell.classList.add('flow-diag-45');

        const p1 = game.players[0];
        const p2 = game.players[1];
        
        let piece = p1.getPieceAt(r, c);
        let owner = p1;
        
        if (!piece) {
            piece = p2.getPieceAt(r, c);
            owner = p2;
        }

        if (piece) {
          const pieceDiv = document.createElement('div');
          const skin = getSkinClass(owner);
          
          pieceDiv.className = `piece ${skin} ${piece.state}`;
          pieceDiv.title = `${owner.name} (${piece.state})`;
          cell.appendChild(pieceDiv);
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
  }

  /**
   * Highlight selectable pieces and legal move targets for the current selection.
   */
  updateBoardHighlights(game) {
    const { boardEl } = this.elements;
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

  setBoardDisabled(disabled) {
    const { boardEl } = this.elements;
    if (boardEl) {
      if (disabled) {
        boardEl.classList.add('disabled-board');
      } else {
        boardEl.classList.remove('disabled-board');
      }
    }
  }

  setCloseBlocked(block) {
    const { closePanelBtn } = this.elements;
    if (!closePanelBtn) return;
    // Keep the close button clickable at all times but reflect the blocked
    // state visually and for assistive tech via aria-disabled.
    if (block) closePanelBtn.classList.add('close-blocked');
    else closePanelBtn.classList.remove('close-blocked');
    closePanelBtn.setAttribute('aria-disabled', String(!!block));
  }

  openSidePanel() {
    const { sidePanel, menuBtn } = this.elements;
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 100);
  }

  closeSidePanel() {
    const { sidePanel, menuBtn } = this.elements;
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    menuBtn.innerHTML = '&#9776;';
  }

  updateFirstPlayerOptions() {
    const { gameModeInput, firstPlayerInput } = this.elements;
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

  closeScoreboardPanelIfOpen() {
    const { scoreboardPanel, scoreboardBtn } = this.elements;
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('open');
    if (scoreboardBtn) scoreboardBtn.innerHTML = '🏆';
  }

  hardShowScoreboard() {
    const { scoreboardPanel } = this.elements;
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('display-none');
    scoreboardPanel.removeAttribute('aria-hidden');
  }

  openScoreboardPanel(boardSize) {
    this.hardShowScoreboard();
    this.scoreManager.updateScoreboardView();
    this.scoreManager.loadOnlineRanking(boardSize);
  }

  handleSettingChange() {
    const { msgEl } = this.elements;
    if (window.game) {
      const currentMsgBox = msgEl.querySelector('.msg-box');
      if (currentMsgBox) {
        const currentMsgText = currentMsgBox.textContent || '';
        if (currentMsgText !== 'Setting changed. Click "Start" to begin a new game with this setting.') {
          this.lastGameMessageBeforeSettings = currentMsgText;
        }
      }
      this.setMessage('Setting changed. Click "Start" to begin a new game with this setting.');
    }
  }

  restoreMessageBeforeSettings() {
    if (this.lastGameMessageBeforeSettings) {
      this.setMessage(this.lastGameMessageBeforeSettings);
      this.lastGameMessageBeforeSettings = null;
    }
  }

  clearGameUI() {
    const { boardEl, sticksEl, rollBtn, passTurnBtn } = this.elements;
    if (boardEl) boardEl.innerHTML = '';
    if (sticksEl) sticksEl.innerHTML = '';
    this.hide(rollBtn);
    this.hide(sticksEl);
    this.hide(passTurnBtn);
  }

  getElements() {
    return this.elements;
  }

  /**
   * Enable or disable the Pass Turn button.
   * Logic for opacity/cursor is now handled by CSS based on classes/disabled state.
   */
  updatePassBtn(enabled) {
    const { passTurnBtn } = this.elements;
    
    if (!passTurnBtn) {
        console.warn("Pass Turn button not found in DOM");
        return;
    }
    
    passTurnBtn.disabled = !enabled;
    
    if (enabled) {
      passTurnBtn.classList.remove('btn-ghost');
      passTurnBtn.classList.add('btn-primary');
    } else {
      passTurnBtn.classList.remove('btn-primary');
      passTurnBtn.classList.add('btn-ghost');
    }
  }
}