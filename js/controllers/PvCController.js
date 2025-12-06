import BaseGameController from './BaseGameController.js';
import TabGame from '../classes/Tabgame.js';
import { TIMING } from '../constants/Constants.js';

export default class PvCController extends BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager, cpuController) {
    super(uiManager, sticksRenderer, scoreManager, modalManager);
    this.cpuController = cpuController;
  }

  initGame(cols, difficulty, firstPlayer) {
    this.game = new TabGame(cols);
    this.game.isVsPlayer = false;
    this.game.difficultyLevel = difficulty;
    this.game.players[0].name = 'player1';
    this.game.players[1].name = 'cpu';
    
    if (firstPlayer === 'cpu') {
        this.game.curPlayerIdx = 1;
    } else {
        this.game.curPlayerIdx = 0;
    }

    window.game = this.game;
    
    this.setupCommonUI();
    this.renderAll();

    const cur = this.game.getCurrentPlayer();
    if (cur.name === 'cpu') {
        this.uiManager.setMessage("Game Started. CPU goes first.");
        setTimeout(() => this.cpuController.maybeCpuTurn(this.game, this), TIMING.cpuStartMs);
    } else {
        this.uiManager.setMessage("Game Started. Player 1 vs CPU.");
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
    // REFACTORED: Call base to check eligibility and lock button
    if (!super.handleRoll()) return;

    // Proceed with specific logic
    const val = this.game.startTurn();
    this.sticksRenderer.renderSticks({ value: val, sticks: this.game.lastSticks }, { animate: true });
    
    this.sticksRenderer.queueAfterFlip(() => {
        this.announceRoll('player1', val);
        const hasMoves = this.hasAnyValidMoves();
        
        if (!hasMoves) {
            const isBonus = [1, 4, 6].includes(val);
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

  // ... (handleBoardClick and handlePass remain the same) ...
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
    const isBonus = [1,4,6].includes(roll);
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
    this.cleanupGame();
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