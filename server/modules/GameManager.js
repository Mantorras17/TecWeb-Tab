const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

class GameManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.gamesFile = path.join(this.dataDir, 'games.json');
    this.games = new Map();
    this.waitingPlayers = new Map(); // "group-size" -> {nick, time}
    this.sseListeners = new Map(); // gameId -> Map(nick -> res)
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const data = await fs.readFile(this.gamesFile, 'utf8');
      const gamesArray = JSON.parse(data);
      this.games = new Map(gamesArray);
    } catch (e) {
      this.games = new Map();
      await this.save();
    }
  }

  generateGameId(group, size, players) {
    const data = `${group}-${size}-${Date.now()}-${players.sort().join('-')}`;
    return crypto.createHash('md5').update(data).digest('hex');
  }

  async joinGame(group, nick, size) {
    const key = `${group}-${size}`;

    // Check for waiting player
    if (this.waitingPlayers.has(key)) {
      const opponent = this.waitingPlayers.get(key);
      this.waitingPlayers.delete(key);

      const gameId = this.generateGameId(group, size, [nick, opponent]);
      const game = {
        id: gameId,
        group,
        size,
        players: [opponent, nick],
        initial: opponent,
        currentPlayer: opponent,
        step: 'from',
        pieces: this.initPieces(size),
        dice: null,
        winner: null,
        createdAt: new Date().toISOString(),
        lastMoveTime: Date.now()
      };

      this.games.set(gameId, game);
      await this.save();

      // Notify both players via SSE
      this.broadcast(gameId, {
        pieces: game.pieces,
        initial: game.initial,
        step: game.step,
        turn: game.currentPlayer,
        players: {
          [opponent]: 'Blue',
          [nick]: 'Red'
        }
      });

      return { success: true, gameId };
    } else {
      // Wait for opponent
      this.waitingPlayers.set(key, nick);
      return { success: true, gameId: null }; // Return null for waiting
    }
  }

  initPieces(size) {
    const pieces = new Array(4 * size).fill(null);
    // Initial player pieces (Blue) - positions 0 to size-1
    for (let i = 0; i < size; i++) {
      pieces[i] = { color: 'Blue', inMotion: false, reachedLastRow: false };
    }
    // Second player pieces (Red) - positions 3*size to 4*size-1
    for (let i = 3 * size; i < 4 * size; i++) {
      pieces[i] = { color: 'Red', inMotion: false, reachedLastRow: false };
    }
    return pieces;
  }

  async leaveGame(gameId, nick) {
    if (!this.games.has(gameId)) {
      return { success: false, error: 'Invalid game reference' };
    }

    const game = this.games.get(gameId);
    if (!game.players.includes(nick)) {
      return { success: false, error: 'Player not in game' };
    }

    // If game already has a winner, it's over
    if (game.winner !== null) {
      return { success: true }; // Already finished
    }

    const opponent = game.players.find(p => p !== nick);
    game.winner = opponent;
    game.currentPlayer = null; // Game ended

    // Broadcast winner to both players
    this.broadcast(gameId, { winner: opponent });
    
    await this.save();
    return { success: true };
  }

  async rollDice(gameId, nick) {
    if (!this.games.has(gameId)) {
      return { success: false, error: 'Invalid game reference' };
    }

    const game = this.games.get(gameId);
    
    if (game.currentPlayer !== nick) {
      return { success: false, error: 'Not your turn to play' };
    }

    if (game.dice !== null) {
      if (game.dice.keepPlaying) {
        return { success: false, error: 'You already rolled the dice but can roll it again' };
      } else {
        return { success: false, error: 'You already rolled the dice and have valid moves' };
      }
    }

    // Roll the dice
    const stickValues = Array.from({ length: 4 }, () => Math.random() < 0.5);
    const sum = stickValues.reduce((a, b) => a + (b ? 1 : 0), 0);
    const value = sum === 0 ? 6 : sum;
    const keepPlaying = [1, 4, 6].includes(value);

    game.dice = { stickValues, value, keepPlaying };
    game.lastMoveTime = Date.now();

    // Determine if player must pass
    // In a real implementation, check if there are valid moves with this dice
    // For now, we'll send mustPass as null (server doesn't enforce move validity)
    
    this.broadcast(gameId, {
      dice: game.dice,
      turn: game.currentPlayer,
      mustPass: null
    });

    await this.save();
    return { success: true };
  }

  async passTurn(gameId, nick) {
    if (!this.games.has(gameId)) {
      return { success: false, error: 'Invalid game reference' };
    }

    const game = this.games.get(gameId);
    
    if (game.currentPlayer !== nick) {
      return { success: false, error: 'Not your turn to play' };
    }

    if (!game.dice) {
      return { success: false, error: 'You must roll the dice first' };
    }

    if (game.dice.keepPlaying) {
      return { success: false, error: 'You already rolled the dice but can roll it again' };
    }

    // Pass turn to opponent
    const opponent = game.players.find(p => p !== nick);
    game.currentPlayer = opponent;
    game.dice = null;
    game.step = 'from';
    game.lastMoveTime = Date.now();

    this.broadcast(gameId, {
      turn: opponent,
      dice: null,
      step: 'from'
    });

    await this.save();
    return { success: true };
  }

  async makeMove(gameId, nick, cell) {
    if (!this.games.has(gameId)) {
      return { success: false, error: 'Invalid game reference' };
    }

    const game = this.games.get(gameId);
    
    if (game.currentPlayer !== nick) {
      return { success: false, error: 'not your turn to play' };
    }

    if (typeof cell !== 'number') {
      return { success: false, error: 'cell is not an integer' };
    }

    if (cell < 0) {
      return { success: false, error: 'cell is negative' };
    }

    if (cell >= 4 * game.size) {
      return { success: false, error: 'cell out of bounds' };
    }

    // Handle move logic based on step
    const opponent = game.players.find(p => p !== nick);
    
    if (game.step === 'from') {
      // Player selecting a piece to move
      // Check if there's a piece at this position owned by current player
      const piece = game.pieces[cell];
      
      if (!piece || piece.color !== (nick === game.initial ? 'Blue' : 'Red')) {
        return { success: false, error: 'Invalid piece selection' };
      }

      // Move to 'to' step
      game.step = 'to';
      game.selected = [cell]; // Remember selected piece
      
    } else if (game.step === 'to') {
      // Player selecting destination
      // In Phase 2, if same as 'from', it cancels selection
      if (game.selected && game.selected[0] === cell) {
        // Rollback
        game.step = 'from';
        game.selected = [];
        this.broadcast(gameId, {
          step: 'from',
          selected: game.selected,
          turn: game.currentPlayer
        });
        await this.save();
        return { success: true };
      }

      // Move piece
      const sourcePiece = game.pieces[game.selected[0]];
      const destPiece = game.pieces[cell];

      // Check for capture
      if (destPiece && destPiece.color === (nick === game.initial ? 'Red' : 'Blue')) {
        return { success: false, error: 'cannot capture to your own piece' };
      }

      // Perform move
      game.pieces[cell] = sourcePiece;
      game.pieces[game.selected[0]] = null;

      // Update piece state
      if (sourcePiece) {
        sourcePiece.inMotion = true;
        // Check if reached last row
        const lastRow = nick === game.initial ? 3 * game.size : game.size - 1;
        if (cell >= lastRow && cell < lastRow + game.size) {
          sourcePiece.reachedLastRow = true;
        }
      }

      // Pass turn to opponent (normal flow)
      game.currentPlayer = opponent;
      game.dice = null;
      game.step = 'from';
      game.selected = [];
      game.lastMoveTime = Date.now();

      // Check for game over (all pieces moved to last row)
      const allMovedBlue = game.pieces
        .slice(0, game.size)
        .every(p => !p || p.inMotion);
      const allMovedRed = game.pieces
        .slice(3 * game.size)
        .every(p => !p || p.inMotion);

      if (allMovedBlue) {
        game.winner = game.initial;
        this.broadcast(gameId, {
          winner: game.initial,
          pieces: game.pieces,
          cell: cell,
          selected: [game.selected[0], cell]
        });
        await this.save();
        return { success: true };
      }

      if (allMovedRed) {
        const redPlayer = game.players.find(p => p !== game.initial);
        game.winner = redPlayer;
        this.broadcast(gameId, {
          winner: redPlayer,
          pieces: game.pieces,
          cell: cell,
          selected: [game.selected[0], cell]
        });
        await this.save();
        return { success: true };
      }

      this.broadcast(gameId, {
        cell: game.selected[0],
        selected: [game.selected[0], cell],
        pieces: game.pieces,
        turn: game.currentPlayer,
        step: 'from',
        initial: game.initial
      });
    }

    await this.save();
    return { success: true };
  }

  async setupSSE(query, res) {
    const gameId = query.game;
    const nick = query.nick;

    if (!gameId || !nick) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing parameters' }));
      return;
    }

    if (!this.games.has(gameId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid game reference' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    if (!this.sseListeners.has(gameId)) {
      this.sseListeners.set(gameId, new Map());
    }
    this.sseListeners.get(gameId).set(nick, res);

    // Send initial empty message
    res.write('data: {}\n\n');

    res.on('close', () => {
      const listeners = this.sseListeners.get(gameId);
      if (listeners) {
        listeners.delete(nick);
        if (listeners.size === 0) {
          this.sseListeners.delete(gameId);
        }
      }
    });

    res.on('error', () => {
      const listeners = this.sseListeners.get(gameId);
      if (listeners) {
        listeners.delete(nick);
      }
    });
  }

  broadcast(gameId, data) {
    if (!this.sseListeners.has(gameId)) return;

    const listeners = this.sseListeners.get(gameId);
    const message = `data: ${JSON.stringify(data)}\n\n`;

    listeners.forEach((res, nick) => {
      try {
        res.write(message);
      } catch (e) {
        listeners.delete(nick);
      }
    });
  }

  async save() {
    try {
      const gamesArray = Array.from(this.games.entries());
      await fs.writeFile(this.gamesFile, JSON.stringify(gamesArray, null, 2));
    } catch (e) {
      console.error('Error saving games:', e);
    }
  }
}

module.exports = GameManager;