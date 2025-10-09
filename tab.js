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
            board[3][col] = { owner: 'player', state: 'not-moved', color: col % 2 === 0 ? 'blue' : 'green' };
            board[0][col] = { owner: 'cpu', state: 'not-moved', color: col % 2 === 0 ? 'red' : 'orange' };
        }
        return board;
    }
    throwSticks() {
        // Simulate 4 sticks, each with 2 sides (0 or 1)
        const sticks = Array.from({ length: 4 }, () => Math.random() < 0.5 ? 0 : 1);
        const sum = sticks.reduce((a, b) => a + b, 0);
        let value;
        if (sum === 0) value = 6;
        else if (sum === 1) value = 1;
        else if (sum === 2) value = 2;
        else if (sum === 3) value = 3;
        else value = 4;
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
document.getElementById('start-game').onclick = () => {
    const size = parseInt(document.getElementById('board-size').value, 10);
    window.tabGame = new TabGame(size);
    renderBoard(window.tabGame);
    showMessage('Game started! Player\'s turn.');
};
document.getElementById('throw-sticks').onclick = () => {
    if (!window.tabGame) return;
    const result = window.tabGame.throwSticks();
    renderSticks(result);
    showMessage(`You threw the sticks: move ${result.value} cells.`);
};
document.getElementById('show-instructions').onclick = () => {
    document.getElementById('instructions').style.display = 'block';
    document.getElementById('instructions-content').textContent = 'See README for rules.';
};
document.getElementById('close-instructions').onclick = () => {
    document.getElementById('instructions').style.display = 'none';
};
document.getElementById('show-scoreboard').onclick = () => {
    document.getElementById('scoreboard').style.display = 'block';
    document.getElementById('scoreboard-content').textContent = 'Scoreboard coming soon.';
};
document.getElementById('close-scoreboard').onclick = () => {
    document.getElementById('scoreboard').style.display = 'none';
};
document.getElementById('quit-game').onclick = () => {
    window.tabGame = null;
    document.getElementById('board').innerHTML = '';
    document.getElementById('sticks-result').innerHTML = '';
    showMessage('Game quit.');
};

// Initial render
showMessage('Welcome to Tâb! Click Start to begin.');