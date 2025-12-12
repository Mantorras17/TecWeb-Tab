/**
 * Centralized event handling and user interactions
 */
export default class EventManager {
  constructor(gameController, uiManager, modalManager, serverManager) {
    this.gameController = gameController;
    this.uiManager = uiManager;
    this.modalManager = modalManager;
    this.serverManager = serverManager;
    this.elements = uiManager.getElements();
    this.validateCriticalElements();
    this.setupEventListeners();
  }

  /**
   * Validate that critical UI elements exist
   */
  validateCriticalElements() {
    const critical = [
      'boardEl', 'rollBtn', 'startSideBtn', 'introStartBtn', 
      'menuBtn', 'scoreboardBtn'
    ];
    
    const missing = critical.filter(elementName => !this.elements[elementName]);
    
    if (missing.length > 0) {
      console.error('Critical UI elements missing:', missing);
      throw new Error(`Critical UI elements missing: ${missing.join(', ')}`);

    }
  }

  /**
   * Safe event listener attachment with validation
   */
  safeAddEventListener(elementName, event, handler, options = {}) {
    const element = this.elements[elementName];
    
    if (!element) {
      const message = `Cannot attach ${event} listener: element '${elementName}' not found`;
      
      if (options.required) {
        console.error(message);
        throw new Error(message);
      } else {
        console.warn(message);
        return false;
      }
    }
    
    element.addEventListener(event, handler);
    return true;
  }

  setupEventListeners() {
    this.setupBoardEvents();
    this.setupGameControlEvents();
    this.setupUIControlEvents();
    this.setupInstructionEvents();
    this.setupScoreboardEvents();
    this.setupSidePanelEvents();
    this.setupUserMenuEvents();
    this.setupSettingsEvents();
    this.setupDocumentEvents();
  }

  setupBoardEvents() {
    this.safeAddEventListener('boardEl', 'click', (e) => {
      const cell = e.target.closest('.board-cell');
      if (!cell) return;
      const r = +cell.dataset.row;
      const c = +cell.dataset.col;
      this.gameController.handleBoardClick(r, c);
    }, { required: true });
  }

  setupGameControlEvents() {
    // Critical game controls - these should fail if missing
    this.safeAddEventListener('introStartBtn', 'click', () => {
      this.uiManager.showGame();
      this.uiManager.openSidePanel();
      this.uiManager.setMessage('Choose the configurations and click "Start" to play the game!');
      this.uiManager.show(this.elements.menuBtn);
      this.uiManager.show(this.elements.scoreboardBtn);
      this.uiManager.setCloseBlocked(true);
    }, { required: true });

    this.safeAddEventListener('startSideBtn', 'click', () => {
      this.gameController.startNewGame();
    }, { required: true });

    this.safeAddEventListener('rollBtn', 'click', () => {
      this.gameController.handlePlayerRoll();
    }, { required: true });

    this.safeAddEventListener('passTurnBtn', 'click', () => {
      this.gameController.handlePassTurn();
    });

    // Optional controls - warn but don't fail
    this.safeAddEventListener('quitBtn', 'click', () => {
      this.gameController.handleQuitGame();
    });
  }

  setupUIControlEvents() {
    this.safeAddEventListener('closePanelBtn', 'click', () => {
      this.uiManager.restoreMessageBeforeSettings();
      this.uiManager.closeSidePanel();
    });
  }

  setupInstructionEvents() {
    this.safeAddEventListener('instrOpen', 'click', () => {
      this.modalManager.openInstructions();
    });

    this.safeAddEventListener('instrPanel', 'click', (e) => {
      if (e.target.closest('.ins-close')) {
        this.modalManager.closeInstructions();
      }
    });

    this.safeAddEventListener('instrScrim', 'click', () => {
      this.modalManager.closeInstructions();
    });

    this.safeAddEventListener('insPrev', 'click', () => {
      this.modalManager.prevPage();
    });

    this.safeAddEventListener('insNext', 'click', () => {
      this.modalManager.nextPage();
    });
  }

  setupScoreboardEvents() {
    const { scoreboardBtn, scoreboardPanel } = this.elements;
    
    if (scoreboardBtn && scoreboardPanel) {
      scoreboardBtn.addEventListener('click', () => {
        const isOpen = scoreboardPanel.classList.toggle('open');
        scoreboardBtn.innerHTML = isOpen ? '&times;' : '🏆';
        if (isOpen) {
          // Ensure UI wiring and initial render occurs when panel opens
          try {
            this.uiManager.openScoreboardPanel(this.gameController.game?.columns || 9);
          } catch (e) {
            console.warn('Error opening scoreboard panel via UIManager', e);
          }
          setTimeout(() => scoreboardPanel.focus(), 100);
        }
      });

      scoreboardPanel.addEventListener('click', (e) => {
        if (e.target === scoreboardPanel) {
          scoreboardPanel.classList.remove('open');
          scoreboardBtn.innerHTML = '🏆';
        }
      });
    } else {
      console.warn('Scoreboard elements not found - scoreboard functionality disabled');
    }
  }

  setupSidePanelEvents() {
    const { menuBtn, sidePanel } = this.elements;
    
    if (menuBtn && sidePanel) {
      menuBtn.addEventListener('click', () => {
        const isOpen = sidePanel.classList.contains('open');
        if (isOpen) this.uiManager.closeSidePanel();
        else this.uiManager.openSidePanel();
      });
    } else {
      console.warn('Side panel elements not found - side panel functionality disabled');
    }

    this.safeAddEventListener('openSidePanelBtn', 'click', () => {
      this.uiManager.openSidePanel();
    });
  }

  setupUserMenuEvents() {
    const elements = this.uiManager.getElements();
    const { userAvatar, userMenu } = elements;
    
    if (userAvatar && userMenu) {
      userAvatar.addEventListener('click', () => {
        userMenu.classList.toggle('hidden');
      });
    }

    this.safeAddEventListener('loginBtn', 'click', () => {
      this.elements.menuMain?.classList.add('hidden');
      this.elements.menuLogin?.classList.remove('hidden');
    });

    this.safeAddEventListener('signupBtn', 'click', () => {
      this.elements.menuMain?.classList.add('hidden');
      this.elements.menuSignup?.classList.remove('hidden');
    });

    // Handle back buttons with safe queries
    const loginBackBtn = this.elements.menuLogin?.querySelector('.back-btn');
    if (loginBackBtn) {
      loginBackBtn.addEventListener('click', () => {
        this.elements.menuLogin?.classList.add('hidden');
        this.elements.menuMain?.classList.remove('hidden');
      });
    }

    const signupBackBtn = this.elements.menuSignup?.querySelector('.back-btn');
    if (signupBackBtn) {
      signupBackBtn.addEventListener('click', () => {
        this.elements.menuSignup?.classList.add('hidden');
        this.elements.menuMain?.classList.remove('hidden');
      });
    }

    // Lógica de Autenticação
    // função auxiliar para processar o login/registo
    const performAuth = async (nick, pass) => {
        if (!nick || !pass) { alert("Preenche tudo!"); return; }
        try {
          // chama o servidor 
          await this.serverManager.login(nick, pass);
          this.serverManager.setCredentials(nick, pass);
          
          // Atualiza UI
          if(this.elements.userIdSpan) this.elements.userIdSpan.textContent = nick;
          if(this.elements.userMenu) this.elements.userMenu.classList.add('hidden');
          alert(`Bem-vindo, ${nick}!`);
          
          // limpa os campos de input
          const inputs = [
                this.elements.menuLogin?.querySelector('#login-user'),
                this.elements.menuLogin?.querySelector('#login-pass'),
                this.elements.menuSignup?.querySelector('#signup-user'),
                this.elements.menuSignup?.querySelector('#signup-pass')
            ];
            inputs.forEach(input => { if(input) input.value = ''; });
        } catch (err) {
            alert("Erro: " + err.message);
        }
    };

    // ligar o botão de confirmar no login
    const loginConfirm = this.elements.menuLogin?.querySelector('.confirm');
    if (loginConfirm) {
      loginConfirm.addEventListener('click', () => {
        const nick = this.elements.menuLogin.querySelector('#login-user').value;
        const pass = this.elements.menuLogin.querySelector('#login-pass').value;
        performAuth(nick, pass);
      });
    }

    // ligar o botão de confirmar no sign up
    const signupConfirm = this.elements.menuSignup?.querySelector('.confirm');
    if (signupConfirm) {
      signupConfirm.addEventListener('click', () => {
        const nick = this.elements.menuSignup.querySelector('#signup-user').value;
        const pass = this.elements.menuSignup.querySelector('#signup-pass').value;
        performAuth(nick, pass);
      });
    }
  }

  setupSettingsEvents() {
    this.safeAddEventListener('sizeInput', 'change', () => {
      this.uiManager.handleSettingChange();
    });

    this.safeAddEventListener('firstPlayerInput', 'change', () => {
      this.uiManager.handleSettingChange();
    });

    this.safeAddEventListener('difficultyInput', 'change', () => {
      this.uiManager.handleSettingChange();
    });

    this.safeAddEventListener('gameModeInput', 'change', () => {
      this.uiManager.updateFirstPlayerOptions();
      this.uiManager.handleSettingChange();
    });
  }

  setupDocumentEvents() {
    document.addEventListener('click', (e) => {
      const { userMenu, userAvatar } = this.elements;
      if (userMenu && userAvatar && !userMenu.contains(e.target) && !userAvatar.contains(e.target)) {
        userMenu.classList.add('hidden');
      }
    });
  }
}