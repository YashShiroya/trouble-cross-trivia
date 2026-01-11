
import React from 'react';

interface TerminalFrameProps {
  children: React.ReactNode;
  title: string;
  roundInfo?: string;
}

const TerminalFrame: React.FC<TerminalFrameProps> = ({ children, title, roundInfo }) => {
  return (
    <div className="max-w-4xl mx-auto w-full border-2 border-[#00ffcc] shadow-[0_0_20px_rgba(0,255,204,0.3)] bg-[#0a0a0a] overflow-hidden flex flex-col min-h-[600px] mb-8">
      {/* Header */}
      <div className="border-b-2 border-[#00ffcc] p-4 flex justify-between items-center bg-[#00ffcc] text-[#050505] font-bold uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <span className="animate-pulse">⚡</span> {title}
        </div>
        <div>{roundInfo}</div>
      </div>
      
      {/* Body */}
      <div className="flex-grow p-6 flex flex-col gap-6">
        {children}
      </div>

      {/* Footer Decoration */}
      <div className="border-t border-[#00ffcc]/30 p-2 text-[10px] text-[#00ffcc]/50 flex justify-between uppercase">
        <span>sys_link: active</span>
        <span>kernel_v2.18_stable</span>
        <span>host_os_connected</span>
      </div>
    </div>
  );
};

export default TerminalFrame;
