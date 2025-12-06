import UIManager from './ui/UIManager.js';
import SticksRenderer from './ui/SticksRenderer.js';
import ModalManager from './ui/ModalManager.js';
import ScoreManager from './managers/ScoreManager.js';
import EventManager from './managers/EventManager.js';
import ServerManager from './managers/ServerManager.js';

// --- NEW CONTROLLERS ---
import CPUController from './controllers/CPUController.js';
import PvPController from './controllers/PvPController.js';
import PvCController from './controllers/PvCController.js';
import OnlineController from './controllers/OnlineController.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Managers
  const uiManager = new UIManager();
  const sticksRenderer = new SticksRenderer(uiManager);
  const modalManager = new ModalManager(uiManager);
  const scoreManager = new ScoreManager(uiManager);
  const serverManager = new ServerManager();
  const cpuController = new CPUController(uiManager, sticksRenderer);

  // 2. State for the Active Controller (Polymorphism)
  let activeController = null;

  // 3. The Coordinator (Proxy)
  // This object mimics the old GameController interface so EventManager still works.
  const gameCoordinator = {
    
    // --- START LOGIC ---
    startNewGame: async () => {
      const elements = uiManager.getElements();

      // Check if game is running
      if (activeController && window.game) { // window.game is set by the active controller
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
        
        // Cleanup old controller
        if (activeController.cleanup) activeController.cleanup();
      }

      // Read Settings
      const gameMode = elements.gameModeInput?.value || 'pvc';
      const cols = elements.sizeInput ? parseInt(elements.sizeInput.value, 10) || 9 : 9;
      const difficulty = elements.difficultyInput ? elements.difficultyInput.value : 'easy';
      const firstPlayer = elements.firstPlayerInput ? elements.firstPlayerInput.value : 'player1';

      // --- FACTORY SWITCH ---
      if (gameMode === 'online') {
          // ONLINE
          activeController = new OnlineController(
              uiManager, sticksRenderer, scoreManager, modalManager, serverManager
          );
          // Online usually handles its own "init" via server joining
          await activeController.initGame(cols); 

      } else if (gameMode === 'pvc') {
          // Player vs CPU
          activeController = new PvCController(
              uiManager, sticksRenderer, scoreManager, modalManager, cpuController
          );
          activeController.initGame(cols, difficulty, firstPlayer);

      } else {
          // Player vs Player
          activeController = new PvPController(
              uiManager, sticksRenderer, scoreManager, modalManager
          );
          activeController.initGame(cols, firstPlayer);
      }
      
      // Expose for debugging
      window.gameController = activeController; 
    },

    // --- DELEGATION METHODS ---
    // These pass the events to whichever controller is currently active
    
    handlePlayerRoll: () => {
      if (activeController) activeController.handleRoll();
    },

    handleBoardClick: (row, col) => {
      if (activeController) activeController.handleBoardClick(row, col);
    },

    handlePassTurn: () => {
      if (activeController) activeController.handlePass();
    },

    handleQuitGame: async () => {
        if (activeController) {
            await activeController.handleQuit();
            activeController = null;
        }
    }
  };

  // 4. Set up Event Management with the Coordinator
  // EventManager thinks it is talking to a normal GameController, 
  // but it's actually talking to our dynamic Proxy.
  const eventManager = new EventManager(gameCoordinator, uiManager, modalManager, serverManager);

  // 5. Globals & Init
  window.serverManager = serverManager;
  window.game = null; // Will be populated by the specific controllers
  window.gameMessage = (text) => uiManager.setMessage(text);

  const elements = uiManager.getElements();
  uiManager.hide(elements.rollBtn);
  modalManager.collectPages();
  scoreManager.updateScoreboardView();
  uiManager.updateFirstPlayerOptions();
  uiManager.showIntro();
  uiManager.setMessage('Welcome to Tâb! Click Start to begin');
});