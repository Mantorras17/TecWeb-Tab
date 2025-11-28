/** @typedef {import('./classes/piece.js').default} Piece */
/** @typedef {'player1'|'player2'|'cpu'|string} PlayerName */
/** @typedef {'not-moved'|'first-row'|'moved'|'last-row'} PieceState */



/**
 * Represents a Tâb player: identity, starting row, and owned pieces.
 */
export default class Player {
  /**
   * @param {PlayerName} name Display or logical name.
   * @param {string} skin Visual token for rendering.
   * @param {number} startRow Row index where this player's pieces start.
   */
  constructor(name, skin, startRow) {
    /** @type {PlayerName} */ this.name = name;
    /** @type {string} */     this.skin = skin;
    /** @type {Piece[]} */    this.pieces = [];
    /** @type {number} */     this.startRow = startRow;
  }


  /**
   * Add a piece to this player.
   * @param {Piece} newPiece
   */
  addPiece(newPiece) {
    this.pieces.push(newPiece);
  }


  /**
   * Remove a piece from this player (if present).
   * @param {Piece} piece
   */
  removePiece(piece) {
    const idx = this.pieces.indexOf(piece);
    if (idx > -1) {
      this.pieces.splice(idx, 1);
    }
  }


  /**
   * Find a piece owned by this player at grid coordinate.
   * @param {number} row
   * @param {number} col
   * @returns {Piece|undefined}
   */
  getPieceAt(row, col) {
    return this.pieces.find(piece => piece.row === row && piece.col === col);
  }


  /**
   * Get all pieces in a given progress state.
   * @param {PieceState} state
   * @returns {Piece[]}
   */
  getPiecesByState(state) {
    return this.pieces.filter(piece => piece.state === state);
  }


  /**
   * Whether this player has no remaining pieces.
   * @returns {boolean}
   */
  hasLost() {
    return this.pieces.length === 0;
  }
}