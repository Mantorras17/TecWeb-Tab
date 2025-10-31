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
    cpu:     { wins: 0, losses: 0, name: 'CPU' }
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
  // --- FIM MERGE ---

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
        { value: 'cpu', text: 'CPU' }
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
        img.style.animation = 'stickFlip 0.6s ease-in-out forwards';
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

    if (animate) setTimeout(reveal, 600);
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
    // Lógica de guarda do 'main' (corrigida)
    if (cur.name !== 'cpu' || game.isVsPlayer) return; 

    cpuBusy = true; // Lógica do 'main'
    queueAfterFlip(updateRollBtn);  
    renderSticks(null); // UI do 'HEAD'

    const run = () => { // Estrutura do 'main'
      cpuTimer = null;
      if (!game || game.over || game.getCurrentPlayer().name !== 'cpu' || game.isVsPlayer) {
         cpuBusy = false; return;
      }

      const val = game.startTurn();
      queueAfterFlip(updateRollBtn);  
      renderSticks({ value: val, sticks: game.lastSticks }, { animate: true }); // UI do 'HEAD'
      renderAll({ updateSticks: false });
      if (val === 1) msgAfterFlip(`CPU rolled ${val} move`);
      else           msgAfterFlip(`CPU rolled ${val} moves`);
      
      // Lógica de "jogar"
      setTimeout(() => {
        const skipped = game.autoSkipIfNoMoves(); // Lógica do 'main'
        
        if (skipped) {
          const nextPlayer = game.getCurrentPlayer();
          let skipMessage = "";
          if (nextPlayer === cur) { // Rolou 1,4,6
             skipMessage = "No possible moves. Roll again!";
          } else { // Rolou 2,3
             skipMessage = "No possible moves. Turn passed.";
          }
          
          msgAfterFlip(skipMessage, 1000); // UI do 'HEAD'
          
          queueAfterFlip(() => { // UI do 'HEAD'
            renderAll(); // Re-ativa 'rollBtn' para o jogador
            if (nextPlayer.name === 'cpu') {
              maybeCpuTurn(); // CPU joga de novo
            } else {
              msgAfterFlip("Your turn!", 1500); // Lógica do 'main'
              cpuBusy = false;
            }
          });
          return;
        }

        // Não foi "skip", o CPU joga
        game.cpuMove(); // Lógica do 'main' (usa dificuldade)
        renderAll({ updateSticks: false });
        msgAfterFlip('CPU played');

        setTimeout(() => {
          if (game.getCurrentPlayer().name === 'cpu') {
            msgAfterFlip('CPU plays again!');
            setTimeout(maybeCpuTurn, 100);
          } else {
            msgAfterFlip('Your turn!');
            queueAfterFlip(updateRollBtn);
            cpuBusy = false;
          }
        }, 800); // Compromisso de tempo
      }, 1000); // Compromisso de tempo
    };
    setTimeout(run, 1000); // Compromisso de tempo
  }

  // --- MERGE: `boardEl` (lógica do 'main', UI do 'HEAD') ---
  // Esta é a função correta (select-vs-move) do 'main'
  if (boardEl) {
    boardEl.addEventListener('click', (e) => {
      if (!game || game.over) return;
      const currentPlayer = game.getCurrentPlayer();
      if (currentPlayer.name === 'cpu' && !game.isVsPlayer) {
        setMessage('Wait for CPU.');
        return;
      }
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;
      if (game.stickValue == null) {
        setMessage('Roll first'); // Corrigido
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
          if (checkGameOver()) return; 

          const nextPlayer = game.getCurrentPlayer();
          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            setMessage('CPU´s turn');
            // MERGE: usa queueAfterFlip
            queueAfterFlip(maybeCpuTurn, 1000); 
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
    show(rollBtn); // UI do 'HEAD'
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
      { name: 'CPU', ...scores.cpu }
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
    const winnerName = winner.name;
    const loserPlayer = (winner === game.players[0]) ? game.players[1] : game.players[0];
    const loserName = loserPlayer.name;

    if (scores[winnerName]) scores[winnerName].wins++;
    if (scores[loserName]) scores[loserName].losses++;
    
    updateScoreboardView();

    let winnerDisplay = winnerName.toUpperCase();
    if (winnerName === 'player1') winnerDisplay = 'Player 1';
    if (winnerName === 'player2') winnerDisplay = 'Player 2';

    msgAfterFlip(`Game Over! ${winnerDisplay} won!`); // UI do 'HEAD'
    if (rollBtn) rollBtn.disabled = true;
    if (boardEl) boardEl.classList.add('disabled-board');
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

  // Botões de navegação (lógica do 'main')
  introStartBtn?.addEventListener('click', () => {
    showGame();
    openSidePanel();
    setMessage('Choose the configurations and click "Start" to play the game.');
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
      renderSticks(null); // Mostra sticks cinzentos
      buildBoard(); // Precisamos de desenhar o tabuleiro
      updateBoardHighlights(); // e highlights
      
      closeSidePanel();

      const currentPlayer = game.getCurrentPlayer();
      if (currentPlayer.name === 'cpu') {
        setMessage('Game started! CPU plays first.');
        setTimeout(maybeCpuTurn, 100);
      } else if (currentPlayer.name === 'player1') {
        setMessage('Game started! Player 1, your turn.');
      } else if (currentPlayer.name === 'player2') {
        setMessage('Game started! Player 2, your turn.');
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
        if (turn === 'cpu') setMessage('Wait — CPU turn');
        else if (sticksUI.busy) setMessage('Throwing sticks in progress…');
        else setMessage('You already threw. Move a piece');
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
      
      const skipped = game.autoSkipIfNoMoves(); // Lógica do 'main'
      
      if (skipped) {
        // Lógica de 'skipped' do 'main', adaptada para 'queueAfterFlip' do 'HEAD'
        queueAfterFlip(() => {
          const nextPlayer = game.getCurrentPlayer();
          let skipMessage = "";

          if (nextPlayer === currentPlayer) { // Rolou 1,4,6
            if (game.isVsPlayer) {
              const P1_name = game.players[0].name;
              skipMessage = `${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'} has no moves. Roll again!`;
            } else {
              skipMessage = "No possible moves. Roll again!";
            }
          } else { // Rolou 2,3
            skipMessage = "No possible moves. Turn passed.";
          }
          
          setMessage(skipMessage);
          renderAll(); // Re-ativa 'rollBtn'

          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            maybeCpuTurn();
          } else if (game.isVsPlayer && nextPlayer !== currentPlayer) {
            const P1_name = game.players[0].name;
            const P2_name = game.players[1].name;
            messageTimer = setTimeout(() => {
              if (game.getCurrentPlayer() === nextPlayer && game.stickValue === null) {
                setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);
              }
            }, 1500); 
          }
        }, 600); // 600ms = Duração da animação 'stickFlip'

        return; 
      }
      
      msgAfterFlip('Choose a piece to move.'); // UI do 'HEAD'
      renderAll({ updateSticks: false }); // UI do 'HEAD'
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
        quitMessage = `Game forfeited. ${winnerDisplay} wins.`;
      }
      window.game = null;
      if (boardEl) boardEl.innerHTML = '';
      if (sticksEl) sticksEl.innerHTML = '';
      
      // UI do 'HEAD'
      hide(rollBtn);
      showIntro(); 
      
      setMessage(quitMessage);
      closeSidePanel();
      
      // 'setTimeout' do 'main' (é útil)
      setTimeout(() => {
        if (!window.game) {
          setMessage('Choose the configurations and click "Start" to play the game.');
        }
      }, 3000); 
    });
  }

  // Instruções (lógica de ambos)
  if (instrOpen && instrPanel) {
    instrOpen.addEventListener('click', () => { instrPanel.style.display = 'block'; });
  }
  if (instrClose && instrPanel) {
    instrClose.addEventListener('click', () => { instrPanel.style.display = 'none'; });
  }

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
      setMessage('Setting changed. Click "Start" to begin a new game with this setting.');
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
  setMessage('Welcome to Tâb! Click Start to begin.'); // Mensagem do 'main'
});