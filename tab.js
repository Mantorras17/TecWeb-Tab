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
    this.over = false;      // <--- BUG ANTIGO: Faltavam estas
    this.winner = null;   // <--- BUG ANTIGO: Faltavam estas
  }

  initPlayers() {
    // OS NOMES SÃO AGORA 'player1' e 'cpu' por defeito
    const player = new Player('player1', 'blue', 3);
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
    const startRow = piece.owner.startRow; // <--- BUG ANTIGO: Faltava esta linha

    // Using BFS with k steps with rule-based pruning on edges
    let frontier = new Set([startId]);
    for (let step = 0; step < sticks; step++) {
      const next = new Set();
      frontier.forEach(id => {
        const from = graph.idToCoord(id);
        graph.neighborsId(id).forEach(nid => {
          const to = graph.idToCoord(nid);
          // BUG ANTIGO: Adicionada esta verificação
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

  // ESTA FUNÇÃO AGORA É "SILENCIOSA" (NÃO MOSTRA MENSAGENS)
  autoSkipIfNoMoves() {
    if (this.stickValue != null && !this.hasAnyLegalMove()) {
      const keepTurn = this.playAgain(); // ex: rolou 4
      
      if (keepTurn) {
        // Rola 1, 4, ou 6 sem jogadas. Não passa o turno.
        this.endTurn(true); // keepTurn = true
      } else {
        // Rola 2 ou 3 sem jogadas. Passa o turno.
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
    if (this.over) return false; // <--- BUG ANTIGO: Verificação de 'over'
    if (!piece || this.stickValue == null) return false;
    if (piece.owner !== this.getCurrentPlayer()) return false; // <--- BUG ANTIGO: Adicionado
    const legal = this.possibleMoves(piece, this.stickValue);
    const ok = legal.some(p => p.row === toRow && p.col === toCol);
    if (!ok) return false;
    const occ = this.isCellOccupied(toRow, toCol);
    if (occ && occ.owner === 'opponent') this.handleCapture(occ.piece);
    else if (occ && occ.owner === 'me') return false;
    piece.moveTo(toRow, toCol);
    this.clearSelection();
    if (this.checkGameOver().over) return true; // <--- BUG ANTIGO: Verificação de 'over'
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
    this.checkGameOver(); // <--- BUG ANTIGO: Adicionado
  }

  // ESTA FUNÇÃO AGORA É "SILENCIOSA" (NÃO MOSTRA MENSAGENS)
  moveSelectedTo(row, col) {
    if (this.over) return false; // <--- BUG ANTIGO: Adicionado
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
    
    if (this.checkGameOver().over) return true; // <--- BUG ANTIGO: Adicionado
    
    const playAgain = this.playAgain();
    
    // O bloco de mensagem foi REMOVIDO daqui
    
    this.endTurn(playAgain);
    return true; // Retorna 'true' para indicar que a jogada foi um sucesso
  }

  startTurn(sticks = null) {
    if (this.over) return null; // <--- BUG ANTIGO: Adicionado
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
    if (this.over) return; // <--- BUG ANTIGO: Adicionado
    this.stickValue = null;
    if (!keepTurn) this.curPlayerIdx = 1 - this.curPlayerIdx;
  }

  // NOME MUDADO: de 'isGameOver' para 'checkGameOver'
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

  // FUNÇÕES DE DEBUG REMOVIDAS (selfTestGraph, printArrowMap, etc.)
  // Elas estavam a causar confusão.

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
    const gameOverState = this.checkGameOver(); // <--- BUG ANTIGO: Corrigido para 'checkGameOver'
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
    if (depth === 0 || this.checkGameOver().over) { // <--- BUG ANTIGO: Corrigido para 'checkGameOver'
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

    let expectedValue = 0; // "let α := 0" do nó "random event"

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
              // Nó MAX: "α := max(α, ...)"
              bestScoreForThisRoll = Math.max(bestScoreForThisRoll, evaluation);
            } else {
              // Nó MIN: "α := min(α, ...)"
              bestScoreForThisRoll = Math.min(bestScoreForThisRoll, evaluation);
            }
          }
        }
      }
      // "α := α + (Probability[child] × ...)"
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


// =================================================================
// INÍCIO DA LÓGICA DA INTERFACE (UI)
// =================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Try to read size from a selector; fallback to 9
  const sizeInput = document.getElementById('board-size');
  
  // Single game instance
  let game;
  window.game = null;
  let cpuBusy = false;          // <--- ADICIONADO (faltava)
  let cpuRolledOnce = false;    // <--- ADICIONADO (faltava)
  let cpuTimer = null;
  let messageTimer = null;

  // --- NOVO SCOREBOARD A 3 ---
  let scores = {
    player1: { wins: 0, losses: 0, name: 'Player 1' },
    player2: { wins: 0, losses: 0, name: 'Player 2' },
    cpu:     { wins: 0, losses: 0, name: 'CPU' }
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
  const gameModeInput = document.getElementById('game-mode');
  const difficultyInput = document.getElementById('difficulty');
  const scoreboardBody = document.getElementById('scoreboard-body');
  const noScoresMsg = document.getElementById('no-scores-msg');
  const closePanelBtn = document.getElementById('closePanel'); // <--- ADICIONADO (faltava)

  // Helpers
  function setMessage(text) {
    if (!msgEl) return;
    msgEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'msg-box';
    box.textContent = text || '';
    msgEl.appendChild(box);
  }

  // Funções de controlo do Painel 
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

  /* Atualiza as opções 'first-player' com base no modo de jogo */
  function updateFirstPlayerOptions() {
    if (!gameModeInput || !firstPlayerInput) return;
    const selectedMode = gameModeInput.value;
    const currentFirstPlayer = firstPlayerInput.value;
    firstPlayerInput.innerHTML = '';

    let options = [];
    if (selectedMode === 'pvp') {
      // Se for Player vs Player
      options = [
        { value: 'player1', text: 'Player 1' },
        { value: 'player2', text: 'Player 2' }
      ];
    } else {
      // Se for Player vs CPU
      options = [
        { value: 'player1', text: 'Player 1' }, // <--- MUDANÇA (de 'player' para 'player1')
        { value: 'cpu', text: 'CPU' }
      ];
    }

    options.forEach(opt => {
      const optionEl = document.createElement('option');
      optionEl.value = opt.value;
      optionEl.textContent = opt.text;
      firstPlayerInput.appendChild(optionEl);
    });
    
    // Tenta repor a seleção
    if (currentFirstPlayer === 'player1') {
      firstPlayerInput.value = 'player1';
    } else if (selectedMode === 'pvp' && currentFirstPlayer === 'cpu') {
      firstPlayerInput.value = 'player2';
    } else if (selectedMode === 'pvc' && currentFirstPlayer === 'player2') {
      firstPlayerInput.value = 'cpu';
    }
  }

  window.gameMessage = setMessage; // <--- MUDANÇA (era 'window.setMessage')

  function renderSticks(valueOrResult) {
    if (!sticksEl) return;
    sticksEl.innerHTML = '';
    const value = typeof valueOrResult === 'number' ? valueOrResult : valueOrResult?.value;
    if (value == null) return;
    sticksEl.innerHTML = `Roll: <b>${value}</b>`; // <--- MUDANÇA (Removido '&rarr;')
  }

  // Build/Render board
  function buildBoard() {
    if (!boardEl) return;
    if (!game) return; // Não faz nada se o jogo não começou
    
    boardEl.innerHTML = '';
    const box = document.createElement('div');
    box.className = 'board-box';
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'stretch';
    container.style.gap = '2px';

    // Usa a perspetiva do JOGADOR ATUAL
    const mePlayer = game.getCurrentPlayer();
    const oppPlayer = game.getOpponentPlayer();
    // Determina a skin (p1=azul, p2=vermelho) com base no nome do jogador
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

        // Piece layer
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

  function updateBoardHighlights() {
    if (!boardEl || !game) return; // <--- MUDANÇA: Adicionada verificação 'game'
    
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
          if (pieceEl) {
            pieceEl.classList.add('selected');
          }
        }
        if (game.getSelectedMoves().some(p => p.row === r && p.col === c)) {
          cell.classList.add('highlight');
        }
      }
    }
  }

  function renderAll() {
    if (!window.game) return; // Se o jogo não começou, não faz nada
    
    buildBoard();
    updateBoardHighlights();
    renderSticks(game.stickValue ?? null);

    const currentPlayer = game.getCurrentPlayer();
    const isCpuTurn = (currentPlayer.name === 'cpu' && !game.isVsPlayer);

    // 1. Botão de Lançar
    if (rollBtn) {
      rollBtn.disabled = isCpuTurn || game.stickValue != null;
    }

    // 2. Tabuleiro
    if (boardEl) {
      if (isCpuTurn) {
        boardEl.classList.add('disabled-board');
      } else {
        boardEl.classList.remove('disabled-board');
      }
    }
  }

  // CPU turn handler 
  function maybeCpuTurn() {
    if (!game || game.over) return; // <--- MUDANÇA: Adicionada verificação 'over'
    
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu' || game.isVsPlayer) return; // <--- MUDANÇA: Não joga em PvP

    cpuBusy = true; // <--- MUDANÇA: Adicionado (faltava)

    const run = () => { // <--- MUDANÇA: Adicionada 'run' (faltava)
      cpuTimer = null;
      if (!game || game.over || game.getCurrentPlayer().name !== 'cpu' || game.isVsPlayer) {
        cpuBusy = false;
        return;
      }
      
      const val = game.startTurn();
      renderSticks(val);
      renderAll();
      setMessage(`CPU rolled: ${val}`);

      setTimeout(() => {
        const didPlay = game.cpuMove();
        renderAll();

        if (checkGameOver()) {
          cpuBusy = false; // <--- MUDANÇA: Adicionado
          return;
        }

        if (didPlay) {
          setMessage('CPU played.');
        } 
        
        setTimeout(() => {
          if (game.getCurrentPlayer().name === 'cpu') {
            setMessage('CPU plays again!');
            setTimeout(maybeCpuTurn, 100);
          } else {
            setMessage('Your turn!');
            cpuBusy = false; // <--- MUDANÇA: Adicionado
          }
        }, 100);
      }, 100); // tempo entre lançar e mover
    };
    
    setTimeout(run, 100); // tempo antes de lançar os paus
  }


  // Event delegation for board clicks
  if (boardEl) {
    boardEl.addEventListener('click', (e) => {
      if (!game || game.over) return; // <--- MUDANÇA: Adicionado 'over'
      
      const currentPlayer = game.getCurrentPlayer(); // Guarda o jogador ANTES da jogada

      // Bloco de guarda do CPU
      if (currentPlayer.name === 'cpu' && !game.isVsPlayer) {
        setMessage('Wait for CPU.');
        return;
      }

      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;

      // Bloco de guarda: Tem de rolar primeiro
      if (game.stickValue == null) {
        setMessage('Roll first.');
        return;
      }

      // Bloco de guarda: Limpa qualquer mensagem "Your turn!" pendente
      if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
      }

      // --- LÓGICA DE SELEÇÃO vs. MOVIMENTO ---
      const pieceAtClick = game.getCurrentPlayer().getPieceAt(r, c);

      if (pieceAtClick) {
        // --- AÇÃO 1: SELECIONAR UMA PEÇA ---
        if (game.selectedPiece === pieceAtClick) {
          game.clearSelection();
          updateBoardHighlights();
          return;
        }
        game.selectPieceAt(r, c);
        updateBoardHighlights(); // Mostra as jogadas possíveis
        
      } else {
        // --- AÇÃO 2: MOVER UMA PEÇA ---
        if (!game.selectedPiece) {
          return; // Clicou no vazio sem peça selecionada
        }

        // Tenta mover a peça
        const moveWasSuccessful = game.moveSelectedTo(r, c);

        if (moveWasSuccessful) {
          // --- A JOGADA FOI FEITA COM SUCESSO ---
          renderAll(); 
          if (checkGameOver()) return; 

          const nextPlayer = game.getCurrentPlayer();
          
          if (nextPlayer.name === 'cpu' && !game.isVsPlayer) {
            // MODO PvC: Passou para o CPU
            setMessage('CPU´s turn');
            setTimeout(maybeCpuTurn, 1000);
          } else {
            // MODO PvP OU (PvC e o Humano continua)
            if (nextPlayer === currentPlayer) {
              // O turno NÃO passou (jogou 1, 4, ou 6)
              if (game.isVsPlayer) {
                const P1_name = game.players[0].name;
                setMessage(`${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, play again!`);
              } else {
                setMessage("Play again!"); // Mensagem para PvC
              }
            } else {
              // O turno PASSOU (jogou 2 ou 3)
              if (game.isVsPlayer) {
                const P1_name = game.players[0].name;
                setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);
              }
              // Em PvC, não é preciso mensagem
            }
          }
        }
        // Se a jogada falhou (clicou num quadrado inválido), não faz nada
      }
    });
  }


  // Funções de Ecrã
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

  function showMode() { // Esta função não estava a ser usada, mas mantenho
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

  /* --- ATUALIZADO PARA O SCOREBOARD A 3 --- */
  function updateScoreboardView() {
    if (!scoreboardBody || !noScoresMsg) return;
    scoreboardBody.innerHTML = '';

    // Usa a nova estrutura 'scores'
    const totalGames = scores.player1.wins + scores.player1.losses + 
                       scores.player2.wins + scores.player2.losses + 
                       scores.cpu.wins + scores.cpu.losses;

    if (totalGames === 0) {
      noScoresMsg.style.display = 'block';
      return;
    }
    noScoresMsg.style.display = 'none';

    // Cria o array de estatísticas
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

  /* --- ATUALIZADO PARA O SCOREBOARD A 3 --- */
  function handleGameOver(winner) {
    if (!winner) return;

    const winnerName = winner.name; // 'player1', 'player2', ou 'cpu'
    
    // Encontra o perdedor
    const loserPlayer = (winner === game.players[0]) ? game.players[1] : game.players[0];
    const loserName = loserPlayer.name; // 'player1', 'player2', ou 'cpu'

    // 1. Atualiza a variável 'scores'
    if (scores[winnerName]) scores[winnerName].wins++;
    if (scores[loserName]) scores[loserName].losses++;
    
    // 2. Atualiza a tabela HTML
    updateScoreboardView();

    // 3. Mostra a mensagem
    let winnerDisplay = winnerName.toUpperCase(); // "CPU"
    if (winnerName === 'player1') winnerDisplay = 'Player 1';
    if (winnerName === 'player2') winnerDisplay = 'Player 2';

    setMessage(`Game Over! ${winnerDisplay} won!`);
    if (rollBtn) rollBtn.disabled = true;
    if (boardEl) boardEl.classList.add('disabled-board');
  }

  /*  Verifica se o jogo terminou e, se sim, trata disso. */
  function checkGameOver() {
    if (!game) return false;
    
    // USA O 'checkGameOver' DA CLASSE (corrigido)
    const { over, winner } = game.checkGameOver();
    
    if (over) {
      handleGameOver(winner);
      return true;
    }
    return false;
  }

  // Elementos do Modal
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalText = document.getElementById('modal-text');
  const modalConfirm = document.getElementById('modal-confirm');
  const modalCancel = document.getElementById('modal-cancel');

  /* Mostra o modal de confirmação e espera por uma resposta.*/
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

  // O botão "Intro Start" mostra o jogo e abre o painel
  introStartBtn?.addEventListener('click', () => {
    showGame();
    openSidePanel();
    setMessage('Choose the configurations and click "Start" to play the game.');
  });
  
  // Side-panel Start (início real do jogo)
  if (startSideBtn) {
    startSideBtn.addEventListener('click', async () => {

      if (window.game) {
        const confirmed = await showModal(
          'New game?',
          'Starting a new game will cancel the current one. Are you sure?',
          'Yes, Start New',
          'No, Cancel'
        );
        if (!confirmed) {
          return;
        }
      }

      // Ler as configurações do painel
      const gameMode = gameModeInput?.value || 'pvc';
      const cols = sizeInput ? parseInt(sizeInput.value, 10) || 9 : 9;
      const firstPlayer = firstPlayerInput ? firstPlayerInput.value : 'player1';
      const difficulty = difficultyInput ? difficultyInput.value : 'easy';

      // Criar a instância do jogo
      game = new TabGame(cols);
      window.game = game; // Expor globalmente
      game.isVsPlayer = (gameMode === 'pvp');

      // Aplicar as configurações
      game.players[0].name = 'player1'; // P1 é sempre 'player1'
      
      if (game.isVsPlayer) {
        // Modo Player vs Player
        game.players[1].name = 'player2';
      } else {
        // Modo Player vs CPU
        game.players[1].name = 'cpu'; // Garante que é 'cpu'
        game.difficultyLevel = ({easy: 0, medium: 1, hard: 2}[difficulty]) ?? 0;
      }

      // Define o jogador inicial
      if (firstPlayer === 'cpu' || firstPlayer === 'player2') {
        game.curPlayerIdx = 1;
      } else {
        game.curPlayerIdx = 0; // 'player1'
      }
      
      // Limpa timers antigos
      if (cpuTimer) { clearTimeout(cpuTimer); cpuTimer = null; }
      if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; } // <--- ADICIONADO
      cpuBusy = false;
      cpuRolledOnce = false;
      
      // Renderizar o tabuleiro e fechar o painel
      renderAll();
      closeSidePanel();

      // Define a mensagem de início
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
  
  // Botão de fechar o painel (do teu código antigo)
  closePanelBtn?.addEventListener('click', closeSidePanel);


  // Throw sticks (--- TOTALMENTE REESCRITO ---)
  if (rollBtn) {
    rollBtn.addEventListener('click', () => {
      if (!game) {
        setMessage('Choose the configurations and click "Start" to play the game.');
        return;
      }

      if (messageTimer) {
        clearTimeout(messageTimer);
        messageTimer = null;
      }

      const currentPlayer = game.getCurrentPlayer();
      
      const val = game.startTurn();
      renderSticks(val);
      renderAll(); // Desativa 'rollBtn'
      
      const skipped = game.autoSkipIfNoMoves(); 
      
      if (skipped) {
        const nextPlayer = game.getCurrentPlayer();
        let skipMessage = "";

        if (nextPlayer === currentPlayer) { // Rolou 1,4,6 (joga de novo)
          if (game.isVsPlayer) {
            const P1_name = game.players[0].name;
            skipMessage = `${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'} has no moves. Roll again!`;
          } else {
            skipMessage = "No possible moves. Roll again!";
          }
        } else { // Rolou 2,3 (passa o turno)
          skipMessage = "No possible moves. Turn passed.";
        }

        setTimeout(() => {
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
        }, 1200); // 1.2s para ver o roll

        return; 
      }
      
      setMessage('Choose a piece to move.');
    });
  }

  // Quit (--- LÓGICA DE VITÓRIA CORRIGIDA ---)
  if (quitBtn) {
    quitBtn.addEventListener('click', async () => {
      
      let quitMessage = 'Game quit.';

      const confirmed = await showModal(
        'Quit?',
        'Are you sure you want to quit? This action will count as a loss.',
        'Yes, quit',
        'No, cancel'
      );

      if (!confirmed) {
        return;
      }

      if (window.game && !game.over) { // <--- MUDANÇA: Só conta a derrota se o jogo não acabou
        
        // Quem clicou 'Quit'? O 'currentPlayer'.
        // Quem ganhou? O 'opponentPlayer'.
        const winnerPlayer = game.getOpponentPlayer();
        
        handleGameOver(winnerPlayer); // Passa o VENCEDOR
        
        let winnerDisplay = winnerPlayer.name.toUpperCase();
        if (winnerPlayer.name === 'player1') winnerDisplay = 'Player 1';
        if (winnerPlayer.name === 'player2') winnerDisplay = 'Player 2';
        
        quitMessage = `Game forfeited. ${winnerDisplay} wins.`;
      }

      // Reset
      window.game = null;
      if (boardEl) boardEl.innerHTML = '';
      if (sticksEl) sticksEl.innerHTML = '';
      if (rollBtn) rollBtn.disabled = true;
      
      setMessage(quitMessage);
      closeSidePanel();

      setTimeout(() => {
        if (!window.game) {
          setMessage('Choose the configurations and click "Start" to play the game.');
        }
      }, 3000); 
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

  // Função chamada sempre que uma configuração é alterada no painel.
  function settingChangeListener() {
    if (window.game) {
      setMessage('Setting changed. Click "Start" to begin a new game with this setting.');
    }
  }

  sizeInput?.addEventListener('change', settingChangeListener);
  firstPlayerInput?.addEventListener('change', settingChangeListener);
  difficultyInput?.addEventListener('change', settingChangeListener);
  gameModeInput?.addEventListener('change', () => {
    updateFirstPlayerOptions(); // Atualiza o dropdown "First Player"
    settingChangeListener();    // Mostra a mensagem "Setting changed..."
  });

  // User menu 
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
    // BUG ANTIGO: Corrigido para verificar se os elementos existem
    if (userMenu && userAvatar && !userMenu.contains(e.target) && !userAvatar.contains(e.target)) {
      userMenu.classList.add('hidden');
    }
  });

  // Mostra o placar no estado inicial (vazio)
  updateScoreboardView();

  // Define o estado inicial do dropdown 'first-player'
  updateFirstPlayerOptions(); 

  // Initial UI state
  showIntro();
  setMessage('Welcome to Tâb! Click Start to begin.');
});