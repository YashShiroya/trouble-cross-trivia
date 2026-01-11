
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { 
  GameState, GameStatus, DisplayMode, Team, Player, Question, 
  QuestionStatus, DefectorStatus, StandoffChoice, GameAction, Notification 
} from './types';
import { generateQuestions, getInnerMindCommentary } from './services/geminiService';
import TerminalFrame from './components/TerminalFrame';
import SetupScreen from './components/SetupScreen';
import { Trophy, Sword, AlertTriangle, MessageSquare, Radio, X, Users, UserCheck, Link as LinkIcon, Loader2, Check, Globe, Activity, Eye, Zap, Newspaper, User, ChevronRight } from 'lucide-react';

const PEER_PREFIX = "TRBLX-V218-";

const getInitialRoomCode = () => {
  const params = new URLSearchParams(window.location.search);
  return params.get('room')?.toUpperCase() || null;
};

const INITIAL_STATE: GameState = {
  status: getInitialRoomCode() ? GameStatus.SETUP : GameStatus.IDLE,
  displayMode: DisplayMode.HOST_OS,
  currentRound: 1,
  currentQuestionIndex: 0,
  questions: [],
  teamA: { id: 'A', name: 'TEAM A', score: 0, doubleUsed: false },
  teamB: { id: 'B', name: 'TEAM B', score: 0, doubleUsed: false },
  innerMind: 'System idle. Waiting for initialization sequence...',
  defectionWindowOpen: true,
  defectorPeerIdA: null,
  defectorPeerIdB: null,
  revealedDefectors: [],
  notification: null,
  tokenARevealRound: 0, // Will be randomized on game start
  tokenBRevealRound: 0, // Will be randomized on game start
  tokenAUsed: false,
  tokenBUsed: false,
  players: [],
  standoff: { triggered: false, choiceA: null, choiceB: null, result: null },
  currentTurn: { answeringTeam: 'A', status: QuestionStatus.AWAITING, lastAnswer: '', isDouble: false },
  isHost: !getInitialRoomCode(),
  roomCode: getInitialRoomCode(),
  peerConnected: false,
  connectedPeersCount: 0
};

const App: React.FC = () => {
  const [game, setGame] = useState<GameState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [clientIdentity, setClientIdentity] = useState<'NONE' | 'A' | 'B' | 'ASSISTANT'>('NONE');
  const [myStoredName, setMyStoredName] = useState<string>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const connectTimeoutRef = useRef<number | null>(null);

  const myPeerId = peerRef.current?.id;
  const myPlayerData = game.players.find(p => p.peerId === myPeerId);
  // Reactive team identity: uses stored preference if not registered, then synced state
  const myCurrentTeam = myPlayerData?.team || (clientIdentity === 'ASSISTANT' ? 'ASSISTANT' : clientIdentity);

  const broadcastState = useCallback((state: GameState) => {
    if (state.isHost) {
      connectionsRef.current.forEach(conn => {
        if (conn.open) {
          conn.send({ type: 'SYNC_STATE', state });
        }
      });
    }
  }, []);

  const updateGame = useCallback((updater: (prev: GameState) => GameState) => {
    setGame(prev => {
      const next = updater(prev);
      return next;
    });
  }, []);

  useEffect(() => {
    if (game.isHost && game.status !== GameStatus.IDLE && game.peerConnected) {
      broadcastState(game);
    }
  }, [game, broadcastState]);

  const updateInnerMind = async (situation: string) => {
    if (!game.isHost) return;
    const commentary = await getInnerMindCommentary(situation);
    updateGame(prev => ({ ...prev, innerMind: commentary }));
  };

  const startPeer = (code: string, isHost: boolean) => {
    setLoadingStatus('Initializing Peer Cluster...');
    setLoading(true);
    const peerId = `${PEER_PREFIX}${code}`;
    
    if (peerRef.current) peerRef.current.destroy();
    const peer = new Peer(peerId);
    peerRef.current = peer;

    peer.on('open', () => {
      setLoading(false);
      setGame(prev => ({ ...prev, isHost, roomCode: code, peerConnected: true }));
    });

    peer.on('error', (err) => {
      setLoading(false);
      if (err.type === 'unavailable-id' && isHost) {
        const newCode = Math.random().toString(36).substring(2, 6).toUpperCase();
        startPeer(newCode, true);
      } else {
        setConnectionError(`Link Fault: ${err.type}`);
      }
    });

    if (isHost) {
      peer.on('connection', (conn) => {
        connectionsRef.current.push(conn);
        updateGame(prev => ({ ...prev, connectedPeersCount: connectionsRef.current.length }));
        conn.on('data', (data: any) => handleIncomingAction(data as GameAction, conn.peer));
        conn.on('open', () => conn.send({ type: 'SYNC_STATE', state: game }));
        conn.on('close', () => {
          connectionsRef.current = connectionsRef.current.filter(c => c !== conn);
          updateGame(prev => ({ 
            ...prev, 
            connectedPeersCount: connectionsRef.current.length,
            players: prev.players.filter(p => p.peerId !== conn.peer)
          }));
        });
      });
    }
  };

  const handleIncomingAction = (action: GameAction, senderPeerId?: string) => {
    if (action.type === 'SYNC_STATE') {
      setGame({ ...action.state, isHost: false });
      setLoading(false);
      return;
    }

    // Client-allowed actions (these can be sent by clients to host)
    const clientAllowedActions = ['REGISTER_PLAYER', 'TOGGLE_DOUBLE', 'LOCK_IN', 'PASS', 'DEFECT', 'STANDOFF_CHOICE'];

    // Block all non-host actions unless they're in the allowed list
    if (!game.isHost) {
      if (!clientAllowedActions.includes(action.type)) {
        console.warn(`Client attempted unauthorized action: ${action.type}`);
        return;
      }
    }

    // Only process if host (or if client and action is allowed)
    if (!game.isHost && !clientAllowedActions.includes(action.type)) return;

    switch (action.type) {
      case 'REGISTER_PLAYER':
        if (!game.isHost) return; // Host must process
        updateGame(p => {
          // Check if team already has 6 players
          const teamCount = p.players.filter((pl: Player) => pl.team === action.team).length;
          const existingPlayer = p.players.find((pl: Player) => pl.peerId === action.peerId);

          // Allow if: player already exists (re-registering) OR team has less than 6 players
          if (existingPlayer || teamCount < 6) {
            return {
              ...p,
              players: [...p.players.filter((pl: Player) => pl.peerId !== action.peerId), { peerId: action.peerId, team: action.team, name: action.name }]
            };
          }
          // Team is full, don't add player
          return p;
        });
        break;
      case 'JUDGE_ANSWER':
        if (!game.isHost) return; // Host only
        judgeAnswer(action.isCorrect);
        break;
      case 'TOGGLE_DOUBLE':
        if (!game.isHost) return; // Host must process
        toggleDouble();
        break;
      case 'LOCK_IN':
        if (!game.isHost) return; // Host must process
        lockIn();
        break;
      case 'PASS':
        if (!game.isHost) return; // Host must process
        handlePass();
        break;
      case 'NEXT_QUESTION':
        if (!game.isHost) return; // Host only
        handleNext();
        break;
      case 'START_GAME':
        if (!game.isHost) return; // Host only
        startGame();
        break;
      case 'DEFECT':
        if (!game.isHost) return; // Host must process
        handleDefection(action.peerId);
        break;
      case 'STANDOFF_CHOICE':
        if (!game.isHost) return; // Host must process
        selectStandoff(action.team, action.choice, senderPeerId);
        break;
      case 'RESOLVE_STANDOFF':
        if (!game.isHost) return; // Host only
        resolveStandoff();
        break;
      case 'DISMISS_NOTIFICATION':
        if (!game.isHost) return; // Host only
        updateGame((p: GameState) => ({ ...p, notification: null }));
        break;
    }
  };

  const sendAction = (action: GameAction) => {
    if (game.isHost) handleIncomingAction(action, 'HOST');
    else {
      const conn = connectionsRef.current[0];
      if (conn?.open) conn.send(action);
      else setConnectionError("Uplink severed. Host unavailable.");
    }
  };

  const initGame = async (teamAName: string, teamBName: string, difficulty: string) => {
    setLoading(true);
    setLoadingStatus('Generating Kernel Question Bank...');
    try {
      const questions = await generateQuestions(difficulty);
      const roomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newState: GameState = {
        ...INITIAL_STATE,
        status: GameStatus.LOBBY,
        questions,
        teamA: { ...INITIAL_STATE.teamA, name: teamAName },
        teamB: { ...INITIAL_STATE.teamB, name: teamBName },
        isHost: true,
        roomCode
      };
      setGame(newState);
      startPeer(roomCode, true);
    } catch (e) {
      setLoading(false);
      alert("Kernel Generation Failed. Verify API Key availability.");
    }
  };

  const joinGame = (code: string, name: string) => {
    setMyStoredName(name);
    setLoading(true);
    setLoadingStatus(`Synchronizing with Node ${code.toUpperCase()}...`);
    const peer = new Peer(); 
    peerRef.current = peer;
    peer.on('open', (id) => {
      const conn = peer.connect(`${PEER_PREFIX}${code.toUpperCase()}`, { reliable: true });
      connectionsRef.current = [conn];
      connectTimeoutRef.current = window.setTimeout(() => {
        if (!game.peerConnected) {
          setLoading(false);
          setConnectionError(`Sync Timeout. Bridge to ${code.toUpperCase()} failed.`);
          peer.destroy();
        }
      }, 15000);
      
      conn.on('open', () => {
        if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
        setGame(prev => ({ 
          ...prev, 
          isHost: false, 
          status: GameStatus.SETUP, 
          roomCode: code.toUpperCase(), 
          peerConnected: true 
        }));
      });
      
      conn.on('data', (data: any) => handleIncomingAction(data as GameAction));
      conn.on('close', () => setGame(prev => ({ ...prev, peerConnected: false, status: GameStatus.IDLE })));
    });
  };

  const startGame = () => {
    if (!game.isHost) return;

    const teamAPlayers = game.players.filter(p => p.team === 'A');
    const teamBPlayers = game.players.filter(p => p.team === 'B');

    const defA = teamAPlayers.length > 0 ? teamAPlayers[Math.floor(Math.random() * teamAPlayers.length)].peerId : null;
    const defB = teamBPlayers.length > 0 ? teamBPlayers[Math.floor(Math.random() * teamBPlayers.length)].peerId : null;

    // Randomize token reveal rounds per spec
    // Token A: Random between rounds 1, 2, or 3
    const tokenAReveal = Math.floor(Math.random() * 3) + 1; // 1, 2, or 3

    // Token B: Random between rounds 2, 3, or 4, but must be >= tokenAReveal
    const minTokenB = Math.max(2, tokenAReveal);
    const maxTokenB = 4;
    const tokenBReveal = Math.floor(Math.random() * (maxTokenB - minTokenB + 1)) + minTokenB;

    updateGame(prev => ({
      ...prev,
      status: GameStatus.IN_PROGRESS,
      defectorPeerIdA: defA,
      defectorPeerIdB: defB,
      tokenARevealRound: tokenAReveal,
      tokenBRevealRound: tokenBReveal,
      tokenAUsed: false,
      tokenBUsed: false
    }));
    updateInnerMind('Mission start. Loyalties have been secretly compromised.');
  };

  const handleDefection = (peerId: string) => {
    if (!game.isHost) return;

    // Enforce defection window - cannot defect after Round 4 ends
    if (!game.defectionWindowOpen) {
      updateInnerMind('Defection window is CLOSED. The time for betrayal has passed.');
      return;
    }

    const player = game.players.find(p => p.peerId === peerId);
    if (!player) return;

    // Verify this player is actually a defector
    if (peerId !== game.defectorPeerIdA && peerId !== game.defectorPeerIdB) {
      return;
    }

    const fromTeam = player.team;
    const toTeam = fromTeam === 'A' ? 'B' : 'A';
    const toTeamName = toTeam === 'A' ? game.teamA.name : game.teamB.name;

    updateGame(prev => {
      const targetTeamKey = toTeam === 'A' ? 'teamA' : 'teamB';
      // Mark the token as used
      const isTokenA = peerId === prev.defectorPeerIdA;
      const isTokenB = peerId === prev.defectorPeerIdB;

      return {
        ...prev,
        [targetTeamKey]: { ...prev[targetTeamKey], score: prev[targetTeamKey].score + 2 },
        tokenAUsed: isTokenA ? true : prev.tokenAUsed,
        tokenBUsed: isTokenB ? true : prev.tokenBUsed,
        notification: {
          message: `FIELD REPORT: Agent ${player.name} has defected to ${toTeamName}! +2 Points.`,
          type: 'NEWS',
          timestamp: Date.now()
        },
        players: prev.players.map(p => p.peerId === peerId ? { ...p, team: toTeam } : p)
      };
    });
    updateInnerMind(`The knife falls. ${player.name} has crossed the line.`);
  };

  const handleNext = () => {
    if (!game.isHost) return;
    const nextQIndex = game.currentQuestionIndex + 1;
    let nextRound = game.currentRound;

    const newReveals = [...game.revealedDefectors];
    if (nextQIndex >= 3) {
      // Reveal tokens based on randomized rounds
      if (nextRound === game.tokenARevealRound && game.defectorPeerIdA && !game.tokenAUsed) {
        newReveals.push(game.defectorPeerIdA);
      }
      if (nextRound === game.tokenBRevealRound && game.defectorPeerIdB && !game.tokenBUsed) {
        newReveals.push(game.defectorPeerIdB);
      }

      nextRound++;
      if (nextRound > 6) {
        updateGame(prev => ({ ...prev, status: GameStatus.COMPLETED }));
        return;
      }

      // Standoff triggers ONLY if BOTH tokens are still held after Round 4
      if (nextRound === 5 && !game.tokenAUsed && !game.tokenBUsed) {
        updateGame(prev => ({
          ...prev,
          standoff: { ...prev.standoff, triggered: true },
          defectionWindowOpen: false,
          currentRound: 5,
          currentQuestionIndex: 0,
          currentTurn: { ...prev.currentTurn, status: QuestionStatus.AWAITING, isDouble: false },
          revealedDefectors: Array.from(new Set([...newReveals, game.defectorPeerIdA!, game.defectorPeerIdB!].filter(Boolean) as string[]))
        }));
        return;
      }

      // Close defection window at Round 5 regardless
      const windowOpen = nextRound < 5;

      // Determine first answering team for new round
      // Rounds 1, 3, 5 → Team A starts; Rounds 2, 4, 6 → Team B starts
      const firstTeam = (nextRound % 2 === 1) ? 'A' : 'B';

      updateGame(prev => ({
        ...prev,
        currentRound: nextRound,
        currentQuestionIndex: 0,
        defectionWindowOpen: windowOpen,
        currentTurn: { ...prev.currentTurn, answeringTeam: firstTeam, status: QuestionStatus.AWAITING, isDouble: false },
        revealedDefectors: Array.from(new Set(newReveals))
      }));
    } else {
      // Within a round, alternate teams for each question
      updateGame(prev => ({
        ...prev,
        currentQuestionIndex: nextQIndex,
        currentTurn: { ...prev.currentTurn, answeringTeam: prev.currentTurn.answeringTeam === 'A' ? 'B' : 'A', status: QuestionStatus.AWAITING, isDouble: false },
        revealedDefectors: Array.from(new Set(newReveals))
      }));
    }
  };

  const toggleDouble = () => {
    if (!game.isHost) return;
    const team = game.currentTurn.answeringTeam;
    const teamObj = team === 'A' ? game.teamA : game.teamB;
    if (teamObj.doubleUsed) return;
    updateGame(p => ({ ...p, currentTurn: { ...p.currentTurn, isDouble: !p.currentTurn.isDouble } }));
  };

  const lockIn = () => {
    if (!game.isHost) return;
    updateGame(p => ({ ...p, currentTurn: { ...p.currentTurn, status: QuestionStatus.ANSWERED } }));
  };

  const handlePass = () => {
    if (!game.isHost) return;
    // Team passes on the question - mark as resolved with no points
    updateGame(p => ({ ...p, currentTurn: { ...p.currentTurn, status: QuestionStatus.RESOLVED } }));
    updateInnerMind('Passed. Strategic silence or cowardice?');
  };

  const judgeAnswer = (isCorrect: boolean) => {
    if (!game.isHost) return;
    const activeTeamKey = game.currentTurn.status === QuestionStatus.STEAL ? (game.currentTurn.answeringTeam === 'A' ? 'teamB' : 'teamA') : (game.currentTurn.answeringTeam === 'A' ? 'teamA' : 'teamB');
    const wasDouble = game.currentTurn.isDouble;
    let points = isCorrect ? (wasDouble ? 2 : 1) : (wasDouble ? -1 : 0);
    updateGame(prev => {
      const nextStatus = isCorrect ? QuestionStatus.RESOLVED : (prev.currentTurn.status === QuestionStatus.STEAL ? QuestionStatus.RESOLVED : QuestionStatus.STEAL);
      return {
        ...prev,
        [activeTeamKey]: { ...prev[activeTeamKey], score: Math.max(0, prev[activeTeamKey].score + points), doubleUsed: wasDouble ? true : prev[activeTeamKey].doubleUsed },
        currentTurn: { ...prev.currentTurn, status: nextStatus, isDouble: nextStatus === QuestionStatus.RESOLVED ? false : prev.currentTurn.isDouble }
      };
    });
  };

  const selectStandoff = (team: 'A' | 'B', choice: StandoffChoice, senderId?: string) => {
    if (!game.isHost) return;
    // Security check: Only the actual defector of that team or host can trigger choice
    if (team === 'A' && senderId !== game.defectorPeerIdA && senderId !== 'HOST') return;
    if (team === 'B' && senderId !== game.defectorPeerIdB && senderId !== 'HOST') return;

    updateGame(p => ({ ...p, standoff: { ...p.standoff, [team === 'A' ? 'choiceA' : 'choiceB']: choice } }));
  };

  const resolveStandoff = () => {
    if (!game.isHost) return;
    const { choiceA, choiceB } = game.standoff;
    let resultText = "";
    updateGame(p => {
      let scoreA = p.teamA.score, scoreB = p.teamB.score;
      let updatedPlayers = [...p.players];

      if (choiceA === 'LOYAL' && choiceB === 'LOYAL') {
        resultText = "Double Loyalty. Both teams remained firm.";
      } else if (choiceA === 'DEFECT' && choiceB === 'LOYAL') {
        resultText = `${p.teamA.name} betrays! New team ${p.teamB.name} scores +3.`;
        scoreB += 3;
        // Swap defector A to team B
        updatedPlayers = updatedPlayers.map(player =>
          player.peerId === p.defectorPeerIdA ? { ...player, team: 'B' } : player
        );
      } else if (choiceA === 'LOYAL' && choiceB === 'DEFECT') {
        resultText = `${p.teamB.name} betrays! New team ${p.teamA.name} scores +3.`;
        scoreA += 3;
        // Swap defector B to team A
        updatedPlayers = updatedPlayers.map(player =>
          player.peerId === p.defectorPeerIdB ? { ...player, team: 'A' } : player
        );
      } else {
        // DEFECT + DEFECT: Both swap teams, no points
        resultText = "Mutual Betrayal. CHAOS: Agents swap identifiers.";
        updatedPlayers = updatedPlayers.map(player => {
          if (player.peerId === p.defectorPeerIdA) return { ...player, team: 'B' };
          if (player.peerId === p.defectorPeerIdB) return { ...player, team: 'A' };
          return player;
        });
      }

      return {
        ...p,
        teamA: { ...p.teamA, score: scoreA },
        teamB: { ...p.teamB, score: scoreB },
        players: updatedPlayers,
        standoff: { ...p.standoff, result: resultText, triggered: false },
        notification: { message: `STANDOFF RESULT: ${resultText}`, type: 'REPORT', timestamp: Date.now() }
      };
    });
    updateInnerMind(resultText);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getInviteUrl());
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const getInviteUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.set('room', game.roomCode || '');
    return url.toString();
  };

  const currentQuestion = game.questions[(game.currentRound - 1) * 3 + game.currentQuestionIndex];
  const isMyDefectorReveal = myPeerId && game.revealedDefectors.includes(myPeerId);

  // RENDER: Loading Overlay
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-black">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-500">
          <Loader2 size={64} className="text-[#00ffcc] animate-spin" />
          <div className="text-xl md:text-2xl font-black text-[#00ffcc] space-font flicker uppercase tracking-widest text-center">
            {loadingStatus}
          </div>
          <div className="text-[10px] text-[#00ffcc]/40 uppercase font-black tracking-widest animate-pulse">Syncing Global State...</div>
        </div>
      </div>
    );
  }

  // RENDER: Idle/Join State
  if (game.status === GameStatus.IDLE || (!game.peerConnected && !game.isHost)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        {connectionError && (
          <div className="mb-8 p-6 border-2 border-red-500 bg-red-500/10 text-red-500 font-black uppercase text-xs max-w-sm text-center animate-in zoom-in duration-300">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            <div className="mb-4">TUNNEL FAULT: {connectionError}</div>
            <button onClick={() => { setConnectionError(null); setClientIdentity('NONE'); window.location.search = ''; window.location.reload(); }} className="block mx-auto mt-4 px-6 py-2 border-2 border-red-500 hover:bg-red-500 hover:text-white transition-all font-black">RE-INITIALIZE LINK</button>
          </div>
        )}
        <SetupScreen onHost={initGame} onJoin={joinGame} />
      </div>
    );
  }

  // RENDER: Client Identity Selection
  if (!game.isHost && clientIdentity === 'NONE') {
    const teamACount = game.players.filter((p: Player) => p.team === 'A').length;
    const teamBCount = game.players.filter((p: Player) => p.team === 'B').length;
    const teamAFull = teamACount >= 6;
    const teamBFull = teamBCount >= 6;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 animate-in fade-in duration-500">
        <div className="w-full max-w-sm p-8 border-2 border-[#00ffcc] bg-[#0a0a0a] shadow-[0_0_20px_rgba(0,255,204,0.3)]">
          <h2 className="text-2xl font-black uppercase mb-2 space-font text-[#00ffcc]">ID Authentication</h2>
          <div className="text-[10px] uppercase text-[#00ffcc]/60 mb-6 font-black tracking-widest flex items-center gap-2 border-b border-[#00ffcc]/20 pb-2">
            <User size={12}/> AGENT: {myStoredName || 'UNIDENTIFIED'}
          </div>
          <p className="text-[10px] uppercase opacity-60 mb-8 leading-relaxed font-bold tracking-widest">Select your initial team deployment.</p>
          <div className="flex flex-col gap-3">
             <button
               onClick={() => {
                 setClientIdentity('A');
                 sendAction({ type: 'REGISTER_PLAYER', team: 'A', name: myStoredName || 'AGENT_ALPHA', peerId: myPeerId! });
               }}
               disabled={teamAFull}
               className="py-4 border-2 border-[#00ffcc] font-bold uppercase hover:bg-[#00ffcc] hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed relative"
             >
               Join {game.teamA.name}
               <span className="text-[8px] block mt-1 opacity-60">{teamACount}/6 Players {teamAFull && '(FULL)'}</span>
             </button>

             <button
               onClick={() => {
                 setClientIdentity('B');
                 sendAction({ type: 'REGISTER_PLAYER', team: 'B', name: myStoredName || 'AGENT_BETA', peerId: myPeerId! });
               }}
               disabled={teamBFull}
               className="py-4 border-2 border-[#00ffcc] font-bold uppercase hover:bg-[#00ffcc] hover:text-black transition-colors disabled:opacity-20 disabled:cursor-not-allowed relative"
             >
               Join {game.teamB.name}
               <span className="text-[8px] block mt-1 opacity-60">{teamBCount}/6 Players {teamBFull && '(FULL)'}</span>
             </button>

             <button onClick={() => setClientIdentity('ASSISTANT')} className="py-2 text-[10px] text-[#00ffcc]/40 font-bold uppercase hover:text-[#00ffcc] tracking-widest mt-2">Remote Spectator</button>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: Host Lobby
  if (game.isHost && game.status === GameStatus.LOBBY) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center gap-8 animate-in fade-in duration-500">
        <div className="text-center max-w-2xl w-full">
          <div className="flex items-center justify-center gap-2 mb-2 text-[#00ffcc]/40 text-[10px] font-black uppercase tracking-[0.4em]"><Globe size={12} /> GLOBAL_PEER: ACTIVE</div>
          <h2 className="text-5xl md:text-7xl font-black uppercase mb-4 text-[#00ffcc] space-font tracking-tighter drop-shadow-[0_0_20px_rgba(0,255,204,0.4)]">RECRUITING</h2>
          <div className="bg-white p-4 inline-block mb-4 shadow-[0_0_50px_rgba(0,255,204,0.4)] relative group cursor-pointer" onClick={handleCopy}>
             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(getInviteUrl())}`} alt="Join QR" className="w-64 h-64 md:w-80 md:h-80" />
             <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity p-8 text-white font-bold text-xs uppercase leading-relaxed text-center"><Activity size={32} className="mb-2 text-[#00ffcc] animate-pulse" /> SCAN TO LINK AGENT TERMINAL</div>
          </div>
          <div className="mb-8"><div className="text-[10px] font-black opacity-60 uppercase mb-2 tracking-widest">AUTHENTICATION CODE</div><div className="text-7xl font-black text-[#00ffcc] space-font tracking-[0.2em] flicker">{game.roomCode}</div></div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="w-full max-w-md bg-[#00ffcc]/5 border border-[#00ffcc]/20 p-4">
               <div className="flex items-center gap-3 text-[#00ffcc] font-black uppercase text-sm border-b border-[#00ffcc]/20 pb-2 mb-4"><Users size={18} /> {game.players.length} Active Agents</div>
               <div className="flex flex-wrap gap-2 justify-center">
                  {game.players.map(p => (
                    <div key={p.peerId} className={`px-3 py-1 text-[10px] font-black border uppercase ${p.team === 'A' ? 'border-[#00ffcc] text-[#00ffcc]' : 'border-white/40 text-white/40'}`}>
                      {p.name} [{p.team}]
                    </div>
                  ))}
                  {game.players.length === 0 && <div className="text-[10px] opacity-30 italic">LISTENING FOR CONNECTIONS...</div>}
               </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 w-full justify-center">
              <button
                onClick={() => sendAction({ type: 'START_GAME' })}
                disabled={game.players.length < 2}
                className="px-16 py-5 bg-[#00ffcc] text-black font-black text-2xl uppercase shadow-[0_0_30px_rgba(0,255,204,0.5)] hover:scale-105 transition-transform disabled:opacity-20 relative"
              >
                GENERATE MISSION
                {game.players.length < 2 && <span className="text-[10px] block mt-1 opacity-60">(Need 2+ players)</span>}
              </button>
              <button onClick={handleCopy} className={`px-8 py-5 border-2 border-[#00ffcc] text-[#00ffcc] font-black uppercase flex items-center gap-2 transition-all ${copySuccess ? 'bg-[#00ffcc] text-black' : 'hover:bg-[#00ffcc]/10'}`}>{copySuccess ? <Check size={18} /> : <LinkIcon size={18} />} {copySuccess ? 'LINK COPIED' : 'COPY TUNNEL'}</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // MAIN GAME SCREEN
  return (
    <div className="min-h-screen p-2 md:p-8 flex flex-col items-center relative w-full overflow-hidden">
      {/* Field Report Overlay */}
      {game.notification && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-red-600/20 backdrop-blur-md animate-in fade-in duration-500 p-4">
           <div className="max-w-xl w-full p-1 border-4 border-red-600 bg-black shadow-[0_0_100px_rgba(255,0,0,0.5)] relative">
              <div className="bg-red-600 text-black p-4 flex items-center justify-between font-black uppercase tracking-widest">
                <div className="flex items-center gap-3"><Newspaper size={24} className="animate-pulse" /> URGENT FIELD REPORT</div>
                <button onClick={() => sendAction({ type: 'DISMISS_NOTIFICATION' })} className="hover:scale-125 transition-transform"><X size={24} /></button>
              </div>
              <div className="p-10 text-center">
                 <h2 className="text-3xl font-black uppercase mb-6 flicker space-font text-red-600 tracking-tighter leading-tight">{game.notification.message}</h2>
                 <button onClick={() => sendAction({ type: 'DISMISS_NOTIFICATION' })} className="px-12 py-4 border-2 border-red-600 text-red-600 font-black uppercase hover:bg-red-600 hover:text-black transition-all">ACKNOWLEDGE MISSION DATA</button>
              </div>
           </div>
        </div>
      )}

      <TerminalFrame title={`TROUBLE CROSS: ${game.isHost ? 'HOST_CORE' : 'TERM_' + myCurrentTeam}`} roundInfo={`CODE: ${game.roomCode} | R${game.currentRound}-Q${game.currentQuestionIndex + 1}`}>
        <div className="flex justify-between items-center text-[10px] uppercase font-bold opacity-60 mb-2">
           <div className="flex items-center gap-1"><Radio size={12} className={game.peerConnected ? "text-green-500 animate-pulse" : "text-red-500"} /> {game.isHost ? `${game.connectedPeersCount} Uplinks Active` : 'Encrypted Bridge Stable'}</div>
           {!game.isHost && (
             <div className="flex items-center gap-3 text-[#00ffcc]">
               <div className="flex items-center gap-1"><User size={12} /> {myStoredName}</div>
               <div className="flex items-center gap-1 px-2 border border-[#00ffcc]/30"><UserCheck size={12} /> {myCurrentTeam === 'ASSISTANT' ? 'SPECTATOR' : `TEAM: ${myCurrentTeam === 'A' ? game.teamA.name : game.teamB.name}`}</div>
               {isMyDefectorReveal && <div className="bg-red-600 text-black px-1 font-black animate-pulse">[TRAITOR]</div>}
             </div>
           )}
        </div>

        <div className="grid grid-cols-2 gap-2 md:gap-4">
          {[game.teamA, game.teamB].map(t => (
            <div key={t.id} className={`p-4 border-2 transition-all ${game.currentTurn.answeringTeam === t.id && game.currentTurn.status !== QuestionStatus.STEAL ? 'border-[#00ffcc] bg-[#00ffcc]/10 shadow-[0_0_15px_rgba(0,255,204,0.2)]' : 'border-[#00ffcc]/30 opacity-60'}`}>
              <div className="flex justify-between items-center mb-1"><span className="font-bold uppercase tracking-widest text-xs md:text-lg pr-2 truncate">{t.name}</span><span className="text-2xl md:text-3xl font-black">{t.score}</span></div>
              <div className="h-1 bg-[#00ffcc]/20 w-full mb-3"><div className="h-full bg-[#00ffcc] transition-all duration-500" style={{ width: `${Math.min(100, (t.score / 20) * 100)}%` }}></div></div>
              <div className="flex flex-wrap gap-1">
                {game.players.filter(p => p.team === t.id).map(p => (
                   <span key={p.peerId} className="text-[8px] bg-black/40 px-1 border border-[#00ffcc]/20 font-bold flex items-center gap-0.5">
                     <User size={8} /> {p.name}
                   </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex-grow flex flex-col items-center justify-center p-4 md:p-8 bg-black/40 border border-[#00ffcc]/20 relative overflow-hidden min-h-[350px]">
           {game.status === GameStatus.COMPLETED ? (
             <div className="text-center animate-in zoom-in duration-500"><Trophy size={64} className="mx-auto mb-4 text-yellow-500" /><h2 className="text-4xl md:text-6xl font-black uppercase mb-2 text-yellow-500 flicker">MISSION OVER</h2><button onClick={() => { window.location.search = ''; window.location.reload(); }} className="px-12 py-4 bg-[#00ffcc] text-black font-black uppercase mt-8">RE-INITIALIZE CORE</button></div>
           ) : game.standoff.triggered ? (
             <div className="text-center animate-in fade-in duration-500 w-full">
                <Sword size={48} className="mx-auto mb-4 text-red-500 animate-bounce" />
                <h2 className="text-3xl md:text-5xl font-black uppercase mb-4 text-red-500 flicker tracking-tighter leading-none">⚔️ THE STANDOFF ⚔️</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                    <div className={`p-4 border-2 ${myCurrentTeam === 'A' ? 'border-[#00ffcc]' : 'border-red-500/30'}`}>
                      <h3 className="font-black mb-2 uppercase text-[10px] opacity-60 tracking-widest">{game.teamA.name} Deployment</h3>
                      { (myPeerId === game.defectorPeerIdA || game.isHost) ? (
                        <div className="flex gap-2">
                          <button onClick={() => sendAction({ type: 'STANDOFF_CHOICE', team: 'A', choice: StandoffChoice.LOYAL })} className={`flex-1 px-4 py-3 border font-black uppercase text-xs ${game.standoff.choiceA === 'LOYAL' ? 'bg-green-500 text-black border-green-500 shadow-[0_0_10px_green]' : 'border-white/20'}`}>LOYAL</button>
                          <button onClick={() => sendAction({ type: 'STANDOFF_CHOICE', team: 'A', choice: StandoffChoice.DEFECT })} className={`flex-1 px-4 py-3 border font-black uppercase text-xs ${game.standoff.choiceA === 'DEFECT' ? 'bg-red-500 text-black border-red-500 shadow-[0_0_10px_red]' : 'border-white/20'}`}>DEFECT</button>
                        </div>
                      ) : <div className="text-[10px] text-center italic py-2 opacity-40">Awaiting Agent decision...</div> }
                    </div>
                    
                    <div className={`p-4 border-2 ${myCurrentTeam === 'B' ? 'border-[#00ffcc]' : 'border-red-500/30'}`}>
                      <h3 className="font-black mb-2 uppercase text-[10px] opacity-60 tracking-widest">{game.teamB.name} Deployment</h3>
                      { (myPeerId === game.defectorPeerIdB || game.isHost) ? (
                        <div className="flex gap-2">
                          <button onClick={() => sendAction({ type: 'STANDOFF_CHOICE', team: 'B', choice: StandoffChoice.LOYAL })} className={`flex-1 px-4 py-3 border font-black uppercase text-xs ${game.standoff.choiceB === 'LOYAL' ? 'bg-green-500 text-black border-green-500 shadow-[0_0_10px_green]' : 'border-white/20'}`}>LOYAL</button>
                          <button onClick={() => sendAction({ type: 'STANDOFF_CHOICE', team: 'B', choice: StandoffChoice.DEFECT })} className={`flex-1 px-4 py-3 border font-black uppercase text-xs ${game.standoff.choiceB === 'DEFECT' ? 'bg-red-500 text-black border-red-500 shadow-[0_0_10px_red]' : 'border-white/20'}`}>DEFECT</button>
                        </div>
                      ) : <div className="text-[10px] text-center italic py-2 opacity-40">Awaiting Agent decision...</div> }
                    </div>
                </div>
                { game.isHost && game.standoff.choiceA && game.standoff.choiceB && (
                  <button onClick={() => sendAction({ type: 'RESOLVE_STANDOFF' })} className="mt-8 px-10 py-4 bg-red-600 font-black uppercase flicker tracking-widest text-lg shadow-[0_0_30px_red]">RESOLVE STANDOFF</button>
                )}
             </div>) : (
             <div className="text-center max-w-xl w-full">
               <div className="flex items-center justify-center gap-3 mb-4">
                  <p className="text-[10px] uppercase tracking-widest text-[#00ffcc]/60 font-black border-r border-[#00ffcc]/20 pr-3">Node Difficulty: {currentQuestion?.difficulty}</p>
                  {isMyDefectorReveal && game.defectionWindowOpen && (
                    <button 
                      onClick={() => sendAction({ type: 'DEFECT', peerId: myPeerId! })}
                      className="bg-red-600 text-white text-[10px] px-3 py-1 font-black uppercase animate-pulse shadow-[0_0_10px_red] flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
                    >
                      <Zap size={10} /> EXECUTE DEFECTION
                    </button>
                  )}
               </div>
               
               <h2 className="text-xl md:text-3xl font-bold mb-8 space-font leading-tight px-4">{currentQuestion?.text}</h2>
               
               {game.currentTurn.status === QuestionStatus.AWAITING && (
                  <div className="flex flex-col gap-4 items-center animate-in zoom-in duration-300">
                    <div className="flex flex-wrap justify-center gap-3 w-full max-w-sm">
                      {(game.currentTurn.answeringTeam === myCurrentTeam || game.isHost) && (
                        <>
                          <button onClick={() => sendAction({ type: 'TOGGLE_DOUBLE' })} className={`flex-1 px-4 py-3 border-2 uppercase text-[10px] font-black transition-all ${game.currentTurn.isDouble ? 'bg-red-500 text-black border-red-500 shadow-[0_0_15px_red]' : 'border-red-500/50 text-red-500'}`}>DOUBLE STAKE</button>
                          <button onClick={() => sendAction({ type: 'LOCK_IN' })} className="flex-[2] px-6 py-4 bg-[#00ffcc] text-black font-black uppercase shadow-[0_0_20px_rgba(0,255,204,0.4)] text-sm active:scale-95">LOCK IN ANSWER</button>
                        </>
                      )}
                    </div>
                    <div className="w-full max-w-sm flex justify-center">
                      {(game.currentTurn.answeringTeam === myCurrentTeam || game.isHost) && (
                        <button onClick={() => sendAction({ type: 'PASS' })} className="px-6 py-2 border border-[#00ffcc]/30 text-[#00ffcc]/60 uppercase text-[10px] font-black hover:bg-[#00ffcc]/10 hover:text-[#00ffcc] transition-all">PASS QUESTION</button>
                      )}
                    </div>
                  </div>
               )}
               {(game.currentTurn.status === QuestionStatus.ANSWERED || (game.currentTurn.status === QuestionStatus.STEAL && myCurrentTeam !== game.currentTurn.answeringTeam)) && (
                  <div className="flex flex-col gap-4 items-center">
                     {game.isHost && (
                       <div className="mb-6 p-6 border-2 border-dashed border-[#00ffcc]/40 animate-in zoom-in duration-300 bg-[#00ffcc]/5">
                         <div className="flex items-center justify-center gap-2 text-[10px] uppercase font-black text-[#00ffcc] mb-2"><Eye size={12} /> HOST_INTEL_REVEAL</div>
                         <div className="text-4xl font-black uppercase text-white space-font flicker drop-shadow-[0_0_15px_#00ffcc]">{currentQuestion?.answer}</div>
                       </div>
                     )}
                     <p className="text-xs font-black uppercase tracking-[0.3em] text-[#00ffcc] animate-pulse">Kernel Verification In Progress...</p>
                     {game.isHost && (
                       <div className="flex gap-4">
                          <button onClick={() => sendAction({ type: 'JUDGE_ANSWER', isCorrect: true })} className="px-10 py-4 bg-green-600 text-white font-black uppercase shadow-[0_0_15px_green] hover:scale-105 transition-transform">VALID</button>
                          <button onClick={() => sendAction({ type: 'JUDGE_ANSWER', isCorrect: false })} className="px-10 py-4 bg-red-600 text-white font-black uppercase shadow-[0_0_15px_red] hover:scale-105 transition-transform">INVALID</button>
                       </div>
                     )}
                  </div>
               )}
               {game.currentTurn.status === QuestionStatus.STEAL && game.isHost && (
                  <div className="flex flex-col gap-4 items-center bg-red-500/10 p-6 border-2 border-red-500/50 w-full animate-in zoom-in duration-300">
                     <div className="text-xs font-black text-red-500 uppercase tracking-widest animate-pulse mb-2">🎯 STEAL WINDOW OPEN // EXPECTED KEY: {currentQuestion?.answer}</div>
                     <div className="flex gap-4">
                        <button onClick={() => sendAction({ type: 'JUDGE_ANSWER', isCorrect: true })} className="px-10 py-3 bg-[#00ffcc] text-black font-black uppercase">STEAL SUCCESS</button>
                        <button onClick={() => sendAction({ type: 'JUDGE_ANSWER', isCorrect: false })} className="px-10 py-3 border-2 border-[#00ffcc] text-[#00ffcc] uppercase font-black">STEAL FAIL</button>
                        <button onClick={() => sendAction({ type: 'PASS' })} className="px-10 py-3 border border-white/30 text-white/60 uppercase font-black hover:bg-white/10">PASS</button>
                     </div>
                  </div>
               )}
               {game.currentTurn.status === QuestionStatus.RESOLVED && (
                  <div className="flex flex-col gap-4 items-center animate-in slide-in-from-bottom duration-300">
                     <div className="text-[10px] uppercase font-black opacity-40 tracking-widest mb-1">Decrypted Answer:</div>
                     <div className="text-2xl md:text-5xl font-black mb-6 uppercase space-font border-b-4 border-[#00ffcc] pb-2 px-10 flicker">{currentQuestion?.answer}</div>
                     {game.isHost && <button onClick={() => sendAction({ type: 'NEXT_QUESTION' })} className="px-16 py-4 bg-[#00ffcc] text-black font-black uppercase shadow-[0_0_20px_rgba(0,255,204,0.6)] text-sm tracking-widest active:scale-95 transition-transform">NEXT DATA PACKET</button>}
                  </div>
               )}
             </div>
           )}
        </div>
        <div className="border border-[#00ffcc]/20 bg-black/60 p-4 min-h-[80px] flex flex-col justify-center relative">
          <div className="flex items-center gap-2 text-[8px] uppercase text-[#00ffcc]/50 mb-1 font-black tracking-widest"><MessageSquare size={10} /> inner_mind_relay</div>
          <div className="text-xs md:text-sm space-font font-medium italic text-[#00ffcc]/90 leading-relaxed flicker">"{game.innerMind}"</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
           {game.isHost ? (
             <>
               <button onClick={() => { window.location.search = ''; window.location.reload(); }} className="p-3 border border-red-500/30 text-red-500/60 uppercase text-[9px] font-black hover:bg-red-500 hover:text-white transition-all">TERMINATE SESSION</button>
               <button className="p-3 border border-[#00ffcc]/30 text-[#00ffcc]/60 uppercase text-[9px] font-black hover:bg-[#00ffcc] hover:text-black transition-all" onClick={() => setShowInvite(true)}>QR ACCESS</button>
               <button className="p-3 border border-[#00ffcc]/30 text-[#00ffcc]/60 uppercase text-[9px] font-black hover:bg-[#00ffcc] hover:text-black transition-all" onClick={handleCopy}>UPLINK TUNNEL</button>
             </>
           ) : (
             <div className="col-span-2 md:col-span-3 flex items-center justify-center text-[9px] font-black uppercase opacity-20 tracking-widest gap-2">
               <Check size={10}/> SYNCED // E2EE_LOCKED
             </div>
           )}
        </div>
      </TerminalFrame>
    </div>
  );
};

export default App;
