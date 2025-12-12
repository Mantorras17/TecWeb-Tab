export default class ScoreManager {

  constructor(uiManager, serverManager) {
    this.uiManager = uiManager;
    this.serverManager = serverManager;

    this.scores = {
      player1: { wins: 0, losses: 0, name: 'Player 1' },
      player2: { wins: 0, losses: 0, name: 'Player 2' },
      cpu:      { wins: 0, losses: 0, name: 'Computer' }
    };
  }

  // ------------------------------------------------------------
  // OFFLINE SCOREBOARD
  // ------------------------------------------------------------

  updateScore(winnerName, loserName) {
    if (this.scores[winnerName]) this.scores[winnerName].wins++;
    if (this.scores[loserName]) this.scores[loserName].losses++;
    this.updateScoreboardView();
  }

  updateScoreboardView() {
    const elements = this.uiManager.getElements();
    const { scoreboardBody} = elements;

    if (!scoreboardBody) return;

    // Ensure local leaderboard panel is visible and remove any online panel
    const container = document.getElementById('leaderboard-content');
    if (container) {
      const onlinePanel = container.querySelector('#leaderboard-online');
      if (onlinePanel) onlinePanel.remove();
      const localPanel = container.querySelector('#leaderboard-local');
      if (localPanel) localPanel.style.display = '';
    }

    scoreboardBody.innerHTML = '';

    // Mostrar sempre as 3 linhas base
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
    // Use the existing leaderboard container in the DOM
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    container.innerHTML = "<p>Loading ranking...</p>";

    try {
      const resp = await this.serverManager.request("ranking", {
        group: this.serverManager.GROUP_ID,
        size: boardSize
      });

      const list = Array.isArray(resp) ? resp : (resp && resp.ranking) ? resp.ranking : [];
      this.renderOnlineRanking(list);

    } catch (err) {
      // Show error but ensure offline tab can still be accessed
      container.innerHTML = `<p class="error">Error loading ranking: ${err.message || err}</p>`;
      console.error("Ranking error:", err);
    }
  }

  renderOnlineRanking(list) {
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    // Hide the local panel and show/create the online panel
    const localPanel = container.querySelector('#leaderboard-local');
    if (localPanel) localPanel.style.display = 'none';

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
