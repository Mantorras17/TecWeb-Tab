import { TIMING, ROLL_NAMES } from '../constants/Constants.js';


/**
 * Handles CPU behavior, timing, and AI moves
 */
export default class CPUController {
  constructor(uiManager, sticksRenderer) {
    this.uiManager = uiManager;
    this.sticksRenderer = sticksRenderer;
    this.busy = false;
    this.timer = null;
    this.messageTimer = null;
  }

  /**
   * Drive the CPU turn: roll, decide, possibly skip, move, and chain extra turns.
   * Honors timing constants to simulate thinking/animation delays.
   */
  maybeCpuTurn(game, isExtraTurn = false) {
    if (!game || game.over) return;
    const cur = game.getCurrentPlayer();
    if (cur.name !== 'cpu' || game.isVsPlayer) return;

    this.busy = true;
    this.sticksRenderer.queueAfterFlip(() => this.uiManager.updateRollBtn(false));

    this.sticksRenderer.renderSticks(null, { force: true, animate: false });

    const run = () => {
      this.timer = null;
      if (!game || game.over || game.getCurrentPlayer().name !== 'cpu' || game.isVsPlayer) {
        this.busy = false;
        return;
      }

      const val = game.startTurn();
      this.sticksRenderer.queueAfterFlip(() => this.uiManager.updateRollBtn(false));
      this.sticksRenderer.renderSticks({ value: val, sticks: game.lastSticks }, { animate: true });

      this.sticksRenderer.queueAfterFlip(() => {
        this.uiManager.buildBoard(game);
        this.uiManager.updateBoardHighlights(game);
        this.announceRoll(game.getCurrentPlayer()?.name ?? 'CPU', val);
      });

      this.sticksRenderer.queueAfterFlip(() => {
        setTimeout(() => {
          const skipped = game.autoSkipIfNoMoves();

          if (skipped) {
            const nextPlayer = game.getCurrentPlayer();
            const skipMessage =
              (nextPlayer === cur)
                ? "No possible moves. Throwing sticks again."
                : "No possible moves. Turn passed.";

            this.sticksRenderer.msgAfterFlip(skipMessage, 0);

            setTimeout(() => {
              this.uiManager.buildBoard(game);
              this.uiManager.updateBoardHighlights(game);
              this.sticksRenderer.sticksToGrey(0);

              if (nextPlayer.name === 'cpu') {
                setTimeout(() => this.maybeCpuTurn(game, true), TIMING.cpuChainMs);
              } else {
                setTimeout(() => {
                  this.sticksRenderer.msgAfterFlip("Your turn, player 1!");
                  this.sticksRenderer.queueAfterFlip(() => this.uiManager.updateRollBtn(true));
                  this.busy = false;
                }, TIMING.skipMsgDelayMs);
              }
            }, TIMING.skipMsgDelayMs);
            return;
          }

          game.cpuMove();
          this.uiManager.buildBoard(game);
          this.uiManager.updateBoardHighlights(game);
          this.sticksRenderer.sticksToGrey(0);
          this.sticksRenderer.msgAfterFlip('Player 2 played.');

          setTimeout(() => {
            if (game.getCurrentPlayer().name === 'cpu') {
              this.sticksRenderer.msgAfterFlip('Player 2 plays again.');
              setTimeout(() => this.maybeCpuTurn(game), TIMING.cpuChainMs);
            } else {
              this.sticksRenderer.msgAfterFlip('Your turn, player 1!');
              this.sticksRenderer.queueAfterFlip(() => this.uiManager.updateRollBtn(true));
              this.busy = false;
            }
          }, TIMING.cpuAfterPlayMs);
        }, TIMING.cpuThinkMs);
      });
    };

    setTimeout(run, TIMING.cpuStartMs);
  }

  /**
   * Announce a roll result using localized names and current player's label.
   */
  announceRoll(playerName, value) {
    const name = ROLL_NAMES[value] ?? String(value);
    const who =
      playerName === 'player1' ? 'Player 1' :
      playerName === 'player2' ? 'Player 2' :
      playerName === 'cpu' ? 'Player 2' : 'Player';
    this.uiManager.setMessage(`${who} rolled a ${name} (${value})!`);
  }

  /**
   * Check if CPU is currently busy
   */
  isBusy() {
    return this.busy;
  }

  /**
   * Clear timers
   */
  clearTimers() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.busy = false;
  }

  /**
   * Set message timer for delayed CPU turn
   */
  setMessageTimer(callback, delay) {
    this.messageTimer = setTimeout(callback, delay);
  }
}