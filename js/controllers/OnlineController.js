import BaseGameController from './BaseGameController.js';
import TabGame from '../classes/Tabgame.js';
import Piece from '../classes/Piece.js';

export default class OnlineController extends BaseGameController {
  constructor(uiManager, sticksRenderer, scoreManager, modalManager, serverManager) {
    super(uiManager, sticksRenderer, scoreManager, modalManager);
    this.serverManager = serverManager;
  }

  async initGame(cols) {
    const { nick, pass } = this.serverManager.state;
    
    if (!nick) {
        alert("Login required!");
        this.uiManager.getElements().userMenu.classList.remove('hidden');
        return;
    }

    try {
        this.uiManager.setMessage("Connecting...");
        const joinData = await this.serverManager.join(this.serverManager.GROUP_ID, nick, pass, cols);
        this.serverManager.setGame(joinData.game);
        
        this.uiManager.closeSidePanel();
        this.uiManager.setMessage(`Joined! Waiting for opponent... (Game ID: ${joinData.game})`);
        
        this.serverManager.startListening(nick, joinData.game, 
            (data) => this.onServerUpdate(data),
            (err) => console.error("SSE Error", err)
        );
    } catch (err) {
        this.uiManager.setMessage("Error: " + err.message);
    }
  }

  /**
   * ONLINE RENDER: Static Rotation (My pieces always at bottom)
   */
  renderAll(opts = { updateSticks: true }) {
    if (!this.game) return;
    this.uiManager.buildBoard(this.game);
    this.uiManager.updateBoardHighlights(this.game);
    
    if (opts.updateSticks) {
      this.sticksRenderer.renderSticks(this.game.stickValue ?? null, { animate: false });
    }
    
    this.updateRollBtn();
    
    const hasMoves = this.hasAnyValidMoves();
    const sticksThrown = this.game.stickValue !== null;
    const canPass = ((sticksThrown && !hasMoves) || this.game.waitingForPass);
    this.uiManager.updatePassBtn(canPass);
    
    // ROTATION: Force Static (View from P1/Me perspective)
    // In online init, we assign 'me' to players[0].
    const realIdx = this.game.curPlayerIdx;
    this.game.curPlayerIdx = 0; 
    this.uiManager.updateBoardRotation(this.game);
    this.game.curPlayerIdx = realIdx;
  }

  onServerUpdate(data) {
      if (data.error) { 
          this.uiManager.setMessage("Error: " + data.error); 
          return; 
      }

      const myNick = this.serverManager.state.nick;

      if (data.pieces && !this.game) {
        const size = data.pieces.length / 4; 
        this.game = new TabGame(size);
        this.game.isOnline = true;
        this.game.isVsPlayer = true; 
        window.game = this.game; 
        
        this.game.players[0].name = myNick; 
        const opponentName = Object.keys(data.players || {}).find(n => n !== myNick) || "Opponent";
        this.game.players[1].name = opponentName;
        
        this.serverManager.state.color = data.players ? data.players[myNick] : "Blue";

        const els = this.uiManager.getElements();
        this.uiManager.show(els.rollBtn);
        this.uiManager.hardShowScoreboard();
        this.renderAll();
      }

      if (!this.game) return;

      if (data.pieces) {
        this.game.players[0].pieces = [];
        this.game.players[1].pieces = [];

        data.pieces.forEach((p, index) => {
            if (!p) return; 
            
            const coords = this.getCoordsFromIndex(index, this.game.columns);
            let owner = (p.color === this.serverManager.state.color) ? this.game.players[0] : this.game.players[1];
            const newPiece = new Piece(owner, coords.row, coords.col);
            
            if (p.reachedLastRow) newPiece.state = 'last-row';
            else if (p.inMotion) newPiece.state = 'moved';
            
            owner.addPiece(newPiece);
        });
        
        this.uiManager.buildBoard(this.game);
        this.uiManager.updateBoardHighlights(this.game);
      }

      if (data.turn) {
        if (data.turn === myNick) {
            this.uiManager.setMessage("Your Turn!");
            this.game.curPlayerIdx = 0; 
            this.uiManager.updateRollBtn(this.game.stickValue == null);
        } else {
            this.uiManager.setMessage(`Waiting for ${data.turn}...`);
            this.game.curPlayerIdx = 1;
            this.uiManager.updateRollBtn(false);
        }
      }
      
      if (data.dice && data.dice.value) {
        this.game.stickValue = data.dice.value;
        this.sticksRenderer.renderSticks(data.dice.value, { animate: true });
        
        if (this.game.getCurrentPlayer().name === myNick) {
             this.uiManager.updateRollBtn(false);
        }
      } else {
        this.game.stickValue = null;
        if (this.game.getCurrentPlayer().name === myNick) {
             this.uiManager.updateRollBtn(true);
        }
      }
      
      if (data.winner) {
        this.handleGameOver({ name: data.winner });
        this.serverManager.stopListening();
      }
      
      // Update rotation (force static)
      this.renderAll({ updateSticks: false });
  }

  async handleRoll() {
    if (this.game.stickValue != null) {
        this.uiManager.setMessage("You already rolled. Move a piece before rolling again.");
        return;
    }

    const { nick, pass, gameId } = this.serverManager.state;
    try {
        await this.serverManager.roll(nick, pass, gameId);
    } catch (err) {
        this.uiManager.setMessage("Error rolling: " + err.message);
    }
  }

  async handleBoardClick(row, col) {
    if (row == null || col == null) return;

    if (this.serverManager.state.nick !== this.game.getCurrentPlayer().name) {
        this.uiManager.setMessage("Not your turn!");
        return;
    }

    const pieceAtClick = this.game.getCurrentPlayer().getPieceAt(row, col);
    
    if (pieceAtClick) {
        if (this.game.selectedPiece === pieceAtClick) {
            this.game.clearSelection();
        } else {
            this.game.selectPieceAt(row, col);
        }
        this.uiManager.updateBoardHighlights(this.game);
        return;
    } 
    
    if (this.game.selectedPiece) {
        const cellIndex = this.getIndexFromCoords(row, col, this.game.columns);
        const { nick, pass, gameId } = this.serverManager.state;
        
        try {
            await this.serverManager.notify(nick, pass, gameId, cellIndex);
            this.game.clearSelection();
            this.uiManager.updateBoardHighlights(this.game);
        } catch (err) {
            this.uiManager.setMessage("Error moving: " + err.message);
        }
    }
  }

  async handleQuit() {
      const { nick, pass, gameId } = this.serverManager.state;
      if (this.serverManager.state.active) {
        await this.serverManager.leave(nick, pass, gameId);
        this.serverManager.clearGame();
        this.serverManager.stopListening();
      }
      this.cleanup();
      this.uiManager.setMessage("You left the online game.");
      this.uiManager.closeSidePanel();
      this.uiManager.showGame();
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
  
  handlePass() {
      this.uiManager.setMessage("Pass handled automatically online.");
  }
}