/**
 * Application constants and configuration
 */

export const ROLL_NAMES = {
  1: 'Tâb',
  2: 'Itneyn', 
  3: 'Teláteh', 
  4: "Arba'ah", 
  6: 'Sitteh' 
};

export const TIMING = {
  flipAnimMs: 1100,
  cpuStartMs: 500,
  cpuThinkMs: 2500,
  cpuAfterPlayMs: 2500,
  cpuChainMs: 1200,
  humanToCpuMs: 1000,
  skipMsgDelayMs: 1000,
  pvpPromptDelayMs: 2200,
  gameOverCleanupMs: 2200
};

export const DIFFICULTY_LEVELS = {
  easy: 0,
  medium: 1,
  hard: 2
};

export const GAME_MODES = {
  PVC: 'pvc',  // Player vs Computer
  PVP: 'pvp'   // Player vs Player
};

export const PLAYER_NAMES = {
  PLAYER1: 'player1',
  PLAYER2: 'player2',
  CPU: 'cpu'
};