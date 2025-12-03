/**
 * Manages scoring, leaderboard, and statistics
 */
export default class ScoreManager {
  constructor(uiManager) {
    this.uiManager = uiManager;
    this.scores = {
      player1: { wins: 0, losses: 0, name: 'Player 1' },
      player2: { wins: 0, losses: 0, name: 'Player 2' },
      cpu: { wins: 0, losses: 0, name: 'Computer' }
    };
  }

  /**
   * Update score for a game result
   */
  updateScore(winnerName, loserName) {
    if (this.scores[winnerName]) this.scores[winnerName].wins++;
    if (this.scores[loserName]) this.scores[loserName].losses++;
    this.updateScoreboardView();
  }

  /**
   * Rebuild the scoreboard table and "no scores" message based on tracked stats.
   */
  updateScoreboardView() {
    const elements = this.uiManager.getElements();
    const { scoreboardBody, noScoresMsg } = elements;
    
    if (!scoreboardBody || !noScoresMsg) return;
    
    scoreboardBody.innerHTML = '';
    const totalGames = this.scores.player1.wins + this.scores.player1.losses + 
                      this.scores.player2.wins + this.scores.player2.losses + 
                      this.scores.cpu.wins + this.scores.cpu.losses;
    
    if (totalGames === 0) {
      noScoresMsg.classList.remove('display-none');
      return;
    }
    
    noScoresMsg.classList.add('display-none');
    const stats = [
      { name: 'Player 1', ...this.scores.player1 },
      { name: 'Player 2', ...this.scores.player2 },
      { name: 'Computer', ...this.scores.cpu }
    ];
    
    stats.sort((a, b) => b.wins - a.wins);
    
    const getRatio = (wins, losses) => {
      if (losses === 0) return wins > 0 ? String(wins.toFixed(2)) : '0.00';
      return (wins / losses).toFixed(2);
    };
    
    stats.forEach((stat, index) => {
      const row = scoreboardBody.insertRow();
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${stat.name}</td>
        <td>${stat.wins}</td>
        <td>${stat.losses}</td>
        <td>${getRatio(stat.wins, stat.losses)}</td>
      `;
    });
  }

  /**
   * Get current scores
   */
  getScores() {
    return this.scores;
  }
}