// OnlinePvPGameController.js - Online Multiplayer
import BaseGameController from './BaseGameController.js';
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
    if (data.error) {
      this.uiManager.setMessage("Error: " + data.error);
      return;
    }

    const myNick = this.serverManager.state.nick;

    // Store mustPass in shared state so UI logic can rely on server's authoritative value
    if ('mustPass' in data) {
      // server sends either null or the nick of the player who must pass
      this.serverManager.state.mustPass = data.mustPass;
    } else if (this.serverManager && this.serverManager.state && typeof this.serverManager.state.mustPass !== 'undefined') {
      // clear previous mustPass when server does not send it
      delete this.serverManager.state.mustPass;
    }

    // --- 1) INICIALIZAÇÃO DO JOGO (quando ainda não existe this.game) ---
    if (data.pieces && !this.game) {
      const size = Math.max(3, Math.floor((data.pieces.length || 0) / 4)); // defensivo
      this.game = new TabGame(size);
      window.game = this.game;
      this.game.isOnline = true;
      this.game.isVsPlayer = true;

      const myColor = (data.players && data.players[myNick]) ? data.players[myNick] : "Blue";
      const amIPlayer1 = (myColor === "Blue");

      // garante que existam 2 players
      if (!this.game.players || this.game.players.length < 2) {
        // tenta criar jogadores caso a classe TabGame não os tenha inicializado como esperado
        this.game.players = [this.game.players[0] || { pieces: [] }, this.game.players[1] || { pieces: [] }];
      }

      // configurar nomes/skins/startRow
      this.game.players[0].name = myNick;
      this.game.players[0].skin = amIPlayer1 ? 'blue' : 'red';
      this.game.players[0].startRow = amIPlayer1 ? 3 : 0;

      const opponentName = Object.keys(data.players || {}).find(n => n !== myNick) || "Opponent";
      this.game.players[1].name = opponentName;
      this.game.players[1].skin = amIPlayer1 ? 'red' : 'blue';
      this.game.players[1].startRow = amIPlayer1 ? 0 : 3;

      this.serverManager.state.color = myColor;

      // UI: mostrar botões & tabuleiro
      const els = this.uiManager.getElements();
      this.uiManager.show(els.rollBtn);
      this.uiManager.show(els.passTurnBtn);
      this.uiManager.hardShowScoreboard();
      this.sticksRenderer.renderSticks(null);
      this.renderAll();

      this.uiManager.setMessage("Game ready. Waiting for server updates...");
    }

    if (!this.game) return;

    // --- 2) SINCRONIZAR pieces quando o servidor envia pieces (apenas após confirmação) ---
    // Só recarregamos se:
    // - Inicialização (já foi feita acima em section 1) 
    // - Turn changed (data.turn foi enviado, o que significa nova jogada confirmada)
    // - Evitar recarregar no meio de uma seleção (step === "to")
    if (data.pieces && data.turn) {  // <-- MUDA: só sincroniza se o server envia turn também
      const piecesArray = Array.isArray(data.pieces) ? data.pieces : [];

      // Clear local pieces arrays de forma segura
      if (!this.game.players || this.game.players.length < 2) {
        this.game.players = [this.game.players[0] || { pieces: [] }, this.game.players[1] || { pieces: [] }];
      }
      this.game.players[0].pieces = [];
      this.game.players[1].pieces = [];

      // Reconstroi as peças conforme o servidor
      const serverMyColor = this.serverManager.state.color || (data.players && data.players[Object.keys(data.players)[0]]);

      piecesArray.forEach((p, index) => {
        if (!p) return; // casa vazia

        const coords = this.getCoordsFromIndex(index, this.game.columns);
        if (!coords || typeof coords.row !== 'number' || typeof coords.col !== 'number') {
          console.warn("Invalid coords for index", index, coords);
          return;
        }

        // Owner: se a cor do objecto for igual à cor que o servidor disse ser "minha"
        const owner = (p.color && serverMyColor && p.color === serverMyColor) ? this.game.players[0] : this.game.players[1];
        if (!owner) {
          console.warn("Owner undefined for piece", p, index);
          return;
        }

        // Criar peça e ajustar estado
        const newPiece = new Piece(owner, coords.row, coords.col);
        if (p.reachedLastRow) newPiece.state = 'last-row';
        else if (p.inMotion) newPiece.state = 'moved';

        // Adicionar peça ao owner
        if (typeof owner.addPiece === 'function') {
          owner.addPiece(newPiece);
        } else {
          owner.pieces = owner.pieces || [];
          owner.pieces.push(newPiece);
        }
      });

      // O servidor confirmou a jogada — limpa seleção local
      if (typeof this.game.clearSelection === 'function') this.game.clearSelection();

      // Reconstruir UI e habilitar botão Pass (aguardando que o jogador clique)
      this.uiManager.buildBoard(this.game);
      this.uiManager.updateBoardHighlights(this.game);
      this.renderAll(); // Atualiza botões, incluindo Pass Button
    }

    // --- 3) Atualização do turno (turn) ---
    if (data.turn) {
      const isMyTurn = (data.turn === myNick);
      const idx = this.game.players.findIndex(p => p && p.name === data.turn);
      this.game.curPlayerIdx = (idx >= 0) ? idx : 0;

      // Reset local de estado de turno (servidor decide o resto)
      this.game.stickValue = null;
      this.game.waitingForPass = false;

      // atualizar UI (pass/roll controlados pelo servidor em online)
      this.renderAll();
      this.uiManager.setMessage(isMyTurn ? "Your Turn! Roll the sticks." : `Waiting for ${data.turn}...`);
    }

    // --- 4) Dados (dice) ---
    if (data.dice) {
      // Se o servidor envia um objecto dice com value -> usamos; se for null -> limpa stickValue
      if (data.dice && typeof data.dice.value === 'number') {
        const rollValue = data.dice.value;
        this.game.stickValue = rollValue;
        this.game.lastStickValue = rollValue;

        // Store keepPlaying flag from server so client knows re-roll is allowed
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
              // Se é roll de bónus (1,4,6) sem movimentos → pode rodar outra vez
              if (isBonusRoll) {
                this.uiManager.setMessage(`No moves with ${rollValue} (Bonus). Roll again!`);
                this.game.waitingForPass = false;
                this.renderAll({ updateSticks: false });
                return;
              }
              
              // Se não é bónus (2,3,5) sem movimentos → deve fazer pass
              this.uiManager.setMessage(`No moves available. Click "Pass Turn".`);
              this.game.waitingForPass = true;
              this.renderAll({ updateSticks: false });
              return;
            }
            
            // Tem movimentos → seleciona uma peça
            this.game.waitingForPass = false;
            this.sticksRenderer.msgAfterFlip("Choose a piece to move!", 600);
            this.renderAll({ updateSticks: false });
          } else {
            this.renderAll({ updateSticks: false });
          }
        });
      } else {
        // dice === null -> já foi usado, limpar estado local
        this.game.stickValue = null;
        if (this.serverManager && this.serverManager.state) {
          this.serverManager.state.keepPlaying = false;
        }
        this.renderAll({ updateSticks: false });
      }

      // mustPass (se presente) controla botão de pass — state já actualizado acima
      if ('mustPass' in data) {
        this.uiManager.updatePassBtn(data.mustPass === myNick);
      }
    }

    // --- 5) selected / step: sincronizar seleção (opcional, muestra origen / posibles destinos) ---
    if (Array.isArray(data.selected) && data.selected.length >= 0) {
      // Guardar o índice da origem (se o servidor enviar 'cell' como origem)
      if (typeof data.cell === 'number') {
        this.serverManager.state.selectedFromIndex = data.cell;
      }

      if (data.step === "to") {
        // Mostrar destinos válidos (server já decidiu as casas)
        const destinations = data.selected.map(idx => this.getCoordsFromIndex(idx, this.game.columns))
                                        .filter(d => d && typeof d.row === 'number');

        // Tentar definir a peça localmente (se existir) para highlight visual
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
            // Estamos na fase de escolher a peça: limpar qualquer seleção local pendente
            this.game.clearSelection();
            this.uiManager.updateBoardHighlights(this.game);
            // apagar stored selectedFromIndex pois voltou ao estado 'from'
            delete this.serverManager.state.selectedFromIndex;
      }
    }

    // --- 6) Winner ---
    if (data.winner) {
      const winner = this.game.players.find(p => p && p.name === data.winner);
      if (winner) {
        this.handleGameOver(winner);
      } else {
        this.uiManager.setMessage(`${data.winner} won!`);
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

    // If no stick value yet, can roll
    if (this.game.stickValue == null) return true;

    // If stickValue present, allow re-roll only when server signalled keepPlaying and there are no valid moves
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

    // --- Clique numa peça: seleção LOCAL apenas (SEM notify) ---
    if (pieceAtClick) {
      const moves = this.game.selectPieceAt(row, col);
      if (!moves || moves.length === 0) {
        this.uiManager.setMessage("That piece has no valid moves.");
        return;
      }

      this.localSelectedFromIndex = cellIndex;
      this.uiManager.updateBoardHighlights(this.game);
      this.uiManager.setMessage("Piece selected — choose a destination.");
      return;
    }

    // --- Clique numa célula vazia (destino) ---
    if (this.localSelectedFromIndex != null) {
      const destIndex = cellIndex;
      this.uiManager.setMessage("Sending move to server...");
      try {
        // Send origin first and wait for server to acknowledge step 'to'
        await this.serverManager.notify(nick, pass, gameId, this.localSelectedFromIndex);
      } finally {
        this.localSelectedFromIndex = null;
        this.game.clearSelection();
        this.uiManager.updateBoardHighlights(this.game);
      }
      return;
    }

    this.uiManager.setMessage("Action not allowed right now. Wait for server.");
  }


  async handlePass() {
    if (!this.game) return;

    const { nick, pass, gameId } = this.serverManager.state;
    this.game.endTurn();
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
      'Are you sure you want to quit? This action will count as a loss.',
      'Yes, quit',
      'No, cancel'
    );
    if (!confirmed) return;

    if (this.serverManager.state.active) {
      await this.serverManager.leave(this.serverManager.state.nick, this.serverManager.state.pass, this.serverManager.state.gameId);
    } 
    this.uiManager.setMessage('You left the game.');
    const size = this.game ? this.game.columns : 9;
    this.scoreManager.loadOnlineRanking(size)
  }

  updateRollBtn() {
    const enabled = this.canPlayerRoll();
    this.uiManager.updateRollBtn(enabled);
  }
  
  updatePassBtn() {
    const isMyTurn = this.game.getCurrentPlayer().name === this.serverManager.state.nick;
    const myNick = this.serverManager.state.nick;

    // Only allow passing when server explicitly signals mustPass (contains the nick of the player who must pass)
    if (this.serverManager && this.serverManager.state && typeof this.serverManager.state.mustPass !== 'undefined') {
      const canPass = isMyTurn && this.serverManager.state.mustPass === myNick;
      this.uiManager.updatePassBtn(canPass);
      this.uiManager.setBoardDisabled(!isMyTurn);
      return;
    }

    // Otherwise, do not allow pass (online client defers to server)
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

    // Online: rotate board if I'm the red player (startRow=0)
    const forceRotate = this.game.isOnline && (this.game.players[0].startRow === 0);
    this.uiManager.updateBoardRotation(this.game, forceRotate);
  }

  handleGameOver(winner) {
    if (!winner) return;

    const winnerName = winner.name;
    
    this.sticksRenderer.msgAfterFlip(`Game Over! ${winnerName} won!`);

    const elements = this.uiManager.getElements();
    if (elements.rollBtn) elements.rollBtn.disabled = true;
    this.uiManager.setBoardDisabled(true);
    this.uiManager.hide(elements.sticksEl);
    const cols = this.game ? this.game.columns : undefined;
    this.uiManager.openScoreboardPanel(cols);
    this.scoreManager.loadOnlineRanking(cols);
    setTimeout(() => {
      this.cleanupGame();
      this.serverManager.closeUpdate();
      this.uiManager.showGame();
      this.uiManager.openSidePanel();
      this.uiManager.setMessage('Choose the configurations and click "Start" to play the game.');
      this.uiManager.setCloseBlocked(true);
      this.uiManager.openScoreboardPanel(cols);
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

  getIndexFromCoords(r, c, cols) {
  // Mapeamento zig-zag para corresponder ao formato do servidor
  let indexBase = 0;
  if (r === 3) indexBase = 0;
  if (r === 2) indexBase = cols;
  if (r === 1) indexBase = 2 * cols;
  if (r === 0) indexBase = 3 * cols;

  let offset = c;
  // Nas linhas 2 e 0 o eixo de colunas vai em sentido contrário
  if (r === 2 || r === 0) offset = (cols - 1) - c;
  return indexBase + offset;
}

getCoordsFromIndex(index, cols) {
  // Inverte o cálculo para obter (row,col) a partir do índice linear do servidor
  const rowIdx = Math.floor(index / cols);
  const offset = index % cols;
  let r = 3 - rowIdx;
  let c = offset;
  // Ajuste espelho para as linhas 2 e 0
  if (r === 2 || r === 0) c = (cols - 1) - offset;
  return { row: r, col: c };
}

  clearMessageTimer() {
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }

  /**
   * Waits for the server to set `serverManager.state.step` to `targetStep`.
   * Polls state every 100ms until `timeoutMs` elapses. Returns true if
   * the expected step was observed, false on timeout.
   */
  async waitForServerStep(targetStep, timeoutMs = 2000) {
    const start = Date.now();
    const pollInterval = 100;

    while ((Date.now() - start) < timeoutMs) {
      try {
        if (this.serverManager && this.serverManager.state && this.serverManager.state.step === targetStep) {
          return true;
        }
      } catch (e) {
        // defensive: ignore transient read errors and continue polling
      }
      await new Promise(res => setTimeout(res, pollInterval));
    }
    return false;
  }
}