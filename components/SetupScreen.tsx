
import React, { useState } from 'react';
import { Wifi, Server, Smartphone, ShieldCheck, User } from 'lucide-react';

interface SetupScreenProps {
  onHost: (teamA: string, teamB: string, difficulty: string) => void;
  onJoin: (code: string, name: string) => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onHost, onJoin }) => {
  const [view, setView] = useState<'menu' | 'host' | 'join'>('menu');
  const [teamAName, setTeamAName] = useState('SOULS');
  const [teamBName, setTeamBName] = useState('CLOUDS');
  const [difficulty, setDifficulty] = useState('medium');
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');

  if (view === 'menu') {
    return (
      <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500 max-w-lg text-center px-4">
        <div className="relative">
          <h1 className="text-6xl md:text-8xl font-black mb-4 tracking-tighter space-font text-[#00ffcc] drop-shadow-[0_0_20px_rgba(0,255,204,0.6)] flicker">
            TROUBLE CROSS
          </h1>
          <div className="text-[10px] absolute -right-4 top-0 bg-[#00ffcc] text-black px-2 py-0.5 font-bold uppercase rotate-12">v2.18</div>
          <p className="text-sm opacity-70 italic font-bold tracking-widest uppercase">"BETRAYAL IS THE PRIMARY FEATURE"</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4 w-full">
          <button 
            onClick={() => setView('host')}
            className="group flex items-center justify-between px-6 py-8 border-2 border-[#00ffcc] text-left hover:bg-[#00ffcc] hover:text-black transition-all shadow-[0_0_20px_rgba(0,255,204,0.1)] hover:shadow-[0_0_40px_rgba(0,255,204,0.3)]"
          >
            <div>
              <div className="text-2xl font-black uppercase">INITIALIZE HOST</div>
              <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Establish Session Command Center</div>
            </div>
            <Server className="group-hover:scale-110 transition-transform" size={32} />
          </button>

          <button 
            onClick={() => setView('join')}
            className="group flex items-center justify-between px-6 py-6 border-2 border-[#00ffcc]/30 text-left hover:border-[#00ffcc] hover:text-[#00ffcc] transition-all"
          >
            <div>
              <div className="text-xl font-black uppercase">LINK REMOTE TERMINAL</div>
              <div className="text-[10px] opacity-70 uppercase font-bold tracking-widest">Join via existing Room Code</div>
            </div>
            <Smartphone className="group-hover:scale-110 transition-transform" />
          </button>
        </div>

        <div className="mt-4 p-4 border border-[#00ffcc]/20 bg-[#00ffcc]/5 text-[10px] uppercase text-left leading-relaxed">
          <div className="flex items-center gap-2 mb-2 text-[#00ffcc] font-black">
            <ShieldCheck size={14} /> SECURITY PROTOCOLS:
          </div>
          • Host manages kernel state and questions.<br/>
          • Terminals connect via P2P encrypted bridge.<br/>
          • If tunnel returns 404, verify host sub-path permissions.
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex flex-col items-center gap-6 animate-in slide-in-from-bottom duration-500 w-full max-w-sm px-4">
        <h2 className="text-3xl font-black space-font uppercase tracking-tighter flicker">REMOTE UPLINK</h2>
        
        <div className="w-full space-y-4">
          <div className="bg-[#00ffcc]/5 p-4 border border-[#00ffcc]/20">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#00ffcc] mb-2 font-black">
              <User size={12}/> Agent Codename
            </label>
            <input 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value.toUpperCase())}
              placeholder="YOUR NAME"
              className="w-full bg-black border-b-2 border-[#00ffcc] p-2 outline-none font-bold text-xl text-[#00ffcc] placeholder:opacity-20"
            />
          </div>

          <div className="bg-[#00ffcc]/5 p-4 border border-[#00ffcc]/20">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#00ffcc] mb-2 font-black">
              <Wifi size={12}/> Authentication Code
            </label>
            <input 
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 4))}
              placeholder="----"
              className="w-full text-center text-4xl bg-black border-b-2 border-[#00ffcc] p-2 outline-none space-font font-black tracking-[0.2em] focus:bg-[#00ffcc]/10 transition-all placeholder:opacity-20"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 w-full">
          <button 
            onClick={() => onJoin(roomCode, playerName || 'ANONYMOUS')}
            disabled={roomCode.length !== 4}
            className="w-full py-5 bg-[#00ffcc] text-black font-black text-xl uppercase tracking-widest disabled:opacity-20 shadow-[0_0_30px_rgba(0,255,204,0.4)] hover:scale-[1.02] transition-all"
          >
            ESTABLISH LINK
          </button>
          <button onClick={() => setView('menu')} className="w-full py-2 text-[#00ffcc]/60 uppercase text-[10px] font-bold hover:text-[#00ffcc] tracking-widest">Abort Join Sequence</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 gap-8 animate-in fade-in duration-700 w-full max-w-4xl">
      <div className="text-center">
        <h1 className="text-5xl font-black mb-2 tracking-tighter space-font text-[#00ffcc] flicker">
          KERNEL CONFIG
        </h1>
        <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-50">Local Cluster Initialization</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-2xl">
        <div className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest text-[#00ffcc] font-black opacity-60">Team Alpha Identity</label>
          <input 
            value={teamAName}
            onChange={(e) => setTeamAName(e.target.value.toUpperCase())}
            className="w-full bg-transparent border-b-2 border-[#00ffcc] p-3 outline-none focus:bg-[#00ffcc]/10 font-bold text-2xl space-font"
          />
        </div>
        <div className="space-y-4">
          <label className="block text-[10px] uppercase tracking-widest text-[#00ffcc] font-black opacity-60">Team Beta Identity</label>
          <input 
            value={teamBName}
            onChange={(e) => setTeamBName(e.target.value.toUpperCase())}
            className="w-full bg-transparent border-b-2 border-[#00ffcc] p-3 outline-none focus:bg-[#00ffcc]/10 font-bold text-2xl space-font"
          />
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <label className="block text-[10px] uppercase tracking-widest text-[#00ffcc] mb-4 font-black opacity-60">Difficulty Index</label>
        <div className="grid grid-cols-4 gap-2">
          {['easy', 'medium', 'hard', 'extreme'].map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`py-4 border-2 text-[10px] font-black uppercase transition-all tracking-widest ${difficulty === d ? 'bg-[#00ffcc] text-black border-[#00ffcc] shadow-[0_0_15px_rgba(0,255,204,0.4)]' : 'border-[#00ffcc]/20 text-[#00ffcc]/40 hover:border-[#00ffcc]/60 hover:text-[#00ffcc]'}`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-2xl mt-8">
        <button 
          onClick={() => onHost(teamAName, teamBName, difficulty)}
          className="flex-1 py-6 border-4 border-[#00ffcc] text-3xl font-black uppercase hover:bg-[#00ffcc] hover:text-black transition-all shadow-[0_0_40px_rgba(0,255,204,0.2)] active:scale-95"
        >
          GENERATE KERNEL
        </button>
        <button onClick={() => setView('menu')} className="px-10 py-6 border border-[#00ffcc]/30 uppercase text-xs font-bold hover:text-[#00ffcc]">Return</button>
      </div>

      <div className="text-[9px] uppercase opacity-30 mt-8 tracking-[0.5em] text-center">
        TROUBLE CROSS — HOST_OS_v2.18 — READY_FOR_UPLINK
      </div>
    </div>
  );
};

export default SetupScreen;
