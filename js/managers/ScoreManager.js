export default class ScoreManager {

  constructor(uiManager, serverManager) {
    this.uiManager = uiManager;
    this.serverManager = serverManager;
    
    // Key used to save data in the browser
    this.STORAGE_KEY = 'tablut_local_scores';

    // Try to load saved scores, otherwise use defaults
    const savedData = localStorage.getItem(this.STORAGE_KEY);

    if (savedData) {
      this.scores = JSON.parse(savedData);
    } else {
      this.scores = {
        player1: { wins: 0, losses: 0, name: 'Player 1' },
        player2: { wins: 0, losses: 0, name: 'Player 2' },
        cpu:      { wins: 0, losses: 0, name: 'Computer' }
      };
    }
  }

  // Helper to save current scores to browser memory
  saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.scores));
  }

  // ------------------------------------------------------------
  // OFFLINE SCOREBOARD
  // ------------------------------------------------------------

  updateScore(winnerName, loserName) {
    if (this.scores[winnerName]) this.scores[winnerName].wins++;
    if (this.scores[loserName]) this.scores[loserName].losses++;
    
    // Save to storage immediately after updating
    this.saveToStorage();
    
    this.updateScoreboardView();
  }

  updateScoreboardView() {
    const elements = this.uiManager.getElements();
    const { scoreboardBody } = elements;

    if (!scoreboardBody) return;

    const container = document.getElementById('leaderboard-content');
    if (container) {
      const onlinePanel = container.querySelector('#leaderboard-online');
      if (onlinePanel) onlinePanel.remove(); // Remove online view if present
      
      const localPanel = container.querySelector('#leaderboard-local');
      if (localPanel) localPanel.hidden = false; // Show local panel
    }

    scoreboardBody.innerHTML = '';

    const stats = [
      { name: 'Player 1', ...this.scores.player1 },
      { name: 'Player 2', ...this.scores.player2 },
      { name: 'Computer', ...this.scores.cpu }
    ];

    const getRatio = (wins, losses) => {
      if (losses === 0) return wins > 0 ? wins.toFixed(2) : "0.00";
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


  // ------------------------------------------------------------
  // ONLINE SCOREBOARD
  // ------------------------------------------------------------

  async loadOnlineRanking(boardSize) {
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    try {
      const resp = await this.serverManager.ranking(this.serverManager.GROUP_ID, boardSize);

      const list = Array.isArray(resp) ? resp : (resp && resp.ranking) ? resp.ranking : [];
      this.renderOnlineRanking(list);

    } catch (err) {
      container.innerHTML = `<p class="error">Error loading ranking: ${err.message || err}</p>`;
      console.error("Ranking error:", err);
    }
  }

  renderOnlineRanking(list) {
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    // Toggle visibility using hidden attribute
    const localPanel = container.querySelector('#leaderboard-local');
    if (localPanel) localPanel.hidden = true;

    let onlinePanel = container.querySelector('#leaderboard-online');
    if (!onlinePanel) {
      onlinePanel = document.createElement('div');
      onlinePanel.className = 'leaderboard-panel';
      onlinePanel.id = 'leaderboard-online';
      container.appendChild(onlinePanel);
    }

    if (!list || list.length === 0) {
      onlinePanel.innerHTML = "<p>No ranking data available.</p>";
      return;
    }

    // Clean table HTML
    onlinePanel.innerHTML = `
      <table class="scoreboard-table">
        <thead><tr><th>Nick</th><th>Games</th><th>Victories</th></tr></thead>
        <tbody>
        ${list.map(r => `
          <tr>
            <td>${r.nick}</td>
            <td>${r.games}</td>
            <td>${r.victories}</td>
          </tr>
        `).join("")}
        </tbody>
      </table>
    `;
  }
}