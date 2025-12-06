const fs = require('fs').promises;
const crypto = require('crypto');
const path = require('path');

class UserManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.usersFile = path.join(this.dataDir, 'users.json');
    this.users = new Map();
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const data = await fs.readFile(this.usersFile, 'utf8');
      const users = JSON.parse(data);
      this.users = new Map(users);
    } catch (e) {
      // File doesn't exist yet
      this.users = new Map();
      await this.save();
    }
  }

  hashPassword(password) {
    return crypto.createHash('md5').update(password).digest('hex');
  }

  async register(nick, password) {
    if (!nick || typeof nick !== 'string') {
      return { success: false, error: 'Invalid nick' };
    }
    if (!password || typeof password !== 'string') {
      return { success: false, error: 'Invalid password' };
    }

    const hashedPassword = this.hashPassword(password);

    if (this.users.has(nick)) {
      const existing = this.users.get(nick);
      if (existing.password === hashedPassword) {
        // Same password - allow (confirmation)
        return { success: true };
      } else {
        // Different password - error
        return { success: false, error: 'User registered with a different password' };
      }
    }

    // New user
    this.users.set(nick, { password: hashedPassword });
    await this.save();
    return { success: true };
  }

  async authenticate(nick, password) {
    if (!this.users.has(nick)) {
      return { success: false, error: 'User not registered' };
    }

    const hashedPassword = this.hashPassword(password);
    const user = this.users.get(nick);

    if (user.password === hashedPassword) {
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  }

  async save() {
    const data = Array.from(this.users.entries());
    await fs.writeFile(this.usersFile, JSON.stringify(data, null, 2));
  }
}

module.exports = UserManager;