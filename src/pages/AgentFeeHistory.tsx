import React, { useState, useEffect } from 'react';
import { Loader2, History, TrendingUp, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

interface FeeRecord {
  id: string;
  agentCode: string;
  agentName: string;
  clientName: string;
  operationType: 'deposit' | 'withdrawal';
  baseAmount: number;
  feeTotal: number;
  agentShare: number;
  adminShare: number;
  createdAt: any;
}

export default function AgentFeeHistory() {
  const [records, setRecords] = useState<FeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/admin/agent-fee-records')
      .then(r => r.json())
      .then(d => setRecords(d.records || []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false));
  }, [open]);

  const totalAdminShare = records.reduce((s, r) => s + (r.adminShare || 0), 0);
  const totalAgentShare = records.reduce((s, r) => s + (r.agentShare || 0), 0);
  const totalFees = records.reduce((s, r) => s + (r.feeTotal || 0), 0);

  const formatDate = (ts: any) => {
    if (!ts) return '—';
    const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="pt-4 border-t border-dashed border-gray-200 space-y-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between text-left group"
      >
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5">
          <History className="h-3.5 w-3.5" />
          Historique des frais agent
        </p>
        <span className="text-[10px] font-bold text-primary group-hover:underline">
          {open ? 'Masquer' : 'Afficher'}
        </span>
      </button>

      {open && (
        <Card className="rounded-2xl border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              Aucun enregistrement de frais pour le moment.
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-3 gap-3 p-4 bg-gray-50 border-b">
                <div className="text-center">
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Total Frais</p>
                  <p className="text-base font-black text-gray-700">${totalFees.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Part Agents</p>
                  <p className="text-base font-black text-amber-600">${totalAgentShare.toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Part Admin</p>
                  <p className="text-base font-black text-emerald-700">${totalAdminShare.toFixed(2)}</p>
                </div>
              </div>

              {/* Records table */}
              <div className="overflow-x-auto max-h-64 overflow-y-auto custom-scrollbar">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-black text-gray-400 uppercase tracking-wide text-[9px]">Date</th>
                      <th className="text-left px-3 py-2 font-black text-gray-400 uppercase tracking-wide text-[9px]">Agent</th>
                      <th className="text-left px-3 py-2 font-black text-gray-400 uppercase tracking-wide text-[9px]">Client</th>
                      <th className="text-center px-3 py-2 font-black text-gray-400 uppercase tracking-wide text-[9px]">Op.</th>
                      <th className="text-right px-3 py-2 font-black text-gray-400 uppercase tracking-wide text-[9px]">Montant</th>
                      <th className="text-right px-3 py-2 font-black text-amber-500 uppercase tracking-wide text-[9px]">Agent</th>
                      <th className="text-right px-3 py-2 font-black text-emerald-600 uppercase tracking-wide text-[9px]">Admin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r, i) => (
                      <tr key={r.id || i} className="border-t border-gray-50 hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400 text-[10px] whitespace-nowrap">{formatDate(r.createdAt)}</td>
                        <td className="px-3 py-2 font-bold text-gray-700 text-[10px]">{r.agentName || r.agentCode}</td>
                        <td className="px-3 py-2 text-gray-500 text-[10px]">{r.clientName}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                            r.operationType === 'deposit'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-orange-50 text-orange-600'
                          }`}>
                            {r.operationType === 'deposit' ? 'Dépôt' : 'Retrait'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-gray-700 text-[10px]">${(r.baseAmount || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-black text-amber-600 text-[10px]">+${(r.agentShare || 0).toFixed(4)}</td>
                        <td className="px-3 py-2 text-right font-black text-emerald-600 text-[10px]">+${(r.adminShare || 0).toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
