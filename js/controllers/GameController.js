import TabGame from '../classes/Tabgame.js';
import { TIMING, DIFFICULTY_LEVELS, ROLL_NAMES } from '../constants/Constants.js';

/**
 * Main game orchestration - handles game lifecycle, turn management, and coordination
 */
export default class GameController {
  constructor(uiManager, sticksRenderer, cpuController, scoreManager, modalManager) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.cpuController = cpuController;
    this.scoreManager = scoreManager;
    this.modalManager = modalManager;
    this.game = null;
    this.messageTimer = null;
  }

  /**
   * Start a new game with given configuration
   */
  async startNewGame() {
    const elements = this.uiManager.getElements();
    
    if (window.game) {
      const confirmed = await this.modalManager.showModal(
        'New game?',
        'Starting a new game will cancel the current one. Are you sure?',
        'Yes, Start New',
        'No, Cancel'
      );
      if (!confirmed) return;
    }

    const gameMode = elements.gameModeInput?.value || 'pvc';
    const cols = elements.sizeInput ? parseInt(elements.sizeInput.value, 10) || 9 : 9;
    const firstPlayer = elements.firstPlayerInput ? elements.firstPlayerInput.value : 'player1';
    const difficulty = elements.difficultyInput ? elements.difficultyInput.value : 'easy';

    this.game = new TabGame(cols);
    window.game = this.game;

    this.uiManager.setCloseBlocked(false);

    this.game.isVsPlayer = (gameMode === 'pvp');
    this.game.players[0].name = 'player1';
    
    if (this.game.isVsPlayer) {
      this.game.players[1].name = 'player2';
    } else {
      this.game.players[1].name = 'cpu';
      this.game.difficultyLevel = DIFFICULTY_LEVELS[difficulty] ?? 0;
    }

    if (firstPlayer === 'cpu' || firstPlayer === 'player2') {
      this.game.curPlayerIdx = 1;
    } else {
      this.game.curPlayerIdx = 0;
    }

    this.cpuController.clearTimers();

    this.uiManager.show(elements.rollBtn);
    this.uiManager.show(elements.passTurnBtn); // Ensure Pass button is visible now

    this.updateRollBtn();
    this.uiManager.hardShowScoreboard();
    this.uiManager.show(elements.sticksEl);

    this.sticksRenderer.renderSticks(null);
    this.renderAll();
    this.uiManager.closeSidePanel();
    this.uiManager.closeScoreboardPanelIfOpen();

    const currentPlayer = this.game.getCurrentPlayer();
    if (currentPlayer.name === 'cpu') {
      this.uiManager.setMessage('Game started. Player 2 plays first!');
      setTimeout(() => this.cpuController.maybeCpuTurn(this.game), TIMING.cpuStartMs);
    } else if (currentPlayer.name === 'player1') {
      this.uiManager.setMessage('Game started. Player 1, your turn!');
    } else if (currentPlayer.name === 'player2') {
      this.uiManager.setMessage('Game started. Player 2, your turn!');
    }
  }

  /**
     * Handle human player roll
     */
  handlePlayerRoll() {
    const currentPlayer = this.game.getCurrentPlayer();
    
    if (!this.canPlayerRoll()) {
      const turn = currentPlayer?.name;
      if (turn === 'cpu') this.uiManager.setMessage("Wait — Player 2's turn.");
      else if (this.sticksRenderer.isBusy()) this.uiManager.setMessage('Throwing sticks in progress…');
      else this.uiManager.setMessage('You already threw. Move a piece!');
      return;
    }

    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }

    const val = this.game.startTurn();
    this.updateRollBtn();
    
    this.sticksRenderer.renderSticks({ value: val, sticks: this.game.lastSticks }, { animate: true });
    
    this.sticksRenderer.queueAfterFlip(() => {
        this.announceRoll(currentPlayer?.name ?? 'Player', val);

        const hasMoves = this.hasAnyValidMoves();

        // --- NEW LOGIC START ---
        if (!hasMoves) {
          const isBonus = [1, 4, 6].includes(val);
          
          if (isBonus) {
              // CASE: Bonus Roll (4/6) but No Moves.
              // Auto-resolve: Keep the turn, clear the "move phase", let player roll again immediately.
              this.uiManager.setMessage(`You rolled a ${val} (Bonus) but have no moves. Throw again!`);
              
              // This resets stickValue to null, which enables the Roll button and disables Pass button
              this.game.endTurn(true); 
          } else {
              // CASE: Normal Roll (2/3) and No Moves.
              // Must manually Pass Turn to acknowledge loss of turn.
              this.uiManager.setMessage(`No moves available for ${val}. Click 'Pass Turn' to end turn.`);
          }
        } else {
          this.sticksRenderer.msgAfterFlip('Choose a piece to move!', 600);
        }
        // --- NEW LOGIC END ---

        // This will update buttons based on the new state set above
        this.renderAll({ updateSticks: false });
    });
  }
  /**
   * Handle board cell click
   */
  handleBoardClick(row, col) {
    if (!this.game || this.game.over) return;
    
    const currentPlayer = this.game.getCurrentPlayer();
    if (currentPlayer.name === 'cpu' && !this.game.isVsPlayer) {
      this.uiManager.setMessage('Wait for Player 2');
      return;
    }

    if (this.game.stickValue == null) {
      this.uiManager.setMessage('Throw sticks first!');
      return;
    }

    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }

    const pieceAtClick = this.game.getCurrentPlayer().getPieceAt(row, col);
    
    if (pieceAtClick) {
      if (this.game.selectedPiece === pieceAtClick) {
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
        return;
      }
      this.game.selectPieceAt(row, col);
      this.uiManager.updateBoardHighlights(this.game);
    } else {
      if (!this.game.selectedPiece) {
        return;
      }
      
      const moveWasSuccessful = this.game.moveSelectedTo(row, col);
      if (moveWasSuccessful) {
        this.renderAll({ updateSticks: false });
        this.sticksRenderer.sticksToGrey(0);
        
        if (this.checkGameOver()) return;

        const nextPlayer = this.game.getCurrentPlayer();
        const P1_name = this.game.players[0].name;
        
        if (this.game.waitingForPass) {
            this.uiManager.setMessage("Move complete. Click 'Pass Turn' to finish.");
        } 
        else if (nextPlayer.name === 'cpu' && !this.game.isVsPlayer) {
          this.uiManager.setMessage("Player 2's turn.");
          this.sticksRenderer.queueAfterFlip(() => this.cpuController.maybeCpuTurn(this.game, false), TIMING.humanToCpuMs);
        } else {
           if (nextPlayer === currentPlayer) {
             this.uiManager.setMessage(`${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, play again!`);
           } else {
             this.uiManager.setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);
           }
        }
      }
    }
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

  /**
   * Determine if the human player is allowed to roll the sticks now.
   */
  canPlayerRoll() {
    if (!this.game) return false;
    if (this.sticksRenderer.isBusy()) return false;
    
    if (this.game.waitingForPass) return false;

    const cur = this.game.getCurrentPlayer();
    if (!cur) return false;
    if (cur.name === 'cpu') return false;
    return this.game.stickValue == null;
  }

  updateRollBtn() {
    const enabled = this.canPlayerRoll();
    this.uiManager.updateRollBtn(enabled);
  }

  /**
   * Full UI refresh
   */
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

    const currentPlayer = this.game.getCurrentPlayer();
    const isCpuTurn = (currentPlayer.name === 'cpu' && !this.game.isVsPlayer);
    this.uiManager.setBoardDisabled(isCpuTurn);
    this.uiManager.updateBoardRotation(this.game);
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
    if (!winner) return;

    const winnerName = winner.name;
    const loserPlayer = (winner === this.game.players[0]) ? this.game.players[1] : this.game.players[0];
    const loserName = loserPlayer.name;

    this.scoreManager.updateScore(winnerName, loserName);

    let winnerDisplay = winnerName.toUpperCase();
    if (winnerName === 'player1') winnerDisplay = 'Player 1';
    if (winnerName === 'player2') winnerDisplay = 'Player 2';
    
    this.sticksRenderer.msgAfterFlip(`Game Over! ${winnerDisplay} won!`);

    const elements = this.uiManager.getElements();
    if (elements.rollBtn) elements.rollBtn.disabled = true;
    this.uiManager.setBoardDisabled(true);
    this.uiManager.hide(elements.sticksEl);
    this.uiManager.openScoreboardPanel();

    setTimeout(() => {
      this.cleanupGame();
      this.uiManager.showGame();
      this.uiManager.openSidePanel();
      this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
      this.uiManager.setCloseBlocked(true);
      this.uiManager.openScoreboardPanel();
    }, TIMING.gameOverCleanupMs);
  }

  announceRoll(playerName, value) {
    const name = ROLL_NAMES[value] ?? String(value);
    const who =
      playerName === 'player1' ? 'Player 1' :
      playerName === 'player2' ? 'Player 2' :
      playerName === 'cpu' ? 'Player 2' : 'Player';
    this.uiManager.setMessage(`${who} rolled a ${name} (${value})!`);
  }

  cleanupGame() {
    this.cpuController.clearTimers();
    window.game = null;
    this.game = null;
    this.uiManager.clearGameUI();
  }

  getGame() {
    return this.game;
  }

  /**
   * Handle manual pass turn
   */
  handlePassTurn() {
    if (!this.game || this.game.over) return;
    
    const currentPlayer = this.game.getCurrentPlayer();
    
    // Safety check: CPU shouldn't click buttons
    if (currentPlayer.name === 'cpu') return;

    // --- FIX: USE CURRENT ON-SCREEN VALUE ---
    // We use stickValue because it is the active roll that caused us to be stuck.
    // We fallback to lastStickValue just in case.
    const currentRoll = this.game.stickValue || this.game.lastStickValue;
    
    console.log("Pass Clicked. Roll was:", currentRoll);

    // Explicitly check for bonus numbers (1, 4, 6)
    const isBonusRoll = [1, 4, 6].includes(currentRoll);

    // If isBonusRoll is TRUE, we force the game to keep the current player.
    this.game.endTurn(isBonusRoll); 

    // Update the UI
    this.renderAll({ updateSticks: true }); 

    if (isBonusRoll) {
        // CASE: You rolled 1, 4, or 6. You keep the turn!
        this.uiManager.setMessage(`You rolled a ${currentRoll} (Bonus)! Throw sticks again.`);
        console.log("KEEPING TURN - Player should NOT change");
    } else {
        // CASE: You rolled 2 or 3. Turn ends.
        this.uiManager.setMessage("Turn passed.");
        console.log("PASSING TURN - Player switching");
        
        const nextPlayer = this.game.getCurrentPlayer();
        
        if (nextPlayer.name === 'cpu') {
            this.uiManager.setMessage("Player 2's turn.");
            this.sticksRenderer.queueAfterFlip(() => {
                this.cpuController.maybeCpuTurn(this.game, false);
            }, 1000);
        } else {
            const display = nextPlayer.name === 'player1' ? 'Player 1' : 'Player 2';
            this.uiManager.setMessage(`${display}, your turn!`);
        }
    }
  }

  hasAnyValidMoves() {
    if (!this.game || this.game.stickValue === null) return false;
    
    const player = this.game.getCurrentPlayer();
    
    for (const piece of player.pieces) {
      const moves = this.game.possibleMoves(piece, this.game.stickValue);
      if (moves.length > 0) return true;
    }
    
    return false;
  }
}