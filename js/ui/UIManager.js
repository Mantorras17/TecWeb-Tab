/**
 * Handles all DOM manipulation and UI state management
 */
export default class UIManager {
  constructor() {
    this.elements = this.initializeElements();
    this.lastGameMessageBeforeSettings = null;
  }

  initializeElements() {
    return {
      sizeInput: document.getElementById('board-size'),
      intro: document.getElementById('intro-screen'),
      modeScreen: document.getElementById('mode-screen'),
      introStartBtn: document.getElementById('intro-start'),
      boardEl: document.getElementById('board'),
      rollBtn: document.getElementById('throw-sticks'),
      sticksEl: document.getElementById('sticks-result'),
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
      noScoresMsg: document.getElementById('no-scores-msg'),
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
      menuMain: document.getElementById('menu-main'),
      menuLogin: document.getElementById('menu-login'),
      menuSignup: document.getElementById('menu-signup'),
      loginBtn: document.getElementById('btn-login'),
      signupBtn: document.getElementById('btn-signup')
    };
  }

  /**
   * Hide any element by adding 'hidden' and setting display: none.
   */
  hide(el) {
    if (el) { 
      el.classList.add('hidden', 'display-none');
    }
  }

  /**
   * Show any element by removing 'hidden' and restoring display.
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
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn } = this.elements;
    
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
  }

  /**
   * Show the game grid and hide intro/mode screens.
   */
  showGame() {
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn } = this.elements;
    
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
   */
  updateBoardRotation(game) {
    const { boardEl } = this.elements;
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
  buildBoard(game) {
    const { boardEl } = this.elements;
    if (!boardEl || !game) return;
    
    boardEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'board-box';
    const container = document.createElement('div');
    container.className = 'board-container';

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

        const flowClass = (r === 0 || r === 2) ? 'flow-left' : 'flow-right';
        cell.classList.add('flow', flowClass);

        if (r === 0 && c === 0) {
          cell.classList.add('flow-diag-225');
        }
        if (r === 1 && c === game.columns - 1) {
          cell.classList.add('flow-diag-right-both');
        }
        if (r === 2 && c === 0) {
          cell.classList.add('flow-diag-135');
        }
        if (r === 3 && c === game.columns - 1) {
          cell.classList.add('flow-diag-45');
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

  /**
   * Set board disabled state for CPU turns
   */
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

  /**
   * Enable/disable the side panel close button (and sync aria state).
   */
  setCloseBlocked(block) {
    const { closePanelBtn } = this.elements;
    if (!closePanelBtn) return;
    closePanelBtn.disabled = !!block;
    closePanelBtn.setAttribute('aria-disabled', String(!!block));
  }

  /**
   * Open the left side configuration panel.
   */
  openSidePanel() {
    const { sidePanel, menuBtn } = this.elements;
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 100);
  }

  /**
   * Close the left side configuration panel.
   */
  closeSidePanel() {
    const { sidePanel, menuBtn } = this.elements;
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    menuBtn.innerHTML = '&#9776;';
  }

  /**
   * Update the "First Player" select options based on game mode (PvP vs PvC).
   */
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

  /**
   * If the scoreboard panel is open, close it and reset the button icon.
   */
  closeScoreboardPanelIfOpen() {
    const { scoreboardPanel, scoreboardBtn } = this.elements;
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('open');
    if (scoreboardBtn) scoreboardBtn.innerHTML = '🏆';
  }

  /**
   * Ensure scoreboard panel is visible and accessible.
   */
  hardShowScoreboard() {
    const { scoreboardPanel } = this.elements;
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('display-none');
    scoreboardPanel.removeAttribute('aria-hidden');
  }

  /**
   * Open scoreboard panel
   */
  openScoreboardPanel() {
    const { scoreboardPanel, scoreboardBtn } = this.elements;
    if (scoreboardPanel) {
      scoreboardPanel.classList.add('open');
      if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      setTimeout(() => scoreboardPanel.focus(), 100);
    }
  }

  /**
   * Handle setting change during game
   */
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

  /**
   * Restore message before settings change
   */
  restoreMessageBeforeSettings() {
    if (this.lastGameMessageBeforeSettings) {
      this.setMessage(this.lastGameMessageBeforeSettings);
      this.lastGameMessageBeforeSettings = null;
    }
  }

  /**
   * Clear game UI elements for cleanup
   */
  clearGameUI() {
    const { boardEl, sticksEl, rollBtn } = this.elements;
    if (boardEl) boardEl.innerHTML = '';
    if (sticksEl) sticksEl.innerHTML = '';
    this.hide(rollBtn);
    this.hide(sticksEl);
  }

  /**
   * Get UI elements for external access
   */
  getElements() {
    return this.elements;
  }
}