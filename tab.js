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
      const keepTurn = this.playAgain(); // e.g., rolled 4
      
      if (keepTurn) {
        // O jogador rolou 1, 4, ou 6 mas não tem jogadas.
        if (this.getCurrentPlayer().name !== 'cpu') {
          setMessage('No possible moves. Roll again!');
        }
        // Não passa o turno, apenas reinicia os paus
        this.endTurn(true); // keepTurn = true
      } else {
        // O jogador rolou 2 ou 3 e não tem jogadas.
        if (this.getCurrentPlayer().name !== 'cpu') {
          setMessage('No possible moves. Turn passed.');
        }
        // Passa o turno
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
      this.autoSkipIfNoMoves();
      return false; // retorna false quando não consegue jogar
    }

    // Escolher movimento e destino aleatoriamente
    const { piece, moves } = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    const move = moves[Math.floor(Math.random() * moves.length)];

    // Executar jogada
    this.selectedPiece = piece;
    this.selectedMoves = moves;
    this.moveSelectedTo(move.row, move.col);
    return true; // conseguiu jogar
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
    return true;
  }

  cpuMove() {
    // Nível 0: Fácil (Aleatório)
    if (this.difficultyLevel === 0) {
      return this.cpuMoveRandom();
    }
    
    // Nível 1: Médio (Heurística 1-ply)
    if (this.difficultyLevel === 1) {
      return this.cpuMoveHeuristic();
    }

    // Nível 2: Difícil (Expectiminimax N-ply)
    if (this.difficultyLevel === 2) {
      return this.cpuMoveMinimax();
    }

    // Fallback para o modo aleatório
    return this.cpuMoveRandom();
  }

  /* Retorna uma pontuação: +infinito é vitória, -infinito é derrota.*/
  evaluateBoard() {
    const me = this.getCurrentPlayer();
    const opponent = this.getOpponentPlayer();

    // 1. Verificação de Fim de Jogo (Nó Terminal)
    const gameOverState = this.isGameOver();
    if (gameOverState.over) {
      return (gameOverState.winner.name === me.name) ? Infinity : -Infinity;
    }

    let score = 0;
    
    // 2. Contagem de Peças (Heurística Principal)
    // +100 por cada peça minha, -100 por cada peça do oponente.
    score += me.pieces.length * 100;
    score -= opponent.pieces.length * 100;

    // 3. Bónus de Posição (Heurística Secundária)
    for (const piece of me.pieces) {
      // Bónus maior por estar na linha final segura
      if (piece.state === 'last-row') score += 20; 
      // Bónus menor por simplesmente ter saído da linha inicial
      else if (piece.state !== 'not-moved') score += 5; 
    }
    for (const piece of opponent.pieces) {
      // Penalização equivalente se o oponente estiver avançado
      if (piece.state === 'last-row') score -= 20;
      else if (piece.state !== 'not-moved') score -= 5;
    }
    return score;
  }


  /* (isMaximizingPlayer): 'true' se for o CPU (MAX), 'false' se for o Humano (MIN).*/
  minimax(depth, isMaximizingPlayer) {
    // Caso Base: "if node is a terminal node or depth = 0"
    if (depth === 0 || this.isGameOver().over) {
      return this.evaluateBoard(); // Retorna a pontuação do tabuleiro
    }

    // Define os 5 resultados possíveis dos paus e as suas probabilidades
    //
    const rolls = [
      { value: 1, prob: 0.25 },  // Tâb
      { value: 2, prob: 0.38 },  // Itneyn
      { value: 3, prob: 0.25 },  // Teláteh
      { value: 4, prob: 0.06 },  // Arba'ah
      { value: 6, prob: 0.06 }   // Sitteh
    ];

    let expectedValue = 0; // "let α := 0" do nó "random event"

    // Simula o NÓ DE SORTE: "foreach child of node" (para o evento aleatório)
    // Itera sobre todos os lançamentos possíveis.
    for (const roll of rolls) {
      let bestScoreForThisRoll = isMaximizingPlayer ? -Infinity : +Infinity;
      
      // Encontra todas as jogadas legais para este lançamento simulado
      const allMoves = [];
      for (const piece of this.getCurrentPlayer().pieces) {
        if (!piece.canMoveFirst(roll.value)) continue;
        const dests = this.possibleMoves(piece, roll.value);
        if (dests.length) allMoves.push({ piece, moves: dests });
      }

      if (allMoves.length === 0) {
        // Se não houver jogadas, a pontuação é apenas a do tabuleiro atual
        bestScoreForThisRoll = this.evaluateBoard();
      } else {
        // Simula o NÓ MAX/MIN: "foreach child of node" (para o jogador)
        // Itera sobre todas as jogadas possíveis para este lançamento
        for (const { piece, moves } of allMoves) {
          for (const move of moves) {
            
            // 1. SIMULA A JOGADA 
            const fromRow = piece.row, fromCol = piece.col, fromState = piece.state;
            const occ = this.isCellOccupied(move.row, move.col);
            let captured = null;
            if (occ && occ.owner === 'opponent') {
              captured = occ.piece;
              this.getOpponentPlayer().removePiece(captured);
            }
            piece.moveTo(move.row, move.col);
            //
            const playsAgain = [1, 4, 6].includes(roll.value); 
            
            //  2. CHAMA A RECURSÃO 
            // Chama `expectiminimax(child, depth-1)`
            // Se 'playsAgain', o 'isMaximizingPlayer' não muda.
            // Se não, o 'isMaximizingPlayer' é invertido (!isMaximizingPlayer).
            const evaluation = this.minimax(depth - 1, playsAgain ? isMaximizingPlayer : !isMaximizingPlayer);

            // 3. DESFAZ A JOGADA 
            piece.row = fromRow; piece.col = fromCol; piece.state = fromState;
            if (captured) this.getOpponentPlayer().addPiece(captured);
            

            if (isMaximizingPlayer) {
              // Nó MAX: "α := max(α, ...)"
              bestScoreForThisRoll = Math.max(bestScoreForThisRoll, evaluation);
            } else {
              // Nó MIN: "α := min(α, ...)"
              bestScoreForThisRoll = Math.min(bestScoreForThisRoll, evaluation);
            }
          }
        }
      }
      // "α := α + (Probability[child] × ...)"
      expectedValue += bestScoreForThisRoll * roll.prob;
    }
    
    // "return α"
    return expectedValue; // Retorna a média ponderada de todas as possibilidades
  }

  /* Chamada depois do CPU ter lançado os sticks*/ 
  cpuMoveMinimax() {
    // O valor dos paus já está em this.lastStickValue
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
      return this.autoSkipIfNoMoves(); // Não há jogadas
    }

    let bestScore = -Infinity;
    let bestMove = null;
    // Profundidade da IA. 2 = (1 jogada CPU, 1 jogada Humano).
    // Aumentar isto torna a IA mais lenta
    const DEPTH = 2; 

    for (const { piece, moves } of legalMoves) {
      for (const move of moves) {
        
        // «SIMULA A JOGADA
        const fromRow = piece.row, fromCol = piece.col, fromState = piece.state;
        const occ = this.isCellOccupied(move.row, move.col);
        let captured = null;
        if (occ && occ.owner === 'opponent') {
          captured = occ.piece;
          this.getOpponentPlayer().removePiece(captured);
        }
        piece.moveTo(move.row, move.col);
        const playAgain = this.playAgain();

        // CHAMA O MINIMAX PARA VER O FUTURO 
        // O próximo a jogar é:
        // - O CPU (Maximizador) se 'playAgain' for true
        // - O Humano (Minimizador) se 'playAgain' for false
        let score = this.minimax(DEPTH, playAgain);

        // DESFAZ A JOGADA 
        piece.row = fromRow; piece.col = fromCol; piece.state = fromState;
        if (captured) this.getOpponentPlayer().addPiece(captured);
        

        //  VERIFICA SE É A MELHOR JOGADA 
        if (score > bestScore) {
          bestScore = score;
          bestMove = { piece, move };
        }
      }
    }

    //  EXECUTA A MELHOR JOGADA ENCONTRADA 
    if (bestMove) {
      this.selectedPiece = bestMove.piece;
      this.selectedMoves = this.possibleMoves(bestMove.piece, this.lastStickValue);
      this.moveSelectedTo(bestMove.move.row, bestMove.move.col);
      return true; // Fez uma jogada
    }
    
    // Fallback caso algo corra mal
    return this.cpuMoveRandom();
  }

}







document.addEventListener('DOMContentLoaded', () => {
  // Try to read size from a selector; fallback to 9
  const sizeInput = document.getElementById('board-size');
  const initialCols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;

  // Single game instance (will be created on 'Start')
  let game;
  window.game = null; // Começa como nulo
  let scores = {
    player: { wins: 0, losses: 0 },
    cpu: { wins: 0, losses: 0 }
  };

  // Elements (guarded: only use if present)
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
  const difficultyInput = document.getElementById('difficulty');
  const scoreboardBody = document.getElementById('scoreboard-body');
  const noScoresMsg = document.getElementById('no-scores-msg');

  // Helpers
  function setMessage(text) {
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }

  //  Funções de controlo do Painel 
  function openSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.add('open');
    sidePanel.style.width = '320px';
    menuBtn.innerHTML = '&times;';
    setTimeout(() => sidePanel.focus(), 100);
  }

  function closeSidePanel() {
    if (!sidePanel || !menuBtn) return;
    sidePanel.classList.remove('open');
    sidePanel.style.width = '0';
    menuBtn.innerHTML = '&#9776;';
  }

  window.setMessage = setMessage //para que setmessage seja acessível em qualquer parte do código

  function renderSticks(valueOrResult) {
    if (!sticksEl) return;
    sticksEl.innerHTML = '';
    const value = typeof valueOrResult === 'number' ? valueOrResult : valueOrResult?.value;
    if (value == null) return;
    sticksEl.innerHTML += ` &rarr; <b>${value}</b>`;
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

  function renderAll() {
    buildBoard();
    updateBoardHighlights();
    renderSticks(game.stickValue ?? null);

    // Se o jogo não começou, não faz nada
    if (!window.game) return; 

    const isPlayerTurn = game.getCurrentPlayer().name === 'player';


    // 1. Botão de Lançar
    if (rollBtn) {
      // Desativa se:
      // - Não for a vez do jogador (é vez do CPU)
      // - OU for a vez do jogador, mas ele JÁ lançou (tem de mover)
      rollBtn.disabled = !isPlayerTurn || game.stickValue != null;
    }

    // 2. Tabuleiro
    if (boardEl) {
      if (isPlayerTurn) {
        // Se é vez do jogador, o tabuleiro está ativo
        boardEl.classList.remove('disabled-board');
      } else {
        // Se é vez do CPU, o tabuleiro é bloqueado
        boardEl.classList.add('disabled-board');
      }
    }
  }

  // CPU turn handler 
  function maybeCpuTurn() {
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu') return; // só joga se for o CPU

    // Pausa antes de lançar
    setTimeout(() => {
      const val = game.startTurn();
      renderSticks(val);
      renderAll();
      setMessage(`CPU rolled: ${val}`);

      // Outra pausa antes de mover
      setTimeout(() => {
        // 1. Captura o 'true' ou 'false' retornado pela cpuMove()
        const didPlay = game.cpuMove();
        
        renderAll();

        // Se o jogo terminou, não faz mais nada
        if (checkGameOver()) return;

        // Só mostra a mensagem se a jogada foi feita
        if (didPlay) {
          setMessage('CPU played.');
        } 
        // Se 'didPlay' for 'false', não dizemos nada.

        // Pequeno delay antes de decidir se joga de novo
        setTimeout(() => {
          if (game.getCurrentPlayer().name === 'cpu') {
            setMessage('CPU plays again!');
            setTimeout(maybeCpuTurn, 100);
            return;
          }
          setMessage('Your turn!');
        }, 100);

      }, 100); // tempo entre lançar e mover

    }, 100); // tempo antes de lançar os paus
  }


  // Event delegation for board clicks
  if (boardEl) {
    boardEl.addEventListener('click', (e) => {
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;

      if (game.stickValue == null) {
        setMessage('Roll first.');
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

      // Se o jogo terminou, não faz mais nada
      if (checkGameOver()) return;

      // Se a jogada mudou para CPU, iniciar jogada automaticamente
      if (game.getCurrentPlayer().name === 'cpu') {
        setMessage('CPU´s turn');
        setTimeout(maybeCpuTurn, 100);
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

  /* Atualiza o HTML da tabela do scoreboard com base na variável 'scores'.*/
  function updateScoreboardView() {
    if (!scoreboardBody || !noScoresMsg) return;

    // Limpa a tabela
    scoreboardBody.innerHTML = '';

    const totalGames = scores.player.wins + scores.player.losses;

    if (totalGames === 0) {
      noScoresMsg.style.display = 'block'; // Mostra a mensagem "No games played"
      return;
    }

    noScoresMsg.style.display = 'none'; // Esconde a mensagem

    // Cria um array para ordenar por vitórias
    const stats = [
      { name: 'Player', ...scores.player },
      { name: 'CPU', ...scores.cpu }
    ];

    // Ordena por mais vitórias
    stats.sort((a, b) => b.wins - a.wins);

    // Helper para calcular o rácio W/L
    const getRatio = (wins, losses) => {
      if (losses === 0) return wins > 0 ? 'INF' : '0.00'; // Evita divisão por zero
      return (wins / losses).toFixed(2);
    };

    // Adiciona as linhas à tabela
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

  /* Chamado quando um jogo termina. Atualiza os scores e a UI. */
  function handleGameOver(winner) {
    if (!winner) return;

    const winnerName = winner.name; // 'player' ou 'cpu'
    const loserName = (winnerName === 'player') ? 'cpu' : 'player';

    // 1. Atualiza a variável 'scores'
    scores[winnerName].wins++;
    scores[loserName].losses++;
    
    // 2. Atualiza a tabela HTML
    updateScoreboardView();

    // 3. Mostra a mensagem e bloqueia o jogo
    setMessage(`Game Over! ${winnerName === 'player' ? 'You' : 'CPU'} won!`);
    if (rollBtn) rollBtn.disabled = true;
    if (boardEl) boardEl.classList.add('disabled-board');
  }

  /*  Verifica se o jogo terminou e, se sim, trata disso.
   * Retorna 'true' se o jogo terminou, 'false' caso contrário. */
  function checkGameOver() {
    if (!game) return false;
    
    const { over, winner } = game.isGameOver();
    
    if (over) {
      handleGameOver(winner);
      return true;
    }
    return false;
  }

  // ( ... )
  // Logo após a sua função checkGameOver()
  // ( ... )

  // Elementos do Modal
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');

  /* Mostra o modal de confirmação e espera por uma resposta.*/
  function showModal(title, text, confirmText = 'Yes', cancelText = 'No') {
    return new Promise((resolve) => {
      // 1. Preenche o modal com o texto
      modalTitle.textContent = title;
      modalText.textContent = text;
      modalConfirm.textContent = confirmText;
      modalCancel.textContent = cancelText;

      // 2. Mostra o modal
      modalOverlay.classList.remove('hidden');
      modalOverlay.style.display = 'grid';

      // 3. Define os listeners dos botões (apenas uma vez)
      
      // Função para fechar e limpar
      const close = (value) => {
        modalOverlay.style.display = 'none';
        modalOverlay.classList.add('hidden');
        // Remove os listeners para não se acumularem
        modalConfirm.onclick = null;
        modalCancel.onclick = null;
        resolve(value);
      };

      // 4. Atribui os cliques
      modalConfirm.onclick = () => close(true);
      modalCancel.onclick = () => close(false);
    });
  }

  // O botão "Intro Start" mostra o jogo e abre o painel
  introStartBtn?.addEventListener('click', () => {
    showGame(); // Mostra a grelha do jogo
    openSidePanel(); // Força a abertura do painel
    setMessage('Choose the configurations and click "Start" to play the game.');
  });
  
  // Side-panel Start (início real do jogo)
  if (startSideBtn) {
    startSideBtn.addEventListener('click', async () => {

    // Verifica se um jogo já está a decorrer
    if (window.game) {
        // Usa o nosso modal personalizado
        const confirmed = await showModal(
          'New game?',
          'Starting a new game will cancel the current one. Are you sure?',
          'Yes, Start New',
          'No, Cancel'
        );
        
        // Se o utilizador clicar "Cancelar" (false), a função para aqui.
        if (!confirmed) {
          return;
        }
      }
      // Se clicar "OK" (Yes), o código continua e 
      // o jogo atual (window.game) será simplesmente substituído,
      // sem ser pontuado.

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
      
      // Fechar o painel
      closeSidePanel();

      if (game.getCurrentPlayer().name === 'cpu') {
        setMessage('Game started! CPU plays first.');
        // Damos um pequeno atraso para a animação do painel fechar
        setTimeout(maybeCpuTurn, 100); 
      } else {
        setMessage('Game started! Your turn.');
        // Não faz nada, espera pelo clique no "Throw Sticks"
      }
    });
  }

  // Throw sticks
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      if (!game) {
        setMessage('Choose the configurations and click "Start" to play the game.');
        return;
      }

      const val = game.startTurn();
      renderSticks(val);

      // autoSkipIfNoMoves agora trata das mensagens e da lógica do turno
      const skipped = game.autoSkipIfNoMoves();

      if (skipped) {
        // A lógica foi tratada. Verificamos se precisamos de chamar o CPU.
        if (game.getCurrentPlayer().name === 'cpu') {
          // Se o turno passou para o CPU (ex: rolou 3 sem jogadas)
          maybeCpuTurn();
        }
        // Se ainda for a vez do jogador (ex: rolou 4 sem jogadas), 
        // a mensagem é "Roll again!" e não fazemos mais nada.
        return; 
      }
      
      // Se não saltou, há jogadas disponíveis.
      setMessage('Choose a piece to move.');
      renderAll();
    });
  }

  // Quit
  if (quitBtn) {
    quitBtn.addEventListener('click', async () => {
      
      let quitMessage = 'Game quit.';

      const confirmed = await showModal(
        'Quit?',
        'Are you sure you want to quit? This action wil count as a loss.',
        'Yes, quit',
        'No, cancel'
      );

      // Se o utilizador clicar "Cancelar" (false), não faz nada.
      if (!confirmed) {
        return;
      }

      // Se um jogo estiver a decorrer quando se clica em "Quit"
      if (window.game) {
        
        // Encontra o jogador CPU pelo nome
        const cpuPlayer = game.players.find(p => p.name === 'cpu');

        if (cpuPlayer) {
          // Chama a função de fim de jogo, passando o CPU como vencedor
          // Isto atualiza a variável 'scores' e o placar
          handleGameOver(cpuPlayer);
          
          // Define uma mensagem específica de desistência
          quitMessage = 'Game forfeited. CPU wins.';
        }
      }

      // O código de reset original corre em qualquer dos casos
      window.game = null;
      if (boardEl) boardEl.innerHTML = '';
      if (sticksEl) sticksEl.innerHTML = '';

      // Desativa os controlos de jogo, pois o jogo terminou
      if (rollBtn) rollBtn.disabled = true;
      
      // Define a mensagem (ou a default ou a de desistência)
      setMessage(quitMessage);

      // Fecha o painel lateral (caso esteja aberto)
      closeSidePanel();

      // Após 3 segundos, volta à mensagem de "pronto a jogar".
      setTimeout(() => {
        // Apenas reverte a mensagem se outro jogo não tiver começado
        if (!window.game) {
          setMessage('Choose the configurations and click "Start" to play the game.');
        }
      }, 3000); // 3 segundos
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
      if (isOpen) setTimeout(() => scoreboardPanel.focus(), 100);
    });
    scoreboardPanel.addEventListener('click', (e) => {
      if (e.target === scoreboardPanel) {
        scoreboardPanel.classList.remove('open');
        scoreboardBtn.innerHTML = '🏆';
      }
    });
  }

  /*Função chamada sempre que uma configuração é alterada no painel.*/
  function settingChangeListener() {
    if (window.game) {
      setMessage('Setting changed. Click "Start" to begin a new game with this setting.');
    }
  }

  // Substitui o seu listener 'sizeInput' antigo por estes
  sizeInput?.addEventListener('change', settingChangeListener);
  firstPlayerInput?.addEventListener('change', settingChangeListener);
  difficultyInput?.addEventListener('change', settingChangeListener);

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

    // Mostra o placar no estado inicial (vazio)
    updateScoreboardView();

    // Initial UI state
    showIntro();
    setMessage('Welcome to Tâb! Click Start to begin.');
  });

