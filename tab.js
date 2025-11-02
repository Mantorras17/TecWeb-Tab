class Graph {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.adj = Array.from({ length: rows * cols }, () => new Set());
  }

  coordToId(row, col) {
    return row * this.cols + col;
  }

  idToCoord(id) {
    return {
      row: Math.floor(id / this.cols),
      col: id % this.cols
    };
  }

  inBounds(row, col) {
    return (row >= 0) && (row < this.rows) && (col >= 0) && (col < this.cols);
  }

  addEdgeId(fromId, toId) {
    this.adj[fromId].add(toId);
  }

  addEdgeRC(fromRow, fromCol, toRow, toCol) {
    if (!this.inBounds(fromRow, fromCol) || !this.inBounds(toRow, toCol)) return;
    this.addEdgeId(this.coordToId(fromRow, fromCol), this.coordToId(toRow, toCol));
  }

  neighborsId(id) {
    return Array.from(this.adj[id] || []);
  }

  neighborsRC(row, col) {
    const id = this.coordToId(row, col);
    return this.neighborsId(id).map(nid => this.idToCoord(nid));
  }

  kStepId(startId, k) {
    let options = new Set([startId]);
    // CORRIGIDO: O 'cons' e 'for' estavam misturados no merge
    for (let i = 0; i < k; i++) { 
      const next = new Set();
      options.forEach(id => this.neighborsId(id).forEach(n => next.add(n)));
      options = next;
      if (options.size === 0) break;
    }
    return options;
  }

  kStepRC(startRow, startCol, k) {
    const ids = this.kStepId(this.coordToId(startRow, startCol), k);
    return Array.from(ids).map(id => this.idToCoord(id));
  }
}



class Piece {
  constructor(owner, row, col) {
    this.owner = owner;
    this.row = row;
    this.col = col;
    this.state = 'not-moved'; // 'not-moved' || 'first-row' || 'moved' || 'last-row'
  }

  moveTo(newRow, newCol) {
    this.row = newRow;
    this.col = newCol;

    const firstRow = this.owner.startRow;
    const lastRow = this.calculateLastRow();

    if (newRow === lastRow) {
      this.state = 'last-row';
      return;
    }
    if (newRow === firstRow) {
      this.state = 'first-row';
      return;
    }
    if (this.state === 'not-moved') {
      this.state = 'moved';
    } else if (this.state === 'first-row' && newRow !== firstRow) {
      this.state = 'moved';
    }
  }

  canMoveFirst(sticks) {
    return !(this.state === 'not-moved' && sticks !== 1);
  }

  canVisitLastRow() {
    if (this.state === 'last-row') return false;
    const startRow = this.owner.startRow;
    return !this.owner.pieces.some(p => p !== this && p.row === startRow);
  }

  calculateLastRow() {
    return 3 - this.owner.startRow;
  }
}



class Player {
  constructor(name, skin, startRow) {
    this.name = name;
    this.skin = skin;
    this.pieces = [];
    this.startRow = startRow;
  }

  addPiece(newPiece) {
    this.pieces.push(newPiece);
  }

  removePiece(piece) {
    const idx = this.pieces.indexOf(piece);
    if (idx > -1) {
      this.pieces.splice(idx, 1);
    }
  }

  getPieceAt(row, col) {
    return this.pieces.find(piece => piece.row === row && piece.col === col);
  }

  getPiecesByState(state) {
    return this.pieces.filter(piece => piece.state === state);
  }

  hasLost() {
    return this.pieces.length === 0;
  }
}



class Board {
  constructor(rows, cols) {
    this.rows = rows;
    this.cols = cols;
    this.graph = new Graph(rows, cols);
    this.buildPath();
  }

  buildPath() {
    const g = this.graph;
    for (let c = 0; c < this.cols; c++) {
      if (c > 0) g.addEdgeRC(0, c, 0, c - 1);
      else g.addEdgeRC(0, 0, 1, 0);

      if (c < this.cols - 1) g.addEdgeRC(1, c, 1, c + 1);
      else {
        g.addEdgeRC(1, c, 0, c); // up to row 0
        g.addEdgeRC(1, c, 2, c); // down to row 2
      }

      if (c > 0) g.addEdgeRC(2, c, 2, c - 1);
      else g.addEdgeRC(2, 0, 1, 0);

      if (c < this.cols - 1) g.addEdgeRC(3, c, 3, c + 1);
      else g.addEdgeRC(3, c, 2, c);
    }
  }
}




class TabGame {
  constructor(columns = 9) {
    this.columns = columns;
    this.rows = 4;
    this.board = new Board(this.rows, this.columns);
    this.players = this.initPlayers();
    this.curPlayerIdx = 0;
    this.stickValue = null;
    this.lastStickValue = null;
    this.selectedPiece = null;
    this.selectedMoves = [];
    this.extraTurns = [1, 4, 6];
    
    // --- MERGE ---
    this.lastSticks = [0, 0, 0, 0];  // From HEAD (para animação)
    this.over = false;              // From main (para lógica de jogo)
    this.winner = null;           // From main (para lógica de jogo)
    // --- FIM MERGE ---
  }

  initPlayers() {
    // Da tua lógica 'main' (correta)
    const player = new Player('player1', 'blue', 3);
    const cpu = new Player('cpu', 'red', 0);

    for (let col = 0; col < this.columns; col++) {
      const playerPiece = new Piece(player, 3, col);
      const cpuPiece = new Piece(cpu, 0, col);
      player.addPiece(playerPiece);
      cpu.addPiece(cpuPiece);
    }
    return [player, cpu];
  }

  throwSticks() {
    const sticks = Array.from({ length: 4 }, () => Math.random() < 0.5 ? 0 : 1);
    const sum = sticks.reduce((a, b) => a + b, 0);
    const value = (sum === 0) ? 6 : sum;
    this.stickValue = value;
    this.lastStickValue = value;
    this.lastSticks = sticks; // <-- Adicionado do 'HEAD'
    return { sticks, value };
  }

  getCurrentPlayer() {
    return this.players[this.curPlayerIdx];
  }

  getOpponentPlayer() {
    return this.players[1 - this.curPlayerIdx];
  }

  isCellOccupied(row, col) {
    const me = this.getCurrentPlayer().getPieceAt(row, col);
    if (me) return { piece: me, owner: 'me' };
    const opp = this.getOpponentPlayer().getPieceAt(row, col);
    if (opp) return { piece: opp, owner: 'opponent' };
    return null;
  }

  canUseLastRow(player = this.getCurrentPlayer()) {
    const startRow = player.startRow;
    return !player.pieces.some(p => p.row === startRow);
  }

  possibleMoves(piece, sticks) {
    if (!piece.canMoveFirst(sticks)) return [];
    const graph = this.board.graph;
    const startId = graph.coordToId(piece.row, piece.col);
    const lastLine = piece.calculateLastRow();
    const startRow = piece.owner.startRow; // <-- Lógica do 'main'

    let frontier = new Set([startId]);
    for (let step = 0; step < sticks; step++) {
      const next = new Set();
      frontier.forEach(id => {
        const from = graph.idToCoord(id);
        graph.neighborsId(id).forEach(nid => {
          const to = graph.idToCoord(nid);
          // Lógica do 'main' (correção de bug)
          const enteringStartRow = (from.row !== startRow) && (to.row === startRow);
          if (enteringStartRow) return;
          const enteringLastRow = (from.row !== lastLine) && (to.row === lastLine);
          if (enteringLastRow && !piece.canVisitLastRow()) return;
          if (enteringLastRow && piece.state === 'last-row') return;
          next.add(nid);
        });
      });
      frontier = next;
      if (frontier.size === 0) break;
    }
    const coords = Array.from(frontier).map(id => graph.idToCoord(id));
    return coords.filter(({ row, col }) => {
      const occ = this.isCellOccupied(row, col);
      return !(occ && occ.owner === 'me');
    });
  }

  getAllLegalMoves() {
    if (this.stickValue == null) return [];
    const moves = [];
    for (const piece of this.getCurrentPlayer().pieces) {
      if (!piece.canMoveFirst(this.stickValue)) continue;
      const dests = this.possibleMoves(piece, this.stickValue);
      if (dests.length) moves.push({ piece, moves: dests });
    }
    return moves;
  }

  hasAnyLegalMove() {
    return this.getAllLegalMoves().length > 0;
  }

  // Função "silenciosa" do 'main' (correta)
  autoSkipIfNoMoves() {
    if (this.stickValue != null && !this.hasAnyLegalMove()) {
      const keepTurn = this.playAgain(); 
      
      if (keepTurn) {
        this.endTurn(true); // keepTurn = true
      } else {
        this.endTurn(false); // keepTurn = false
      }
      return true; // Sim, saltámos a jogada.
    }
    return false; // Não saltou, existem jogadas.
  }

  selectPieceAt(row, col) {
    const piece = this.getCurrentPlayer().getPieceAt(row, col);
    if (!piece) return [];
    if (this.stickValue === null) return [];
    if (!piece.canMoveFirst(this.stickValue)) return [];
    this.selectedPiece = piece;
    this.selectedMoves = this.possibleMoves(piece, this.stickValue);
    return this.getSelectedMoves();
  }

  selectOrMoveAt(row, col) {
    const piece = this.getCurrentPlayer().getPieceAt(row, col);
    if (piece) {
      const moves = this.selectPieceAt(row, col);
      return moves.length > 0;
    }
    if (!this.selectedPiece) return false;
    return this.moveSelectedTo(row, col);
  }

  // Função 'movePiece' do 'main' (corrigida)
  movePiece(piece, toRow, toCol) {
    if (this.over) return false; 
    if (!piece || this.stickValue == null) return false;
    if (piece.owner !== this.getCurrentPlayer()) return false;
    const legal = this.possibleMoves(piece, this.stickValue);
    const ok = legal.some(p => p.row === toRow && p.col === toCol);
    if (!ok) return false;
    const occ = this.isCellOccupied(toRow, toCol);
    if (occ && occ.owner === 'opponent') this.handleCapture(occ.piece);
    else if (occ && occ.owner === 'me') return false;
    piece.moveTo(toRow, toCol);
    this.clearSelection();
    if (this.checkGameOver().over) return true;
    const again = this.playAgain();
    this.endTurn(again);
    return true;
  }

  getSelectedMoves() {
    return this.selectedMoves.slice();
  }

  clearSelection() {
    this.selectedPiece = null;
    this.selectedMoves = [];
  }

  handleCapture(capturedPiece) {
    this.getOpponentPlayer().removePiece(capturedPiece);
    this.checkGameOver(); // Correção do 'main'
  }

  // Função "silenciosa" do 'main' (correta)
  moveSelectedTo(row, col) {
    if (this.over) return false;
    const piece = this.selectedPiece;
    if (!piece) return false;
    const allowed = this.selectedMoves.some(p => p.row === row && p.col === col);
    if (!allowed) return false;

    const occ = this.isCellOccupied(row, col);
    if (occ && occ.owner === 'opponent') {
      this.handleCapture(occ.piece);
    }
    else if (occ && occ.owner === 'me') return false;
    
    piece.moveTo(row, col);
    this.clearSelection();
    
    if (this.checkGameOver().over) return true;
    
    const playAgain = this.playAgain();
    this.endTurn(playAgain);
    return true; // Retorna 'true' para indicar que a jogada foi um sucesso
  }

  startTurn(sticks = null) {
    if (this.over) return null;
    if (sticks == null) this.throwSticks();
    else {
      this.stickValue = sticks;
      this.lastStickValue = sticks;
    }
    return this.stickValue;
  }

  playAgain() {
    return this.extraTurns.includes(this.lastStickValue);
  }

  endTurn(keepTurn = false) {
    if (this.over) return;
    this.stickValue = null;
    if (!keepTurn) this.curPlayerIdx = 1 - this.curPlayerIdx;
  }

  // Função 'checkGameOver' do 'main' (corrigida)
  checkGameOver() {
    if (this.over) return { over: true, winner: this.winner };
    
    const p0Lost = this.players[0].hasLost();
    const p1Lost = this.players[1].hasLost();
    if (p0Lost || p1Lost) {
      this.over = true;
      this.winner = p0Lost ? this.players[1] : this.players[0];
      this.stickValue = null;
      this.clearSelection();
      return { over: true, winner: this.winner };
    }
    return { over: false, winner: null };
  }

  // Funções de IA (CPU) - copiadas do 'main' (faltavam no 'HEAD')
  cpuMoveRandom() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      this.autoSkipIfNoMoves();
      return false;
    }
    const { piece, moves } = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    const move = moves[Math.floor(Math.random() * moves.length)];
    this.selectedPiece = piece;
    this.selectedMoves = moves;
    this.moveSelectedTo(move.row, move.col);
    return true;
  }

  cpuMoveHeuristic() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      this.autoSkipIfNoMoves();
      return false;
    }
    let bestScore = -Infinity;
    let bestMoves = [];
    for (const { piece, moves } of legalMoves) {
      for (const move of moves) {
        let score = 0;
        const occ = this.isCellOccupied(move.row, move.col);
        if (occ && occ.owner === 'opponent') score += 10;
        if (piece.state === 'not-moved') score += 1;
        if (piece.row === piece.owner.startRow) score += 0.5;

        if (score > bestScore) {
          bestScore = score;
          bestMoves = [{ piece, move }];
        } else if (score === bestScore) {
          bestMoves.push({ piece, move });
        }
      }
    }
    const { piece, move } = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    this.selectedPiece = piece;
    this.selectedMoves = this.possibleMoves(piece, this.lastStickValue);
    this.moveSelectedTo(move.row, move.col);
    return true;
  }

  cpuMove() {
    if (this.difficultyLevel === 0) {
      return this.cpuMoveRandom();
    }
    if (this.difficultyLevel === 1) {
      return this.cpuMoveHeuristic();
    }
    if (this.difficultyLevel === 2) {
      return this.cpuMoveMinimax();
    }
    return this.cpuMoveRandom();
  }

  evaluateBoard() {
    const me = this.getCurrentPlayer();
    const opponent = this.getOpponentPlayer();
    const gameOverState = this.checkGameOver();
    if (gameOverState.over) {
      return (gameOverState.winner.name === me.name) ? Infinity : -Infinity;
    }
    let score = 0;
    score += me.pieces.length * 100;
    score -= opponent.pieces.length * 100;
    for (const piece of me.pieces) {
      if (piece.state === 'last-row') score += 20; 
      else if (piece.state !== 'not-moved') score += 5; 
    }
    for (const piece of opponent.pieces) {
      if (piece.state === 'last-row') score -= 20;
      else if (piece.state !== 'not-moved') score -= 5;
    }
    return score;
  }

  minimax(depth, isMaximizingPlayer) {
    if (depth === 0 || this.checkGameOver().over) {
      return this.evaluateBoard();
    }
    const rolls = [
      { value: 1, prob: 0.25 },  // Tâb
      { value: 2, prob: 0.38 },  // Itneyn
      { value: 3, prob: 0.25 },  // Teláteh
      { value: 4, prob: 0.06 },  // Arba'ah
      { value: 6, prob: 0.06 }   // Sitteh
    ];
    let expectedValue = 0;
    for (const roll of rolls) {
      let bestScoreForThisRoll = isMaximizingPlayer ? -Infinity : +Infinity;
      const allMoves = [];
      for (const piece of this.getCurrentPlayer().pieces) {
        if (!piece.canMoveFirst(roll.value)) continue;
        const dests = this.possibleMoves(piece, roll.value);
        if (dests.length) allMoves.push({ piece, moves: dests });
      }
      if (allMoves.length === 0) {
        bestScoreForThisRoll = this.evaluateBoard();
      } else {
        for (const { piece, moves } of allMoves) {
          for (const move of moves) {
            const fromRow = piece.row, fromCol = piece.col, fromState = piece.state;
            const occ = this.isCellOccupied(move.row, move.col);
            let captured = null;
            if (occ && occ.owner === 'opponent') {
              captured = occ.piece;
              this.getOpponentPlayer().removePiece(captured);
            }
            piece.moveTo(move.row, move.col);
            const playsAgain = [1, 4, 6].includes(roll.value); 
            const evaluation = this.minimax(depth - 1, playsAgain ? isMaximizingPlayer : !isMaximizingPlayer);
            piece.row = fromRow; piece.col = fromCol; piece.state = fromState;
            if (captured) this.getOpponentPlayer().addPiece(captured);
            if (isMaximizingPlayer) {
              bestScoreForThisRoll = Math.max(bestScoreForThisRoll, evaluation);
            } else {
              bestScoreForThisRoll = Math.min(bestScoreForThisRoll, evaluation);
            }
          }
        }
      }
      expectedValue += bestScoreForThisRoll * roll.prob;
    }
    return expectedValue;
  }

  cpuMoveMinimax() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      return this.autoSkipIfNoMoves();
    }
    let bestScore = -Infinity;
    let bestMove = null;
    const DEPTH = 2; 
    for (const { piece, moves } of legalMoves) {
      for (const move of moves) {
        const fromRow = piece.row, fromCol = piece.col, fromState = piece.state;
        const occ = this.isCellOccupied(move.row, move.col);
        let captured = null;
        if (occ && occ.owner === 'opponent') {
          captured = occ.piece;
          this.getOpponentPlayer().removePiece(captured);
        }
        piece.moveTo(move.row, move.col);
        const playAgain = this.playAgain();
        let score = this.minimax(DEPTH, playAgain);
        piece.row = fromRow; piece.col = fromCol; piece.state = fromState;
        if (captured) this.getOpponentPlayer().addPiece(captured);
        if (score > bestScore) {
          bestScore = score;
          bestMove = { piece, move };
        }
      }
    }
    if (bestMove) {
      this.selectedPiece = bestMove.piece;
      this.selectedMoves = this.possibleMoves(bestMove.piece, this.lastStickValue);
      this.moveSelectedTo(bestMove.move.row, bestMove.move.col);
      return true;
    }
    return this.cpuMoveRandom();
  }
}

// =================================================================
// INÍCIO DA LÓGICA DA INTERFACE (UI)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
  const sizeInput = document.getElementById('board-size');
  
  // Variáveis globais do 'main'
  let game;
  window.game = null;
  let cpuBusy = false;
  let cpuRolledOnce = false;
  let cpuTimer = null;
  let messageTimer = null;

  // Scoreboard a 3 do 'main'
  let scores = {
    player1: { wins: 0, losses: 0, name: 'Player 1' },
    player2: { wins: 0, losses: 0, name: 'Player 2' },
    cpu:     { wins: 0, losses: 0, name: 'Computer' }
  };

  // --- MERGE: Variáveis de ambos os 'branches' ---
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
  const instrClose = document.getElementById('close-instructions');
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
  const scoreboardBody = document.getElementById('scoreboard-body'); // Do 'main'
  const noScoresMsg = document.getElementById('no-scores-msg'); // Do 'main'
  const sticksUI = { busy: false, queue: [] }; // Do 'HEAD' (animação)

    // --- Close button blocker ---
  function setCloseBlocked(block) {
    if (!closePanelBtn) return;
    closePanelBtn.disabled = !!block;
    closePanelBtn.setAttribute('aria-disabled', String(!!block));
  }

  // === Global timing (slower pacing) ===
  const TIMING = {
    // Sticks flip animation + any code that waits for that reveal
    flipAnimMs: 1100,        // was 600

    // CPU pacing
    cpuStartMs: 1200,        // was 100 / 2000 (normalize both)
    cpuThinkMs: 2500,        // was 1600
    cpuAfterPlayMs: 2500,    // was 800/1400/1800 in places (normalize)
    cpuChainMs: 1200,        // was 100

    // Human → CPU handoff delay after your move
    humanToCpuMs: 4000,      // was 1000

    // Messaging tweaks
    skipMsgDelayMs: 1000,    // already 1000, keep
    pvpPromptDelayMs: 2200,  // was 1500
  };

  function sticksToGrey(delayMs = 0) {
    setTimeout(() => renderSticks(null, { force: true, animate: false }), delayMs);
  }

  function closeScoreboardPanelIfOpen() {
    if (!scoreboardPanel) return;
    scoreboardPanel.classList.remove('open');
    if (scoreboardBtn) scoreboardBtn.innerHTML = '🏆';
  }
  
  // put near your other helpers
function hardHideScoreboard() {
  if (!scoreboardPanel || !scoreboardBtn) return;
  scoreboardPanel.classList.remove('open');   // ensure closed
  scoreboardPanel.style.display = 'none';     // fully remove from layout/visibility
  scoreboardPanel.setAttribute('aria-hidden', 'true');
  scoreboardBtn.innerHTML = '🏆';
}
function hardShowScoreboard() {
  if (!scoreboardPanel) return;
  scoreboardPanel.style.display = '';         // bring it back when the game UI is visible
  scoreboardPanel.removeAttribute('aria-hidden');
}


  // --- Helpers do 'HEAD' (animação) ---
  function hide(el){ if(el){ el.classList.add('hidden'); el.style.display = 'none'; } }
  function show(el){ if(el){ el.classList.remove('hidden'); el.style.display = ''; } }

  hide(rollBtn); // Oculta o botão no início

  function queueAfterFlip(cb, delay = 0) {
    if (!sticksUI.busy) {
      setTimeout(cb, delay);
      return;
    }
    sticksUI.queue.push(() => setTimeout(cb, delay));
  }
  
  function msgAfterFlip(text, delay = 0) {
    queueAfterFlip(() => setMessage(text), delay);
  }
  
  // Helpers do 'main' (lógica)
  function setMessage(text) {
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }
  
  // --- MERGE: `canPlayerRoll` (do 'HEAD') corrigido para PvP/PvC ---
  function canPlayerRoll() {
    if (!game) return false;
    if (sticksUI.busy) return false; // Animação a decorrer
    const cur = game.getCurrentPlayer();
    if (!cur) return false;
    if (cur.name === 'cpu') return false; // Bloqueia CPU
    return game.stickValue == null; // Permite 'player1' e 'player2' se não tiverem rolado
  }
  
  // Helper do 'HEAD'
  function updateRollBtn() {
    if (!rollBtn) return;
    const enabled = canPlayerRoll();
    rollBtn.disabled = !enabled;
    rollBtn.setAttribute('aria-disabled', String(!enabled));
  }

  // --- MERGE: `openSidePanel` (largura do 'HEAD') ---
  function openSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    sidePanel.style.width = '360px'; // <-- Do 'HEAD'
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 100);
  }

  function closeSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    sidePanel.style.width = '0';
    menuBtn.innerHTML = '&#9776;';
  }

  // Função do 'main' (lógica PvP/Scoreboard)
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
        { value: 'cpu', text: 'Computer' }
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

  window.gameMessage = setMessage;

  // --- MERGE: `renderSticks` (do 'HEAD', para animação) ---
  function renderSticks(valueOrResult, opts = {}) {
    if (!sticksEl) return;
    // ✅ ensure the sticks area is visible whenever we render
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
        img.src = 'image2.jpeg'; // Certifica-te que esta imagem existe
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
      img.src = 'image2.jpeg'; // Certifica-te que esta imagem existe
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
        img.src = v === 1 ? 'image4.jpeg' : 'image2.jpeg'; // Certifica-te que estas imagens existem
        strip.appendChild(img);
      });
      if (value === 1) {
        label.innerHTML = `<b>${value} move</b>`;
      }
      else {
        label.innerHTML = `<b>${value} moves</b>`;
      }
      sticksUI.busy = false; // ✅ unlock
      const tasks = sticksUI.queue.splice(0, sticksUI.queue.length);
      tasks.forEach(fn => fn());
    };

    if (animate) setTimeout(reveal, TIMING.flipAnimMs);
    else reveal();
  }

  // Função 'buildBoard' (do 'main', com skins corretas)
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

  // Função 'updateBoardHighlights' (do 'main')
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

  // --- MERGE: `renderAll` (lógica do 'main', UI do 'HEAD') ---
  function renderAll(opts = { updateSticks: true }) {
    if (!window.game) return;
    
    buildBoard();
    updateBoardHighlights();
    
    if (opts.updateSticks) {
      // Chama a nova 'renderSticks' sem animação
      renderSticks(game.stickValue ?? null, { animate: false }); 
    }
    
    // Usa o novo helper do 'HEAD'
    updateRollBtn(); 

    // Lógica de UI do 'main' (essencial para PvP/PvC)
    const currentPlayer = game.getCurrentPlayer();
    const isCpuTurn = (currentPlayer.name === 'cpu' && !game.isVsPlayer);

    if (boardEl) {
      if (isCpuTurn) {
        boardEl.classList.add('disabled-board');
      } else {
        boardEl.classList.remove('disabled-board');
      }
    }
  }

  // --- MERGE: `maybeCpuTurn` (lógica do 'main', UI do 'HEAD') ---
  function maybeCpuTurn() {
    if (!game || game.over) return;
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu' || game.isVsPlayer) return;
  
    cpuBusy = true;
    queueAfterFlip(updateRollBtn);

    setMessage("Player 2's turn");

    // show grey sticks while the message is visible
    renderSticks(null, { force: true, animate: false });
  
    const run = () => {
      cpuTimer = null;
      if (!game || game.over || game.getCurrentPlayer().name !== 'cpu' || game.isVsPlayer) {
        cpuBusy = false;
        return;
      }
  
      // CPU rolls (this sets game.lastSticks)
      const val = game.startTurn();
      queueAfterFlip(updateRollBtn);
  
      // ✅ Ensure the flip animation runs AFTER any prior tasks,
      // and only show "CPU rolled..." AFTER the flip reveal (not grey)
      queueAfterFlip(() => {
        renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });
        renderAll({ updateSticks: false });
        msgAfterFlip(val === 1 ? `Player 2 got ${val} move` : `Player 2 got ${val} moves`, 0);
      });
  
      // ⬇️ Only start "thinking" AFTER the flip reveal finished
      queueAfterFlip(() => {
        setTimeout(() => {
          const skipped = game.autoSkipIfNoMoves();
  
          if (skipped) {
            const nextPlayer = game.getCurrentPlayer();
            const skipMessage =
              (nextPlayer === cur)
                ? "No possible moves. Throwing sticks again"
                : "No possible moves. Turn passed";
  
            msgAfterFlip(skipMessage, 0);
  
            // After a short pause, grey the sticks and proceed
            setTimeout(() => {
              renderAll({ updateSticks: false });
              sticksToGrey(0);
  
              if (nextPlayer.name === 'cpu') {
                // CPU keeps the turn → chain
                setTimeout(maybeCpuTurn, TIMING.cpuChainMs);
              } else {
                // Turn passed to human
                setTimeout(() => {
                  msgAfterFlip("Your turn, player 1!");
                  queueAfterFlip(updateRollBtn);
                  cpuBusy = false;
                }, TIMING.skipMsgDelayMs);
              }
            }, TIMING.skipMsgDelayMs);
  
            return;
          }
  
          // Not skipped: CPU actually plays
          game.cpuMove();
          renderAll({ updateSticks: false });
          sticksToGrey(0);
          msgAfterFlip('Player 2 played');
  
          // After CPU’s move
          setTimeout(() => {
            if (game.getCurrentPlayer().name === 'cpu') {
              msgAfterFlip('Player 2 plays again');
              setTimeout(maybeCpuTurn, TIMING.cpuChainMs);
            } else {
              msgAfterFlip('Your turn, player 1!');
              queueAfterFlip(updateRollBtn);
              cpuBusy = false;
            }
          }, TIMING.cpuAfterPlayMs);
        }, TIMING.cpuThinkMs); // CPU "thinking" time
      });
    };
  
    setTimeout(run, TIMING.cpuStartMs); // delay before CPU starts its roll
  }
  
  
  // --- MERGE: `boardEl` (lógica do 'main', UI do 'HEAD') ---
  // Esta é a função correta (select-vs-move) do 'main'
  if (boardEl) {
    boardEl.addEventListener('click', (e) => {
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
        setMessage('Throw sticks first!'); // Corrigido
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
          // --- Jogada feita ---
          // MERGE: updateSticks: false (para não estragar animação)
          renderAll({ updateSticks: false }); 
          sticksToGrey(0);
          if (checkGameOver()) return; 

          const nextPlayer = game.getCurrentPlayer();
          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            setMessage("Player 2's turn");
            // MERGE: usa queueAfterFlip
            queueAfterFlip(maybeCpuTurn, TIMING.humanToCpuMs);
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
  }


  // Funções de Ecrã (do 'main')
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
    hide(scoreboardBtn);
    hardHideScoreboard(); 
    hide(rollBtn); // UI do 'HEAD'
  }
  function showMode() {
    if (intro) {
      intro.classList.add('hidden');
      intro.hidden = true;
      intro.style.display = 'none';
    }
    if (modeScreen) {
      modeScreen.classList.remove('hidden');
      modeScreen.hidden = false;
      modeScreen.style.display = 'grid';
    }
    if (mainGrid) mainGrid.style.display = 'none';
    hide(rollBtn); // UI do 'HEAD'
  }
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

  // Scoreboard a 3 (do 'main')
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
      if (losses === 0) return wins > 0 ? 'INF' : '0.00';
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

  // handleGameOver a 3 (do 'main')
  function handleGameOver(winner) {
    if (!winner) return;

    // === Update scores first ===
    const winnerName = winner.name;
    const loserPlayer = (winner === game.players[0]) ? game.players[1] : game.players[0];
    const loserName = loserPlayer.name;

    if (scores[winnerName]) scores[winnerName].wins++;
    if (scores[loserName]) scores[loserName].losses++;
    updateScoreboardView();

    // === Announce winner ===
    let winnerDisplay = winnerName.toUpperCase();
    if (winnerName === 'player1') winnerDisplay = 'Player 1';
    if (winnerName === 'player2') winnerDisplay = 'Player 2';
    msgAfterFlip(`Game Over! ${winnerDisplay} won!`);

    // === Disable current board interactions ===
    rollBtn && (rollBtn.disabled = true);
    boardEl && boardEl.classList.add('disabled-board');
    // === 🟢 Hide sticks completely on game over ===
    if (sticksEl) {
      sticksEl.innerHTML = '';
      sticksEl.classList.add('hidden');
      sticksEl.style.display = 'none';
    } hide && hide(sticksEl);
    
    // === OPEN the scoreboard panel right away ===
    if (scoreboardPanel) {
      scoreboardPanel.classList.add('open');
      if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      setTimeout(() => scoreboardPanel.focus(), 100);
    }

    // === After a short pause, RESET to "pre-start" state (main grid + sidepanel open) ===
    const CLEANUP_DELAY = 2200; // tweak as you like
    setTimeout(() => {
      // clear timers
      if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
      if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }

      // forget current game
      window.game = null;
      game = null;

      // nuke board and hide roll button
      if (boardEl) boardEl.innerHTML = '';
      hide && hide(rollBtn);
      hide && hide(sticksEl); // hide sticks area again
      // show the main game layout (not the intro) and open the side panel
      showGame && showGame();           // keeps main grid visible
      openSidePanel && openSidePanel(); // opens the config panel

      // rebuild empty board grid so it’s visible again
      buildBoard && buildBoard();
      updateBoardHighlights && updateBoardHighlights();

      // prompt like the intro’s Start flow
      setMessage('Choose the configurations and click "Start" to play the game.');
      setCloseBlocked(true); // ⬅️ block again in the post-game pre-start state
      
      // keep scoreboard panel open (already opened above on game over)
      if (scoreboardPanel) {
        scoreboardPanel.classList.add('open');
        if (scoreboardBtn) scoreboardBtn.innerHTML = '&times;';
      }
    }, CLEANUP_DELAY);
  }


  // checkGameOver (global, do 'main')
  function checkGameOver() {
    if (!game) return false;
    const { over, winner } = game.checkGameOver();
    if (over) {
      handleGameOver(winner);
      return true;
    }
    return false;
  }

  // Modal (do 'main')
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');
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

  introStartBtn?.addEventListener('click', () => {
    showGame();
    openSidePanel();
    setMessage('Choose the configurations and click "Start" to play the game!');
    show(menuBtn);
    show(scoreboardBtn);
    setCloseBlocked(true); // ⬅️ block close while choosing configs
  });

// --- MERGE: `startSideBtn` (lógica do 'main', UI do 'HEAD') ---
if (startSideBtn) {
  startSideBtn.addEventListener('click', async () => {
    if (window.game) {
      const confirmed = await showModal(
        'New game?',
        'Starting a new game will cancel the current one. Are you sure?',
        'Yes, Start New',
        'No, Cancel'
      );
      if (!confirmed) return;
    }
    const gameMode = gameModeInput?.value || 'pvc';
    const cols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;
    const firstPlayer = firstPlayerInput ? firstPlayerInput.value : 'player1';
    const difficulty = difficultyInput ? difficultyInput.value : 'easy';

    game = new TabGame(cols);
    window.game = game;

    // ✅ re-enable the close button as soon as the user starts the game
    setCloseBlocked(false); // ⬅️ INSERT THIS LINE HERE

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
    cpuRolledOnce = false;
    
    // UI do 'HEAD' (substitui 'renderAll()')
    show(rollBtn);
    updateRollBtn();
    hardShowScoreboard();
    // make sure sticks area is visible again
    if (sticksEl) {
      sticksEl.classList.remove('hidden');
      sticksEl.style.display = '';
    }

    renderSticks(null); // Mostra sticks cinzentos
    buildBoard(); // Precisamos de desenhar o tabuleiro
    updateBoardHighlights(); // e highlights
    
    closeSidePanel();
    // ✅ close the scoreboard if it was open
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
}

  
  closePanelBtn?.addEventListener('click', closeSidePanel);

  // --- MERGE: `rollBtn` (lógica do 'main' DENTRO da UI do 'HEAD') ---
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      // Guarda 'canPlayerRoll' do 'HEAD'
      if (!canPlayerRoll()) {
        const turn = game.getCurrentPlayer()?.name;
        if (turn === 'cpu') setMessage("Wait — Player 2's turn");
        else if (sticksUI.busy) setMessage('Throwing sticks in progress…');
        else setMessage('You already threw. Move a piece!');
        return;
      }

      // Lógica de 'messageTimer' do 'main'
      if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
      }

      const currentPlayer = game.getCurrentPlayer(); // Lógica do 'main'
      const val = game.startTurn();
      updateRollBtn(); // UI do 'HEAD'
      renderSticks({ value: val, sticks: game.lastSticks }, { animate: true }); // UI do 'HEAD'
      // Tell the player what they rolled (queued to appear after the flip reveal)
      const rolledText = (val === 1) ? 'You got 1 move' : `You got ${val} moves`;
      msgAfterFlip(rolledText, 0);


      const skipped = game.autoSkipIfNoMoves(); // Lógica do 'main'
      
      if (skipped) {
        // Lógica de 'skipped' do 'main', adaptada para 'queueAfterFlip' do 'HEAD'
        queueAfterFlip(() => {
          const nextPlayer = game.getCurrentPlayer();
          let skipMessage = "";

          if (nextPlayer === currentPlayer) { // Rolou 1,4,6
            if (game.isVsPlayer) {
              const P1_name = game.players[0].name;
              skipMessage = `${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'} has no moves. Throw sticks again!`;
            } else {
              skipMessage = "No possible moves. Throw sticks again!";
            }
          } else { // Rolou 2,3
            skipMessage = "No possible moves. Turn passed";
          }
          
          // keep the board update, but don't touch sticks yet
          renderAll({ updateSticks: false });

          // ✅ Ensure the pass message appears first, THEN grey the sticks shortly after
          queueAfterFlip(() => {
            setMessage(skipMessage);                // show "No possible moves. Turn passed."
            setTimeout(() => sticksToGrey(0), 50);  // grey strictly after the message is visible
          }, TIMING.skipMsgDelayMs);


          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            // We’re already inside a queued block. First show the pass msg, then grey,
            // then, after that breath, kick the CPU (so its flip can safely animate).
            setTimeout(() => {
              // One more tiny wait ensures the grey render just finished painting
              setTimeout(maybeCpuTurn, TIMING.cpuStartMs);
            }, TIMING.skipMsgDelayMs + 60);
          }
           else if (game.isVsPlayer && nextPlayer !== currentPlayer) {
            const P1_name = game.players[0].name;
            const P2_name = game.players[1].name;
            messageTimer = setTimeout(() => {
              if (game.getCurrentPlayer() === nextPlayer && game.stickValue === null) {
                setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);
              }
            },  TIMING.pvpPromptDelayMs); 
          }
        }, TIMING.flipAnimMs); // 600ms = Duração da animação 'stickFlip'

        return; 
      }
      
      // give the rolled message a tiny moment, then prompt
      msgAfterFlip('Choose a piece to move!', 600);
      renderAll({ updateSticks: false });

    });
  }

  // --- MERGE: `quitBtn` (lógica do 'main', UI do 'HEAD') ---
  if (quitBtn) {
    quitBtn.addEventListener('click', async () => {
      let quitMessage = 'Game quit.';
      const confirmed = await showModal(
        'Quit?',
        'Are you sure you want to quit? This action will count as a loss.',
        'Yes, quit',
        'No, cancel'
      );
      if (!confirmed) return;

      if (window.game && !game.over) {
        const winnerPlayer = game.getOpponentPlayer();
        handleGameOver(winnerPlayer);
        let winnerDisplay = winnerPlayer.name.toUpperCase();
        if (winnerPlayer.name === 'player1') winnerDisplay = 'Player 1';
        if (winnerPlayer.name === 'player2') winnerDisplay = 'Player 2';
        quitMessage = `Game forfeited. ${winnerDisplay} wins`;
      }
      window.game = null;
      if (boardEl) boardEl.innerHTML = '';
      if (sticksEl) sticksEl.innerHTML = '';
      
      // UI do 'HEAD'
      hide(rollBtn);
      showIntro(); 
      
      setMessage(quitMessage);
      closeSidePanel();
      hardHideScoreboard();    
      // 'setTimeout' do 'main' (é útil)
      setTimeout(() => {
        if (!window.game) {
          setMessage('Choose the configurations and click "Start" to play the game');
          setCloseBlocked(true); // ⬅️ block while waiting to start again
        }
      }, 3000); 
    });
  }

  // Instruções (lógica de ambos)
  const instrScrim = document.getElementById('instructions-scrim');

  function openInstructions() {
    if (!instrPanel || !instrScrim) return;
  
    // ensure pages exist, then reset to page 1 (index 0)
    if (!insPages.length) collectPages();
    goToPage(0);
  
    instrPanel.classList.add('open');
    instrPanel.setAttribute('aria-hidden', 'false');
    instrScrim.classList.add('visible');
    document.body.classList.add('instructions-open');
  }
  
  function closeInstructions() {
    if (!instrPanel || !instrScrim) return;
    instrPanel.classList.remove('open');
    instrPanel.setAttribute('aria-hidden', 'true');
    instrScrim.classList.remove('visible');
    document.body.classList.remove('instructions-open');
  }
  
  // Open via button
  instrOpen?.addEventListener('click', openInstructions);
  
  // Close via any .ins-close button
  instrPanel?.addEventListener('click', (e) => {
    if (e.target.closest('.ins-close')) closeInstructions();
  });
  
  // Close via scrim click
  instrScrim?.addEventListener('click', closeInstructions);
  
  // Close via ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && instrPanel?.classList.contains('open')) {
      closeInstructions();
    }
  });

  // ---------- Multi-page Instructions ----------
const insPagesWrap = document.getElementById('ins-pages');
const insCounter   = document.getElementById('ins-counter');
const insDotsWrap  = document.getElementById('ins-dots');
const insPrev      = document.getElementById('ins-prev');
const insNext      = document.getElementById('ins-next');

let insPages = [];
let insIndex = 0; // 0-based

function collectPages() {
  insPages = Array.from(insPagesWrap?.querySelectorAll('.ins-page') || []);
  // ensure only first is visible by default
  insPages.forEach((p, i) => p.toggleAttribute('hidden', i !== 0));
  insIndex = 0;
  buildDots();
  updatePager();
}

function buildDots() {
  if (!insDotsWrap) return;
  insDotsWrap.innerHTML = '';
  insPages.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'ins-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Page ${i+1}`);
    dot.setAttribute('aria-selected', i === insIndex ? 'true' : 'false');
    dot.addEventListener('click', () => goToPage(i));
    insDotsWrap.appendChild(dot);
  });
}

function updatePager() {
  const total = insPages.length || 1;
  const page  = insIndex + 1;
  if (insCounter) insCounter.textContent = `Page ${page} of ${total}`;

  // show only current
  insPages.forEach((p, i) => p.toggleAttribute('hidden', i !== insIndex));

  // dots state
  Array.from(insDotsWrap?.children || []).forEach((dot, i) =>
    dot.setAttribute('aria-selected', i === insIndex ? 'true' : 'false')
  );

  // buttons
  if (insPrev) insPrev.disabled = (insIndex === 0);
  if (insNext) insNext.disabled = (insIndex === total - 1);
}

function goToPage(i) {
  if (!insPages.length) return;
  insIndex = Math.max(0, Math.min(i, insPages.length - 1));
  updatePager();

  // focus first heading on the new page (a11y nicety)
  const firstHeading = insPages[insIndex].querySelector('h1,h2,h3,h4,h5,h6,button,[tabindex]');
  if (firstHeading) firstHeading.focus({ preventScroll: true });
}

function nextPage() { goToPage(insIndex + 1); }
function prevPage() { goToPage(insIndex - 1); }

insPrev?.addEventListener('click', prevPage);
insNext?.addEventListener('click', nextPage);

// Keyboard support when modal is open
document.addEventListener('keydown', (e) => {
  if (!instrPanel?.classList.contains('open')) return;
  if (e.key === 'ArrowRight') { e.preventDefault(); nextPage(); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prevPage(); }
  if (e.key === 'Home')       { e.preventDefault(); goToPage(0); }
  if (e.key === 'End')        { e.preventDefault(); goToPage(insPages.length - 1); }
});

// Optional: swipe on touch (simple)
let touchX = null;
instrPanel?.addEventListener('touchstart', (e) => { touchX = e.touches?.[0]?.clientX ?? null; }, { passive: true });
instrPanel?.addEventListener('touchend', (e) => {
  if (touchX == null) return;
  const dx = (e.changedTouches?.[0]?.clientX ?? touchX) - touchX;
  if (Math.abs(dx) > 40) { dx < 0 ? nextPage() : prevPage(); }
  touchX = null;
}, { passive: true });

// Public helper to replace pages dynamically if you prefer building them via JS
window.setInstructionsPages = function(htmlArray) {
  if (!insPagesWrap) return;
  insPagesWrap.innerHTML = '';
  htmlArray.forEach((html, i) => {
    const sec = document.createElement('section');
    sec.className = 'ins-page';
    sec.dataset.page = String(i + 1);
    sec.innerHTML = html;
    insPagesWrap.appendChild(sec);
  });
  collectPages();
};

// Initialize pages from current markup once DOM is ready
collectPages();

// Also reset to page 1 any time the modal opens
const _openInstr = openInstructions;
openInstructions = function() {
  _openInstr();
  goToPage(0);
};


  // Side panel (lógica de ambos)
  if (menuBtn && sidePanel) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sidePanel.classList.contains('open');
      if (isOpen) closeSidePanel();
      else openSidePanel();
    });
  }
  openSidePanelBtn?.addEventListener('click', openSidePanel);

  // Scoreboard (lógica de ambos)
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

  // Listeners de Configurações (do 'main', que é mais robusto)
  function settingChangeListener() {
    if (window.game) {
      setMessage('Setting changed. Click "Start" to begin a new game with this setting');
    }
  }
  sizeInput?.addEventListener('change', settingChangeListener);
  firstPlayerInput?.addEventListener('change', settingChangeListener);
  difficultyInput?.addEventListener('change', settingChangeListener);
  gameModeInput?.addEventListener('change', () => {
    updateFirstPlayerOptions();
    settingChangeListener();
  });

  // User menu (lógica de ambos, com correção de bug do 'main')
  const userAvatar = document.getElementById('user-avatar');
  const userMenu = document.getElementById('user-menu');
  const menuMain = document.getElementById('menu-main');
  const menuLogin = document.getElementById('menu-login');
  const menuSignup = document.getElementById('menu-signup');
  if (userAvatar && userMenu) {
    userAvatar.addEventListener('click', () => {
      userMenu.classList.toggle('hidden');
    });
  }
  document.getElementById('btn-login')?.addEventListener('click', () => {
    menuMain.classList.add('hidden');
    menuLogin.classList.remove('hidden');
  });
  document.getElementById('btn-signup')?.addEventListener('click', () => {
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

  // Estado Inicial (do 'main')
  updateScoreboardView();
  updateFirstPlayerOptions(); 
  showIntro();
  setMessage('Welcome to Tâb! Click Start to begin'); // Mensagem do 'main'
});