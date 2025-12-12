import UIManager from './ui/UIManager.js';
import SticksRenderer from './ui/SticksRenderer.js';
import ModalManager from './ui/ModalManager.js';
import ScoreManager from './managers/ScoreManager.js';
import EventManager from './managers/EventManager.js';
import ServerManager from './managers/ServerManager.js';

import CPUController from './controllers/CPUController.js';
import PvCPUController from './controllers/PvCPUController.js';
import PvPLocalController from './controllers/PvPLocalController.js';
import PvPOnlineController from './controllers/PvPOnlineController.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize managers
  const uiManager = new UIManager();
  const sticksRenderer = new SticksRenderer(uiManager);
  const modalManager = new ModalManager(uiManager);
  const serverManager = new ServerManager();
  const scoreManager = new ScoreManager(uiManager, serverManager);
  const cpuController = new CPUController(uiManager, sticksRenderer);
  uiManager.scoreManager = scoreManager;

  let activeController = null;

  // Facade to select the correct controller
  const gameController = {
    startNewGame: async () => {
      const elements = uiManager.getElements();

      if (activeController && window.game) {
        const confirmed = await modalManager.showModal(
          'New game?',
          'Starting a new game will cancel the current one. Are you sure?',
          'Yes, Start New',
          'No, Cancel'
        );
        
        // Handle Online Leave
        if (serverManager.state.active) {
          await serverManager.leave(serverManager.state.nick, serverManager.state.pass, serverManager.state.gameId);
          serverManager.clearGame();
        }

        if (!confirmed) return;
        
        if (activeController.cleanup) activeController.cleanup();
      }

      const gameMode = elements.gameModeInput?.value || 'pvc';
      const cols = elements.sizeInput ? parseInt(elements.sizeInput.value, 10) || 9 : 9;
      const difficulty = elements.difficultyInput ? elements.difficultyInput.value : 'easy';
      const firstPlayer = elements.firstPlayerInput ? elements.firstPlayerInput.value : 'player1';
      
      switch (gameMode) {
        case 'online': {
          activeController = new PvPOnlineController(uiManager, sticksRenderer, scoreManager, modalManager, serverManager); 
          activeController.initGame(cols);
          break;
        }
        case 'pvp': {
          activeController = new PvPLocalController(uiManager, sticksRenderer, scoreManager, modalManager); 
          activeController.initGame(cols, firstPlayer);
          break;
        }
        default: {
          activeController = new PvCPUController(uiManager, sticksRenderer, scoreManager, modalManager, cpuController); 
          activeController.initGame(cols, difficulty, firstPlayer);
          break;
        }
      };
      window.gameController = activeController;
    },

    handlePlayerRoll() {
      if (activeController) activeController.handleRoll();
    },

    handleBoardClick(row, col) {
      if (activeController) activeController.handleBoardClick(row, col);
    },

    handlePassTurn() {
      if (activeController) activeController.handlePass();
    },

    handleQuitGame: async () => {
      if (activeController) {
        await activeController.handleQuit();
        activeController = null;
      }
    }
  };
  
  // Set up event management
  const eventManager = new EventManager(gameController, uiManager, modalManager, serverManager);

  window.serverManager = serverManager;
  window.game = null;
  window.gameMessage = (text) => uiManager.setMessage(text);

  // Initialize UI state
  const elements = uiManager.getElements();
  uiManager.hide(elements.rollBtn);
  uiManager.show(elements.scoreboardBtn);
  modalManager.collectPages();
  scoreManager.updateScoreboardView();
  uiManager.updateFirstPlayerOptions();
  uiManager.showIntro();
  uiManager.setMessage('Welcome to Tâb! Click Start to begin');
});