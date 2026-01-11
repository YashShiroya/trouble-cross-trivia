
export enum GameStatus {
  IDLE = 'IDLE',
  SETUP = 'SETUP',
  LOBBY = 'LOBBY',
  IN_PROGRESS = 'IN_PROGRESS',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
}

export enum DisplayMode {
  HOST_OS = 'HOST_OS',
  MOBILE = 'MOBILE',
  LIVE = 'LIVE',
  QUICK = 'QUICK'
}

export enum DefectorStatus {
  PENDING = 'PENDING',
  HELD = 'HELD',
  USED = 'USED',
  EXPIRED = 'EXPIRED'
}

export enum StandoffChoice {
  LOYAL = 'LOYAL',
  DEFECT = 'DEFECT'
}

export enum QuestionStatus {
  AWAITING = 'AWAITING',
  ANSWERED = 'ANSWERED',
  STEAL = 'STEAL',
  RESOLVED = 'RESOLVED'
}

export interface Player {
  peerId: string;
  name: string;
  team: 'A' | 'B';
}

export interface Team {
  id: 'A' | 'B';
  name: string;
  score: number;
  doubleUsed: boolean;
}

export interface Question {
  text: string;
  answer: string;
  difficulty: string;
}

export interface Notification {
  message: string;
  type: 'REPORT' | 'NEWS' | 'ALERT';
  timestamp: number;
}

export interface GameState {
  status: GameStatus;
  displayMode: DisplayMode;
  currentRound: number;
  currentQuestionIndex: number;
  questions: Question[];
  teamA: Team;
  teamB: Team;
  innerMind: string;
  defectionWindowOpen: boolean;

  // Defection Logic
  defectorPeerIdA: string | null;
  defectorPeerIdB: string | null;
  revealedDefectors: string[]; // Peer IDs who know they are defectors
  notification: Notification | null;

  // Token reveal timing (random)
  tokenARevealRound: number; // 1, 2, or 3
  tokenBRevealRound: number; // 2, 3, or 4 (must be >= tokenARevealRound)
  tokenAUsed: boolean;
  tokenBUsed: boolean;

  standoff: {
    triggered: boolean;
    choiceA: StandoffChoice | null;
    choiceB: StandoffChoice | null;
    result: string | null;
  };
  currentTurn: {
    answeringTeam: 'A' | 'B';
    status: QuestionStatus;
    lastAnswer: string;
    isDouble: boolean;
  };

  // Networking
  isHost: boolean;
  roomCode: string | null;
  peerConnected: boolean;
  connectedPeersCount: number;
  players: Player[];
}

export type GameAction =
  | { type: 'SYNC_STATE', state: GameState }
  | { type: 'REGISTER_PLAYER', team: 'A' | 'B', name: string, peerId: string }
  | { type: 'JUDGE_ANSWER', isCorrect: boolean }
  | { type: 'TOGGLE_DOUBLE' }
  | { type: 'LOCK_IN' }
  | { type: 'PASS' }
  | { type: 'NEXT_QUESTION' }
  | { type: 'START_GAME' }
  | { type: 'DEFECT', peerId: string }
  | { type: 'STANDOFF_CHOICE', team: 'A' | 'B', choice: StandoffChoice }
  | { type: 'RESOLVE_STANDOFF' }
  | { type: 'DISMISS_NOTIFICATION' };
