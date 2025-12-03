import GameController from './controllers/GameController.js';
import UIManager from './ui/UIManager.js';
import SticksRenderer from './ui/SticksRenderer.js';
import ModalManager from './ui/ModalManager.js';
import CPUController from './controllers/CPUController.js';
import ScoreManager from './managers/ScoreManager.js';
import EventManager from './managers/EventManager.js';
import ServerManager from './managers/ServerManager.js';



document.addEventListener('DOMContentLoaded', () => {
  // Initialize all managers and controllers
  const uiManager = new UIManager();
  const sticksRenderer = new SticksRenderer(uiManager);
  const modalManager = new ModalManager(uiManager);
  const scoreManager = new ScoreManager(uiManager);
  const serverManager = new ServerManager();
  const cpuController = new CPUController(uiManager, sticksRenderer);
  const gameController = new GameController(
    uiManager, 
    sticksRenderer, 
    cpuController, 
    scoreManager, 
    modalManager,
    serverManager
  );
  window.gameController = gameController;
  window.serverManager = serverManager;
  
  // Set up event management
  const eventManager = new EventManager(gameController, uiManager, modalManager, serverManager);

  // Set global references for compatibility
  window.game = null;
  window.gameMessage = (text) => uiManager.setMessage(text);

  // Initialize UI state
  const elements = uiManager.getElements();
  uiManager.hide(elements.rollBtn);
  modalManager.collectPages();
  scoreManager.updateScoreboardView();
  uiManager.updateFirstPlayerOptions();
  uiManager.showIntro();
  uiManager.setMessage('Welcome to Tâb! Click Start to begin');
});