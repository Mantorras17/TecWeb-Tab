import Graph from './Graph.js'

/**
 * Logical board for the Tâb game.
 * Wraps a grid-graph with 4 rows and N columns and builds
 * the directed race track path pieces follow.
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
   */
	buildPath() {
		const g = this.graph;
		
        // Loop through every column to build the horizontal paths
		for (let c = 0; c < this.cols; c++) {
			
            // --- ROW 0 (Top) ---
            // Moves Right-to-Left (Indices decrease)
			if (c > 0) {
                g.addEdgeRC(0, c, 0, c - 1);
            } else {
                // End of Row 0 (Left Side). Turn into Row 1.
                // Required for Player 2 (0->1)
                g.addEdgeRC(0, 0, 1, 0); 
            }

            // --- ROW 1 ---
            // Moves Left-to-Right (Indices increase)
			if (c < this.cols - 1) {
                g.addEdgeRC(1, c, 1, c + 1);
            } else {
                // End of Row 1 (Right Side). 
                g.addEdgeRC(1, c, 0, c); // Turn UP to Row 0 (For Player 1)
				g.addEdgeRC(1, c, 2, c); // Turn DOWN to Row 2 (For Player 2)
			}

            // --- ROW 2 ---
            // Moves Right-to-Left (Indices decrease)
			if (c > 0) {
                g.addEdgeRC(2, c, 2, c - 1);
            } else {
                // End of Row 2 (Left Side).
                g.addEdgeRC(2, 0, 1, 0); // Turn UP to Row 1 (For Player 1)
                g.addEdgeRC(2, 0, 3, 0); // Turn DOWN to Row 3 (For Player 2) [THIS WAS MISSING]
            }

            // --- ROW 3 (Bottom) ---
            // Moves Left-to-Right (Indices increase)
			if (c < this.cols - 1) {
                g.addEdgeRC(3, c, 3, c + 1);
            } else {
                // End of Row 3 (Right Side). Turn UP to Row 2.
                // Required for Player 1 (3->2)
                g.addEdgeRC(3, c, 2, c);
            }
		}
	}
}