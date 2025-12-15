// OnlinePvPGameController.js - Online Multiplayer
import TabGame from '../classes/Tabgame.js';
import Piece from '../classes/Piece.js';
import { TIMING, ROLL_NAMES } from '../constants/Constants.js';

/**
 * Game controller for Online Player vs Player games
 */
export default class OnlinePvPGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager, serverManager) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.scoreManager = scoreManager;
    this.modalManager = modalManager;
    this.serverManager = serverManager;
    this.game = null;
    this.messageTimer = null;
    this.localSelectedFromIndex = null;
  }

  async initGame() {
    const elements = this.uiManager.getElements();
    
    if (window.game) {
      const confirmed = await this.modalManager.showModal(
        'New game?',
        'Starting a new game will cancel the current one. Are you sure?',
        'Yes, Start New',
        'No, Cancel'
      );
      if (this.serverManager.state.active) {
        await this.serverManager.leave(
          this.serverManager.state.nick, 
          this.serverManager.state.pass, 
          this.serverManager.state.gameId
        );
        this.serverManager.clearGame();
      }
      if (!confirmed) return;
    }

    const cols = elements.sizeInput ? parseInt(elements.sizeInput.value, 10) || 9 : 9;

    const { nick, pass } = this.serverManager.state;
    if (!nick) {
        alert("Login required!");
        elements.userMenu.classList.remove('hidden');
        return;
    }

    try {
        this.uiManager.setMessage("Connecting...");
        const joinData = await this.serverManager.join(
          this.serverManager.GROUP_ID, 
          nick, 
          pass, 
          cols
        );
        
        this.serverManager.setGame(joinData.game);
        this.uiManager.closeSidePanel();
        this.uiManager.setMessage(`Joined! Waiting... (${joinData.game})`);
        
        this.serverManager.update(this.serverManager.state.gameId, nick, (data) => {
          this.handleServerUpdate(data);
        });

    } catch (err) {
        this.uiManager.setMessage("Error: " + err.message);
    }
  }

  handleServerUpdate(data) {
  try {
    console.log("Server Update:", data);

    // --- 0) WINNER (PRIORIDADE MÁXIMA) ---
    // Verificamos isto PRIMEIRO. Se alguém ganhou, não queremos saber de erros ou updates de peças.
    if (data.winner) {
      if (!this.game) {
         this.uiManager.setMessage(`Game Over! Winner: ${data.winner}`);
         return;
      }
      this.game.over = true;
      const winner = this.game.players.find(p => p && p.name === data.winner);
      if (winner) {
        this.handleGameOver(winner);
      } else {
        this.handleGameOver({ name: data.winner });
      }

      if (this.serverManager) {
         if (typeof this.serverManager.closeUpdate === 'function') this.serverManager.closeUpdate();
         else if (typeof this.serverManager.stopListening === 'function') this.serverManager.stopListening();
      }
      return; // Sai da função imediatamente para não processar mais nada
    }

    // --- AGORA sim verificamos erros ---
    if (data.error) {
      this.uiManager.setMessage("Error: " + data.error);
      return;
    }

    const myNick = this.serverManager.state.nick;

    if ('mustPass' in data) {
      this.serverManager.state.mustPass = data.mustPass;
    } else if (this.serverManager && this.serverManager.state && typeof this.serverManager.state.mustPass !== 'undefined') {
      delete this.serverManager.state.mustPass;
    }

    // --- 1) INICIALIZAÇÃO DO JOGO ---
    if (data.pieces && !this.game) {
      const size = Math.max(3, Math.floor((data.pieces.length || 0) / 4));
      this.game = new TabGame(size);
      window.game = this.game;
      this.game.isOnline = true;
      this.game.isVsPlayer = true;

      const myColor = (data.players && data.players[myNick]) ? data.players[myNick] : "Blue";
      const amIPlayer1 = (myColor === "Blue");

      if (!this.game.players || this.game.players.length < 2) {
        this.game.players = [this.game.players[0] || { pieces: [] }, this.game.players[1] || { pieces: [] }];
      }

      this.game.players[0].name = myNick;
      this.game.players[0].skin = amIPlayer1 ? 'blue' : 'red';
      this.game.players[0].startRow = amIPlayer1 ? 3 : 0;

      const opponentName = Object.keys(data.players || {}).find(n => n !== myNick) || "Opponent";
      this.game.players[1].name = opponentName;
      this.game.players[1].skin = amIPlayer1 ? 'red' : 'blue';
      this.game.players[1].startRow = amIPlayer1 ? 0 : 3;

      this.serverManager.state.color = myColor;

      const els = this.uiManager.getElements();
      this.uiManager.show(els.rollBtn);
      this.uiManager.show(els.passTurnBtn);
      this.uiManager.hardShowScoreboard();
      this.sticksRenderer.renderSticks(null);
      this.renderAll();

      this.uiManager.setMessage("Game ready. Waiting for server updates...");
    }

    if (!this.game) return;

    // --- 2) SINCRONIZAR pieces ---
    if (data.pieces && data.turn) {
      const piecesArray = Array.isArray(data.pieces) ? data.pieces : [];

      if (!this.game.players || this.game.players.length < 2) {
        this.game.players = [this.game.players[0] || { pieces: [] }, this.game.players[1] || { pieces: [] }];
      }
      this.game.players[0].pieces = [];
      this.game.players[1].pieces = [];

      const serverMyColor = this.serverManager.state.color || (data.players && data.players[Object.keys(data.players)[0]]);

      piecesArray.forEach((p, index) => {
        if (!p) return;

        const coords = this.getCoordsFromIndex(index, this.game.columns);
        if (!coords || typeof coords.row !== 'number' || typeof coords.col !== 'number') {
          return;
        }

        const owner = (p.color && serverMyColor && p.color === serverMyColor) ? this.game.players[0] : this.game.players[1];
        if (!owner) return;

        const newPiece = new Piece(owner, coords.row, coords.col);
        if (p.reachedLastRow) newPiece.state = 'last-row';
        else if (p.inMotion) newPiece.state = 'moved';

        if (typeof owner.addPiece === 'function') {
          owner.addPiece(newPiece);
        } else {
          owner.pieces = owner.pieces || [];
          owner.pieces.push(newPiece);
        }
      });

      if (typeof this.game.clearSelection === 'function') this.game.clearSelection();

      this.uiManager.buildBoard(this.game);
      this.uiManager.updateBoardHighlights(this.game);
      this.renderAll(); 
    }

    // --- 3) Atualização do turno ---
    if (data.turn) {
      const isMyTurn = (data.turn === myNick);
      const idx = this.game.players.findIndex(p => p && p.name === data.turn);
      this.game.curPlayerIdx = (idx >= 0) ? idx : 0;

      this.game.stickValue = null;
      this.game.waitingForPass = false;

      this.renderAll();
      this.uiManager.setMessage(isMyTurn ? "Your Turn! Roll the sticks." : `Waiting for ${data.turn}...`);
    }

    // --- 4) Dados (dice) ---
    if (data.dice) {
      if (data.dice && typeof data.dice.value === 'number') {
        if (Array.isArray(data.dice.stickValues)) {
          window.game = window.game || {};
          window.game.lastSticks = data.dice.stickValues.map(v => v ? 1 : 0);
        } else {
          this.game.stickValue = null;
          if (Array.isArray(data.dice.stickValues)) {
            window.game = window.game || {};
            window.game.lastSticks = data.dice.stickValues.map(v => v ? 1 : 0);
          }
          if (this.serverManager && this.serverManager.state) {
            this.serverManager.state.keepPlaying = false;
          }
          this.renderAll({ updateSticks: false });
        }
        const rollValue = data.dice.value;
        this.game.stickValue = rollValue;
        this.game.lastStickValue = rollValue;

        if (this.serverManager && this.serverManager.state) {
          this.serverManager.state.keepPlaying = !!data.dice.keepPlaying;
        }

        const isMyTurn = (data.turn === myNick);
        this.sticksRenderer.renderSticks(rollValue, { animate: true });

        this.sticksRenderer.queueAfterFlip(() => {
          this.announceRoll(this.game.getCurrentPlayer().name, rollValue);

          if (isMyTurn) {
            const hasMoves = this.hasAnyValidMoves();
            const isBonusRoll = [1, 4, 6].includes(rollValue);

            if (!hasMoves) {
              if (isBonusRoll) {
                this.uiManager.setMessage(`No moves with ${rollValue} (Bonus). Roll again!`);
                this.game.waitingForPass = false;
                this.renderAll({ updateSticks: false });
                return;
              }
              this.uiManager.setMessage(`No moves available. Click "Pass Turn".`);
              this.game.waitingForPass = true;
              this.renderAll({ updateSticks: false });
              return;
            }
            this.game.waitingForPass = false;
            this.sticksRenderer.msgAfterFlip("Choose a piece to move!", 600);
            this.renderAll({ updateSticks: false });
          } else {
            this.renderAll({ updateSticks: false });
          }
        });
      } else {
        this.game.stickValue = null;
        if (this.serverManager && this.serverManager.state) {
          this.serverManager.state.keepPlaying = false;
        }
        this.renderAll({ updateSticks: false });
      }

      if ('mustPass' in data) {
        this.uiManager.updatePassBtn(data.mustPass === myNick);
      }
    }

    // --- 5) selected / step ---
    if (Array.isArray(data.selected) && data.selected.length >= 0) {
      if (typeof data.cell === 'number') {
        this.serverManager.state.selectedFromIndex = data.cell;
      }

      if (data.step === "to") {
        const destinations = data.selected.map(idx => this.getCoordsFromIndex(idx, this.game.columns))
                                        .filter(d => d && typeof d.row === 'number');

        if (typeof this.serverManager.state.selectedFromIndex === 'number') {
          const origin = this.getCoordsFromIndex(this.serverManager.state.selectedFromIndex, this.game.columns);
          const piece = this.game.getCurrentPlayer().getPieceAt(origin.row, origin.col)
                    || this.game.getOpponentPlayer().getPieceAt(origin.row, origin.col);
          if (piece) {
            this.game.selectedPiece = piece;
          }
        }

        this.game.selectedMoves = destinations;
        this.uiManager.updateBoardHighlights(this.game);
        this.uiManager.setMessage("Opponent selected a piece — waiting for their move...");
      } else if (data.step === "from") {
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
        this.uiManager.setMessage("Choose a piece to move...");
        delete this.serverManager.state.selectedFromIndex;
      }
    }

  } catch (err) {
    console.error("Erro a processar update do servidor:", err);
  }
}

  handleRoll() {
    const currentPlayer = this.game.getCurrentPlayer();
    
    if (!this.canPlayerRoll()) {
      if (currentPlayer.name !== this.serverManager.state.nick) {
        this.uiManager.setMessage("Wait — it's not your turn.");
      } else if (this.sticksRenderer.isBusy()) {
        this.uiManager.setMessage('Throwing sticks in progress…');
      } else {
        this.uiManager.setMessage('You already threw. Move a piece!');
      }
      return;
    }

    this.clearMessageTimer();

    const { nick, pass, gameId } = this.serverManager.state;
    this.serverManager.roll(nick, pass, gameId)
      .catch(err => this.uiManager.setMessage("Error: " + err.message));
  }

  canPlayerRoll() {
    if (!this.game) return false;
    if (this.sticksRenderer.isBusy()) return false;
    const currentPlayer = this.game.getCurrentPlayer();
    if (!currentPlayer) return false;
    if (currentPlayer.name !== this.serverManager.state.nick) return false;

    if (this.game.stickValue == null) return true;

    const keepPlaying = this.serverManager && this.serverManager.state && !!this.serverManager.state.keepPlaying;
    if (keepPlaying && !this.hasAnyValidMoves()) return true;

    return false;
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

  announceRoll(playerName, value) {
    const name = ROLL_NAMES[value] ?? String(value);
    const displayName = playerName === this.serverManager.state.nick ? 'You' : playerName;
    this.uiManager.setMessage(`${displayName} rolled a ${name} (${value})!`);
  }

  async handleBoardClick(row, col) {
    if (!this.game || this.game.over) return;

    const { nick, pass, gameId } = this.serverManager.state;
    const currentPlayer = this.game.getCurrentPlayer();

    if (nick !== currentPlayer.name) {
      this.uiManager.setMessage("Not your turn!");
      return;
    }

    if (this.game.stickValue == null) {
      this.uiManager.setMessage("Throw sticks first!");
      return;
    }

    const cellIndex = this.getIndexFromCoords(row, col, this.game.columns);
    const pieceAtClick = currentPlayer.getPieceAt(row, col);

    // --- A) Selecionar Peça Própria ---
    if (pieceAtClick) {
      const moves = this.game.selectPieceAt(row, col);
      if (!moves || moves.length === 0) {
        this.uiManager.setMessage("That piece has no valid moves.");
        this.localSelectedFromIndex = null;
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
        return;
      }

      this.localSelectedFromIndex = cellIndex;
      this.uiManager.updateBoardHighlights(this.game);
      this.uiManager.setMessage("Piece selected — choose a destination.");
      return;
    }

    // --- B) Mover para Destino ---
    if (this.localSelectedFromIndex != null) {
      
      // Validação Local antes de enviar
      const origin = this.getCoordsFromIndex(this.localSelectedFromIndex, this.game.columns);
      const selectedPiece = currentPlayer.getPieceAt(origin.row, origin.col);

      if (!selectedPiece) {
        this.localSelectedFromIndex = null;
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
        return;
      }

      const validMoves = this.game.possibleMoves(selectedPiece, this.game.stickValue);
      const isValidMove = validMoves.some(m => m.row === row && m.col === col);

      if (!isValidMove) {
        this.uiManager.setMessage("Invalid move! Selection cleared.");
        this.localSelectedFromIndex = null;
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
        return;
      }

      const destIndex = cellIndex;
      this.uiManager.setMessage("Sending move to server...");
      
      try {
        await this.serverManager.notify(nick, pass, gameId, this.localSelectedFromIndex);
        await this.serverManager.notify(nick, pass, gameId, destIndex);
      } catch (err) {
        // FIX: Se o notify falhar, mas o jogo já tiver acabado (over), não mostramos erro.
        // O servidor pode ter terminado o jogo após o notify e enviado o winner.
        if (this.game && this.game.over) {
            console.log("Ignored notify error because game is over:", err.message);
        } else {
            this.uiManager.setMessage("Error: " + (err.message || err));
        }
      } finally {
        this.localSelectedFromIndex = null;
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
      }
      return;
    }

    this.uiManager.setMessage("Select a piece first.");
  }


  async handlePass() {
    if (!this.game) return;

    const { nick, pass, gameId } = this.serverManager.state;
    const nextPlayer = this.game.getCurrentPlayer();

    this.serverManager.pass(nick, pass, gameId)
      .catch(err => {
        console.error("Error passing turn:", err);
        this.uiManager.setMessage("Server refused PASS.");
      });
    
    this.renderAll();
    this.uiManager.setMessage(`Waiting for ${nextPlayer.name}...`);
  }

  async handleQuit() {
    const confirmed = await this.modalManager.showModal(
      'Quit?',
      'Are you sure you want to quit? Leaving will forfeit the match.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;

    if (this.serverManager.state.active) {
      await this.serverManager.leave(
        this.serverManager.state.nick,
        this.serverManager.state.pass,
        this.serverManager.state.gameId
      );
      this.serverManager.clearGame();
    }
    
    this.cleanupGame();
    this.uiManager.setMessage('Left the game.');
    this.uiManager.closeSidePanel();
    
    setTimeout(() => {
      if (!window.game) {
        this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
        this.uiManager.setCloseBlocked(true);
      }
    }, 3000);
  }

  updateRollBtn() {
    const enabled = this.canPlayerRoll();
    this.uiManager.updateRollBtn(enabled);
  }
  
  updatePassBtn() {
    const isMyTurn = this.game.getCurrentPlayer().name === this.serverManager.state.nick;
    const myNick = this.serverManager.state.nick;

    if (this.serverManager && this.serverManager.state && typeof this.serverManager.state.mustPass !== 'undefined') {
      const canPass = isMyTurn && this.serverManager.state.mustPass === myNick;
      this.uiManager.updatePassBtn(canPass);
      this.uiManager.setBoardDisabled(!isMyTurn);
      return;
    }

    this.uiManager.updatePassBtn(false);
    this.uiManager.setBoardDisabled(!isMyTurn);
  }

  renderAll(opts = { updateSticks: true }) {
    if (!this.game) return;

    this.uiManager.buildBoard(this.game);
    this.uiManager.updateBoardHighlights(this.game);

    if (opts.updateSticks) {
      this.sticksRenderer.renderSticks(this.game.stickValue ?? null, { animate: false });
    }

    this.updateRollBtn();
    this.updatePassBtn();

    const forceRotate = this.game.isOnline && (this.game.players[0].startRow === 0);
    this.uiManager.updateBoardRotation(this.game, forceRotate);
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
    const boardSize = this.game ? this.game.columns : 9;

    const loserPlayer = (winnerName === this.game.players[0].name) 
        ? this.game.players[1] 
        : this.game.players[0];
    const loserName = loserPlayer.name;

    this.scoreManager.updateScore(winnerName, loserName);
    
    // Mostra a mensagem no topo da tela também para garantir
    this.uiManager.setMessage(`Game Over! ${winnerName} won!`);
    this.sticksRenderer.msgAfterFlip(`Game Over! ${winnerName} won!`);

    const elements = this.uiManager.getElements();
    if (elements.rollBtn) elements.rollBtn.disabled = true;
    this.uiManager.setBoardDisabled(true);
    this.uiManager.hide(elements.sticksEl);
    this.uiManager.openScoreboardPanel(boardSize);

    setTimeout(() => {
      this.cleanupGame();
      this.uiManager.showGame();
      this.uiManager.openSidePanel();
      this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
      this.uiManager.setCloseBlocked(true);
    }, TIMING.gameOverCleanupMs);
  }

  cleanupGame() {
    this.clearMessageTimer();
    window.game = null;
    this.game = null;
    this.uiManager.clearGameUI();
  }

  getGame() {
    return this.game;
  }

  openScoreboardPanel() {
    this.uiManager.openScoreboardPanel(this.game.columns);
  }

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

  clearMessageTimer() {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }
}