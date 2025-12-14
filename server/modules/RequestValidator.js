class RequestValidator {
  validateRegister(data) {
    if (!data.nick || typeof data.nick !== 'string') {
      return { valid: false, error: 'Missing or invalid nick' };
    }
    if (!data.password || typeof data.password !== 'string') {
      return { valid: false, error: 'Missing or invalid password' };
    }
    return { valid: true };
  }

  validateRanking(data) {
    if (typeof data.group !== 'number' || data.group <= 0) {
      return { valid: false, error: `Invalid group '${data.group}'` };
    }
    if (typeof data.size !== 'number' || data.size <= 0 || data.size % 2 === 0) {
      return { valid: false, error: `Invalid size '${data.size}'` };
    }
    return { valid: true };
  }

  validateJoin(data) {
    if (typeof data.group !== 'number' || data.group <= 0) {
      return { valid: false, error: `Invalid group '${data.group}'` };
    }
    if (!data.nick || typeof data.nick !== 'string') {
      return { valid: false, error: 'Missing or invalid nick' };
    }
    if (!data.password || typeof data.password !== 'string') {
      return { valid: false, error: 'Missing or invalid password' };
    }
    if (typeof data.size !== 'number' || data.size <= 0 || data.size % 2 === 0) {
      return { valid: false, error: `Invalid size '${data.size}'` };
    }
    return { valid: true };
  }

  validateLeave(data) {
    if (!data.nick || typeof data.nick !== 'string') {
      return { valid: false, error: 'Missing nick' };
    }
    if (!data.password || typeof data.password !== 'string') {
      return { valid: false, error: 'Missing password' };
    }
    if (!data.game || typeof data.game !== 'string') {
      return { valid: false, error: 'Missing game' };
    }
    return { valid: true };
  }

  validateRoll(data) {
    return this.validateGameAction(data);
  }

  validatePass(data) {
    return this.validateGameAction(data);
  }

  validateNotify(data) {
    const gameCheck = this.validateGameAction(data);
    if (!gameCheck.valid) return gameCheck;

    if (typeof data.cell !== 'number') {
      return { valid: false, error: 'cell is not an integer' };
    }
    if (data.cell < 0) {
      return { valid: false, error: 'cell is negative' };
    }
    return { valid: true };
  }

  validateGameAction(data) {
    if (!data.nick || typeof data.nick !== 'string') {
      return { valid: false, error: 'Missing nick' };
    }
    if (!data.password || typeof data.password !== 'string') {
      return { valid: false, error: 'Missing password' };
    }
    if (!data.game || typeof data.game !== 'string') {
      return { valid: false, error: 'Missing game' };
    }
    return { valid: true };
  }
}

module.exports = RequestValidator;