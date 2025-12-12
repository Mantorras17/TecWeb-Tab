import Board from './Board.js'
import Player from './Player.js'
import Piece from './Piece.js'
/** @typedef {row:number, col:number} Cell */


/**
 * Main Tâb game controller.
 * Holds board state, turn flow, move generation, and simple CPU strategies.
 */
export default class TabGame {
  /**
   * @param {number} [columns=9] Number of columns in the track (board length).
   */
  constructor(columns = 9) {
    /** @type {number} */           this.columns = columns;
    /** @type {number} */           this.rows = 4;
    /** @type {Board} */            this.board = new Board(this.rows, this.columns);
    /** @type {[Player, Player]} */ this.players = this.initPlayers();
    /** 0 = current player is players[0], 1 = players[1]
      * @type {number} */           this.curPlayerIdx = 0;
    /** Last roll this turn (1,2,3,4,6) or null when not rolled yet.
      * @type {number|null} */      this.stickValue = null;
    /** Last non-null roll seen (for “play again” checks).
      * @type {1|2|3|4|6|null} */   this.lastStickValue = null;
    /** Faces of the last throw (four 0/1).
      * @type {number[]} */         this.lastSticks = [0, 0, 0, 0];
    /** Currently highlighted/selected piece (if any).
      * @type {Piece|null} */       this.selectedPiece = null;
    /** Cached legal destinations for the selected piece.
      * @type {Cell[]} */           this.selectedMoves = [];
    /** Rolls that grant an extra turn.
      * @type {Array<1|4|6>} */     this.extraTurns = [1, 4, 6];
    /** Game over flag and winner reference.
      * @type {boolean} */          this.over = false;
    /** @type {Player|null} */      this.winner = null;
    /** Difficulty: 0=random, 1=heuristic, 2=minimax.
      * @type {0|1|2} */            this.difficultyLevel = 0;
    
    /** Flag to force human player to click "Pass Turn" after moving on a 2 or 3 */
    this.waitingForPass = false;
  }


  /**
   * Initialize both players and their starting pieces.
   * @returns {[Player, Player]}
   */
  initPlayers() {
    // Player 1 starts at Row 3 (Blue), CPU/P2 starts at Row 0 (Red)
    const player = new Player('player1', 'blue', 3);
    const cpu = new Player('cpu', 'red', 0);

    for (let col = 0; col < this.columns; col++) {
      // Correct arguments order: (Owner, Row, Col)
      const playerPiece = new Piece(player, 3, col);
      const cpuPiece = new Piece(cpu, 0, col);
      
      player.addPiece(playerPiece);
      cpu.addPiece(cpuPiece);
    }
    return [player, cpu];
  }

  /**
   * Throw the 4 sticks and update stickValue/lastStickValue/lastSticks.
   * @returns {{sticks:number[], value: 1|2|3|4|6}}
   */
  throwSticks() {
    const sticks = Array.from({ length: 4 }, () => Math.random() < 0.5 ? 0 : 1);
    const sum = sticks.reduce((a, b) => a + b, 0);
    const value = (sum === 0) ? 6 : sum;
    this.stickValue = value;
    this.lastStickValue = value;
    this.lastSticks = sticks;
    return { sticks, value };
  }


  /**
   * Start a turn by rolling, or accept a provided value for tests.
   * @param {1|2|3|4|6|null} [sticks=null]
   * @returns {number|null} Current stick value.
   */
  startTurn(sticks = null) {
    if (this.over) return null;
    if (sticks == null) this.throwSticks();
    else {
      this.stickValue = sticks;
      this.lastStickValue = sticks;
    }
    return this.stickValue;
  }


  /**
   * Whether the last roll grants another turn.
   * @returns {boolean}
   */
  playAgain() {
    return this.extraTurns.includes(this.lastStickValue);
  }


  /**
   * End the current turn.
   * @param {boolean} [keepTurn=false] If true, current player goes again.
   * @returns {void}
   */
  endTurn(keepTurn = false) {
    if (this.over) return;
    this.stickValue = null;
    this.waitingForPass = false;
    if (!keepTurn) this.curPlayerIdx = 1 - this.curPlayerIdx;
  }


  /** * @returns {Player} 
  */
  getCurrentPlayer() {
    return this.players[this.curPlayerIdx];
  }


  /**
   * @returns {Player} 
   */
  getOpponentPlayer() {
    return this.players[1 - this.curPlayerIdx];
  }


  /**
   * Check if a cell is occupied and by whom (relative to current player).
   * @param {number} row
   * @param {number} col
   * @returns {{ piece: Piece, owner: 'me'|'opponent' } | null}
   */
  isCellOccupied(row, col) {
    const me = this.getCurrentPlayer().getPieceAt(row, col);
    if (me) return { piece: me, owner: 'me' };
    const opp = this.getOpponentPlayer().getPieceAt(row, col);
    if (opp) return { piece: opp, owner: 'opponent' };
    return null;
  }

  /**
   * Whether a player is allowed to enter the last row.
   * It is disallowed while any of their pieces still sits on their start row.
   * @param {Player} [player=this.getCurrentPlayer()]
   * @returns {boolean}
   */
  canUseLastRow(player = this.getCurrentPlayer()) {
    const startRow = player.startRow;
    return !player.pieces.some(p => p.row === startRow);
  }


  /**
   * Generate all legal destinations for a piece given a roll.
   * Applies row-entry rules for start/last rows.
   * @param {Piece} piece
   * @param {number} sticks
   * @returns {{row:number,col:number}[]}
   */
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


  /**
   * All legal moves for the current player based on the current roll.
   * @returns {{ piece: Piece, moves: {row:number,col:number}[] }[]}
   */
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


  /** * @returns {boolean} ~
   */
  hasAnyLegalMove() {
    return this.getAllLegalMoves().length > 0;
  }

  autoSkipIfNoMoves() {
    if (this.hasAnyLegalMove()) return false;
    const keepTurn = this.playAgain();
    this.endTurn(keepTurn);
    return true;
  }

  /**
   * Select a piece and compute its legal destinations for the current roll.
   * @param {number} row
   * @param {number} col
   * @returns {{row:number,col:number}[]} The legal destinations.
   */
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


  /**
   * If a piece is at (row,col), select it; otherwise try moving the selection there.
   * @param {number} row
   * @param {number} col
   * @returns {boolean} True if something was selected or moved.
   */
  selectOrMoveAt(row, col) {
    const piece = this.getCurrentPlayer().getPieceAt(row, col);
    if (piece) {
      const moves = this.selectPieceAt(row, col);
      return moves.length > 0;
    }
    if (!this.selectedPiece) return false;
    return this.moveSelectedTo(row, col);
  }


  /** * @returns {{row:number,col:number}[]} 
   */
  getSelectedMoves() {
    return this.selectedMoves.slice();
  }


  /** * Clear current selection and its cached moves. 
   */
  clearSelection() {
    this.selectedPiece = null;
    this.selectedMoves = [];
  }


  /**
   * Handle capturing an opponent piece (remove it, check end).
   * @param {Piece} capturedPiece
   * @returns {void}
   */
  handleCapture(capturedPiece) {
    this.getOpponentPlayer().removePiece(capturedPiece);
    this.checkGameOver();
  }


  /**
   * Move the currently selected piece to (row,col) if allowed.
   * @param {number} row
   * @param {number} col
   * @returns {boolean}
   */
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

    const again = this.playAgain();
    const isCpu = (this.getCurrentPlayer().name === 'cpu');

    if (again) this.endTurn(true);
    else {
      if (isCpu) this.endTurn(false);
      else {
        this.stickvalue = null;
        this.waitingForPass = true;
      }
    }
    return true;
  }


  /**
   * Determine if the game has ended and set winner if so.
   * @returns {{ over: boolean, winner: Player|null }}
   */
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


  /**
   * Pick a random legal move.
   * @returns {boolean} False if skipped due to no moves.
   */
  cpuMoveRandom() {
    const legalMoves = this.getAllLegalMoves();
    
    // CPU Must Auto-Pass if no moves
    if (legalMoves.length === 0) {
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


  /**
   * Simple heuristic:
   * +10 capture, +1 first move, +0.5 leaving start row sooner.
   * @returns {boolean}
   */
  cpuMoveHeuristic() {
    const legalMoves = this.getAllLegalMoves();
    
    // CPU Must Auto-Pass if no moves
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


  /**
   * Dispatch to the configured CPU difficulty.
   * @returns {boolean}
   */
  cpuMove() {
    switch (this.difficultyLevel) {
      case 1: return this.cpuMoveHeuristic();
      case 2: return this.cpuMoveMinimax();
      default: return this.cpuMoveRandom();
    }
  }


  /**
   * Heuristic evaluation of the current position for the current player.
   * @returns {number}
   */
/*   evaluateBoard() {
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
  } */


  /**
   * Expectiminimax-style lookahead with roll probabilities.
   */
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


  /**
   * Pick the move with best expected score at a fixed depth.
   * @returns {boolean}
   */
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