/** @typedef {{row: number, col: number}} GridPos */



/**
 * Directed grid graph used to model legal forward moves on the Tâb board.
 * Nodes are addressed by (row, col) or by a flattened numeric id.
 */
export default class Graph {
	/**
	 * @param {number} rows Number of rows in the grid.
	 * @param {number} cols Number of columns in the grid.
	 */
	constructor(rows, cols) {
		/** @type {number} */ 			 this.rows = rows;
		/** @type {number} */ 			 this.cols = cols;
		/** @type {Set<number>[]} */ this.adj = Array.from({ length: rows * cols }, () => new Set());
	}


	/**
	 * Convert (row, col) to a flattened node id.
	 * @param {number} row
	 * @param {number} col
	 * @returns {number}
	 */
	coordToId(row, col) {
		return row * this.cols + col;
	}


	/**
	 * Convert a flattened node id back to (row, col).
	 * @param {number} id
	 * @returns {GridPos}
	 */
	idToCoord(id) {
		return {
			row: Math.floor(id / this.cols),
			col: id % this.cols
		};
	}


	/**
	 * Check whether a grid coordinate is inside the board.
	 * @param {number} row
	 * @param {number} col
	 * @returns {boolean}
	 */
	inBounds(row, col) {
		return (row >= 0) && (row < this.rows) && (col >= 0) && (col < this.cols);
	}


	/**
	 * Add a directed edge from one node id to another.
	 * @param {number} fromId
	 * @param {number} toId
	 */
	addEdgeId(fromId, toId) {
		this.adj[fromId].add(toId);
	}


	/**
	 * Add a directed edge using (row, col) coordinates.
	 * Ignores edges that go out of bounds.
	 * @param {number} fromRow
	 * @param {number} fromCol
	 * @param {number} toRow
	 * @param {number} toCol
	 */
	addEdgeRC(fromRow, fromCol, toRow, toCol) {
		if (!this.inBounds(fromRow, fromCol) || !this.inBounds(toRow, toCol)) return;
		this.addEdgeId(this.coordToId(fromRow, fromCol), this.coordToId(toRow, toCol));
	}


	/**
	 * Get neighbors of a node id as an array of ids.
	 * @param {number} id
	 * @returns {number[]}
	 */
	neighborsId(id) {
		return Array.from(this.adj[id] || []);
	}


	/**
	 * Get neighbors of a (row, col) as an array of coordinates.
	 * @param {number} row
	 * @param {number} col
	 * @returns {GridPos[]}
	 */
	neighborsRC(row, col) {
		const id = this.coordToId(row, col);
		return this.neighborsId(id).map(nid => this.idToCoord(nid));
	}


	/**
	 * Compute the set of nodes reachable in exactly k steps from a start id.
	 * @param {number} startId
	 * @param {number} k
	 * @returns {Set<number>}
	 */
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


	/**
	 * Compute coordinates reachable in exactly k steps from (row, col).
	 * @param {number} startRow
	 * @param {number} startCol
	 * @param {number} k
	 * @returns {GridPos[]}
	 */
	kStepRC(startRow, startCol, k) {
		const ids = this.kStepId(this.coordToId(startRow, startCol), k);
		return Array.from(ids).map(id => this.idToCoord(id));
	}
}