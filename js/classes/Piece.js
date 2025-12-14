/** @typedef {'not-moved'|'first-row'|'moved'|'last-row'} PieceState */
/** @typedef {import('../player.js').default} Player */



/**
 * A playing piece on the Tâb board.
 * Tracks its owner, grid position and progress state.
 */
export default class Piece {
  /**
   * @param {Player} owner The player who owns this piece.
   * @param {number} row   Initial row.
   * @param {number} col   Initial column.
   */
  constructor(owner, row, col) {
    /** @type {Player} 		 */ this.owner = owner;
    /** @type {number} 	 	 */ this.row = row;
    /** @type {number} 		 */ this.col = col;
    /** @type {PieceState} */ this.state = 'not-moved';
  }


  /**
   * Move the piece to a new grid cell and update its progress state.
   * - Reaching the opponent's starting row marks 'last-row'
   * - Returning to own start marks 'first-row'
   * - Otherwise transitions from 'not-moved'/'first-row' to 'moved'
   * @param {number} newRow
   * @param {number} newCol
   */
  moveTo(newRow, newCol) {
    this.row = newRow;
    this.col = newCol;

    const firstRow = this.owner.startRow;
    const lastRow = this.calculateLastRow();

    if (newRow === lastRow) {
      this.state = 'last-row';
      return;
    }

    if (this.state === 'last-row') {
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

  /**
   * Whether this piece has ever been in the last row.
   * @returns {boolean}
   */
  hasBeenInLastRow() {
    return this.state === 'last-row';
  }

  /**
   * Whether this piece is currently in the last row.
   * @returns {boolean}
   */
  isCurrentlyInLastRow() {
    return this.row === this.calculateLastRow();
  }


  /**
   * Whether this piece can make its first move given a roll.
   * Rules: a piece that has not moved yet can only start on a roll of 1 (Tâb).
   * @param {number} sticks Current roll value (1,2,3,4,6).
   * @returns {boolean}
   */
  canMoveFirst(sticks) {
    return !(this.state === 'not-moved' && sticks !== 1);
  }


  /**
   * Whether the piece may enter the last row. It may not if:
   * - It is already in the last row, or
   * - Another of the same player's pieces still occupies the starting row.
   * @returns {boolean}
   */
  canMoveInLastRow() {
    const startRow = this.owner.startRow;
    return !this.owner.pieces.some(p => p.row === startRow);
  }


  /**
   * Compute the opponent's starting row (the "last row" for this piece).
   * @returns {number} Row index in [0..3].
   */
  calculateLastRow() {
    return 3 - this.owner.startRow;
  }
}