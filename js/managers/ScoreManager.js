export default class ScoreManager {

  constructor(uiManager, serverManager) {
    this.uiManager = uiManager;
    this.serverManager = serverManager;
    
    // Chave para guardar a pontuação local no browser
    this.STORAGE_KEY = 'tablut_local_scores';

    // Carregar dados locais (se existirem)
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

  // Função auxiliar para guardar no localStorage
  saveToStorage() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.scores));
  }

  // ============================================================
  // TABELA 1: SCOREBOARD LOCAL (Player 1 vs CPU)
  // ============================================================

  updateScore(winnerName, loserName) {
    let updated = false;

    // Verificar se o vencedor é Local (Player 1, Player 2 ou CPU)
    if (this.scores[winnerName]) {
      this.scores[winnerName].wins++;
      updated = true;
    }

    // Verificar se o perdedor é Local
    if (this.scores[loserName]) {
      this.scores[loserName].losses++;
      updated = true;
    }

    // IMPORTANTE: Se o jogo foi Online (ex: contra "Danny"), os nomes não 
    // existem no this.scores, por isso 'updated' será false e não fazemos nada.
    // Isto impede os erros e crashes.
    if (updated) {
      this.saveToStorage();
      this.updateScoreboardView();
    }
  }

  updateScoreboardView() {
    const elements = this.uiManager.getElements();
    const { scoreboardBody } = elements;

    if (!scoreboardBody) return;

    // Lógica de visualização: Esconder Online, Mostrar Local
    const container = document.getElementById('leaderboard-content');
    if (container) {
      const onlinePanel = container.querySelector('#leaderboard-online');
      if (onlinePanel) onlinePanel.hidden = true;
      
      const localPanel = container.querySelector('#leaderboard-local');
      if (localPanel) localPanel.hidden = false;
    }

    // Limpar e preencher a tabela LOCAL
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
        <td>${stat.name}</td> <td>${stat.wins}</td>
        <td>${stat.losses}</td>
        <td>${getRatio(stat.wins, stat.losses)}</td>
      `;
    });
  }


  // ============================================================
  // TABELA 2: SCOREBOARD ONLINE (Nicknames)
  // ============================================================

  async loadOnlineRanking(boardSize) {
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    // Preparar UI: Esconder local, preparar online
    const localPanel = container.querySelector('#leaderboard-local');
    if (localPanel) localPanel.hidden = true;

    let onlinePanel = container.querySelector('#leaderboard-online');
    if (!onlinePanel) {
      onlinePanel = document.createElement('div');
      onlinePanel.className = 'leaderboard-panel';
      onlinePanel.id = 'leaderboard-online';
      container.appendChild(onlinePanel);
    }
    
    onlinePanel.hidden = false;
    onlinePanel.innerHTML = "<p>Loading ranking...</p>";

    try {
      const resp = await this.serverManager.request("ranking", {
        group: this.serverManager.GROUP_ID,
        size: boardSize
      });

      // O servidor devolve uma lista de objetos com { nick, games, victories }
      const list = Array.isArray(resp) ? resp : (resp && resp.ranking) ? resp.ranking : [];
      this.renderOnlineRanking(list);

    } catch (err) {
      if (onlinePanel) {
        onlinePanel.innerHTML = `<p class="error">Error loading ranking: ${err.message || err}</p>`;
      }
      console.error("Ranking error:", err);
    }
  }

  renderOnlineRanking(list) {
    const container = document.getElementById("leaderboard-content");
    if (!container) return;

    // Garantir que estamos a mostrar o painel Online
    const localPanel = container.querySelector('#leaderboard-local');
    if (localPanel) localPanel.hidden = true;

    let onlinePanel = container.querySelector('#leaderboard-online');
    if (!onlinePanel) {
      onlinePanel = document.createElement('div');
      onlinePanel.className = 'leaderboard-panel';
      onlinePanel.id = 'leaderboard-online';
      container.appendChild(onlinePanel);
    }
    onlinePanel.hidden = false;

    if (!list || list.length === 0) {
      onlinePanel.innerHTML = "<p>No ranking data available.</p>";
      return;
    }

    // Criar a tabela ONLINE (com coluna Nick)
    onlinePanel.innerHTML = `
      <table class="scoreboard-table">
        <thead>
            <tr>
                <th>Nick</th>    <th>Games</th>
                <th>Victories</th>
            </tr>
        </thead>
        <tbody>
        ${list.map(r => `
          <tr>
            <td>${r.nick}</td> <td>${r.games}</td>
            <td>${r.victories}</td>
          </tr>
        `).join("")}
        </tbody>
      </table>
    `;
  }
}