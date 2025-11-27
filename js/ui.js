export function hide(el) {
  if (!el) {
    console.warn('hide() called with null element');
    return;
  }
  el.classList.add('hidden', 'display-none');
}

export function show(el) {
  if (!el) {
    console.warn('show() called with null element');
    return;
  }
  el.classList.remove('hidden', 'display-none');
}

export function showIntro(intro, modeScreen, mainGrid, menuBtn, rollBtn) {
  if (intro) {
    show(intro);
    intro.removeAttribute('hidden');
  }
  if (modeScreen) {
    hide(modeScreen);
    modeScreen.setAttribute('hidden', '');
  }
  if (mainGrid) {
    hide(mainGrid);
    mainGrid.classList.remove('visible');
  }
  hide(menuBtn);
  hide(rollBtn);
}

export function showGame(intro, modeScreen, mainGrid, menuBtn, rollBtn) {
  if (intro) {
    hide(intro);
    intro.setAttribute('hidden', '');
  }
  if (modeScreen) {
    hide(modeScreen);
    modeScreen.setAttribute('hidden', '');
  }
  if (mainGrid) {
    show(mainGrid);
    mainGrid.classList.add('visible');
  }
  show(menuBtn);
  hide(rollBtn);
}

export function openSidePanel(sidePanel, menuBtn) {
  if (!sidePanel) {
    console.warn('Cannot open side panel - element not found');
    return;
  }
  if (!menuBtn) {
    console.warn('Cannot update menu button - element not found');
    return;
  }
  
  sidePanel.classList.add('open');
  menuBtn.innerHTML = '&times;';
  setTimeout(() => sidePanel.focus(), 100);
}

export function closeSidePanel(sidePanel, menuBtn) {
  if (!sidePanel) {
    console.warn('Cannot close side panel - element not found');
    return;
  }
  if (!menuBtn) {
    console.warn('Cannot update menu button - element not found');
    return;
  }
  
  sidePanel.classList.remove('open');
  menuBtn.innerHTML = '&#9776;';
}

export function setCloseBlocked(closePanelBtn, block) {
  if (!closePanelBtn) {
    console.warn('Cannot set close blocked - element not found');
    return;
  }
  closePanelBtn.disabled = !!block;
  closePanelBtn.setAttribute('aria-disabled', String(!!block));
}

export function closeScoreboardPanelIfOpen(scoreboardPanel, scoreboardBtn) {
  if (!scoreboardPanel) {
    console.warn('Cannot close scoreboard - element not found');
    return;
  }
  scoreboardPanel.classList.remove('open');
  if (scoreboardBtn) scoreboardBtn.innerHTML = '🏆';
}

export function hardShowScoreboard(scoreboardPanel) {
  if (!scoreboardPanel) {
    console.warn('Cannot show scoreboard - element not found');
    return;
  }
  scoreboardPanel.classList.remove('display-none');
  scoreboardPanel.removeAttribute('aria-hidden');
}

export function setMessage(msgEl, text) {
  if (!msgEl) {
    console.warn('Cannot set message - element not found');
    return;
  }
  msgEl.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'msg-box';
  box.textContent = text || '';
  msgEl.appendChild(box);
}

export function showModal(modalOverlay, modalTitle, modalText, modalConfirm, modalCancel, title, text, confirmText = 'Yes', cancelText = 'No') {
  if (!modalOverlay || !modalTitle || !modalText || !modalConfirm || !modalCancel) {
    console.warn('Cannot show modal - modal elements not found');
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalText.textContent = text;
    modalConfirm.textContent = confirmText;
    modalCancel.textContent = cancelText;
    modalOverlay.classList.remove('hidden', 'display-none');
    
    const close = (value) => {
      modalOverlay.classList.add('hidden', 'display-none');
      modalConfirm.onclick = null;
      modalCancel.onclick = null;
      resolve(value);
    };
    modalConfirm.onclick = () => close(true);
    modalCancel.onclick = () => close(false);
  });
}

export function updateFirstPlayerOptions(gameModeInput, firstPlayerInput) {
  if (!gameModeInput || !firstPlayerInput) {
    console.warn('Cannot update first player options - elements not found');
    return;
  }
  
  const selectedMode = gameModeInput.value;
  const currentFirstPlayer = firstPlayerInput.value;
  firstPlayerInput.innerHTML = '';

  let options = [];
  if (selectedMode === 'pvp') {
    options = [
      { value: 'player1', text: 'Player 1' },
      { value: 'player2', text: 'Player 2' }
    ];
  } else {
    options = [
      { value: 'player1', text: 'Player 1' },
      { value: 'cpu', text: 'Computer (Player 2)' }
    ];
  }
  
  options.forEach(opt => {
    const optionEl = document.createElement('option');
    optionEl.value = opt.value;
    optionEl.textContent = opt.text;
    firstPlayerInput.appendChild(optionEl);
  });
  
  if (currentFirstPlayer === 'player1') {
    firstPlayerInput.value = 'player1';
  } else if (selectedMode === 'pvp' && currentFirstPlayer === 'cpu') {
    firstPlayerInput.value = 'player2';
  } else if (selectedMode === 'pvc' && currentFirstPlayer === 'player2') {
    firstPlayerInput.value = 'cpu';
  }
}