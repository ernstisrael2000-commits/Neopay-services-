import React from 'react';
import { Diamond, Zap, ShoppingCart, PackagePlus, History, CheckCircle2, XCircle, ChevronRight, TrendingUp, Clock, AlertCircle } from 'lucide-react';

export function NuitDoree() {
  // Simulating an empty balance for the alert design, but keeping the requested balance display.
  // We'll show a mocked "Low Balance" alert just to satisfy the need to have an alert in the design.
  const isBalanceLow = true; 

  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet" />
      <div 
        style={{
          width: '420px', 
          minHeight: '860px', 
          margin: '0 auto',
          fontFamily: "'Inter', sans-serif"
        }}
        className="bg-slate-950 text-slate-200 overflow-y-auto relative shadow-2xl"
      >
        {/* Background glow effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[300px] bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-[200px] h-[200px] bg-amber-600/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative z-10 p-6 flex flex-col gap-8">
          
          {/* Header */}
          <header className="flex justify-between items-center mt-2">
            <div>
              <p className="text-amber-500 text-xs font-semibold tracking-widest uppercase mb-1">Agent VIP</p>
              <h1 className="text-3xl text-white font-bold" style={{ fontFamily: "'Playfair Display', serif" }}>
                Mehdi
              </h1>
            </div>
            <div className="flex items-center gap-2 bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">Actif</span>
            </div>
          </header>

          {/* Balance Circle */}
          <section className="flex flex-col items-center justify-center my-4 relative">
            <div className="relative flex items-center justify-center w-56 h-56 rounded-full bg-slate-900 border border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.15)]">
              {/* Inner glow */}
              <div className="absolute inset-2 rounded-full border border-amber-400/10 bg-gradient-to-b from-white/5 to-transparent" />
              
              <div className="text-center z-10 flex flex-col items-center">
                <Diamond className="w-10 h-10 text-amber-400 mb-2 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
                <span className="text-5xl font-bold text-white tracking-tight" style={{ fontFamily: "'Playfair Display', serif" }}>
                  4 850
                </span>
                <span className="text-xs text-slate-400 mt-2 uppercase tracking-wider font-medium">
                  Diamants
                </span>
              </div>
            </div>
          </section>

          {/* Conditional Alert */}
          {isBalanceLow && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-red-500 font-medium text-sm">Solde insuffisant</h3>
                <p className="text-red-400/80 text-xs mt-1 leading-relaxed">
                  Votre solde de diamants est critique. Achetez des parts pour continuer à recharger les joueurs.
                </p>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <section className="grid grid-cols-3 gap-3">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <TrendingUp className="w-4 h-4 text-amber-500 mb-2" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Vendus</span>
              <span className="text-white font-semibold text-sm">12.4k 💎</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <ShoppingCart className="w-4 h-4 text-amber-500 mb-2" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Cmds</span>
              <span className="text-white font-semibold text-sm">47</span>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="w-4 h-4 text-amber-500 mb-2" />
              <span className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">Succès</span>
              <span className="text-white font-semibold text-sm">45</span>
            </div>
          </section>

          {/* Action Buttons */}
          <section className="flex flex-col gap-4 mt-2">
            <button className="relative w-full group overflow-hidden rounded-2xl p-[1px] active:scale-[0.98] transition-transform duration-300">
              <span className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 rounded-2xl" />
              <div className="relative bg-gradient-to-r from-amber-500 to-amber-600 px-6 py-[18px] rounded-2xl flex items-center justify-center gap-3">
                <Zap className="w-5 h-5 text-amber-950 fill-amber-950" />
                <span className="text-amber-950 font-semibold text-[17px] tracking-wide" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Recharger un joueur
                </span>
              </div>
            </button>
            
            <button className="w-full bg-transparent border border-white/20 hover:bg-white/5 transition-colors px-6 py-4 rounded-2xl flex items-center justify-between group active:scale-[0.98] duration-300">
              <div className="flex items-center gap-3">
                <PackagePlus className="w-5 h-5 text-amber-500" />
                <span className="text-white font-medium tracking-wide" style={{ fontFamily: "'Playfair Display', serif" }}>Acheter des parts</span>
              </div>
              <span className="text-amber-500/80 text-xs font-semibold bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20 uppercase tracking-widest">
                Solde: $120.00
              </span>
            </button>
          </section>

          {/* History */}
          <section className="mt-4 mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl text-white font-semibold flex items-center gap-2" style={{ fontFamily: "'Playfair Display', serif" }}>
                <History className="w-5 h-5 text-amber-500" />
                Transactions
              </h2>
              <button className="text-[10px] text-amber-500 hover:text-amber-400 font-bold uppercase tracking-widest transition-colors">
                Voir tout
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              {[
                { id: '123456789', amount: '+500', status: 'success', time: 'il y a 2h' },
                { id: '987654321', amount: '+1000', status: 'success', time: 'il y a 5h' },
                { id: '456789123', amount: '+200', status: 'failed', time: 'hier' },
                { id: '321654987', amount: '+2000', status: 'success', time: 'il y a 2j' },
                { id: '741852963', amount: '+500', status: 'success', time: 'il y a 3j' },
              ].map((tx, idx) => (
                <div key={idx} className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-full ${tx.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {tx.status === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-slate-200 font-medium text-sm">Joueur {tx.id}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-slate-400/80 text-[11px] font-medium tracking-wide uppercase">
                        <Clock className="w-3 h-3" />
                        <span>{tx.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`font-semibold text-[15px] ${tx.status === 'success' ? 'text-amber-500' : 'text-slate-500'}`}>
                      {tx.amount}
                    </span>
                    <Diamond className={`w-3.5 h-3.5 ${tx.status === 'success' ? 'text-amber-500' : 'text-slate-500'}`} />
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
