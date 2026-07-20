import React from 'react';
import { 
  Diamond, 
  Zap, 
  ShoppingCart, 
  History, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  TrendingUp, 
  Clock,
  AlertTriangle,
  Gamepad2
} from 'lucide-react';
import './_neon-gaming.css';

export function NeonGaming() {
  const historyData = [
    { id: 1, player: "123456789", amount: 500, status: "success", time: "il y a 2h" },
    { id: 2, player: "987654321", amount: 1000, status: "success", time: "il y a 5h" },
    { id: 3, player: "456789123", amount: 200, status: "fail", time: "hier" },
    { id: 4, player: "321654987", amount: 2000, status: "success", time: "il y a 2j" },
    { id: 5, player: "741852963", amount: 500, status: "success", time: "il y a 3j" },
  ];

  return (
    <div 
      className="gaming-bg relative overflow-y-auto no-scrollbar font-rajdhani text-white"
      style={{ width: '420px', minHeight: '860px', margin: '0 auto', border: '1px solid #1a1a2e' }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="px-6 pt-8 pb-4 flex justify-between items-center relative z-10">
        <div>
          <h1 className="text-sm text-gray-400 font-semibold tracking-widest uppercase">Agent</h1>
          <div className="text-2xl font-bold font-orbitron text-white text-glow-purple flex items-center gap-2">
            MEHDI
            <div className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_5px_#22d3ee] animate-pulse"></span>
              <span className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold">Actif</span>
            </div>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-purple-500 flex items-center justify-center bg-purple-900/40 shadow-[0_0_10px_rgba(124,58,237,0.4)]">
          <Gamepad2 className="w-5 h-5 text-purple-400" />
        </div>
      </header>

      {/* Hero Balance - Hexagon */}
      <div className="py-6 relative z-10">
        <div className="hex-outer">
          <div className="hex-inner">
            <span className="text-gray-400 text-sm font-semibold tracking-widest uppercase mb-1">Stock Actuel</span>
            <div className="flex items-center justify-center gap-2">
              <span className="font-orbitron text-4xl font-bold text-white text-glow-cyan tracking-wider">
                4 850
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-cyan-400">
              <Diamond className="w-4 h-4 fill-cyan-400/20" />
              <span className="text-sm font-semibold tracking-widest">DIAMANTS</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="px-5 mb-8">
        <div className="bg-[#121225]/80 border border-[#2a2a4a] rounded-xl p-4 shadow-lg backdrop-blur-sm grid grid-cols-3 gap-4">
          <div className="flex flex-col gap-1">
            <div className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-purple-400" /> Ventes
            </div>
            <div className="font-orbitron text-lg font-bold">12.4k</div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
              <div className="h-full w-[70%] bg-purple-500 progress-bar-glow text-purple-500"></div>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-l border-[#2a2a4a] pl-4">
            <div className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1">
              <ShoppingCart className="w-3 h-3 text-cyan-400" /> Cmds
            </div>
            <div className="font-orbitron text-lg font-bold">47</div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
              <div className="h-full w-[85%] bg-cyan-400 progress-bar-glow text-cyan-400"></div>
            </div>
          </div>
          <div className="flex flex-col gap-1 border-l border-[#2a2a4a] pl-4">
            <div className="text-xs text-gray-400 font-semibold uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-green-400" /> Succès
            </div>
            <div className="font-orbitron text-lg font-bold text-green-400">45</div>
            <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
              <div className="h-full w-[95%] bg-green-400 progress-bar-glow text-green-400"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="px-5 flex flex-col gap-4 mb-8">
        <button className="neon-border-btn w-full rounded-lg py-4 px-4 flex items-center justify-between group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-purple-500/20 border border-purple-500/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-purple-400 group-hover:animate-pulse" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg tracking-wide">Recharger un joueur</div>
              <div className="text-xs text-purple-300/70 font-semibold uppercase tracking-wider">Transfert immédiat</div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-purple-400 group-hover:translate-x-1 transition-transform" />
        </button>

        <button className="neon-border-btn neon-border-btn-cyan w-full rounded-lg py-4 px-4 flex items-center justify-between group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-cyan-500/20 border border-cyan-500/50 flex items-center justify-center">
              <Diamond className="w-5 h-5 text-cyan-400" />
            </div>
            <div className="text-left">
              <div className="font-bold text-lg tracking-wide">Acheter des parts</div>
              <div className="text-xs text-cyan-300/70 font-semibold uppercase tracking-wider">Solde dispo: <span className="text-cyan-400 font-orbitron">$120.00</span></div>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-cyan-400 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Alert Component */}
      <div className="px-5 mb-8">
        <div className="border border-pink-500/50 bg-pink-500/10 rounded-lg p-3 flex items-start gap-3 shadow-[0_0_15px_rgba(236,72,153,0.15)]">
          <AlertTriangle className="text-pink-500 w-5 h-5 mt-0.5 shrink-0 animate-pulse drop-shadow-[0_0_5px_rgba(236,72,153,0.8)]" />
          <div>
            <div className="font-orbitron font-bold text-pink-500 text-sm tracking-wide text-glow-pink">ALERTE SYSTÈME</div>
            <div className="text-pink-200/80 text-sm mt-0.5 font-medium">Votre stock est inférieur à 5000 💎. Pensez à recharger bientôt pour éviter toute rupture.</div>
          </div>
        </div>
      </div>

      {/* History Timeline */}
      <div className="px-5 pb-10">
        <div className="flex items-center gap-2 mb-6">
          <History className="w-5 h-5 text-gray-400" />
          <h2 className="text-lg font-bold tracking-wide">DERNIÈRES OPÉRATIONS</h2>
        </div>

        <div className="relative pl-8">
          <div className="timeline-line"></div>
          
          <div className="flex flex-col gap-6">
            {historyData.map((item, index) => (
              <div key={item.id} className="relative">
                <div className={`timeline-dot ${item.status === 'fail' ? 'timeline-dot-pink' : ''} ${index === 0 ? 'animate-pulse' : ''}`}></div>
                <div className="bg-[#121225] border border-[#2a2a4a] rounded-lg p-3 flex justify-between items-center shadow-md">
                  <div>
                    <div className="text-xs text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" /> {item.time}
                    </div>
                    <div className="font-orbitron text-sm font-semibold tracking-wide">
                      ID: {item.player}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    <div className="font-orbitron font-bold text-white flex items-center gap-1">
                      +{item.amount} <Diamond className="w-3 h-3 fill-white/20 text-white" />
                    </div>
                    {item.status === 'success' ? (
                      <div className="flex items-center gap-1 text-xs text-cyan-400 font-semibold">
                        <CheckCircle2 className="w-3 h-3" /> SUCCÈS
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-pink-500 font-semibold text-glow-pink">
                        <XCircle className="w-3 h-3" /> ÉCHEC
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
