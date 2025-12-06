import TabGame from '../classes/Tabgame.js';
import Piece from '../classes/Piece.js';
import ScoreManager from '../managers/ScoreManager.js';
import { TIMING, DIFFICULTY_LEVELS, ROLL_NAMES } from '../constants/Constants.js';

/**
 * Main game orchestration - handles game lifecycle, turn management, and coordination
 */
export default class GameController {
  constructor(uiManager, sticksRenderer, cpuController, scoreManager, modalManager, serverManager) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.cpuController = cpuController;
    this.scoreManager = scoreManager;
    this.modalManager = modalManager;
    this.serverManager = serverManager;
    this.scoreManager = new ScoreManager(this.uiManager, this.serverManager);
    this.uiManager.scoreManager = this.scoreManager;
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
      // Se estiver online, faz leave
      if (this.serverManager.state.active) {
        await this.serverManager.leave(this.serverManager.state.nick, this.serverManager.state.pass, this.serverManager.state.gameId);
        this.serverManager.clearGame();
      }
      if (!confirmed) return;
    }

    const gameMode = elements.gameModeInput?.value || 'pvc';
    const cols = elements.sizeInput ? parseInt(elements.sizeInput.value, 10) || 9 : 9;

    // --- MODO ONLINE ---
    if (gameMode === 'online') {
        const { nick, pass } = this.serverManager.state;
        if (!nick) {
            alert("Login required!");
            elements.userMenu.classList.remove('hidden');
            return;
        }

        try {
            this.uiManager.setMessage("Connecting...");
            const joinData = await this.serverManager.join(this.serverManager.GROUP_ID, nick, pass, cols);
            
            this.serverManager.setGame(joinData.game);
            this.uiManager.closeSidePanel();
            this.uiManager.setMessage(`Joined! Waiting... (${joinData.game})`);
            
            this.serverManager.update(this.serverManager.state.gameId, nick, (data) => {
            this.handleServerUpdate(data);
            });

        } catch (err) {
            this.uiManager.setMessage("Error: " + err.message);
        }
        return; // Sai, o resto é gerido pelo handleServerUpdate
    }

    const firstPlayer = elements.firstPlayerInput ? elements.firstPlayerInput.value : 'player1';
    const difficulty = elements.difficultyInput ? elements.difficultyInput.value : 'easy';

    this.game = new TabGame(cols);
    this.game.isOnline = false; // flag
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
    this.renderAll();
  }

  // --- Processa updates do servidor ---
  handleServerUpdate(data) {
      console.log("Server Update:", data);
      if (data.error) { this.uiManager.setMessage("Error: " + data.error); return; }

      const myNick = this.serverManager.state.nick;

      // 1. Início do Jogo
      if (data.pieces && !this.game) {
        const size = data.pieces.length / 4; 
        this.game = new TabGame(size);
        window.game = this.game;
        this.game.isOnline = true;
        
        // Descobrir a minha cor baseada no objeto players do servidor
        // Ex: data.players = { "Joao": "Blue", "Maria": "Red" }
        const myColor = data.players ? data.players[myNick] : "Blue";
        const amIPlayer1 = (myColor === "Blue"); // Player 1 é Azul

        // Configurar 'Eu' (players[0])
        this.game.players[0].name = myNick;
        this.game.players[0].skin = amIPlayer1 ? 'blue' : 'red';
        this.game.players[0].startRow = amIPlayer1 ? 3 : 0; // Se sou Red, começo em cima (0)

        // Configurar 'Oponente' (players[1])
        const opponentName = Object.keys(data.players || {}).find(n => n !== myNick) || "Opponent";
        this.game.players[1].name = opponentName;
        this.game.players[1].skin = amIPlayer1 ? 'red' : 'blue';
        this.game.players[1].startRow = amIPlayer1 ? 0 : 3;

        this.serverManager.state.color = myColor;

        this.uiManager.show(this.uiManager.getElements().rollBtn);
        this.uiManager.show(this.uiManager.getElements().passTurnBtn);
        this.uiManager.hardShowScoreboard();
        this.sticksRenderer.renderSticks(null);
        this.renderAll();
      }

      if (!this.game) return;

      // 2. Tabuleiro
      if (data.pieces) {
        this.game.players[0].pieces = [];
        this.game.players[1].pieces = [];

        data.pieces.forEach((p, index) => {
            if (!p) return;
            const coords = this.getCoordsFromIndex(index, this.game.columns); 
            const owner = (p.color === this.serverManager.state.color) ? this.game.players[0] : this.game.players[1];
            
            const newPiece = new Piece(owner, coords.row, coords.col);
            if (p.reachedLastRow) newPiece.state = 'last-row';
            else if (p.inMotion) newPiece.state = 'moved';
            
            owner.addPiece(newPiece);
        });
        this.renderAll();
      }

      // 3. Turno
      if (data.turn) {
        const elements = this.uiManager.getElements();
        const isMyTurn = data.turn === myNick;
          // Reset de estado local para o novo turno
          this.game.stickValue = null;
          this.game.waitingForPass = false;
          this.game.curPlayerIdx = this.game.players.findIndex(p => p.name === data.turn);
        
          // ONLINE: botões controlados exclusivamente pelo servidor
          if (this.game.isOnline) {
            this.uiManager.updateRollBtn(isMyTurn);
            this.uiManager.updatePassBtn(isMyTurn && data.mustPass === myNick);
            this.uiManager.setBoardDisabled(!isMyTurn);
            this.uiManager.setMessage(isMyTurn ? "Your Turn!" : `Waiting for ${data.turn}...`);
          } else {
            // OFFLINE: PvP ou PvC mantém lógica local
            const canRoll = (this.game.stickValue == null);
            this.uiManager.updateRollBtn(canRoll);
            const hasMoves = this.hasAnyValidMoves();
            const shouldEnablePass = (!canRoll && !hasMoves);
            this.uiManager.updatePassBtn(shouldEnablePass);
          }
      }

      
      // 4. Dados
      if (data.dice && data.dice.value) {
        this.game.stickValue = data.dice.value;
        this.sticksRenderer.renderSticks(data.dice.value, { animate: true });

         // ONLINE: ATIVAR PASS DE IMEDIATO SE O ROLL É 2 OU 3 
        const elements = this.uiManager.getElements();

        if (this.game.isOnline) {
          // controlar botões via servidor
          const elements = this.uiManager.getElements();
          this.uiManager.show(elements.passTurnBtn);
          const mustPassForMe = data.mustPass === myNick;
          this.uiManager.updatePassBtn(mustPassForMe);
        }
      }
      
      // 5. Vencedor
      if (data.winner) {
        this.handleGameOver({ name: data.winner });
        this.serverManager.closeUpdate();
      }
  }

  // Helpers de Mapeamento (Server <-> Local)
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

  getCoordsFromIndex(index, cols) {
    const rowIdx = Math.floor(index / cols); 
    const offset = index % cols;
    let r = 3 - rowIdx; 
    let c = offset;
    if (r === 2 || r === 0) c = (cols - 1) - offset;
    return { row: r, col: c };
  }

  /**
   * Handle human player roll
   */
  handlePlayerRoll() {
    // ONLINE
    if (this.game && this.game.isOnline) {
      if (this.game.stickValue != null) {
          this.uiManager.setMessage("You already rolled. Move a piece before rolling again.");
          return;
      }
      const { nick, pass, gameId } = this.serverManager.state;
      this.serverManager.roll(nick, pass, gameId)
          .catch(err => this.uiManager.setMessage("Error: " + err.message));
      return;
    }

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
    this.sticksRenderer.renderSticks({ value: val, sticks: this.game.lastSticks },{ animate: true });

    this.sticksRenderer.queueAfterFlip(() => {
      this.announceRoll(currentPlayer?.name ?? 'Player', val);

      // 1) Verificar se existem jogadas válidas
      const hasMoves = this.hasAnyValidMoves();
      const isBonus = [1,4,6].includes(val);

      // --- CASO A: NÃO TEM MOVES ---
      if (!hasMoves) {
        // BONUS (1,4,6) → jogar outra vez
        if (isBonus) {
          this.uiManager.setMessage(`You rolled a ${val} (Bonus) but have no moves. Throw again!`);
          // Reset ao valor para permitir lançar outra vez
          this.game.endTurn(true);
          this.game.waitingForPass = false;
          this.renderAll({ updateSticks: false });
          return;
        }

        // Caso normal (2,3,5): NÃO tem moves → pode ter skip automático OU pass manual
        const skipped = this.game.autoSkipIfNoMoves();
        if (skipped) {
          const nextPlayer = this.game.getCurrentPlayer();
          let msg = "";
          if (nextPlayer === currentPlayer) {
            // Jogador continua turno
            msg = "No possible moves. Throw sticks again!";
          } else {
            // Turno passou automaticamente
            msg = `No moves available. ${nextPlayer.name}'s turn.`;
          }

          this.uiManager.setMessage(msg);
          this.renderAll();
          // CPU
          if (nextPlayer.name === "cpu" && !this.game.isVsPlayer) {
            this.messageTimer = setTimeout(() => {
                this.uiManager.setMessage("Player 2's turn");
                this.cpuController.maybeCpuTurn(this.game, false);
            }, 1500);
          }

          return;
        }

        // Caso não houve skip automático → jogador tem de carregar no botão Pass
        this.uiManager.setMessage(`No moves available. Click "Pass Turn".`);
        this.game.waitingForPass = true;
        this.renderAll({ updateSticks: false });

        return;
    }

      // --- CASO B: TEM MOVES ---
      this.game.waitingForPass = false;

      this.sticksRenderer.msgAfterFlip("Choose a piece to move!", 600);
      this.renderAll({ updateSticks: false });
    });
  }

  /**
   * Handle board cell click
   */
  handleBoardClick(row, col) {
    if (row == null || col == null) {
      console.error("Row or col is undefined!", row, col);
      return;
    }
    if (this.game && this.game.isOnline) {
      const { nick, pass, gameId } = this.serverManager.state;
      const currentPlayer = this.game.getCurrentPlayer();

      // Check turn
      if (nick !== currentPlayer.name) {
          this.uiManager.setMessage("Not your turn!");
          return;
      }

      const cellIndex = this.getIndexFromCoords(row, col, this.game.columns);
      if (cellIndex < 0) return;

      // ----------------- STEP: FROM -----------------
      if (this.serverManager.state.step === "from") {
        const piece = currentPlayer.getPieceAt(row, col);

        if (!piece) {
            this.uiManager.setMessage("Select a valid piece.");
            return;
        }

        // highlight local
        this.game.selectPieceAt(row, col);
        this.uiManager.updateBoardHighlights(this.game);

        console.log("NOTIFY FROM:", cellIndex);

        this.serverManager.notify(nick, pass, gameId, cellIndex)
            .catch(err => this.uiManager.setMessage("Error: " + err.message));

        return;
      }

      // ----------------- STEP: TO -----------------
      if (this.serverManager.state.step === "to") {

        if (!this.game.selectedPiece) {
            this.uiManager.setMessage("Select a piece first.");
            return;
        }

        console.log("NOTIFY TO:", cellIndex);

        this.serverManager.notify(nick, pass, gameId, cellIndex)
            .catch(err => this.uiManager.setMessage("Error: " + err.message));

        // Clear highlight (server envia update com a nova board)
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);

        return;
      }

      return;
    }

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
      if (this.game.selectedPiece) {
      const moveWasSuccessful = this.game.moveSelectedTo(row, col);
      if (moveWasSuccessful) {
        this.game.stickValue = null;  // permite novo roll no próximo turno
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
          this.sticksRenderer.queueAfterFlip(
              () => this.cpuController.maybeCpuTurn(this.game, false),
              TIMING.humanToCpuMs
          );
        } 
        else {
          if (nextPlayer === currentPlayer) {
            this.uiManager.setMessage(`${currentPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, play again!`);
          } else {
            this.uiManager.setMessage(`${nextPlayer.name === P1_name ? 'Player 1' : 'Player 2'}, your turn!`);
          }
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

    const currentPlayer = this.game.getCurrentPlayer();
    if (!currentPlayer) return false;
    if (currentPlayer.name === 'cpu') return false;

    // BONUS ROLL: se stickValue é 1,4,6 e ainda não houve movimento
    const bonusRollAllowed = this.game.stickValue !== null && [1,4,6].includes(this.game.stickValue) && !this.hasAnyValidMoves();

    if (this.game.waitingForPass && !bonusRollAllowed) return false;

    return this.game.stickValue == null || bonusRollAllowed;
  }

  /**
   * Enable/disable the roll button based on current turn and state.
   */
  updateRollBtn() {
    const enabled = this.canPlayerRoll();
    this.uiManager.updateRollBtn(enabled);
  }

  /**
   * Full UI refresh: board, highlights, sticks (optionally), roll button, and rotation.
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
    // ROTAÇÃO NO ONLINE 
    // Se sou Vermelho (P2, startRow=0), tenho de rodar o tabuleiro para ver o meu lado em baixo.
    // Se sou Azul (P1, startRow=3), não rodo (startRow=3 já é em baixo).
    let forceRotate = false;
    if (this.game.isOnline) {
        // Se o meu startRow é 0, preciso de rodar
        forceRotate = (this.game.players[0].startRow === 0);
    }
    
    this.uiManager.updateBoardRotation(this.game, forceRotate);
  }

  /**
   * Check whether the game is over and trigger end-game handling if so.
   */
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
    this.openScoreboardPanel();

    setTimeout(() => {
      this.cleanupGame();
      this.uiManager.showGame();
      this.uiManager.openSidePanel();
      this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
      this.uiManager.setCloseBlocked(true);
      this.openScoreboardPanel();
    }, TIMING.gameOverCleanupMs);
  }

  /**
   * Announce a roll result using localized names and current player's label.
   */
  announceRoll(playerName, value) {
    const name = ROLL_NAMES[value] ?? String(value);
    const who =
      playerName === 'player1' ? 'Player 1' :
      playerName === 'player2' ? 'Player 2' :
      playerName === 'cpu' ? 'Player 2' : 'Player';
    this.uiManager.setMessage(`${who} rolled a ${name} (${value})!`);
  }

  /**
   * Clean up game state
   */
  cleanupGame() {
    this.cpuController.clearTimers();
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
   * Handle manual pass turn
   */
  async handlePassTurn() {
    if (!this.game || !this.game.isOnline) return;

    const { nick, pass, gameId } = this.serverManager.state;
    this.uiManager.updatePassBtn(false);
    this.uiManager.updateRollBtn(false);
    this.uiManager.setMessage("Passing turn...");

    try {
      await this.serverManager.pass(nick, pass, gameId);
    } catch (err) {
      console.error("Erro ao passar turno:", err);
      this.uiManager.setMessage("Server refused PASS.");
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

  openScoreboardPanel() {
    // Abre o painel visual
    this.uiManager.openScoreboardPanel();

    // Carrega offline primeiro
    this.loadOfflineScores();

    // Liga tabs para trocar entre Offline / Online
    this.uiManager.setupScoreboardTabs(
        () => this.loadOfflineScores(),
        () => this.loadOnlineScores()
    );
  }

  // SCOREBOARD ONLINE 
  async loadOnlineScores() {
      try {
          const size = this.game ? this.game.columns : 7; // fallback para evitar crashes
          const ranking = await this.serverManager.ranking(
              this.serverManager.GROUP_ID,
              size
          );
          this.uiManager.renderOnlineScoreboard(ranking);
      } catch (err) {
          this.uiManager.setMessage("Erro ao carregar ranking online.");
          console.error(err);
      }
  }

  // SCOREBOARD OFFLINE
  loadOfflineScores() {
      if (!this.scoreManager) return;

      const scores = this.scoreManager.getOfflineScores();
      this.uiManager.renderOfflineScoreboard(scores);
  }
}