class TabGame {
    constructor(columns = 9) {
        this.columns = columns;
        this.board = this.createBoard();
        this.currentPlayer = 'player';
        this.diceValue = null;
        this.state = 'waiting'; // waiting, playing, finished
        // ...other state variables...
    }
    createBoard() {
        // Create a 4xN board array
        const board = [];
        for (let i = 0; i < 4; i++) {
            board.push(new Array(this.columns).fill(null));
        }
        // Place pieces for both players
        for (let col = 0; col < this.columns; col++) {
            board[3][col] = { owner: 'player', state: 'not-moved', color: 'blue'};
            board[0][col] = { owner: 'cpu', state: 'not-moved', color: 'red'};
        }
        return board;
    }
    throwSticks() {
        // Simulate 4 sticks, each with 2 sides (0 or 1)
        const sticks = Array.from({ length: 4 }, () => Math.random() < 0.5 ? 0 : 1);
        const sum = sticks.reduce((a, b) => a + b, 0);
        let value;
        if (sum === 0) value = 6;
        else value = sum;
        this.diceValue = value;
        return { sticks, value };
    }
    // ...methods for game logic...
}

function renderBoard(game) {
    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = '';

    // Board container for flex layout
    const boardContainer = document.createElement('div');
    boardContainer.style.display = 'flex';
    boardContainer.style.flexDirection = 'column';
    boardContainer.style.alignItems = 'center';

    // Column labels
    const colLabels = document.createElement('div');
    colLabels.className = 'board-row';
    colLabels.style.fontWeight = 'bold';
    colLabels.style.marginBottom = '4px';
    colLabels.appendChild(document.createElement('div')); // Empty for row label
    for (let j = 0; j < game.columns; j++) {
        const label = document.createElement('div');
        label.className = 'board-cell';
        label.style.background = 'transparent';
        label.textContent = String.fromCharCode(65 + j); // A, B, C, ...
        colLabels.appendChild(label);
    }
    boardContainer.appendChild(colLabels);

    // Render each board row with row label
    for (let i = 0; i < 4; i++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';
        rowDiv.style.position = 'relative';

        // Row label
        const rowLabel = document.createElement('div');
        rowLabel.className = 'board-cell';
        rowLabel.style.background = 'transparent';
        rowLabel.style.fontWeight = 'bold';
        rowLabel.textContent = `L${i+1}`;
        rowDiv.appendChild(rowLabel);

        for (let j = 0; j < game.columns; j++) {
            const cellDiv = document.createElement('div');
            cellDiv.className = 'board-cell';
            cellDiv.dataset.row = i;
            cellDiv.dataset.col = j;
            const piece = game.board[i][j];
            if (piece) {
                const pieceDiv = document.createElement('div');
                pieceDiv.className = 'piece ' + piece.state;
                pieceDiv.style.background = piece.color;
                pieceDiv.title = `${piece.owner} (${piece.state})`;
                cellDiv.appendChild(pieceDiv);
            }
            rowDiv.appendChild(cellDiv);
        }
        boardContainer.appendChild(rowDiv);

        // Add separator after each row except last
        if (i < 3) {
            const sep = document.createElement('div');
            sep.style.width = `${(game.columns+1)*42}px`;
            sep.style.borderBottom = '2px solid #333';
            sep.style.margin = '2px 0 2px 0';
            boardContainer.appendChild(sep);
        }
    }

    boardDiv.appendChild(boardContainer);
}

function renderSticks(result) {
    const sticksDiv = document.getElementById('sticks-result');
    sticksDiv.innerHTML = '';
    if (!result) return;
    result.sticks.forEach(side => {
        const stick = document.createElement('span');
        stick.textContent = side ? '|' : 'O';
        stick.style.margin = '0 5px';
        stick.style.fontWeight = 'bold';
        stick.style.color = side ? '#aaa' : '#333';
        sticksDiv.appendChild(stick);
    });
    sticksDiv.innerHTML += ` &rarr; <b>${result.value}</b>`;
}

function showMessage(msg) {
    document.getElementById('messages').textContent = msg;
}


// Event listeners
document.getElementById('start-game').addEventListener('click', () => {
    const size = parseInt(document.getElementById('board-size').value, 10);
    window.tabGame = new TabGame(size);
    renderBoard(window.tabGame);
    showMessage('Game started! Player\'s turn.');
});
document.getElementById('throw-sticks').addEventListener('click', () => {
    if (!window.tabGame) return;
    const result = window.tabGame.throwSticks();
    renderSticks(result);
    showMessage(`You threw the sticks: move ${result.value} cells.`);
});
document.getElementById('show-instructions').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'block';
    document.getElementById('instructions-content').textContent = 'See README for rules.';
});
document.getElementById('close-instructions').addEventListener('click', () => {
    document.getElementById('instructions').style.display = 'none';
});
document.getElementById('quit-game').addEventListener('click', () => {
    window.tabGame = null;
    document.getElementById('board').innerHTML = '';
    document.getElementById('sticks-result').innerHTML = '';
    showMessage('Game quit.');
});

showMessage('Welcome to Tâb! Click Start to begin.');

window.tabGame = new TabGame(parseInt(document.getElementById('board-size').value, 10));
renderBoard(window.tabGame);

document.getElementById('board-size').addEventListener('change', function() {
    window.tabGame = new TabGame(parseInt(this.value, 10));
    renderBoard(window.tabGame);
    showMessage('Board size changed. Click Start to begin a new game.');
});

// Leaderboard tab switching
document.querySelectorAll('.leaderboard-tab').forEach(tab => {
    tab.addEventListener('click', function() {
        document.querySelectorAll('.leaderboard-tab').forEach(t => t.classList.remove('active'));
        this.classList.add('active');
        document.querySelectorAll('.leaderboard-panel').forEach(panel => panel.style.display = 'none');
        document.getElementById('leaderboard-' + this.dataset.tab).style.display = 'block';
    });
});

// Example function to calculate win/loss ratio (skeleton, static data)
function calculateWinLossRatio(wins, losses) {
    if (losses === 0) return wins > 0 ? wins.toFixed(2) : "0.00";
    return (wins / losses).toFixed(2);
}

// ----- SCOREBOARD PANEL -----
const scoreboardBtn = document.getElementById('scoreboard-btn');
const scoreboardPanel = document.getElementById('scoreboard-panel');
const closeScoreboard = document.getElementById('close-scoreboard');

// abre o painel (tal como o menu lateral)
scoreboardBtn.addEventListener('click', () => {
    const isOpen = scoreboardPanel.classList.toggle('open');
    if (isOpen) {
        scoreboardBtn.innerHTML = '&times;'; // muda o ícone para X
        setTimeout(() => scoreboardPanel.focus(), 10);
    } else {
        scoreboardBtn.innerHTML = '🏆'; // volta ao troféu
    }
});

// fecha ao clicar no X dentro do painel
closeScoreboard.addEventListener('click', () => {
    scoreboardPanel.classList.remove('open');
    scoreboardBtn.innerHTML = '🏆';
});

// Fecha ao clicar fora da caixa
scoreboardPanel.addEventListener('click', (e) => {
    if (e.target === scoreboardPanel) {
        scoreboardPanel.classList.remove('open');
        scoreboardBtn.innerHTML = '🏆';
    }
});

// --- Intro + Mode screen logic (fixed version) ---
document.addEventListener("DOMContentLoaded", () => {
    const intro = document.getElementById("intro-screen");
    const modeScreen = document.getElementById("mode-screen");
    const appGrid = document.getElementById("main-grid"); // your main game layout
    const introBtn = document.getElementById("intro-start");
    const modeButtons = document.querySelectorAll(".mode-btn");
    const modeBackBtn = document.getElementById("mode-back");

    // Ensure correct initial state
    showIntro();

    function showIntro() {
        intro.style.display = "grid";
        intro.classList.remove("hidden");

        modeScreen.hidden = true;
        modeScreen.style.display = "none";
        appGrid.style.display = "none";
    }

    function showModeScreen() {
      // Fade out intro
        intro.classList.add("hidden");
        intro.addEventListener(
            "transitionend",
            () => {
                intro.style.display = "none";
                // Show mode screen
                modeScreen.hidden = false;
                modeScreen.style.display = "grid";
            },
            { once: true }
        );
    }

    function showGame() {
      // Fade out mode screen
        modeScreen.classList.add("hidden");
        modeScreen.addEventListener(
            "transitionend",
            () => {
                modeScreen.style.display = "none";
                appGrid.style.display = "grid"; // reveal the main grid
            },
            { once: true }
        );
    }

    // Button handlers
    introBtn?.addEventListener("click", showModeScreen);

    modeButtons.forEach((btn) => {
        if (btn.id !== "mode-back") {
            btn.addEventListener("click", () => {
                showGame();
                if (typeof showMessage === "function") {
                    showMessage(`Mode selected: ${btn.textContent}`);
                }
            });
        }
    });

    // Back button
    modeBackBtn?.addEventListener("click", () => {
        modeScreen.style.display = "none";
        intro.style.display = "grid";
        intro.classList.remove("hidden");
    });
    });
  // --- End Intro + Mode screen logic ---



