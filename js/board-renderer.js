/**
 * Board rendering module: builds and updates the visual board
 */

export function buildBoard(boardEl, game) {
  if (!boardEl) {
    console.warn('Cannot build board - element not found');
    return;
  }
  if (!game) {
    console.warn('Cannot build board - game not initialized');
    return;
  }
  
  boardEl.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'board-box';
  const container = document.createElement('div');
  container.className = 'board-container';

  const mePlayer = game.getCurrentPlayer();
  const oppPlayer = game.getOpponentPlayer();
  const meSkin = (mePlayer.name === 'player1') ? 'p1' : 'p2';
  const oppSkin = (oppPlayer.name === 'player1') ? 'p1' : 'p2';

  for (let r = 0; r < game.rows; r++) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'board-row';
    for (let c = 0; c < game.columns; c++) {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'board-cell';
      cell.dataset.row = String(r);
      cell.dataset.col = String(c);

      const flowClass = (r === 0 || r === 2) ? 'flow-left' : 'flow-right';
      cell.classList.add('flow', flowClass);

      if (r === 0 && c === 0) cell.classList.add('flow-diag-135');
      if (r === 1 && c === game.columns - 1) cell.classList.add('flow-diag-right-both');
      if (r === 2 && c === 0) cell.classList.add('flow-diag-225');
      if (r === 3 && c === game.columns - 1) cell.classList.add('flow-diag-315');

      const me = mePlayer.getPieceAt(r, c);
      const opp = oppPlayer.getPieceAt(r, c);

      if (me || opp) {
        const piece = document.createElement('div');
        piece.className = 'piece ' + (me ? meSkin : oppSkin) + ' ' + (me || opp).state;
        piece.title = `${me ? mePlayer.name : oppPlayer.name} (${(me || opp).state})`;
        cell.appendChild(piece);
      }
      rowDiv.appendChild(cell);
    }
    container.appendChild(rowDiv);
    if (r < game.rows - 1) {
      const sep = document.createElement('div');
      sep.className = 'row-sep';
      container.appendChild(sep);
    }
  }
  box.appendChild(container);
  boardEl.appendChild(box);
}

export function updateBoardHighlights(boardEl, game) {
  if (!boardEl) {
    console.warn('Cannot update highlights - board element not found');
    return;
  }
  if (!game) {
    console.warn('Cannot update highlights - game not initialized');
    return;
  }

  boardEl.querySelectorAll('.board-cell').forEach(cell => {
    cell.classList.remove('selected', 'highlight', 'mine', 'opp');
  });
  
  boardEl.querySelectorAll('.piece.selected').forEach(piece => {
    piece.classList.remove('selected');
  });
  
  for (let r = 0; r < game.rows; r++) {
    for (let c = 0; c < game.columns; c++) {
      const cell = boardEl.querySelector(`.board-cell[data-row="${r}"][data-col="${c}"]`);
      if (!cell) continue;
      
      const me = game.getCurrentPlayer().getPieceAt(r, c);
      const opp = game.getOpponentPlayer().getPieceAt(r, c);
      
      if (me) cell.classList.add('mine');
      if (opp) cell.classList.add('opp');
      
      if (game.selectedPiece && game.selectedPiece.row === r && game.selectedPiece.col === c) {
        const pieceEl = cell.querySelector('.piece');
        if (pieceEl) pieceEl.classList.add('selected');
      }
      
      if (game.getSelectedMoves().some(p => p.row === r && p.col === c)) {
        cell.classList.add('highlight');
      }
    }
  }
}

export function updateBoardRotation(boardEl, game) {
  if (!game || !boardEl) {
    console.warn('Cannot rotate board - elements not found');
    return;
  }

  const boardBox = boardEl.querySelector('.board-box');
  if (!boardBox) return;

  if (game.isVsPlayer && game.curPlayerIdx === 1) {
    boardBox.classList.add('rotated');
  } else {
    boardBox.classList.remove('rotated');
  }
}