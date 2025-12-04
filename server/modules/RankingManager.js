const fs = require('fs').promises;
const path = require('path');

class RankingManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.rankingsFile = path.join(this.dataDir, 'rankings.json');
    this.rankings = new Map(); // "group-size" -> array of {nick, games, victories}
    this.init();
  }

  async init() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const data = await fs.readFile(this.rankingsFile, 'utf8');
      const rankingsArray = JSON.parse(data);
      this.rankings = new Map(rankingsArray);
    } catch (e) {
      this.rankings = new Map();
      await this.save();
    }
  }

  async getRanking(group, size) {
    const key = `${group}-${size}`;
    const ranking = this.rankings.get(key) || [];
    
    // Sort by victories descending, then by games ascending
    return ranking
      .sort((a, b) => {
        if (b.victories !== a.victories) {
          return b.victories - a.victories;
        }
        return a.games - b.games;
      })
      .slice(0, 10); // Maximum 10 entries
  }

  async updatePlayerStats(group, size, winner, loser) {
    const key = `${group}-${size}`;
    let ranking = this.rankings.get(key) || [];

    // Update winner
    let winnerEntry = ranking.find(p => p.nick === winner);
    if (!winnerEntry) {
      winnerEntry = { nick: winner, games: 0, victories: 0 };
      ranking.push(winnerEntry);
    }
    winnerEntry.games++;
    winnerEntry.victories++;

    // Update loser
    let loserEntry = ranking.find(p => p.nick === loser);
    if (!loserEntry) {
      loserEntry = { nick: loser, games: 0, victories: 0 };
      ranking.push(loserEntry);
    }
    loserEntry.games++;

    this.rankings.set(key, ranking);
    await this.save();
  }

  async save() {
    try {
      const rankingsArray = Array.from(this.rankings.entries());
      await fs.writeFile(this.rankingsFile, JSON.stringify(rankingsArray, null, 2));
    } catch (e) {
      console.error('Error saving rankings:', e);
    }
  }
}

module.exports = RankingManager;