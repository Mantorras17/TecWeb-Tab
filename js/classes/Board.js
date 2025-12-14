import Graph from './Graph.js'


/**
 * Logical board for the Tâb game.
 * Wraps a grid-graph with 4 rows and N columns and builds
 * the directed race track path pieces follow.
 *
 * Track layout (arrows show allowed move direction):
 * - Row 0:  -><-  (right-to-left across the top row)
 * - Row 1:  ->    (left-to-right)
 * - Row 2:  <-    (right-to-left)
 * - Row 3:  ->    (left-to-right)
 * With vertical links at the ends to connect rows into a single circuit.
 */
export default class Board {
	/**
   * Create a board with a 4 x cols grid.
   * @param {number} rows Number of rows (expected 4).
   * @param {number} cols Number of columns (board length).
   */
	constructor(rows, cols) {
		this.rows = rows;
		this.cols = cols;
		this.graph = new Graph(rows, cols);
		this.buildPath();
	}

	/**
   * Build the directed edges that define legal forward movement.
   * Uses Graph.addEdgeRC(fromRow, fromCol, toRow, toCol).
   * - Top row (0): right-to-left; left end links down to row 1, col 0.
   * - Row 1: left-to-right; right end links up to row 0 and down to row 2.
   * - Row 2: right-to-left; left end links up to row 1, col 0.
   * - Bottom row (3): left-to-right; right end links up to row 2.
   */
	buildPath() {
		const g = this.graph;
		for (let c = 0; c < this.cols; c++) {
			if (c > 0) g.addEdgeRC(0, c, 0, c-1);
			else g.addEdgeRC(0, 0, 1, 0);
			if (c < this.cols-1) g.addEdgeRC(1, c, 1, c+1);
			else {
				g.addEdgeRC(1, c, 0, c); // up to row 0
				g.addEdgeRC(1, c, 2, c); // down to row 2
			}
			if (c > 0) g.addEdgeRC(2, c, 2, c-1);
			else {
				g.addEdgeRC(2, 0, 1, 0);
				g.addEdgeRC(2, 0, 3, 0);
			}
			if (c < this.cols-1) g.addEdgeRC(3, c, 3, c+1);
			else g.addEdgeRC(3, c, 2, c);
		}
	}
}