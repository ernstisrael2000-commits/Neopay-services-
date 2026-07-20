import React from 'react';
import { 
  ArrowUpRight, 
  ShoppingCart, 
  CheckCircle2, 
  XCircle, 
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  History,
  AlertCircle
} from 'lucide-react';

export function Minimaliste() {
  const balance = 4850;
  
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      <div style={{ width: '420px', minHeight: '860px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }} className="bg-slate-50 relative overflow-y-auto flex flex-col shadow-2xl ring-1 ring-black/5">
        
        {/* Header */}
        <div className="bg-white px-6 pt-12 pb-5 flex items-center justify-between border-b border-slate-100 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-lg shadow-inner">
              M
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Revendeur</p>
              <h1 className="text-lg font-bold text-slate-900 leading-tight tracking-tight">Mehdi</h1>
            </div>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider flex items-center gap-1.5 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ACTIF
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6 flex-1">
          {/* Balance */}
          <div className="flex flex-col items-center py-8 bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-slate-100/60 relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-indigo-400"></div>
            <p className="text-[11px] font-bold text-slate-400 mb-1.5 uppercase tracking-[0.2em]">Solde Actuel</p>
            <div className="flex items-center gap-2.5">
              <span className="text-[2.75rem] font-black text-slate-900 tracking-tighter leading-none">4 850</span>
              <span className="text-2xl mt-1 drop-shadow-sm" role="img" aria-label="diamond">💎</span>
            </div>
          </div>

          {/* Conditional Alert Example (Shown if balance was 0) */}
          {balance === 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">Solde épuisé</p>
                <p className="text-xs text-red-700 mt-1">Vous n'avez plus de diamants. Rechargez votre compte pour continuer à vendre.</p>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-[1rem] border border-slate-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)] flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-indigo-50 flex items-center justify-center mb-2.5">
                <TrendingUp size={16} className="text-indigo-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Vendus</p>
              <p className="text-[15px] font-bold text-slate-800 tracking-tight flex items-center gap-1">12.4k <span className="text-[10px]">💎</span></p>
            </div>
            
            <div className="bg-white p-4 rounded-[1rem] border border-slate-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)] flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-blue-50 flex items-center justify-center mb-2.5">
                <ShoppingCart size={16} className="text-blue-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Cmds</p>
              <p className="text-[15px] font-bold text-slate-800 tracking-tight">47</p>
            </div>
            
            <div className="bg-white p-4 rounded-[1rem] border border-slate-100 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.04)] flex flex-col items-center">
              <div className="h-8 w-8 rounded-full bg-emerald-50 flex items-center justify-center mb-2.5">
                <CheckCircle2 size={16} className="text-emerald-600" />
              </div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Succès</p>
              <p className="text-[15px] font-bold text-slate-800 tracking-tight">45</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 mt-1">
            <button className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold py-4 rounded-xl shadow-[0_4px_14px_0_rgba(79,70,229,0.3)] transition-all flex items-center justify-center gap-2">
              <ArrowUpRight size={20} strokeWidth={2.5} />
              <span className="tracking-wide">Recharger un joueur</span>
            </button>
            
            <div className="flex gap-3">
              <button className="flex-1 bg-white border-2 border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 active:bg-indigo-100 font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm">
                <CreditCard size={18} strokeWidth={2.5} />
                Acheter des parts
              </button>
              <div className="bg-slate-100 px-4 flex flex-col justify-center items-center rounded-xl border border-slate-200 min-w-[100px]">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fonds</p>
                <p className="text-[15px] font-black text-slate-800 tracking-tight">$120.00</p>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="mt-5 pb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-slate-900 flex items-center gap-2 tracking-tight">
                <History size={18} className="text-slate-400" />
                Transactions récentes
              </h2>
              <button className="text-[13px] font-semibold text-indigo-600 hover:text-indigo-700 flex items-center group">
                Tout voir <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] overflow-hidden">
              <div className="divide-y divide-slate-50">
                {/* Item 1 */}
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-lg font-medium text-slate-600">
                      J
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">ID: 123456789</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5 flex items-center gap-1">
                        Il y a 2h
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900 tracking-tight">+500 <span className="text-xs font-normal">💎</span></p>
                    <p className="text-[11px] font-bold text-emerald-500 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} strokeWidth={3} /> Succès
                    </p>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-lg font-medium text-slate-600">
                      P
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">ID: 987654321</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">Il y a 5h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900 tracking-tight">+1000 <span className="text-xs font-normal">💎</span></p>
                    <p className="text-[11px] font-bold text-emerald-500 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} strokeWidth={3} /> Succès
                    </p>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="p-4 flex items-center justify-between hover:bg-red-50/50 bg-white transition-colors cursor-pointer group relative">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-red-500"></div>
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-lg font-medium text-slate-600">
                      G
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">ID: 456789123</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">Hier</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-500 tracking-tight line-through opacity-70">+200 <span className="text-xs font-normal">💎</span></p>
                    <p className="text-[11px] font-bold text-red-500 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-wide">
                      <XCircle size={12} strokeWidth={3} /> Échec
                    </p>
                  </div>
                </div>

                {/* Item 4 */}
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-lg font-medium text-slate-600">
                      A
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">ID: 321654987</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">Il y a 2j</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900 tracking-tight">+2000 <span className="text-xs font-normal">💎</span></p>
                    <p className="text-[11px] font-bold text-emerald-500 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} strokeWidth={3} /> Succès
                    </p>
                  </div>
                </div>

                {/* Item 5 */}
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer group">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100 text-lg font-medium text-slate-600">
                      K
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 tracking-tight">ID: 741852963</p>
                      <p className="text-[11px] font-medium text-slate-400 mt-0.5">Il y a 3j</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[15px] font-bold text-slate-900 tracking-tight">+500 <span className="text-xs font-normal">💎</span></p>
                    <p className="text-[11px] font-bold text-emerald-500 mt-0.5 flex items-center justify-end gap-1 uppercase tracking-wide">
                      <CheckCircle2 size={12} strokeWidth={3} /> Succès
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </>
  );
}
