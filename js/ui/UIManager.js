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
      signupBtn: document.getElementById('btn-signup'),
      passTurnBtn: document.getElementById('pass-turn'),
    };
  }

  hide(el) { if (el) el.classList.add('hidden', 'display-none'); }
  show(el) { if (el) el.classList.remove('hidden', 'display-none'); }

  showIntro() {
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn, passTurnBtn } = this.elements;
    if (intro) { this.show(intro); intro.removeAttribute('hidden'); }
    if (modeScreen) { this.hide(modeScreen); modeScreen.setAttribute('hidden', ''); }
    if (mainGrid) { mainGrid.classList.add('hidden'); mainGrid.classList.remove('visible'); }
    this.hide(menuBtn); this.hide(rollBtn); this.hide(passTurnBtn);
  }

  showGame() {
    const { intro, modeScreen, mainGrid, menuBtn, rollBtn, passTurnBtn } = this.elements;
    if (intro) { this.hide(intro); intro.setAttribute('hidden', ''); }
    if (modeScreen) { this.hide(modeScreen); modeScreen.setAttribute('hidden', ''); }
    if (mainGrid) { mainGrid.classList.remove('hidden'); mainGrid.classList.add('visible'); }
    this.show(menuBtn); this.hide(rollBtn); this.hide(passTurnBtn);
  }

  setMessage(text) {
    const { msgEl } = this.elements;
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }

  updateRollBtn(enabled) {
    const { rollBtn } = this.elements;
    if (!rollBtn) return;
    rollBtn.disabled = !enabled;
    rollBtn.setAttribute('aria-disabled', String(!enabled));
  }

  updateBoardRotation(game) {
    const { boardEl } = this.elements;
    if (!boardEl) return;
    const boardBox = boardEl.querySelector('.board-box');
    if (boardBox) {
        boardBox.style.transform = 'none';
        boardBox.classList.remove('rotated');
    }
  }

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

    const mePlayer = game.getCurrentPlayer();
    const oppPlayer = game.getOpponentPlayer();
    const meSkin = (mePlayer.name === 'player1') ? 'p1' : 'p2';
    const oppSkin = (oppPlayer.name === 'player1') ? 'p1' : 'p2';

    const currentPlayerName = game.getCurrentPlayer().name;
    
    // --- FIX START ---
    // We removed 'cpu' from here. Now the board only rotates for Player 2 (PvP).
    // The CPU will always see the board from the standard (Player 1) perspective.
    const isRotated = (currentPlayerName === 'player2');
    // --- FIX END ---

    for (let vR = 0; vR < game.rows; vR++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'board-row';
      
      for (let vC = 0; vC < game.columns; vC++) {
        
        let logicR = vR;
        let logicC = vC;

        if (isRotated) {
            logicR = (game.rows - 1) - vR;
            logicC = (game.columns - 1) - vC;
        }

        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        cell.dataset.row = String(logicR);
        cell.dataset.col = String(logicC);

        const flowClass = (vR === 0 || vR === 2) ? 'flow-left' : 'flow-right';
        cell.classList.add('flow', flowClass);

        // --- ARROWS SETUP ---
        if (vR === 0 && vC === 0) {
          cell.classList.add('flow-diag-225');
        }
        if (vR === 1 && vC === game.columns - 1) {
          cell.classList.add('flow-diag-right-both');
        }
        if (vR === 2 && vC === 0) {
          cell.classList.add('flow-diag-135'); 
        }
        if (vR === 3 && vC === game.columns - 1) {
          cell.classList.add('flow-diag-45');
        }

        const me = mePlayer.getPieceAt(logicR, logicC);
        const opp = oppPlayer.getPieceAt(logicR, logicC);

        if (me || opp) {
          const piece = document.createElement('div');
          piece.className = 'piece ' + (me ? meSkin : oppSkin) + ' ' + (me || opp).state;
          piece.title = `${me ? mePlayer.name : oppPlayer.name} (${(me || opp).state})`;
          cell.appendChild(piece);
        }
        rowDiv.appendChild(cell);
      }
      container.appendChild(rowDiv);
      
      if (vR < game.rows - 1) {
        const sep = document.createElement('div');
        sep.className = 'row-sep';
        container.appendChild(sep);
      }
    }
    box.appendChild(container);
  }

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
      if (disabled) boardEl.classList.add('disabled-board');
      else boardEl.classList.remove('disabled-board');
    }
  }

  setCloseBlocked(block) {
    const { closePanelBtn } = this.elements;
    if (!closePanelBtn) return;
    closePanelBtn.disabled = !!block;
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
      options = [{ value: 'player1', text: 'Player 1' }, { value: 'player2', text: 'Player 2' }];
    } else {
      options = [{ value: 'player1', text: 'Player 1' }, { value: 'cpu', text: 'Computer (Player 2)' }];
    }
    
    options.forEach(opt => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.text;
      firstPlayerInput.appendChild(optionEl);
    });
    
    if (currentFirstPlayer === 'player1') firstPlayerInput.value = 'player1';
    else if (selectedMode === 'pvp' && currentFirstPlayer === 'cpu') firstPlayerInput.value = 'player2';
    else if (selectedMode === 'pvc' && currentFirstPlayer === 'player2') firstPlayerInput.value = 'cpu';
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

  openScoreboardPanel() {
    const { scoreboardPanel, scoreboardBtn } = this.elements;
    if (scoreboardPanel) {
      scoreboardPanel.classList.add('open');
      if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      setTimeout(() => scoreboardPanel.focus(), 100);
    }
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
    const { boardEl, sticksEl, rollBtn } = this.elements;
    if (boardEl) boardEl.innerHTML = '';
    if (sticksEl) sticksEl.innerHTML = '';
    this.hide(rollBtn);
    this.hide(sticksEl);
  }

  getElements() { return this.elements; }

  updatePassBtn(enabled) {
    const { passTurnBtn } = this.elements;
    if (!passTurnBtn) return;
    passTurnBtn.disabled = !enabled;
    if (enabled) {
      passTurnBtn.classList.remove('btn-ghost');
      passTurnBtn.classList.add('btn-primary');
      passTurnBtn.style.opacity = "1";
      passTurnBtn.style.cursor = "pointer";
    } else {
      passTurnBtn.classList.remove('btn-primary');
      passTurnBtn.classList.add('btn-ghost');
      passTurnBtn.style.opacity = "0.5";
      passTurnBtn.style.cursor = "not-allowed";
    }
  }
}