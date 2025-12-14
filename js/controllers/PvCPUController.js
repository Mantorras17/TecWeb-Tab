import TabGame from '../classes/Tabgame.js';
import BaseGameController from './BaseGameController.js';
import { TIMING } from '../constants/Constants.js';

/**
 * Game controller for Player vs CPU games
 */
export default class PvCPUController extends BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager, cpuController) {
    super(uiManager, sticksRenderer, scoreManager, modalManager);
    this.cpuController = cpuController;
  }

  initGame(cols, difficulty, firstPlayer) {
    this.game = new TabGame(cols);
    this.game.curPlayerIdx = (firstPlayer === 'cpu') ? 1 : 0;
    window.game = this.game;

    this.setupCommonUI();
    this.renderAll();

    const currentPlayer = this.game.getCurrentPlayer();
    if (currentPlayer.name === 'cpu') {
      this.uiManager.setMessage('Game started. CPU goes first!');
      setTimeout(() => this.cpuController.maybeCpuTurn(this.game), TIMING.cpuStartMs);
    } else {
      this.uiManager.setMessage('Game started. Your turn!');
    }
  }

  renderAll(opts = { updateSticks: true }) {
    if (!this.game) return;
    this.uiManager.buildBoard(this.game);
    this.uiManager.updateBoardHighlights(this.game);
    
    if (opts.updateSticks) {
      this.sticksRenderer.renderSticks(this.game.stickValue ?? null, { animate: false });
    }
    
    this.updateRollBtn();
    
    const isCpu = this.game.getCurrentPlayer().name === 'cpu';
    const hasMoves = this.hasAnyValidMoves();
    const sticksThrown = this.game.stickValue !== null;
    
    const canPass = ((sticksThrown && !hasMoves) || this.game.waitingForPass) && !isCpu;
    this.uiManager.updatePassBtn(canPass);
    
    this.uiManager.updateBoardRotation(this.game);
    this.uiManager.setBoardDisabled(isCpu);
  }

  handleRoll() {
    if (!super.handleRoll()) return;

    const value = this.game.startTurn();
    this.sticksRenderer.renderSticks({ value: value, sticks: this.game.lastSticks }, { animate: true });
    this.sticksRenderer.queueAfterFlip(() => {
        this.announceRoll('player1', value);
        const hasMoves = this.hasAnyValidMoves();
        
        if (!hasMoves) {
            const isBonus = this.game.extraTurns.includes(value);
            if (isBonus) {
                this.uiManager.setMessage(`Bonus roll (${value}) but no moves. Roll again!`);
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
    if (this.game.getCurrentPlayer().name === 'cpu') return; 

    if (this.game.selectOrMoveAt(row, col)) {
        this.renderAll({ updateSticks: false });
        if (this.checkGameOver()) return;

        if (this.game.getCurrentPlayer().name === 'cpu') {
            this.uiManager.setMessage("CPU's turn");
            setTimeout(() => this.cpuController.maybeCpuTurn(this.game, this), TIMING.humanToCpuMs);
        } else {
            this.uiManager.setMessage("Player 1, play again!");
        }
    }
  }

  handlePass() {
    const roll = this.game.stickValue || this.game.lastStickValue;
    const isBonus = this.game.extraTurns.includes(roll);
    this.game.endTurn(isBonus); 
    this.renderAll();
    if (this.game.getCurrentPlayer().name === 'cpu') {
        this.uiManager.setMessage("CPU's turn");
        setTimeout(() => this.cpuController.maybeCpuTurn(this.game, this), 1000);
    }
  }

  async handleQuit() {
    const confirmed = await this.modalManager.showModal(
      'Quit?',
      'Are you sure you want to quit? This action will count as a loss.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;
    const winner = this.game.players[1];
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