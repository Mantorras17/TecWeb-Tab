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
    for (let i=0; i < k; i++) {
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
    this.lastSticks = [0, 0, 0, 0];  
  }

  initPlayers() {
    const player = new Player('player', 'blue', 3);
    const cpu = new Player('cpu', 'red', 0);

    // Create pieces for each player (owner is the Player object)
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
    this.lastSticks = sticks;
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

    // Using BFS with k steps with rule-based pruning on edges
    let frontier = new Set([startId]);
    for (let step = 0; step < sticks; step++) {
      const next = new Set();
      frontier.forEach(id => {
        const from = graph.idToCoord(id);
        graph.neighborsId(id).forEach(nid => {
          const to = graph.idToCoord(nid);
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
    return coords.filter(({row, col}) => {
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

  autoSkipIfNoMoves() {
    if (this.stickValue != null && !this.hasAnyLegalMove()) {
      this.endTurn(false);
      return true;
    }
    return false;
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

  movePiece(piece, toRow, toCol) {
    if (!piece || this.stickValue == null) return false;
    const legal = this.possibleMoves(piece, this.stickValue);
    const ok = legal.some(p => p.row === toRow && p.col === toCol);
    if (!ok) return false;
    const occ = this.isCellOccupied(toRow, toCol);
    if (occ && occ.owner === 'opponent') this.handleCapture(occ.piece);
    else if (occ && occ.owner === 'me') return false;
    piece.moveTo(toRow, toCol);
    this.clearSelection();
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
    this.getOpponentPlayer().removePiece(capturedPiece)
  }

  moveSelectedTo(row, col) {
    const piece = this.selectedPiece;
    if (!piece) return false;
    const allowed = this.selectedMoves.some(p => p.row === row && p.col === col);
    if (!allowed) return false;

    // Capture if opponent is there
    const occ = this.isCellOccupied(row, col);
    if (occ && occ.owner === 'opponent') {
      this.handleCapture(occ.piece);
    }
    else if (occ && occ.owner === 'me') return false;
    piece.moveTo(row, col);
    this.clearSelection();
    const playAgain = this.playAgain();

    // Mostrar mensagem se for jogador humano
  if (playAgain && this.getCurrentPlayer().name !== 'cpu') {
    setMessage('Play again! ');
  }
    this.endTurn(playAgain);
    return true;
  }

  startTurn(sticks = null) {
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
    this.stickValue = null;
    if (!keepTurn) this.curPlayerIdx = 1 - this.curPlayerIdx;
  }

  isGameOver() {
    const p0Lost = this.players[0].hasLost();
    const p1Lost = this.players[1].hasLost();
    if (p0Lost || p1Lost) {
      const winner = p0Lost ? this.players[1] : this.players[0];
      return { over: true, winner };
    }
    return { over: false, winner: null };
  }




  selfTestGraph() {
    const g = this.board.graph;
    const C = this.columns;
    const outDeg = [];
    const missing = [];

    const hasEdge = (r1, c1, r2, c2) => {
      const from = g.coordToId(r1, c1);
      const to = g.coordToId(r2, c2);
      return g.adj[from].has(to);
    };

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < C; c++) {
        const id = g.coordToId(r, c);
        const deg = g.adj[id].size;
        outDeg.push({ row: r, col: c, outDegree: deg });

        if (r === 0) {
          if (c > 0) { if (!hasEdge(r, c, 0, c - 1)) missing.push({ from: [r,c], to:[0,c-1] }); }
          else { if (!hasEdge(r, c, 1, 0)) missing.push({ from: [r,c], to:[1,0] }); }
        } else if (r === 1) {
          if (c < C - 1) { if (!hasEdge(r, c, 1, c + 1)) missing.push({ from: [r,c], to:[1,c+1] }); }
          else {
            if (!hasEdge(r, c, 0, c)) missing.push({ from: [r,c], to:[0,c] });
            if (!hasEdge(r, c, 2, c)) missing.push({ from: [r,c], to:[2,c] });
          }
        } else if (r === 2) {
          if (c > 0) { if (!hasEdge(r, c, 2, c - 1)) missing.push({ from: [r,c], to:[2,c-1] }); }
          else { if (!hasEdge(r, c, 1, 0)) missing.push({ from: [r,c], to:[1,0] }); }
        } else if (r === 3) {
          if (c < C - 1) { if (!hasEdge(r, c, 3, c + 1)) missing.push({ from: [r,c], to:[3,c+1] }); }
          else { if (!hasEdge(r, c, 2, c)) missing.push({ from: [r,c], to:[2,c] }); }
        }
      }
    }

    // Degree checks: all 1 except (1, last col) which should be 2
    const badOutDegree = outDeg.filter(({ row, col, outDegree }) => {
      const expected = (row === 1 && col === C - 1) ? 2 : 1;
      return outDegree !== expected;
    });

    const ok = missing.length === 0 && badOutDegree.length === 0;
    if (!ok) {
      console.warn('Graph test failed');
      console.table(badOutDegree);
      console.table(missing);
    } else {
      console.log('Graph test passed');
    }
    return { ok, badOutDegree, missing };
  }

  printArrowMap() {
    const g = this.board.graph;
    const C = this.columns;
    const arrowRows = [];
    const arrowFor = (r, c) => {
      const outs = Array.from(g.adj[g.coordToId(r, c)]);
      if (outs.length === 2) return '*'; // branch at row 1, last col
      if (outs.length === 0) return '·';
      const { row, col } = g.idToCoord(outs[0]);
      if (row === r && col === c + 1) return '>';
      if (row === r && col === c - 1) return '<';
      if (row === r + 1 && col === c) return 'v';
      if (row === r - 1 && col === c) return '^';
      return '?';
    };
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      for (let c = 0; c < C; c++) line += arrowFor(r, c);
      arrowRows.push(line);
    }
    const map = arrowRows.join('\n');
    console.log(map);
    return map;
  }

  debugReset(p1Coords = [], p2Coords = []) {
    this.players[0].pieces = [];
    this.players[1].pieces = [];
    p1Coords.forEach(({row, col}) => this.players[0].addPiece(new Piece(this.players[0], row, col)));
    p2Coords.forEach(({row, col}) => this.players[1].addPiece(new Piece(this.players[1], row, col)));
    this.curPlayerIdx = 0;
    this.stickValue = null;
    this.clearSelection();
  }

  // Simple assertion utility
  _assert(cond, msg) {
    if (!cond) throw new Error('Test failed: ' + msg);
  }

  // Run a few logic tests; throws on failure, logs on success
  runLogicSelfTest() {
    console.log('Running logic self-test...');

    // 1) Graph shape sanity for current width
    const map = this.printArrowMap();
    this._assert(map.includes('*'), 'Expected branch (*) at row 1 last col');

    // 2) Jumping: pieces can jump over blockers; only final landing checked
    const g3 = new TabGame(3);
    g3.debugReset([{row:3, col:0}], []);
    g3.players[0].pieces[0].state = 'moved'; // allow sticks=2
    g3.startTurn(2);
    g3.selectPieceAt(3,0);
    let moves = g3.getSelectedMoves();
    g3._assert(moves.some(p => p.row === 3 && p.col === 2), 'Jumping two steps failed (no blocker)');

    // Add a blocker at 3,1 (own piece) -> still can land at 3,2; cannot land on 3,1
    g3.players[0].addPiece(new Piece(g3.players[0], 3, 1));
    g3.startTurn(2);
    g3.selectPieceAt(3,0);
    moves = g3.getSelectedMoves();
    g3._assert(moves.some(p => p.row === 3 && p.col === 2), 'Should jump over own piece at 3,1');
    g3._assert(!moves.some(p => p.row === 3 && p.col === 1), 'Should not land on own piece at 3,1');

    // 3) Entering last row is blocked while any own piece is on startRow
    const g9 = new TabGame(9);
    // Player starts on row 3; leave one piece on row 3 to block entry
    g9.debugReset(
      [{row:1, col:8}, {row:3, col:0}],
      []
    );
    g9.startTurn(1);
    g9.selectPieceAt(1,8);
    moves = g9.getSelectedMoves();
    g9._assert(!moves.some(p => p.row === 0 && p.col === 8), 'Should not enter last row while a piece remains on start row');

    // Move that blocking piece off the start row, then entry is allowed
    g9.players[0].pieces.find(p => p.row === 3).row = 2; // move off start row
    g9.startTurn(1);
    g9.selectPieceAt(1,8);
    moves = g9.getSelectedMoves();
    g9._assert(moves.some(p => p.row === 0 && p.col === 8), 'Should allow entering last row after start row is empty');

    console.log('Logic self-test passed.');
  }

  cpuMoveRandom() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      this.endTurn(false);
      return;
    }

    // Escolher movimento e destino aleatoriamente
    const { piece, moves } = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    const move = moves[Math.floor(Math.random() * moves.length)];

    // Executar jogada
    this.selectedPiece = piece;
    this.selectedMoves = moves;
    this.moveSelectedTo(move.row, move.col);
  }

  cpuMoveHeuristic() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      this.endTurn(false);
      return;
    }

    let bestScore = -Infinity;
    let bestMoves = [];

    for (const { piece, moves } of legalMoves) {
      for (const move of moves) {
        let score = 0;

        // Heurística 1: capturar peças
        const occ = this.isCellOccupied(move.row, move.col);
        if (occ && occ.owner === 'opponent') score += 10;

        // Heurística 2: mover peça pela primeira vez
        if (piece.state === 'not-moved') score += 1;

        // Heurística 3: mover peça da linha inicial
        if (piece.row === piece.owner.startRow) score += 0.5;

        if (score > bestScore) {
          bestScore = score;
          bestMoves = [{ piece, move }];
        } else if (score === bestScore) {
          bestMoves.push({ piece, move });
        }
      }
    }

    // Escolher aleatoriamente uma das melhores jogadas
    const { piece, move } = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    this.selectedPiece = piece;
    this.selectedMoves = this.possibleMoves(piece, this.lastStickValue);
    this.moveSelectedTo(move.row, move.col);
  }

  cpuMove() {
    const M = 2; // número total de níveis possíveis (0 e 1)
    const N = this.difficultyLevel ?? 0; // nível atual
    const A = Math.floor(Math.random() * M);

    if (A < N) {
      this.cpuMoveHeuristic(); // avançado
    } else {
      this.cpuMoveRandom(); // aleatório
    }
  }

}







document.addEventListener('DOMContentLoaded', () => {
  // Try to read size from a selector; fallback to 9
  const sizeInput = document.getElementById('board-size');
  const initialCols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;

  // Single game instance (will be created on 'Start')
  let game;
  window.game = null; // Começa como nulo

  // Elements (guarded: only use if present)
  const intro = document.getElementById('intro-screen');
  const modeScreen = document.getElementById('mode-screen');
  const introStartBtn = document.getElementById('intro-start');
  const modeSingleBtn = document.getElementById('mode-single');
  const modeMultiBtn = document.getElementById('mode-multi');
  const modeCpuBtn = document.getElementById('mode-cpu');
  const modeBackBtn = document.getElementById('mode-back');
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
  const difficultyInput = document.getElementById('difficulty');
  const closePanelBtn = document.getElementById('closePanel');
  const sticksUI = { busy: false, queue: [] }; // flip animation in progress? + queued work

  function hide(el){ if(el){ el.classList.add('hidden'); el.style.display = 'none'; } }
  function show(el){ if(el){ el.classList.remove('hidden'); el.style.display = ''; } }

  hide(rollBtn);

  function queueAfterFlip(cb, delay = 0) {
    // Run now if not flipping; otherwise enqueue to run right after reveal
    if (!sticksUI.busy) {
      setTimeout(cb, delay);
      return;
    }
    sticksUI.queue.push(() => setTimeout(cb, delay));
  }
  
  // Call this instead of setMessage(...) when you want it to wait for the flip
  function msgAfterFlip(text, delay = 0) {
    queueAfterFlip(() => setMessage(text), delay);
  }
  
  // Helpers
  function setMessage(text) {
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }
  function canPlayerRoll() {
    if (!game) return false;
    if (sticksUI.busy) return false;                 // flipping animation running
    const cur = game.getCurrentPlayer();
    if (!cur || cur.name !== 'player') return false; // not your turn
    return game.stickValue == null;                  // already rolled this turn?
  }
  
  function updateRollBtn() {
    if (!rollBtn) return;
    const enabled = canPlayerRoll();
    rollBtn.disabled = !enabled;
    rollBtn.setAttribute('aria-disabled', String(!enabled));
  }
  
  //  Funções de controlo do Painel 
  function openSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    sidePanel.style.width = '360px';
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 10);
  }

  function closeSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    sidePanel.style.width = '0';
    menuBtn.innerHTML = '&#9776;';
  }

  window.setMessage = setMessage //para que setmessage seja acessível em qualquer parte do código
// --- change renderSticks signature + logic ---
function renderSticks(valueOrResult, opts = {}) {
  if (!sticksEl) return;

  const force = opts.force === true;       // allow overriding busy state
  const animate = opts.animate !== false;  // default = animate

  // Respect busy state unless forced
  if (sticksUI.busy && !force) return;

  // Reset content
  sticksEl.innerHTML = '';

  // Detect if a roll value exists
  const hasValue =
    typeof valueOrResult === 'number' ||
    (valueOrResult && valueOrResult.value != null);

  // Idle/grey sticks
  if (!hasValue) {
    const strip = document.createElement('div');
    strip.className = 'stick-strip';
    strip.style.perspective = '1000px';
    for (let i = 0; i < 4; i++) {
      const img = document.createElement('img');
      img.className = 'stick-img inactive';
      img.src = 'image2.jpeg';
      strip.appendChild(img);
    }
    const label = document.createElement('div');
    label.className = 'sticks-label';
    sticksEl.appendChild(strip);
    sticksEl.appendChild(label);
    return;
  }

  // We are going to animate a flip -> mark busy
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
    img.src = 'image2.jpeg';
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

  // Reveal faces after flip
  const reveal = () => {
    strip.innerHTML = '';
    faces.forEach((v) => {
      const img = document.createElement('img');
      img.className = 'stick-img ' + (v === 1 ? 'light' : 'dark') + ' active';
      img.alt = v === 1 ? 'Flat side (light)' : 'Round side (dark)';
      img.src = v === 1 ? 'image4.jpeg' : 'image2.jpeg';
      strip.appendChild(img);
    });
    if(value === 1) {
      label.innerHTML = `<b>${value} move</b>`;
    }
    else{
    label.innerHTML = `<b>${value} moves</b>`;}
    sticksUI.busy = false; // ✅ unlock
    // Flush any queued messages/tasks that waited for the flip
    const tasks = sticksUI.queue.splice(0, sticksUI.queue.length);
    tasks.forEach(fn => fn());

  };

  if (animate) setTimeout(reveal, 600);
  else reveal();
}

  


  // Build/Render board (no arrows, clean layout)
  function buildBoard() {
    if (!boardEl) return;
    boardEl.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'board-box';

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'stretch';
    container.style.gap = '2px';

    for (let r = 0; r < game.rows; r++) {
      const rowDiv = document.createElement('div');
      rowDiv.className = 'board-row';

      for (let c = 0; c < game.columns; c++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'board-cell';
        cell.dataset.row = String(r);
        cell.dataset.col = String(c);

        // Piece layer
        const me = game.players[0].getPieceAt(r, c);
        const opp = game.players[1].getPieceAt(r, c);
        if (me || opp) {
          const piece = document.createElement('div');
          piece.className = 'piece ' + (me ? 'p1' : 'p2') + ' ' + (me || opp).state;
          piece.title = `${me ? 'player' : 'cpu'} (${(me || opp).state})`;
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

  function updateBoardHighlights() {
    if (!boardEl) return;
    // Clear all flags
    boardEl.querySelectorAll('.board-cell').forEach(cell => {
      cell.classList.remove('selected', 'highlight', 'mine', 'opp');
    });

    // Limpar destaques antigos das peças
    boardEl.querySelectorAll('.piece.selected').forEach(piece => {
      piece.classList.remove('selected');
    });

    // Re-apply occupants and highlights
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
          if (pieceEl) {
            pieceEl.classList.add('selected'); // aplicar 'selected' à peça
          }
        }
        if (game.getSelectedMoves().some(p => p.row === r && p.col === c)) {
          cell.classList.add('highlight');
        }
      }
    }
  }
  function renderAll(opts = { updateSticks: true }) {
    buildBoard();
    updateBoardHighlights();
    if (opts.updateSticks) {
      renderSticks(game.stickValue ?? null, { animate: false });
    }
    updateRollBtn();
  }
  

  // CPU turn handler 
  function maybeCpuTurn() {
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu') return; // só joga se for o CPU
    queueAfterFlip(updateRollBtn);  
    // grey sticks while CPU is "thinking" before its roll
    renderSticks(null);
    // Pausa antes de lançar
    setTimeout(() => {
      const val = game.startTurn();
      queueAfterFlip(updateRollBtn);  
      renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });
      renderAll({ updateSticks: false });   // ✅ do not overwrite
      if (val === 1)  msgAfterFlip(`CPU got ${val} move`);
      else            msgAfterFlip(`CPU got ${val} moves`);
      

  // Outra pausa antes de mover
  setTimeout(() => {
    // ✅ Check if CPU can actually move
    const legalMoves = game.getAllLegalMoves();
    if (legalMoves.length === 0) {
      msgAfterFlip('No legal moves. Passing turn...');
      // brief pause so the player can read it
      setTimeout(() => {
        game.endTurn(false);                               // hand over to player
        renderSticks(null, { force: true, animate: false }); // reset sticks immediately
        msgAfterFlip('Your turn!');                        // message after flip queue
        queueAfterFlip(updateRollBtn);                     // enable/disable button after flip queue
      }, 1000);      
      return; // stop here; CPU doesn't play
    }

    // CPU has at least one legal move — proceed
    game.cpuMoveHeuristic(); // ou cpuMoveRandom()
    renderAll({ updateSticks: false });
    setMessage('CPU played');

    // Pequeno delay antes de decidir se joga de novo
    setTimeout(() => {
      if (game.getCurrentPlayer().name === 'cpu') {
        setMessage('CPU plays again!');
        setTimeout(maybeCpuTurn, 1200);
        return;
      }
      // Hand control back to the player *through* the flip queue.
      renderSticks(null, { force: true, animate: false });
      msgAfterFlip('Your turn!');
      queueAfterFlip(updateRollBtn);
    }, 800);
    

  }, 2500); // tempo entre lançar e mover


    }, 2200); // tempo antes de lançar os paus
  }


  // Event delegation for board clicks
  if (boardEl) {
    boardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;

      if (game.stickValue == null) {
        setMessage('Roll first');
        return;
      }

      // Deselect if clicking the same selected piece
      if (game.selectedPiece && game.selectedPiece.row === r && game.selectedPiece.col === c) {
        game.clearSelection();
        updateBoardHighlights();
        return;
      }

      game.selectOrMoveAt(r, c);
      renderAll();

      // Se a jogada mudou para CPU, iniciar jogada automaticamente
      if (game.getCurrentPlayer().name === 'cpu') {
        setMessage('CPU´s turn');
        setTimeout(maybeCpuTurn, 0);
    }
    });
  }

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
  }

  // O botão "Intro Start" mostra o jogo e abre o painel
  introStartBtn?.addEventListener('click', () => {
    showGame(); // Mostra a grelha do jogo
    openSidePanel(); // Força a abertura do painel
    setMessage('Choose the configurations and click "Start" to play the game');
  });
  
  // Side-panel Start (início real do jogo)
  if (startSideBtn) {
    startSideBtn.addEventListener('click', () => {
      // Ler as configurações do painel
      const cols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;
      const firstPlayer = firstPlayerInput ? firstPlayerInput.value : 'player';
      const difficulty = difficultyInput ? difficultyInput.value : 'easy';

      // Criar a instância do jogo
      game = new TabGame(cols);
      window.game = game; // Expor globalmente

      // Aplicar as configurações lidas
      
      // Mapeia o <select> para o nível (0=fácil, 1=médio, 2=difícil)
      // que a tua função cpuMove() espera
      const diffMap = { 'easy': 0, 'medium': 1, 'hard': 2 };
      game.difficultyLevel = diffMap[difficulty] || 0;

      // Define o jogador inicial (0 = player, 1 = cpu)
      game.curPlayerIdx = (firstPlayer === 'cpu') ? 1 : 0;

      // Renderizar o tabuleiro
      renderAll();
      
      // show inactive/grey sticks until the first roll
      renderSticks(null);

      show(rollBtn);
      updateRollBtn();      

      // Fechar o painel
      closeSidePanel();

      // Enviar mensagem
      setMessage('Game started! Player’s turn');
      // (Aqui podes adicionar lógica para verificar se é o CPU a começar)
    });
  }
  
 // Close side panel button
  closePanelBtn?.addEventListener('click', closeSidePanel);

  function passTurnToCpuWithPause() {
    msgAfterFlip('No legal moves. Passing turn...');
    setTimeout(() => {
      renderSticks(null);        // idle sticks for a beat
      setMessage('CPU’s turn');  // announce CPU turn
      setTimeout(() => {
        maybeCpuTurn();          // already has its own pre-roll pause
      }, 2000);
    }, 2500);
  }
  
  // Throw sticks
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      if (!game) {
        setMessage('Choose the configurations and click "Start" to play the game');
        return;
      }
      if (!canPlayerRoll()) {
        const turn = game.getCurrentPlayer()?.name;
        if (turn === 'cpu') setMessage('Wait — CPU turn');
        else if (sticksUI.busy) setMessage('Throwing sticks in progress…');
        else setMessage('You already threw. Move a piece');
        return;
      }
    
      msgAfterFlip('Choose a piece and move it'); // show this after the faces are revealed

      const val = game.startTurn();
      updateRollBtn();
      // start the flip animation:
      renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });
      
      if (game.autoSkipIfNoMoves()) {
        updateRollBtn();
        passTurnToCpuWithPause();
        return;
      }      
      
      // Rebuild the board without touching the sticks UI (so animation completes)
      renderAll({ updateSticks: false });
      
      // After the flip reveals (~600ms), you can safely re-sync UI if you want
      setTimeout(() => {
        // optional: keep this if something else changed during the flip
        renderAll({ updateSticks: false });
      }, 650);
      
    });
  }

  // Quit
  if (quitBtn) {
    quitBtn.addEventListener('click', () => {
      window.game = null;
      if (boardEl) boardEl.innerHTML = '';
      if (sticksEl) sticksEl.innerHTML = '';
      hide(rollBtn);
      showIntro();
      setMessage('Game quit');
    });
  }

  // Instructions
  if (instrOpen && instrPanel) {
    instrOpen.addEventListener('click', () => { instrPanel.style.display = 'block'; });
  }
  if (instrClose && instrPanel) {
    instrClose.addEventListener('click', () => { instrPanel.style.display = 'none'; });
  }

  // Side panel (menu)
  if (menuBtn && sidePanel) {
    menuBtn.addEventListener('click', () => {
      const isOpen = sidePanel.classList.contains('open');
      if (isOpen) {
        closeSidePanel();
      } else {
        openSidePanel();
      }
    });
  }
  // Also open via the message button
  openSidePanelBtn?.addEventListener('click', openSidePanel);

  // Scoreboard open/close
  if (scoreboardBtn && scoreboardPanel) {
    scoreboardBtn.addEventListener('click', () => {
      const isOpen = scoreboardPanel.classList.toggle('open');
      scoreboardBtn.innerHTML = isOpen ? '&times;' : '🏆';
      if (isOpen) setTimeout(() => scoreboardPanel.focus(), 10);
    });
    scoreboardPanel.addEventListener('click', (e) => {
      if (e.target === scoreboardPanel) {
        scoreboardPanel.classList.remove('open');
        scoreboardBtn.innerHTML = '🏆';
      }
    });
  }

  // Live board-size preview (optional)
  sizeInput?.addEventListener('change', () => {
    if (!game) {
      setMessage('Choose the configurations and click "Start" to play the game');
      // Reverte o valor se o jogo não tiver começado
      if (game) sizeInput.value = String(game.columns); 
      return;
    }
    const cols = parseInt(sizeInput.value, 10) || 9;
    const firstIdx = game.curPlayerIdx;
    window.game = new TabGame(cols);
    game = window.game;
    game.curPlayerIdx = firstIdx;
    renderAll();
    setMessage('Board size changed');
  });

// User menu //
const userAvatar = document.getElementById('user-avatar');
const userMenu = document.getElementById('user-menu');
const menuMain = document.getElementById('menu-main');
const menuLogin = document.getElementById('menu-login');
const menuSignup = document.getElementById('menu-signup');

// Toggle open/close on avatar click
if (userAvatar && userMenu) {
  userAvatar.addEventListener('click', () => {
    userMenu.classList.toggle('hidden');
  });
}

// Login / Signup buttons (main menu)
document.getElementById('btn-login')?.addEventListener('click', () => {
  menuMain.classList.add('hidden');
  menuLogin.classList.remove('hidden');
});
document.getElementById('btn-signup')?.addEventListener('click', () => {
  menuMain.classList.add('hidden');
  menuSignup.classList.remove('hidden');
});

// Back buttons
menuLogin.querySelector('.back-btn')?.addEventListener('click', () => {
  menuLogin.classList.add('hidden');
  menuMain.classList.remove('hidden');
});
menuSignup.querySelector('.back-btn')?.addEventListener('click', () => {
  menuSignup.classList.add('hidden');
  menuMain.classList.remove('hidden');
});

// Optional: close the user menu when clicking outside
document.addEventListener('click', (e) => {
  if (!userMenu.contains(e.target) && !userAvatar.contains(e.target)) {
    userMenu.classList.add('hidden');
  }
});

  // Initial UI state
  showIntro();
  setMessage('Welcome to Tâb! Click Start to begin');
});
