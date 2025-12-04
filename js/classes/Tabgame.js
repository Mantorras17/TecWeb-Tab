import Board from './Board.js'
import Player from './Player.js'
import Piece from './Piece.js'
/** @typedef {row:number, col:number} Cell */

export default class TabGame {
  constructor(columns = 9) {
    this.columns = columns;
    this.rows = 4;
    this.board = new Board(this.rows, this.columns);
    this.players = this.initPlayers();
    this.curPlayerIdx = 0;
    this.stickValue = null;
    this.lastStickValue = null;
    this.lastSticks = [0, 0, 0, 0];
    this.selectedPiece = null;
    this.selectedMoves = [];
    this.extraTurns = [1, 4, 6];
    this.over = false;
    this.winner = null;
    this.difficultyLevel = 0;
    this.waitingForPass = false;
  }

  initPlayers() {
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
    this.lastSticks = sticks;
    return { sticks, value };
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
    this.waitingForPass = false;
    if (!keepTurn) this.curPlayerIdx = 1 - this.curPlayerIdx;
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
    if (piece.state === 'not-moved') {
       if (sticks !== 1) return []; 
    }
    if (piece.canMoveFirst && !piece.canMoveFirst(sticks)) return [];
    
    const graph = this.board.graph;
    const startId = graph.coordToId(piece.row, piece.col);
    const lastLine = piece.calculateLastRow();
    const startRow = piece.owner.startRow;

    let frontier = new Set([startId]);
    for (let step = 0; step < sticks; step++) {
      const next = new Set();
      frontier.forEach(id => {
        const from = graph.idToCoord(id);
        graph.neighborsId(id).forEach(nid => {
          const to = graph.idToCoord(nid);

          const enteringStartRow = (from.row !== startRow) && (to.row === startRow);
          if (enteringStartRow) return;

          const enteringLastRow = (from.row !== lastLine) && (to.row === lastLine);
          if (enteringLastRow && piece.hasBeenInLastRow()) return;

          next.add(nid);
        });
      });
      frontier = next;
      if (frontier.size === 0) break;
    }

    const coords = Array.from(frontier).map(id => graph.idToCoord(id));
    return coords.filter(({ row, col }) => {
      const occ = this.isCellOccupied(row, col);
      const blocked = (occ && occ.owner === 'me');
      if (row === lastLine && piece.isCurrentlyInLastRow()) {
        if (!piece.canMoveInLastRow()) return false;
      }
      return !blocked;
    });
  }

  getAllLegalMoves() {
    if (this.stickValue == null) return [];
    const moves = [];
    for (const piece of this.getCurrentPlayer().pieces) {
      if (piece.canMoveFirst && !piece.canMoveFirst(this.stickValue)) continue;
      const dests = this.possibleMoves(piece, this.stickValue);
      if (dests.length) moves.push({ piece, moves: dests });
    }
    return moves;
  }

  hasAnyLegalMove() {
    return this.getAllLegalMoves().length > 0;
  }

  /**
   * MISSING METHOD FIXED HERE
   * Checks if current player has moves. If not, resolves turn (Pass or Extra Turn).
   */
  autoSkipIfNoMoves() {
    if (this.hasAnyLegalMove()) return false;

    // No moves available
    const keepTurn = this.playAgain(); // If 1, 4, 6, they get to roll again even with no moves
    this.endTurn(keepTurn);
    return true;
  }

  selectPieceAt(row, col) {
    const piece = this.getCurrentPlayer().getPieceAt(row, col);
    if (!piece) return [];
    if (this.stickValue === null) return [];
    
    const moves = this.possibleMoves(piece, this.stickValue);
    if (moves.length === 0) return [];

    this.selectedPiece = piece;
    this.selectedMoves = moves;
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

  getSelectedMoves() {
    return this.selectedMoves.slice();
  }

  clearSelection() {
    this.selectedPiece = null;
    this.selectedMoves = [];
  }

  handleCapture(capturedPiece) {
    this.getOpponentPlayer().removePiece(capturedPiece);
    this.checkGameOver();
  }

  moveSelectedTo(row, col) {
    if (this.over) return false;
    const piece = this.selectedPiece;
    if (!piece) return false;

    const allowed = this.selectedMoves.some(p => p.row === row && p.col === col);
    if (!allowed) return false;

    const occ = this.isCellOccupied(row, col);
    if (occ && occ.owner === 'opponent') {
      this.handleCapture(occ.piece);
    } else if (occ && occ.owner === 'me') {
      return false;
    }

    piece.moveTo(row, col);
    this.clearSelection();

    if (this.checkGameOver().over) return true;

    // --- MANUAL PASS TURN LOGIC ---
    const again = this.playAgain(); // True for 1, 4, 6
    const isCpu = (this.getCurrentPlayer().name === 'cpu');

    if (again) {
        // If 1, 4, 6: Keep turn immediately
        this.endTurn(true);
    } else {
        // If 2, 3 (Non-bonus):
        if (isCpu) {
            // CPU passes automatically
            this.endTurn(false);
        } else {
            // HUMAN: Wait for button click
            this.stickValue = null; 
            this.waitingForPass = true;
        }
    }
    return true;
  }

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

  cpuMoveRandom() {
    const legalMoves = this.getAllLegalMoves();
    if (legalMoves.length === 0) {
        // Should be handled by autoSkip, but safeguard:
        const keepTurn = this.playAgain();
        this.endTurn(keepTurn);
        return true;
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
        const keepTurn = this.playAgain();
        this.endTurn(keepTurn);
        return true;
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
    
    if (bestMoves.length === 0) return this.cpuMoveRandom();

    const { piece, move } = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    this.selectedPiece = piece;
    this.selectedMoves = this.possibleMoves(piece, this.lastStickValue);
    this.moveSelectedTo(move.row, move.col);
    return true;
  }

  cpuMove() {
    if (this.difficultyLevel === 0) return this.cpuMoveRandom();
    if (this.difficultyLevel === 1) return this.cpuMoveHeuristic();
    if (this.difficultyLevel === 2) return this.cpuMoveMinimax();
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
      { value: 1, prob: 0.25 },
      { value: 2, prob: 0.38 },
      { value: 3, prob: 0.25 },
      { value: 4, prob: 0.06 },
      { value: 6, prob: 0.06 }
    ];

    let expectedValue = 0;
    for (const roll of rolls) {
      let bestScoreForThisRoll = isMaximizingPlayer ? -Infinity : +Infinity;

      const allMoves = [];
      for (const piece of this.getCurrentPlayer().pieces) {
        if (piece.canMoveFirst && !piece.canMoveFirst(roll.value)) continue;
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

            if (isMaximizingPlayer) bestScoreForThisRoll = Math.max(bestScoreForThisRoll, evaluation);
            else bestScoreForThisRoll = Math.min(bestScoreForThisRoll, evaluation);
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
      const keepTurn = this.playAgain();
      this.endTurn(keepTurn);
      return true;
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
        const score = this.minimax(DEPTH, playAgain);

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