import { TIMING, ROLL_NAMES } from '../constants/Constants.js';

/**
 * Base game controller with shared logic across all game modes
 */
export default class BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.scoreManager = scoreManager;
    this.modalManager = modalManager;
    this.game = null;
  }

  setupCommonUI() {
    this.uiManager.showGame();
    this.uiManager.closeSidePanel();
    this.uiManager.setCloseBlocked(false);
    this.uiManager.hardShowScoreboard();
    this.uiManager.closeScoreboardPanelIfOpen();

    const els = this.uiManager.getElements();
    this.uiManager.show(els.rollBtn);
    this.uiManager.show(els.passTurnBtn);
    this.uiManager.show(els.sticksEl);
    
    this.sticksRenderer.renderSticks(null);
  }

  /**
   * Check whether the game is over and trigger end-game handling if so.
   */
  handleRoll() {
    if (!this.canPlayerRoll()) return false;
    this.uiManager.updateRollBtn(false);
    return true;
  }

  updateRollBtn() {
    const enabled = this.canPlayerRoll();
    this.uiManager.updateRollBtn(enabled);
  }

  canPlayerRoll() {
    if (!this.game || this.sticksRenderer.isBusy() || this.game.waitingForPass) return false;
    const cur = this.game.getCurrentPlayer();
    if (cur && cur.name === 'cpu') return false;
    return this.game.stickValue == null;
  }

  hasAnyValidMoves() {
    if (!this.game || this.game.stickValue === null) return false;
    const player = this.game.getCurrentPlayer();
    for (const piece of player.pieces) {
      if (this.game.possibleMoves(piece, this.game.stickValue).length > 0) return true;
    }
    return false;
  }

  announceRoll(playerName, value) {
    const name = ROLL_NAMES[value] ?? String(value);
    let display = playerName;
    if (playerName === 'player1') display = 'Player 1';
    if (playerName === 'player2') display = 'Player 2';
    if (playerName === 'cpu') display = 'CPU';
    this.uiManager.setMessage(`${display} rolled a ${name} (${value})!`);
  }

  checkGameOver() {
    if (!this.game) return false;
    const { over, winner } = this.game.checkGameOver();
    if (over) {
      this.handleGameOver(winner);
      return true;
    }
    return false;
  }

  /**
   * Handle end of game: stats, UI disable, auto-redirect back to setup.
   */
  handleGameOver(winner) {
    const winnerName = winner.name;
    const loserPlayer = (winner === this.game.players[0]) ? this.game.players[1] : this.game.players[0];
    this.scoreManager.updateScore(winnerName, loserPlayer.name);

    const winnerDisplay = winnerName === 'player1' ? 'Player 1' : (winnerName === 'player2' ? 'Player 2' : 'CPU');
    this.uiManager.setMessage(`${winnerDisplay} wins the game!`);
    const cols = this.game ? this.game.columns : undefined;
    this.uiManager.setBoardDisabled(true);
    setTimeout(() => {
        this.cleanup();
        this.uiManager.showGame();
        this.uiManager.openSidePanel();
        this.uiManager.openScoreboardPanel(cols);
    }, TIMING.gameOverCleanupMs);
  }

  /**
   * Clean up game state
   */
  cleanup() {
    window.game = null;
    this.game = null;
    this.uiManager.clearGameUI();
  }

  /**
   * Get current game instance
   */
  getGame() {
    return this.game;
  }

  /**
   * Handle game quit
   */
  async handleQuitGame() {
    const confirmed = await this.modalManager.showModal(
      'Quit?',
      'Are you sure you want to quit? This action will count as a loss.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;

    if (window.game && !this.game.over) {
      const winnerPlayer = this.game.getOpponentPlayer();
      this.handleGameOver(winnerPlayer);
    }
    
    this.cleanup();
    this.uiManager.setMessage('Game quit.');
    this.uiManager.closeSidePanel();
    
    setTimeout(() => {
      if (!window.game) {
        this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
        this.uiManager.setCloseBlocked(true);
      }
    }, 3000);
  }

  /**
   * Check if player has any valid moves for current stick value
   */
  hasAnyValidMoves() {
    if (!this.game || this.game.stickValue === null) return false;
    
    const player = this.game.getCurrentPlayer();
    
    for (const piece of player.pieces) {
      const moves = this.game.possibleMoves(piece, this.game.stickValue);
      if (moves.length > 0) return true;
    }
    
    return false;
  }

  /**
   * Load and render offline scores
   */
  loadOfflineScores() {
      if (!this.scoreManager) return;
      const scores = this.scoreManager.getOfflineScores();
      this.uiManager.renderOfflineScoreboard(scores);
  }

  /**
   * Load and render online scores (implemented in OnlineGameController)
   */
  async loadOnlineScores() {
      // Override in OnlineGameController
  }

  /**
   * Helper: Convert board coordinates to server index
   */
  getIndexFromCoords(r, c, cols) {
    let indexBase = 0;
    if (r === 3) indexBase = 0;
    if (r === 2) indexBase = cols;
    if (r === 1) indexBase = 2 * cols;
    if (r === 0) indexBase = 3 * cols;
    
    let offset = c;
    if (r === 2 || r === 0) offset = (cols - 1) - c;
    return indexBase + offset;
  }

  /**
   * Helper: Convert server index to board coordinates
   */
  getCoordsFromIndex(index, cols) {
    const rowIdx = Math.floor(index / cols); 
    const offset = index % cols;
    let r = 3 - rowIdx; 
    let c = offset;
    if (r === 2 || r === 0) c = (cols - 1) - offset;
    return { row: r, col: c };
  }
}