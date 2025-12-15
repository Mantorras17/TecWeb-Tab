const http = require('http');
const url = require('url');
const UserManager = require('./UserManager');
const RankingManager = require('./RankingManager');
const GameManager = require('./GameManager');
const RequestValidator = require('./RequestValidator');

class TabServer {
  constructor(port) {
    this.port = port;
    this.userManager = new UserManager();
    this.rankingManager = new RankingManager();
    this.gameManager = new GameManager(this.rankingManager);
    this.validator = new RequestValidator();
    
    this.server = http.createServer((req, res) => this.handleRequest(req, res));
  }

  async handleRequest(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const endpoint = parsedUrl.pathname.substring(1).toLowerCase();

    try {
      if (req.method === 'GET') {
        await this.handleGET(endpoint, parsedUrl.query, res);
      } else if (req.method === 'POST') {
        await this.handlePOST(endpoint, req, res);
      } else {
        this.sendError(res, 404, 'Method not allowed');
      }
    } catch (error) {
      console.error('Error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  async handleGET(endpoint, query, res) {
    if (endpoint === 'update') {
      await this.gameManager.setupSSE(query, res);
    } else {
      this.sendError(res, 404, 'Unknown endpoint');
    }
  }

  async handlePOST(endpoint, req, res) {
    const body = await this.getBody(req);
    let data;
    
    try {
      data = JSON.parse(body || '{}');
    } catch (e) {
      this.sendError(res, 400, 'Invalid JSON');
      return;
    }

    switch (endpoint) {
      case 'register':
        await this.handleRegister(data, res);
        break;
      case 'ranking':
        await this.handleRanking(data, res);
        break;
      case 'join':
        await this.handleJoin(data, res);
        break;
      case 'leave':
        await this.handleLeave(data, res);
        break;
      case 'roll':
        await this.handleRoll(data, res);
        break;
      case 'pass':
        await this.handlePass(data, res);
        break;
      case 'notify':
        await this.handleNotify(data, res);
        break;
      default:
        this.sendError(res, 404, 'Unknown endpoint');
    }
  }

  // ========== HANDLERS ==========

  async handleRegister(data, res) {
    const validation = this.validator.validateRegister(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const result = await this.userManager.register(data.nick, data.password);
    if (result.success) {
      this.sendSuccess(res, {});
    } else {
      this.sendError(res, 401, result.error);
    }
  }

  async handleRanking(data, res) {
    const validation = this.validator.validateRanking(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const ranking = await this.rankingManager.getRanking(data.group, data.size);
    this.sendSuccess(res, { ranking });
  }

  async handleJoin(data, res) {
    const validation = this.validator.validateJoin(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const authResult = await this.userManager.authenticate(data.nick, data.password);
    if (!authResult.success) {
      this.sendError(res, 401, authResult.error);
      return;
    }

    const result = await this.gameManager.joinGame(data.group, data.nick, data.size);
    if (result.success) {
      this.sendSuccess(res, { game: result.gameId });
    } else {
      this.sendError(res, 400, result.error);
    }
  }

  async handleLeave(data, res) {
    const validation = this.validator.validateLeave(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const authResult = await this.userManager.authenticate(data.nick, data.password);
    if (!authResult.success) {
      this.sendError(res, 401, authResult.error);
      return;
    }

    const result = await this.gameManager.leaveGame(data.game, data.nick);
    if (result.success) {
      // Update rankings if game has a winner
      const game = this.gameManager.games.get(data.game);
      if (game && game.winner) {
        const opponent = game.players.find(p => p !== data.nick);
        await this.rankingManager.updatePlayerStats(game.group, game.size, game.winner, opponent);
      }
      this.sendSuccess(res, {});
    } else {
      this.sendError(res, 400, result.error);
    }
  }

  async handleRoll(data, res) {
    const validation = this.validator.validateRoll(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const authResult = await this.userManager.authenticate(data.nick, data.password);
    if (!authResult.success) {
      this.sendError(res, 401, authResult.error);
      return;
    }

    const result = await this.gameManager.rollDice(data.game, data.nick);
    if (result.success) {
      this.sendSuccess(res, {});
    } else {
      this.sendError(res, 400, result.error);
    }
  }

  async handlePass(data, res) {
    const validation = this.validator.validatePass(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const authResult = await this.userManager.authenticate(data.nick, data.password);
    if (!authResult.success) {
      this.sendError(res, 401, authResult.error);
      return;
    }

    const result = await this.gameManager.passTurn(data.game, data.nick);
    if (result.success) {
      this.sendSuccess(res, {});
    } else {
      this.sendError(res, 400, result.error);
    }
  }

  async handleNotify(data, res) {
    const validation = this.validator.validateNotify(data);
    if (!validation.valid) {
      this.sendError(res, 400, validation.error);
      return;
    }

    const authResult = await this.userManager.authenticate(data.nick, data.password);
    if (!authResult.success) {
      this.sendError(res, 401, authResult.error);
      return;
    }

    const result = await this.gameManager.makeMove(data.game, data.nick, data.cell);
    if (result.success) {
      this.sendSuccess(res, {});
    } else {
      this.sendError(res, 400, result.error);
    }
  }

  // ========== HELPERS ==========

  getBody(req) {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', () => resolve(body));
      req.on('error', reject);
    });
  }

  sendSuccess(res, data) {
    res.writeHead(200);
    res.end(JSON.stringify(data));
  }

  sendError(res, code, message) {
    res.writeHead(code);
    res.end(JSON.stringify({ error: message }));
  }

  start() {
    this.server.listen(this.port, '0.0.0.0', () => {
      console.log(`✓ Tâb Server running on port ${this.port}`);
    });
  }

  stop() {
    this.server.close();
    if (this.gameManager && this.gameManager.stop) {
      this.gameManager.stop();
    }
  }
}

module.exports = TabServer;