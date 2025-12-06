import { ROLL_NAMES, TIMING } from '../constants/Constants.js';
import ConfettiManager from '../classes/ConfettiManager.js'; // Import it

export default class BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.scoreManager = scoreManager;
    this.modalManager = modalManager;
    this.game = null;
    
    // Initialize the manager
    this.confettiManager = new ConfettiManager();
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
   * Checks permissions and disables button immediately.
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

  handleGameOver(winner) {
    const winnerName = winner.name;
    const loser = (winner === this.game.players[0]) ? this.game.players[1] : this.game.players[0];
    this.scoreManager.updateScore(winnerName, loser.name);
    
    let display = winnerName === 'player1' ? 'Player 1' : (winnerName === 'cpu' ? 'CPU' : 'Player 2');
    this.sticksRenderer.msgAfterFlip(`Game Over! ${display} won!`);
    
    // --- TRIGGER CONFETTI ---
    this.confettiManager.start();
    // ------------------------

    this.uiManager.setBoardDisabled(true);
    setTimeout(() => {
        this.cleanup();
        this.uiManager.showGame();
        this.uiManager.openSidePanel();
        this.uiManager.openScoreboardPanel();
    }, TIMING.gameOverCleanupMs);
  }

  cleanup() {
    window.game = null;
    this.game = null;
    
    // --- STOP CONFETTI ---
    this.confettiManager.stop();
    // ---------------------

    this.uiManager.clearGameUI();
  }
}