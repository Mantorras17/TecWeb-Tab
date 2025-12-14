import TabGame from '../classes/Tabgame.js';
import { TIMING, ROLL_NAMES } from '../constants/Constants.js';
import BaseGameController from './BaseGameController.js';

/**
 * Game controller for Local Player vs Player games
 */
export default class PvPLocalController extends BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager) {
    super(uiManager, sticksRenderer, scoreManager, modalManager);
  }

  initGame(cols, firstPlayer) {
    this.game = new TabGame(cols);
    this.game.isVsPlayer = true;
    this.game.players[0].name = 'player1';
    this.game.players[1].name = 'player2';
    
    this.game.curPlayerIdx = (firstPlayer === 'player2') ? 1 : 0;

    window.game = this.game; 
    
    this.setupCommonUI(); 
    this.renderAll();
    
    const cur = this.game.getCurrentPlayer();
    const msg = (cur.name === 'player1') ? "Game Started. Player 1's Turn." : "Game Started. Player 2's Turn.";
    this.uiManager.setMessage(msg);
  }

  /**
   * PVP RENDER: Rotates board for hotseat play.
   */
  renderAll(opts = { updateSticks: true }) {
    if (!this.game) return;
    this.uiManager.buildBoard(this.game);
    this.uiManager.updateBoardHighlights(this.game);
    
    if (opts.updateSticks) {
      this.sticksRenderer.renderSticks(this.game.stickValue ?? null, { animate: false });
    }
    
    this.updateRollBtn();
    
    const hasMoves = this.hasAnyValidMoves();
    const sticksThrown = this.game.stickValue !== null;
    const canPass = (sticksThrown && !hasMoves) || this.game.waitingForPass;
    this.uiManager.updatePassBtn(canPass);
    this.uiManager.updateBoardRotation(this.game);
  }

  handleRoll() {
    if (!super.handleRoll()) return;
    
    const val = this.game.startTurn();
    this.sticksRenderer.renderSticks({ value: val, sticks: this.game.lastSticks }, { animate: true });
    
    this.sticksRenderer.queueAfterFlip(() => {
      this.announceRoll(this.game.getCurrentPlayer().name, val);
      const hasMoves = this.hasAnyValidMoves();
      
      if (!hasMoves) {
        const isBonus = this.game.extraTurns.includes(val);
        if (isBonus) {
          this.uiManager.setMessage(`Bonus roll (${val}) but no moves. Roll again!`);
          this.game.endTurn(true);
        } else {
          this.uiManager.setMessage("No moves. Pass turn.");
          this.game.waitingForPass = true;
        }
      }
      this.renderAll({ updateSticks: false });
    });
  }

  handleBoardClick(row, col) {
    if (!this.game || this.game.stickValue === null) return;

    if (this.game.selectOrMoveAt(row, col)) {
      this.renderAll({ updateSticks: false });
      if (this.checkGameOver()) return;
      
      const cur = this.game.getCurrentPlayer();
      const msg = (cur.name === 'player1') ? "Player 1's Turn" : "Player 2's Turn";
      this.uiManager.setMessage(msg);
    }
  }

  handlePass() {
    const roll = this.game.stickValue || this.game.lastStickValue;
    const isBonus = [1,4,6].includes(roll);
    this.game.endTurn(isBonus);
    this.renderAll();
    const cur = this.game.getCurrentPlayer();
    const msg = (cur.name === 'player1') ? "Player 1's Turn" : "Player 2's Turn";
    this.uiManager.setMessage(msg);
  }

  async handleQuit() {
    const confirmed = await this.modalManager.showModal(
      'Quit?',
      'Are you sure you want to quit? This action will count as a loss.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;
    const winner = this.game.getOpponentPlayer();
    this.handleGameOver(winner);
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
}