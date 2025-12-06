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
    const container = document.getElementById("scoreboardContent");
    if (!container) return;

    container.innerHTML = "<p>Loading ranking...</p>";

    try {
      const list = await this.serverManager.request("ranking", {
        group: this.serverManager.GROUP_ID,
        size: boardSize
      });      

      this.renderOnlineRanking(list);

    } catch (err) {
      container.innerHTML = `<p class="error">Error loading ranking.</p>`;
      console.error("Ranking error:", err);
    }
  }

  renderOnlineRanking(list) {
    const container = document.getElementById("scoreboardContent");
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = "<p>No ranking data available.</p>";
      return;
    }

    container.innerHTML = `
      <table class="scoreboard-table">
        <tr><th>Nick</th><th>Games</th><th>Victories</th></tr>
        ${list.map(r => `
          <tr>
            <td>${r.nick}</td>
            <td>${r.games}</td>
            <td>${r.victories}</td>
          </tr>
        `).join("")}
      </table>
    `;
  }
}
