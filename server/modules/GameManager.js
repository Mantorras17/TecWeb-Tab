const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

class GameManager {
  constructor(rankingManager) {
    this.rankingManager = rankingManager;
    this.dataDir = path.join(__dirname, '../data');
    this.gamesFile = path.join(this.dataDir, 'games.json');
    this.games = new Map();
    this.waitingPlayers = new Map(); // "group-size" -> { nick, gameId, time }
    this.sseListeners = new Map(); // gameId -> Map(nick -> res)
    this.timeoutMs = 2 * 60 * 1000; // 2 minutes
    this.monitorIntervalMs = 1000;
    this.timeoutTimer = setInterval(() => this.checkTimeouts(), this.monitorIntervalMs);
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

  async checkTimeouts() {
    const now = Date.now();
    for (const [gameId, game] of this.games.entries()) {
      if (!game || game.winner) continue;
      const last = game.lastMoveTime || 0;
      const elapsed = now - last;
      if (elapsed >= this.timeoutMs) {
        const timedOutPlayer = game.currentPlayer;
        if (!timedOutPlayer) continue;

        const opponent = game.players.find(p => p !== timedOutPlayer);
        game.winner = opponent;
        game.currentPlayer = null;

        try {
          if (this.rankingManager) {
            await this.rankingManager.updatePlayerStats(
              game.group,
              game.size,
              opponent,
              timedOutPlayer
            );
          }
        } catch (e) {
          console.error(`Ranking update failed for timeout in game ${gameId}:`, e);
        }

        this.broadcast(gameId, { winner : opponent });

        try {
          await this.save();
        } catch (e) {
          console.error(`Failed to save game state after timeout in game ${gameId}:`, e);
        }
      }
    }
  }

  async joinGame(group, nick, size) {
    const key = `${group}-${size}`;

    // Check for waiting player
    if (this.waitingPlayers.has(key)) {
      const waiting = this.waitingPlayers.get(key);
      this.waitingPlayers.delete(key);

      const opponent = waiting.nick;
      const gameId = waiting.gameId;
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
      const gameId = this.generateGameId(group, size, [nick]);
      this.waitingPlayers.set(key, { nick, gameId, time: Date.now() });
      return { success: true, gameId };
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

  getRowCol(cell, size) {
    const row = Math.floor(cell / size);
    const col = cell % size;
    return { row, col };
  }

  getCell(row, col, size) {
    return row * size + col;
  }

  getNextCell(fromCell, steps, size) {
    const { row, col } = this.getRowCol(fromCell, size);
    let currentRow = row;
    let currentCol = col;
    let remaining = steps;

    while (remaining > 0) {
      // Row 0 (bottom) and Row 2: move left to right
      if (currentRow === 0 || currentRow === 2) {
        if (currentCol + remaining < size) {
          return this.getCell(currentRow, currentCol + remaining, size);
        }
        remaining -= (size - currentCol);
        currentCol = size - 1;
        currentRow++;
      }
      // Row 1 and Row 3 (top): move right to left
      else if (currentRow === 1 || currentRow === 3) {
        if (currentCol - remaining >= 0) {
          return this.getCell(currentRow, currentCol - remaining, size);
        }
        remaining -= (currentCol + 1);
        currentCol = 0;
        currentRow++;
        if (currentRow === 2) currentCol = 0;
        if (currentRow === 4) currentRow = 2; // From row 3 back to row 2
      }
    }

    return this.getCell(currentRow, currentCol, size);
  }

  getPossibleDestinations(fromCell, steps, size, piece) {
    const { row, col } = this.getRowCol(fromCell, size);
    const destinations = [];

    // Normal path
    const normalDest = this.getNextCell(fromCell, steps, size);
    if (normalDest !== null) destinations.push(normalDest);

    // Special case: from row 2, can choose to go to row 3 (4th row)
    if (row === 2 && col + steps >= size && !piece.reachedLastRow) {
      const stepsToEnd = size - col;
      const remaining = steps - stepsToEnd;
      // Go to row 3 instead of row 1
      const row3Dest = this.getCell(3, size - 1 - remaining, size);
      if (row3Dest >= 3 * size && row3Dest < 4 * size) {
        destinations.push(row3Dest);
      }
    }

    return destinations;
  }

  canMoveInLastRow(game, playerColor) {
    const size = game.size;
    const firstRowStart = playerColor === 'Blue' ? 0 : 3 * size;
    const firstRowEnd = playerColor === 'Blue' ? size : 4 * size;
    
    // Check if all pieces left first row
    for (let i = firstRowStart; i < firstRowEnd; i++) {
      const piece = game.pieces[i];
      if (piece && piece.color === playerColor && !piece.inMotion) {
        return false;
      }
    }
    return true;
  }

  isValidMove(game, fromCell, toCell, diceValue) {
    const piece = game.pieces[fromCell];
    if (!piece) return { valid: false, error: 'No piece at source' };

    const playerColor = game.currentPlayer === game.initial ? 'Blue' : 'Red';
    if (piece.color !== playerColor) {
      return { valid: false, error: 'Not your piece' };
    }

    // First move must be with Tâb (1)
    if (!piece.inMotion && diceValue !== 1) {
      return { valid: false, error: 'First move must be with Tâb (1)' };
    }

    const { row: fromRow } = this.getRowCol(fromCell, game.size);
    const { row: toRow } = this.getRowCol(toCell, game.size);

    // Cannot return to first row
    if (piece.inMotion && toRow === (playerColor === 'Blue' ? 0 : 3)) {
      return { valid: false, error: 'Cannot return to first row' };
    }

    // Check if in 4th row and trying to move there
    if (toRow === 3 && playerColor === 'Blue') {
      if (piece.reachedLastRow) {
        return { valid: false, error: 'Piece already visited last row' };
      }
      if (!this.canMoveInLastRow(game, playerColor)) {
        return { valid: false, error: 'Must move all pieces from first row before moving in last row' };
      }
    }
    if (toRow === 0 && playerColor === 'Red') {
      if (piece.reachedLastRow) {
        return { valid: false, error: 'Piece already visited last row' };
      }
      if (!this.canMoveInLastRow(game, playerColor)) {
        return { valid: false, error: 'Must move all pieces from first row before moving in last row' };
      }
    }

    // Check destination
    const destPiece = game.pieces[toCell];
    if (destPiece && destPiece.color === playerColor) {
      return { valid: false, error: 'cannot capture your own piece' };
    }

    // Verify the move matches dice value
    const possibleDests = this.getPossibleDestinations(fromCell, diceValue, game.size, piece);
    if (!possibleDests.includes(toCell)) {
      return { valid: false, error: 'Invalid move: must play the dice\'s value' };
    }

    return { valid: true };
  }

  getValidMoves(game) {
    if (!game.dice) return [];
    
    const playerColor = game.currentPlayer === game.initial ? 'Blue' : 'Red';
    const diceValue = game.dice.value;
    const validMoves = [];

    for (let i = 0; i < game.pieces.length; i++) {
      const piece = game.pieces[i];
      if (!piece || piece.color !== playerColor) continue;

      const possibleDests = this.getPossibleDestinations(i, diceValue, game.size, piece);
      for (const dest of possibleDests) {
        const validation = this.isValidMove(game, i, dest, diceValue);
        if (validation.valid) {
          validMoves.push({ from: i, to: dest });
        }
      }
    }

    return validMoves;
  }

  checkWinCondition(game) {
    const bluePieces = game.pieces.filter(p => p && p.color === 'Blue').length;
    const redPieces = game.pieces.filter(p => p && p.color === 'Red').length;

    if (bluePieces === 0) {
      return { over: true, winner: game.players.find(p => p !== game.initial) }; // Red wins
    }
    if (redPieces === 0) {
      return { over: true, winner: game.initial }; // Blue wins
    }

    return { over: false, winner: null };
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

    if (this.rankingManager) {
      await this.rankingManager.updatePlayerStats(game.group, game.size, opponent, nick);
    }

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

    if (game.dice !== null && !game.dice.keepPlaying) {
      return { success: false, error: 'You already rolled the dice and have valid moves' };
    }

    // Roll the dice
    const stickValues = Array.from({ length: 4 }, () => Math.random() < 0.5);
    const sum = stickValues.reduce((a, b) => a + (b ? 1 : 0), 0);
    const value = sum === 0 ? 6 : sum;
    const keepPlaying = [1, 4, 6].includes(value);

    game.dice = { stickValues, value, keepPlaying };
    game.lastMoveTime = Date.now();

    const validMoves = this.getValidMoves(game);
    const mustPass = (validMoves.length === 0 && !keepPlaying) ? game.currentPlayer : null;
    
    this.broadcast(gameId, {
      dice: game.dice,
      turn: game.currentPlayer,
      mustPass: mustPass
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

    const validMoves = this.getValidMoves(game);
    if (validMoves.length > 0) {
      return { success: false, error: 'You already rolled the dice and have valid moves' };
    }

    // Pass turn to opponent
    const opponent = game.players.find(p => p !== nick);
    game.currentPlayer = opponent;
    game.dice = null;
    game.step = 'from';
    game.selected = [];
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
      return { success: false, error: 'Not your turn to play' };
    }

    if (typeof cell !== 'number') {
      return { success: false, error: 'Cell is not an integer' };
    }

    if (cell < 0) {
      return { success: false, error: 'Cell is negative' };
    }

    if (cell >= 4 * game.size) {
      return { success: false, error: 'Cell out of bounds' };
    }

    // Handle move logic based on step
    const opponent = game.players.find(p => p !== nick);
    const playerColor = nick === game.initial ? 'Blue' : 'Red';
    
    if (game.step === 'from') {

      if (!game.dice) {
        return { success: false, error: 'You must roll the dice first' };
      }

      const piece = game.pieces[cell];
      if (!piece || piece.color !== playerColor) {
        return { success: false, error: 'Invalid piece selection' };
      }

      const validDests = this.getPossibleDestinations(cell, game.dice.value, game.size, piece)
        .filter(dest => {
          const validation = this.isValidMove(game, cell, dest, game.dice.value);
          return validation.valid;
        });

      if (validDests.length === 0) {
        return { success: false, error: 'No valid moves for selected piece' };
      }

      game.step = 'to';
      game.selected = [cell];

      this.broadcast(gameId, {
        cell,
        selected: [cell, ...validDests],
        step: game.step,
        turn: game.currentPlayer
      });

      await this.save();
      return { success: true };
      
    } else if (game.step === 'to') {
      // Player selecting destination
      if (game.selected && game.selected[0] === cell) {
        // Rollback
        game.step = 'from';
        game.selected = [];
        this.broadcast(gameId, {
          step: 'from',
          turn: game.currentPlayer
        });
        await this.save();
        return { success: true };
      }

      if (!game.selected || game.selected.length === 0) {
        return { success: false, error: 'No piece selected' };
      }

      const fromCell = game.selected[0];
      const validation = this.isValidMove(game, fromCell, cell, game.dice.value);

      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const sourcePiece = game.pieces[fromCell];
      const destPiece = game.pieces[cell];

      // Check for capture
      if (destPiece && destPiece.color !== playerColor) {
        game.pieces[cell] = null;
      }

      // Perform move
      game.pieces[cell] = sourcePiece;
      game.pieces[fromCell] = null;

      // Update piece state
      sourcePiece.inMotion = true;
      const { row: toRow } = this.getRowCol(cell, game.size);
      if ((toRow === 3 && playerColor === 'Blue') || (toRow === 0 && playerColor === 'Red')) {
        sourcePiece.reachedLastRow = true;
      }

      game.lastMoveTime = Date.now();

      const winCheck = this.checkWinCondition(game);
      if (winCheck.over) {
        game.winner = winCheck.winner;
        game.currentPlayer = null;

        if (this.rankingManager) {
          const loser = game.players.find(p => p !== winCheck.winner);
          await this.rankingManager.updatePlayerStats(game.group, game.size, winCheck.winner, loser);
        }

        this.broadcast(gameId, {
          winner: winCheck.winner,
          pieces: game.pieces,
        });
        await this.save();
        return { success: true };
      }

      if (game.dice.keepPlaying) {
        game.dice = null;
        game.step = 'from';
        game.selected = [];

        this.broadcast(gameId, {
          cell: cell,
          selected: [fromCell, cell],
          pieces: game.pieces,
          turn: game.currentPlayer,
          step: 'from',
          dice: null,
          initial: game.initial
        });
      } else {
        game.currentPlayer = opponent;
        game.dice = null;
        game.step = 'from';
        game.selected = [];

        this.broadcast(gameId, {
          cell: cell,
          selected: [fromCell, cell],
          pieces: game.pieces,
          turn: game.currentPlayer,
          step: 'from',
          initial: game.initial
        });
      }

      await this.save();
      return { success: true };
    }
    return { success: false, error: 'Invalid game state' };
  }

  async setupSSE(query, res) {
    const gameId = query.game;
    const nick = query.nick;

    if (!gameId || !nick) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing parameters' }));
      return;
    }

    const gameExists = this.games.has(gameId);
    const isWaiting = Array.from(this.waitingPlayers.values()).some(w => w.gameId === gameId);

    if (!gameExists && !isWaiting) {
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

    if (gameExists) {
      const game = this.games.get(gameId);
      const snapshot = {
        pieces: game.pieces,
        initial: game.initial,
        step: game.step,
        turn: game.currentPlayer,
        players: {
          [game.players[0]]: 'Blue',
          [game.players[1]]: 'Red'
        },
        dice: game.dice || null
      };
      res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
    } else {
      res.write(`data: {"waiting": true}\n\n`);
    }

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

    if (data.winner) {
      listeners.forEach((res, nick) => {
        try {
          res.end();
        } catch (e) { }
      });
      this.sseListeners.delete(gameId);
    }
  }

  async save() {
    try {
      const gamesArray = Array.from(this.games.entries());
      await fs.writeFile(this.gamesFile, JSON.stringify(gamesArray, null, 2));
    } catch (e) {
      console.error('Error saving games:', e);
    }
  }

  stop() {
    if (this.timeoutTimer) {
      clearInterval(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }
}

module.exports = GameManager;