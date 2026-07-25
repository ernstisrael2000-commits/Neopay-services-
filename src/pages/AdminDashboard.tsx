import React, { useState, useEffect, useDeferredValue, useCallback, useRef } from 'react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useUniversalFCM } from '../hooks/useUniversalFCM';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator
} from '../components/ui/dropdown-menu';
import { Smartphone, Plus, Search, CreditCard as Edit2, Trash2, Package, MoveVertical as MoreVertical, CircleCheck as CheckCircle2, Truck, Clock, CircleAlert as AlertCircle, TriangleAlert as AlertTriangle, Loader as Loader2, Upload, Trash, Settings as SettingsIcon, LayoutGrid, Landmark, Image as ImageIcon, CreditCard as Edit, CirclePlus as PlusCircle, X, Wallet, Users, Trophy, Gamepad2, Bell, ListFilter as Filter, ArrowUpDown, DollarSign, ArrowUp, ArrowDown, CreditCard, UserCheck, Circle as HelpCircle, Zap, Star, ChevronRight, ChevronLeft, ArrowRight, ArrowRightLeft, Network, TrendingUp, LayoutDashboard, Circle as XCircle, Globe, Pencil } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription,
  DialogClose
} from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Checkbox } from '../components/ui/checkbox';
import AdminCatalogCommissions from '../components/AdminCatalogCommissions';
import AdminContestManager from '../components/AdminContestManager';
import FazerPriceManager from '../components/FazerPriceManager';
import { useParcels, saveParcel, uploadProof, deleteParcel, useProducts, saveProduct, deleteProduct, updateSettings, uploadLogo, useGames, saveGame, deleteGame, useCardTopups, saveCardTopup, deleteCardTopup, useSliderImages, saveSliderImage, deleteSliderImage, updateSliderImage, useNavButtons, saveNavButton, deleteNavButton, useOnlineServices, saveOnlineSubService, deleteOnlineSubService, useAdminFormations, saveAdminFormation, deleteAdminFormation } from '../services/parcelService';
import { useSettingsCtx } from '../contexts/SettingsContext';
import { 
  useAllAffiliates, 
  useAllWithdrawals, 
  saveAffiliate, 
  updateWithdrawalStatus, 
  deleteAffiliate, 
  useAllAffiliateRequests, 
  updateAffiliateRequestStatus, 
  resetMonthlyStats, 
  awardMonthlyPrizes, 
  clearMonthlyWinners, 
  useMonthlyRankings, 
  searchAffiliatesByName, 
  getAffiliateReferrals,
  useAllClients,
  saveClient,
  deleteClient,
  searchClientsByPhone,
  useAllWalletTransactions,
  updateWalletTransactionStatus,
  approveTransfer,
  rejectTransfer
} from '../services/affiliateService';
import { useAdminAccounts, useAdminLogs, saveAdminAccount, deleteAdminAccount } from '../services/adminService';
import { 
  useAllAgents,
  createAgent,
  updateAgentBalance
} from '../services/agentService';
import { Parcel, ParcelStatus, PaymentStatus, Product, AppSettings, Affiliate, WithdrawalRequest, AffiliateRequest, Game, CardTopup, CardFeeRule, NavButton, AdminAccount, Client, Agent, WalletTransaction, ClientTransaction, AdminClientNotification, OnlineSubService, Formation, FormationModule, FormationChapter, FormationResource } from '../types';
import { useAllClientTransactions, updateClientTransactionStatus, useAdminClientNotifications, markAdminNotificationRead, markAllAdminNotificationsRead, clearAllAdminNotifications, approvePurchaseRequest, declinePurchaseRequest, usePromoCodes, savePromoCode, deletePromoCode } from '../services/clientService';
import AdminShippingManager from './AdminShippingManager';
import AdminWalletManager from './AdminWalletManager';
import AgentFeeHistory from './AgentFeeHistory';
import PinSetupModal from '../components/PinSetupModal';
import PinEntryModal from '../components/PinEntryModal';
import { usePinGuard } from '../hooks/usePinGuard';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Timestamp, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Shield, ShieldAlert as ShieldAlertIcon, History, ShoppingBag, SquareCheck as CheckSquare } from 'lucide-react';

// Helper for image compression
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas to Blob failed'));
          },
          'image/jpeg',
          0.7 // quality
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const LucideIcon = ({ name, className, color }: { name: string, className?: string, color?: string }) => {
  const Icon = (LucideIcons as any)[name] || HelpCircle;
  return <Icon className={className} style={{ color }} />;
};

const generatePDFReport = (stats: any) => {
  const doc = new jsPDF() as any;
  const now = new Date();
  const dateStr = format(now, 'dd/MM/yyyy HH:mm');
  const primaryColor: [number, number, number] = [37, 99, 235]; // #F5A623
  const navyColor: [number, number, number] = [26, 31, 60]; // #1a1f3c
  const greyColor: [number, number, number] = [107, 114, 128]; // #6b7280

  // 1. Header with styling
  doc.setFillColor(...navyColor);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('RENA', 14, 20);
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('RAPPORT D\'INTELLIGENCE ET PERFORMANCE', 14, 30);
  
  doc.setFontSize(10);
  doc.text(`Période : ${format(now, 'MMMM yyyy', { locale: fr }).toUpperCase()}`, 160, 20);
  doc.text(`Généré le : ${dateStr}`, 160, 30);

  // 2. Financial Highlights Section
  doc.setTextColor(...navyColor);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('1. PERFORMANCE FINANCIÈRE', 14, 55);
  doc.setLineWidth(0.5);
  doc.setDrawColor(...primaryColor);
  doc.line(14, 58, 60, 58);

  autoTable(doc, {
    startY: 65,
    head: [['Indicateur', 'Montant (HTG)', 'Description']],
    body: [
      ['Revenu Brut (Estimé)', `${(stats?.totalRevenue || 0).toLocaleString()} HTG`, 'Total des ventes enregistrées'],
      ['Profit Net (Estimé)', `${(stats?.totalProfit || 0).toLocaleString()} HTG`, 'Marge nette estimée (40%)'],
      ['Budget Admins (Provision)', `${(stats?.adminBudget || 0).toLocaleString()} HTG`, 'Total alloué aux salaires administrateurs'],
      ['Retraits Affiliés', `${(stats?.totalWithdrawals || 0).toLocaleString()} HTG`, 'Commissions payées/en attente']
    ],
    theme: 'grid',
    headStyles: { fillColor: navyColor, textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 5 },
    columnStyles: { 
      1: { fontStyle: 'bold', halign: 'right', textColor: primaryColor }
    }
  });

  // 3. Operations & Statistics Section
  const financialY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(18);
  doc.setTextColor(...navyColor);
  doc.text('2. OPÉRATIONS ET STATISTIQUES', 14, financialY + 15);
  doc.line(14, financialY + 18, 60, financialY + 18);

  autoTable(doc, {
    startY: financialY + 25,
    head: [['Catégorie', 'Volume / Quantité']],
    body: [
      ['Total des Colis gérés', stats?.totalParcels || 0],
      ['Total des Affiliés actifs', stats?.totalAffiliates || 0],
      ['Colis livrés avec succès', stats?.totalParcels - (stats?.stuckParcels?.length || 0)],
      ['Produits en rupture/stock faible', stats?.lowStockItems?.length || 0]
    ],
    theme: 'striped',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 }
  });

  // 4. Detailed analysis Section
  const operationsY = (doc as any).lastAutoTable.finalY || 180;
  
  // Create two columns for Top Products and Market Analysis
  doc.setFontSize(16);
  doc.text('3. ANALYSE DÉTAILLÉE', 14, operationsY + 15);
  
  autoTable(doc, {
    startY: operationsY + 20,
    head: [['Produits les plus vendus', 'Volume']],
    body: (stats?.topProducts || []).map((p: any) => [p.name || 'Inconnu', p.value || 0]),
    margin: { right: 107 },
    headStyles: { fillColor: [40, 40, 40] }
  });

  autoTable(doc, {
    startY: operationsY + 20,
    head: [['Alertes Critiques', 'Gravité']],
    body: [
      ...(stats?.stuckParcels || []).slice(0, 3).map((p: any) => [`Colis bloqué : ${p.trackingNumber}`, 'ÉLEVÉ']),
      ...(stats?.lowStockItems || []).slice(0, 3).map((i: any) => [`Stock faible : ${i.name}`, 'MOYEN']),
      ...(stats?.suspiciousWithdrawals || []).slice(0, 3).map((w: any) => [`Retrait suspect : ${w.affiliateName}`, 'CRITIQUE'])
    ].slice(0, 5),
    margin: { left: 107 },
    headStyles: { fillColor: [239, 68, 68] },
    columnStyles: { 1: { fontStyle: 'bold', halign: 'center' } }
  });

  // 5. Footer
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...greyColor);
    doc.text('Rena - Report Generated Automatically - Highly Confidential', 14, 285);
    doc.text(`Page ${i} of ${totalPages}`, 190, 285);
  }

  doc.save(`RAPPORT_RENA_INTELLIGENCE_${format(now, 'yyyy_MM_dd')}.pdf`);
  toast.success("Rapport professionnel généré avec succès !");
};


interface AdminDashboardProps {
  admin: AdminAccount;
  onLogout: () => void;
}

const IntelligenceSearch = React.memo(({ onSearch, isSearching }: { onSearch: (query: string) => void, isSearching: boolean }) => {
  const [localInput, setLocalInput] = useState('');
  
  return (
    <div className="space-y-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-10 bg-white rounded-[3rem] border border-gray-100 shadow-xl overflow-hidden relative"
      >
        <div className="absolute top-0 right-0 h-40 w-40 bg-primary/5 rounded-bl-full -mr-10 -mt-10"></div>
        <div className="relative z-10">
           <div className="flex items-center gap-4 mb-6">
             <div className="p-3 rounded-2xl bg-navy text-primary shadow-lg shadow-navy/20">
               <LucideIcons.Search className="h-6 w-6" />
             </div>
             <div>
               <h3 className="text-3xl font-black text-dark tracking-tight">Analyseur de Réseau</h3>
               <p className="text-gray-400 font-medium">Visualisez la généalogie complète et la performance d'un affilié.</p>
             </div>
           </div>

           <div className="relative flex flex-col sm:flex-row gap-4">
             <div className="relative flex-1">
               <LucideIcons.Search className="absolute left-5 top-1/2 -translate-y-1/2 h-6 w-6 text-gray-400" />
               <Input 
                 placeholder="Nom, identifiant ou code de l'affilié..." 
                 className="pl-14 h-16 rounded-2xl border-gray-200 focus:ring-primary shadow-inner bg-gray-50/50 text-xl font-bold placeholder:text-gray-300"
                 value={localInput}
                 onChange={(e) => setLocalInput(e.target.value)}
                 onKeyPress={(e) => e.key === 'Enter' && onSearch(localInput)}
               />
             </div>
             <Button 
               onClick={() => onSearch(localInput)}
               disabled={isSearching || !localInput.trim()}
               className="h-16 px-12 rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white font-black text-lg shadow-xl shadow-primary/30 border-0 transition-all active:scale-95 flex items-center justify-center gap-3"
             >
               {isSearching ? <LucideIcons.Loader2 className="h-6 w-6 animate-spin" /> : <LucideIcons.Network className="h-6 w-6" />}
               Déployer l'Analyse
             </Button>
           </div>
        </div>
      </motion.div>
    </div>
  );
});

const ClientsTableBody = React.memo(({ 
  clients, 
  searchQuery, 
  affiliates, 
  onEdit, 
  onDelete 
}: { 
  clients: any[], 
  searchQuery: string, 
  affiliates: any[], 
  onEdit: (c: any) => void, 
  onDelete: (c: any) => void 
}) => {
  const filtered = React.useMemo(() => {
    return clients.filter(c => 
      c.phone.includes(searchQuery) || 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [clients, searchQuery]);

  return (
    <>
      {filtered.map((client) => (
        <TableRow key={client.id} className="hover:bg-gray-50/50 border-gray-50 group">
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-light text-primary flex items-center justify-center font-black">
                {client.name.charAt(0)}
              </div>
              <span className="font-bold text-dark">{client.name}</span>
            </div>
          </TableCell>
          <TableCell className="font-bold text-primary">{client.phone}</TableCell>
          <TableCell>
            {client.directSponsorId ? (
               <div className="flex items-center gap-2">
                 <div className="h-6 w-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black">
                   {affiliates.find(a => a.id === client.directSponsorId)?.name.charAt(0)}
                 </div>
                 <span className="text-sm font-medium">{affiliates.find(a => a.id === client.directSponsorId)?.name || 'Inconnu'}</span>
               </div>
            ) : (
              <span className="text-xs text-gray-300 italic">Aucun</span>
            )}
          </TableCell>
          <TableCell>
            {client.indirectSponsorId ? (
               <div className="flex items-center gap-2">
                 <div className="h-6 w-6 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] font-black">
                   {affiliates.find(a => a.id === client.indirectSponsorId)?.name.charAt(0)}
                 </div>
                 <span className="text-sm font-medium">{affiliates.find(a => a.id === client.indirectSponsorId)?.name || 'Inconnu'}</span>
               </div>
            ) : (
              <span className="text-xs text-gray-300 italic">Aucun</span>
            )}
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                onClick={() => onEdit(client)}
              >
                <LucideIcons.Edit2 className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 rounded-lg hover:bg-red-50 text-red-500"
                onClick={() => onDelete(client)}
              >
                <LucideIcons.Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
});

const AffiliateTableBody = React.memo(({ 
  affiliates, 
  searchQuery, 
  onEdit, 
  onDelete 
}: { 
  affiliates: any[], 
  searchQuery: string, 
  onEdit: (a: any) => void, 
  onDelete: (a: any) => void 
}) => {
  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) return affiliates;
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    return affiliates.filter(a => {
      const fullName = (a.name || '').toLowerCase();
      const code = (a.code || '').toLowerCase();
      const username = (a.username || '').toLowerCase();
      const combined = `${fullName} ${code} ${username}`;
      return searchTerms.every(term => combined.includes(term));
    });
  }, [affiliates, searchQuery]);

  return (
    <>
      {filtered.map((a) => (
        <TableRow key={a.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer group" onClick={() => onEdit(a)}>
          <TableCell>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-accent-light text-primary flex items-center justify-center font-black">
                {a.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-dark">{a.name}</p>
                <p className="text-[10px] text-gray-400 font-mono">@{a.username}</p>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs text-primary font-bold">{a.code}</span>
              <Badge variant="outline" className={`text-[9px] w-fit font-black ${
                a.level === 'Elite' ? 'border-orange-200 text-orange-600 bg-orange-50' :
                a.level === 'VIP' ? 'border-purple-200 text-purple-600 bg-purple-50' :
                'border-gray-200 text-gray-500 bg-gray-50'
              }`}>
                {a.level || 'Bronze'}
              </Badge>
            </div>
          </TableCell>
          <TableCell>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LucideIcons.Trophy className="h-3 w-3 text-primary" />
                <span className="text-xs font-bold text-dark">{a.points || 0} pts</span>
              </div>
              <div className="flex items-center gap-2">
                <LucideIcons.Users className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] text-gray-500">{a.referredClients} référés</span>
              </div>
            </div>
          </TableCell>
          <TableCell>
            <p className="font-black text-emerald-600">{a.balance} $</p>
            <p className="text-[9px] text-gray-400 uppercase font-bold tracking-tight">Solde dispo</p>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-accent-light hover:text-primary" onClick={() => onEdit(a)}>
                <LucideIcons.Edit2 className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-red-500 hover:bg-red-50" onClick={() => onDelete(a)}>
                <LucideIcons.Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    </>
  );
});

const AffiliateGridView = React.memo(({ 
  affiliates, 
  searchQuery, 
  onEdit,
  onCredit,
  onSale,
  settings
}: { 
  affiliates: any[], 
  searchQuery: string, 
  onEdit: (a: any) => void,
  onCredit: (a: any) => void,
  onSale: (a: any) => void,
  settings: any
}) => {
  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) return affiliates;
    const searchTerms = searchQuery.toLowerCase().trim().split(/\s+/);
    return affiliates.filter(a => {
      const fullName = (a.name || '').toLowerCase();
      const code = (a.code || '').toLowerCase();
      const username = (a.username || '').toLowerCase();
      const combined = `${fullName} ${code} ${username}`;
      return searchTerms.every(term => combined.includes(term));
    });
  }, [affiliates, searchQuery]);

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-h-[600px] overflow-y-auto custom-scrollbar">
      {filtered.map((a) => (
        <motion.div
           key={a.id}
           initial={{ opacity: 0, scale: 0.95 }}
           animate={{ opacity: 1, scale: 1 }}
           whileHover={{ y: -4 }}
           className="group relative"
        >
           <Card 
             className="border-0 shadow-sm rounded-3xl overflow-hidden cursor-pointer bg-white border border-gray-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300"
             onClick={() => onEdit(a)}
           >
             <CardContent className="p-5">
               <div className="flex items-start justify-between mb-4">
                 <div className="flex items-center gap-3">
                   <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent-light flex items-center justify-center text-primary font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                     {a.name.charAt(0)}
                   </div>
                   <div>
                     <h4 className="font-black text-dark group-hover:text-primary transition-colors truncate max-w-[120px]">{a.name}</h4>
                     <p className="text-[10px] text-primary font-black tracking-widest uppercase">{a.level || 'Bronze'}</p>
                     <p className="text-[10px] text-gray-400 font-mono mt-0.5">{a.code}</p>
                   </div>
                 </div>
                 <div className="text-right">
                   <p className="text-lg font-black text-emerald-600 leading-tight">{a.balance} $</p>
                   <p className="text-[9px] text-gray-400 uppercase font-black">≈ {((a.balance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                 </div>
               </div>

               <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-50 mb-3">
                  <div className="text-center">
                    <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Points</p>
                    <p className="text-xs font-black text-dark">{a.points || 0}</p>
                  </div>
                  <div className="text-center border-x">
                    <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Ventes</p>
                    <p className="text-xs font-black text-dark">{a.monthlySales || 0}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Référés</p>
                    <p className="text-xs font-black text-dark">{a.referredClients || 0}</p>
                  </div>
               </div>

               <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 p-0 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                    onClick={() => onCredit(a)}
                  >
                    <LucideIcons.PlusCircle className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-9 w-9 p-0 rounded-xl bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => onSale(a)}
                  >
                    <LucideIcons.DollarSign className="h-4 w-4" />
                  </Button>
               </div>
             </CardContent>
           </Card>
        </motion.div>
      ))}
    </div>
  );
});

const ClientsSearchHeader = React.memo(({ 
  searchQuery, 
  onSearchChange,
  totalClients
}: { 
  searchQuery: string, 
  onSearchChange: (v: string) => void,
  totalClients: number
}) => {
  const [localValue, setLocalValue] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onSearchChange]);

  return (
    <div className="p-6 border-b border-gray-50 bg-gray-50/30 flex flex-col sm:flex-row gap-4 justify-between items-center">
      <div className="relative w-full sm:w-96">
        <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Chercher par numéro..." 
          className="pl-10 h-11 rounded-xl border-gray-200"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
        />
      </div>
      <p className="text-xs font-black text-gray-400 uppercase tracking-widest">{totalClients} Clients Enregistrés</p>
    </div>
  );
});

const AffiliateSearchHeader = React.memo(({ 
  searchQuery, 
  onSearchChange,
  viewMode,
  onViewModeChange
}: { 
  searchQuery: string, 
  onSearchChange: (v: string) => void,
  viewMode: 'table' | 'grid',
  onViewModeChange: (m: 'table' | 'grid') => void
}) => {
  const [localValue, setLocalValue] = useState(searchQuery);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearchChange(localValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [localValue, onSearchChange]);

  return (
    <CardHeader className="border-b bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
      <div className="flex items-center gap-2">
        <CardTitle className="text-lg font-semibold">Répertoire des Affiliés</CardTitle>
        <div className="flex bg-gray-100 p-1 rounded-lg ml-2">
          <button 
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LucideIcons.Table className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onViewModeChange('grid')}
            className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <LucideIcons.LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="relative w-full sm:w-72">
        <LucideIcons.Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Chercher un affilié..." 
          className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-primary shadow-sm"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
        />
      </div>
    </CardHeader>
  );
});

// ── Purchase notification card with Approve / Decline ────────────────────────
function PurchaseNotifCard({
  notif,
  onApprove,
  onDecline,
}: {
  notif: AdminClientNotification;
  onApprove: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [approving, setApproving] = React.useState(false);
  const [declining, setDeclining] = React.useState(false);
  const busy = approving || declining;

  const openWhatsApp = (phone: string, msg: string) => {
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm overflow-hidden flex flex-col">
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-3 flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white text-xs uppercase tracking-widest">Services payée</p>
          <p className="font-black text-white text-sm truncate">{notif.clientName}</p>
          <p className="text-emerald-100 text-[10px] font-mono">#{(notif as any).clientWalletId}</p>
        </div>
        <span className="shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 animate-pulse">
          EN ATTENTE
        </span>
      </div>
      <div className="px-4 py-3 flex-1 space-y-2">
        <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-100">
          <ShoppingBag className="h-4 w-4 text-gray-400 shrink-0" />
          <p className="font-black text-dark text-sm truncate">{(notif as any).productName || 'Service'}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100">
            <p className="text-emerald-600 font-bold text-[10px] uppercase">Montant</p>
            <p className="font-black text-emerald-700 text-sm">{notif.amount.toLocaleString()} HTG</p>
          </div>
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-100">
            <p className="text-blue-600 font-bold text-[10px] uppercase">Prix affiché</p>
            <p className="font-black text-blue-700 text-sm truncate">{(notif as any).productPrice || '—'}</p>
          </div>
        </div>
        {(notif as any).clientPhone && (
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span className="font-mono bg-gray-50 px-2 py-0.5 rounded-lg border">{(notif as any).clientPhone}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>{notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr }) : ''}</span>
          {(notif as any).directSponsorId && (
            <span className="inline-flex items-center gap-1 font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
              ✓ Commission envoyée
            </span>
          )}
        </div>
      </div>
      <div className="px-4 pb-4 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          disabled={busy}
          className="h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs border-0 flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 transition-all active:scale-95"
          onClick={async () => {
            setApproving(true);
            await onApprove();
            setApproving(false);
            const phone = (notif as any).clientPhone;
            if (phone) {
              const msg = `✅ Bonjour ${notif.clientName},\n\nVotre service *${(notif as any).productName || 'Service'}* au prix de *${notif.amount.toLocaleString()} HTG* a été *approuvé* et sera traité immédiatement.\n\nMerci de votre confiance — Équipe Rena 🙏`;
              openWhatsApp(phone, msg);
            }
          }}
        >
          {approving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckSquare className="h-3.5 w-3.5" />}
          Approuver
        </Button>
        <Button
          size="sm"
          disabled={busy}
          variant="outline"
          className="h-10 rounded-xl border-red-200 text-red-600 hover:bg-red-50 font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95"
          onClick={async () => { setDeclining(true); await onDecline(); setDeclining(false); }}
        >
          {declining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Décliner
        </Button>
      </div>
    </div>
  );
}


// ─── AiChatPanel ──────────────────────────────────────────────────────────────
interface ChatMessage { role: 'user' | 'assistant'; content: string; id: string; }

const CHAT_SUGGESTIONS = [
  'Comment ajouter une nouvelle route API sécurisée ?',
  'Comment optimiser une requête Firestore lente ?',
  'Quelle est la meilleure façon de gérer les erreurs dans Express ?',
  'Comment créer un nouveau hook React pour ce projet ?',
  'Explique la structure d\'authentification de ce projet',
  'Comment ajouter un envoi d\'email automatique ?',
];

function AiChatPanel() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // ── Clé Groq ──────────────────────────────────────────────────────────────
  const [showKeyConfig, setShowKeyConfig] = React.useState(false);
  const [keyInput, setKeyInput] = React.useState('');
  const [savedKey, setSavedKey] = React.useState(() => sessionStorage.getItem('chat_groq_key') || '');
  const [keyVisible, setKeyVisible] = React.useState(false);

  const saveKey = () => {
    const k = keyInput.trim();
    if (!k) return;
    sessionStorage.setItem('chat_groq_key', k);
    setSavedKey(k);
    setKeyInput('');
    setShowKeyConfig(false);
    setError('');
  };
  const clearKey = () => {
    sessionStorage.removeItem('chat_groq_key');
    setSavedKey('');
    setKeyInput('');
  };

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      setCopiedId(id); setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput('');
    setError('');
    const userMsg: ChatMessage = { role: 'user', content, id: Date.now().toString() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);
    try {
      const body: Record<string, any> = { messages: newMessages.map(({ role, content }) => ({ role, content })) };
      if (savedKey) body.apiKey = savedKey;
      const res = await fetch('/api/admin/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur');
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply, id: (Date.now() + 1).toString() };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  // Render markdown with code blocks + copy buttons
  const renderChatMarkdown = (text: string, msgId: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inCode = false, codeLines: string[] = [], codeLang = '', codeIdx = 0;

    lines.forEach((line, i) => {
      if (line.startsWith('```')) {
        if (!inCode) { inCode = true; codeLines = []; codeLang = line.slice(3).trim(); }
        else {
          inCode = false;
          const codeText = codeLines.join('\n');
          const copyKey = `${msgId}-code-${codeIdx++}`;
          elements.push(
            <div key={i} className="relative my-2 group/code">
              <pre className="bg-gray-950 text-green-300 rounded-xl p-4 overflow-x-auto text-[11px] font-mono leading-relaxed pr-14">
                {codeLang && <span className="text-[9px] text-gray-500 uppercase block mb-1">{codeLang}</span>}
                <code>{codeText}</code>
              </pre>
              <button onClick={() => copyText(codeText, copyKey)}
                className="absolute top-2 right-2 opacity-0 group-hover/code:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-[10px] font-black text-gray-300 hover:text-white transition-all">
                {copiedId === copyKey ? <><LucideIcons.Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Copié</span></> : <><LucideIcons.Copy className="h-3 w-3" />Copier</>}
              </button>
            </div>
          );
          codeLines = [];
        }
        return;
      }
      if (inCode) { codeLines.push(line); return; }
      if (line.startsWith('## ')) { elements.push(<h3 key={i} className="text-sm font-black text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200 first:mt-0">{line.slice(3)}</h3>); return; }
      if (line.startsWith('### ')) { elements.push(<h4 key={i} className="text-xs font-black text-gray-700 mt-3 mb-1">{line.slice(4)}</h4>); return; }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        const html = line.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-white/60 text-violet-700 px-1 rounded text-[10px] font-mono">$1</code>');
        elements.push(<li key={i} className="text-xs text-gray-700 ml-4 list-disc leading-relaxed my-0.5" dangerouslySetInnerHTML={{ __html: html }} />);
        return;
      }
      if (line.trim() === '') { elements.push(<div key={i} className="h-1.5" />); return; }
      const html = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-white/60 text-violet-700 px-1 rounded text-[10px] font-mono">$1</code>');
      elements.push(<p key={i} className="text-xs text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />);
    });
    return elements;
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col max-w-3xl mx-auto w-full" style={{ height: 'clamp(420px, 70dvh, 820px)' }}>

      {/* Header */}
      <div className="flex-shrink-0 space-y-3 pb-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-200 flex-shrink-0">
              <LucideIcons.MessageSquareCode className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Chat Dev IA</h2>
              <p className="text-[10px] text-gray-400 flex items-center gap-1.5">
                Développeur senior — connaît votre projet Rena
                {savedKey && <span className="inline-flex items-center gap-0.5 text-emerald-600 font-black"><LucideIcons.KeyRound className="h-2.5 w-2.5" />Clé active</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => { setShowKeyConfig(v => !v); setError(''); }}
              title={savedKey ? 'Clé Groq configurée' : 'Configurer la clé Groq'}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border-2 text-[10px] font-black transition-all ${
                showKeyConfig
                  ? 'border-violet-400 bg-violet-50 text-violet-700'
                  : savedKey
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 text-gray-500 hover:border-violet-300'
              }`}
            >
              <LucideIcons.KeyRound className="h-3 w-3" />
              <span className="hidden sm:inline">{savedKey ? 'Clé Groq ✓' : 'Clé Groq'}</span>
              {savedKey && <span className="sm:hidden text-emerald-600">✓</span>}
            </button>
            {messages.length > 0 && (
              <button onClick={() => { setMessages([]); setError(''); }}
                title="Effacer la conversation"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border-2 border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 text-[10px] font-black transition-all">
                <LucideIcons.Trash2 className="h-3 w-3" />
                <span className="hidden sm:inline">Effacer</span>
              </button>
            )}
          </div>
        </div>

        {/* Key config panel */}
        {showKeyConfig && (
          <div className="rounded-2xl border-2 border-violet-200 bg-violet-50/60 p-4 space-y-3">
            <div>
              <p className="text-xs font-black text-gray-800">Clé API Groq</p>
              <p className="text-[10px] text-gray-500 mt-0.5">
                Obtenez une clé gratuite sur{' '}
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener" className="text-violet-600 font-bold underline">console.groq.com/keys</a>.
                Elle est stockée uniquement en mémoire de session (effacée à la fermeture du navigateur).
              </p>
            </div>
            {savedKey ? (
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white border-2 border-emerald-200">
                  <LucideIcons.CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <span className="text-[11px] font-mono text-gray-600">
                    {keyVisible ? savedKey : savedKey.slice(0, 8) + '••••••••' + savedKey.slice(-4)}
                  </span>
                  <button onClick={() => setKeyVisible(v => !v)} className="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
                    {keyVisible ? <LucideIcons.EyeOff className="h-3.5 w-3.5" /> : <LucideIcons.Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <button onClick={clearKey}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 text-[10px] font-black transition-all">
                  <LucideIcons.Trash2 className="h-3 w-3" /> Supprimer
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="password"
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveKey()}
                  placeholder="gsk_…"
                  className="flex-1 h-9 rounded-xl border-2 border-gray-200 bg-white px-3 text-xs font-mono focus:outline-none focus:border-violet-400 transition-all"
                />
                <button onClick={saveKey} disabled={!keyInput.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-[10px] font-black transition-all">
                  <LucideIcons.Save className="h-3 w-3" /> Enregistrer
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto min-h-0 space-y-4 pb-4 custom-scrollbar pr-1">

        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
            <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center">
              <LucideIcons.BrainCircuit className="h-10 w-10 text-violet-400" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-black text-gray-800">Posez une question sur votre code</p>
              <p className="text-xs text-gray-400">Je connais la structure de Rena, les fichiers, les routes et les patterns utilisés.</p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full max-w-xl">
              {CHAT_SUGGESTIONS.map((s, i) => (
                <button key={i} onClick={() => sendMessage(s)}
                  className="text-left px-3 py-2.5 sm:px-4 sm:py-3 rounded-2xl border-2 border-gray-200 hover:border-violet-300 hover:bg-violet-50 text-[11px] text-gray-600 hover:text-violet-700 font-semibold transition-all group">
                  <span className="text-violet-400 mr-1.5 group-hover:text-violet-600">→</span>{s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <LucideIcons.BrainCircuit className="h-3.5 w-3.5 text-white" />
              </div>
            )}
            <div className={`max-w-[85%] group relative ${msg.role === 'user' ? 'order-first' : ''}`}>
              <div className={`rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-violet-600 text-white rounded-tr-sm'
                  : 'bg-white border-2 border-gray-100 shadow-sm rounded-tl-sm'
              }`}>
                {msg.role === 'user'
                  ? <p className="text-sm leading-relaxed">{msg.content}</p>
                  : <div className="space-y-0.5">{renderChatMarkdown(msg.content, msg.id)}</div>
                }
              </div>
              {/* Copy message button */}
              <button onClick={() => copyText(msg.content, `msg-${msg.id}`)}
                className={`absolute -bottom-5 ${msg.role === 'user' ? 'right-0' : 'left-0'} opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-black transition-all ${
                  copiedId === `msg-${msg.id}` ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                }`}>
                {copiedId === `msg-${msg.id}` ? <><LucideIcons.Check className="h-2.5 w-2.5" />Copié</> : <><LucideIcons.Copy className="h-2.5 w-2.5" />Copier</>}
              </button>
            </div>
            {msg.role === 'user' && (
              <div className="h-7 w-7 rounded-xl bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                <LucideIcons.User className="h-3.5 w-3.5 text-white" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="h-7 w-7 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
              <LucideIcons.BrainCircuit className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="bg-white border-2 border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-2 w-2 rounded-full bg-violet-400"
                    style={{ animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
                <span className="text-[10px] text-gray-400 ml-1 font-semibold">Analyse en cours…</span>
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl">
            <LucideIcons.AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-semibold">{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pt-3 border-t border-gray-100">
        <div className="flex gap-2 items-end bg-white border-2 border-gray-200 focus-within:border-violet-400 rounded-2xl p-2 transition-all shadow-sm">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question… (Entrée pour envoyer)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-gray-800 placeholder-gray-400 outline-none px-2 py-1.5 leading-relaxed"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
            onInput={e => {
              const el = e.currentTarget;
              el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            disabled={loading}
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="h-9 w-9 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all flex-shrink-0 shadow-sm shadow-violet-200"
          >
            {loading
              ? <LucideIcons.Loader2 className="h-4 w-4 text-white animate-spin" />
              : <LucideIcons.Send className="h-4 w-4 text-white" />
            }
          </button>
        </div>
        <p className="text-[9px] text-gray-400 text-center mt-1.5">Propulsé par Groq · Llama 3.1 · Contexte limité aux 12 derniers messages</p>
      </div>
    </div>
  );
}

export default function AdminDashboard({ admin, onLogout }: AdminDashboardProps) {
  useUniversalFCM('admin', admin?.id || null);
  const { supported: pushSupported, permission: pushPermission, subscription: pushSub, loading: pushLoading, subscribe: pushSubscribe, unsubscribe: pushUnsubscribe } = usePushNotifications();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const { formations: adminFormations, loading: formationsLoading, refresh: refreshFormations } = useAdminFormations();
  const { parcels, loading: parcelsLoading } = useParcels();
  const { products, loading: productsLoading } = useProducts();
  const { games, loading: gamesLoading } = useGames();
  const { cards, loading: cardsLoading } = useCardTopups();
  const { sliderImages, loading: sliderLoading } = useSliderImages();
  const { buttons, loading: buttonsLoading } = useNavButtons();
  const { services: onlineServices, loading: onlineServicesLoading } = useOnlineServices();
  const { settings, loading: settingsLoading } = useSettingsCtx();
  const { affiliates, loading: affiliatesLoading } = useAllAffiliates();
  const { withdrawals: allWithdrawals, loading: allWithdrawalsLoading } = useAllWithdrawals();
  const { requests: affiliateRequests, loading: affiliateRequestsLoading } = useAllAffiliateRequests();
  const { admins, loading: adminsLoading } = useAdminAccounts();
  const { logs, loading: logsLoading } = useAdminLogs(100);
  
  // ── Admin PIN setup ──────────────────────────────────────────────────────────
  const [showPinSetup, setShowPinSetup] = useState(false);
  const { pinModalOpen, pinModalTitle, pinModalDesc, requirePin, handlePinConfirm, handlePinCancel } = usePinGuard();

  useEffect(() => {
    if (!admin?.id) return;
    fetch(`/api/admin/has-pin/${admin.id}`)
      .then(r => r.json())
      .then(data => { if (!data.hasPin) setShowPinSetup(true); })
      .catch(() => {});
  }, [admin?.id]);

  const withAdminPin = async (title: string, action: () => Promise<void>) => {
    let pin: string;
    try { pin = await requirePin(title, 'Saisissez votre code PIN pour confirmer cette action.'); }
    catch { return; }
    try {
      const vRes = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminId: admin.id, pin }),
      });
      if (!vRes.ok) { const d = await vRes.json(); toast.error(d.error || 'Code PIN incorrect.'); return; }
    } catch { toast.error('Erreur de vérification PIN.'); return; }
    await action();
  };

  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isAffiliateDialogOpen, setIsAffiliateDialogOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [isAdminDeleteDialogOpen, setIsAdminDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<AdminAccount | null>(null);
  const [adminFormData, setAdminFormData] = useState<Partial<AdminAccount>>({
    fullName: '',
    password: '',
    photoUrl: '',
    loginCode: '',
    isSuperAdmin: false,
    permissions: []
  });

  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);

  // ── Online Services state ──────────────────────────────────────────────────
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<any | null>(null);
  const [serviceFormData, setServiceFormData] = useState({ label: '', description: '', icon: 'Globe', target: 'url' as 'tracking' | 'shipping' | 'url', url: '', order: 0, active: true });
  const [savingService, setSavingService] = useState(false);
  const [deletingServiceId, setDeletingServiceId] = useState<string | null>(null);

  const handleOpenServiceDialog = (svc?: any) => {
    if (svc) {
      setEditingService(svc);
      setServiceFormData({ label: svc.label || '', description: svc.description || '', icon: svc.icon || 'Globe', target: svc.target || 'url', url: svc.url || '', order: svc.order ?? 0, active: svc.active ?? true });
    } else {
      setEditingService(null);
      setServiceFormData({ label: '', description: '', icon: 'Globe', target: 'url', url: '', order: (onlineServices?.length || 0) + 1, active: true });
    }
    setIsServiceDialogOpen(true);
  };

  const handleSaveService = async () => {
    if (!serviceFormData.label.trim()) { toast.error('Le libellé est requis.'); return; }
    await withAdminPin('Enregistrer le service', async () => {
      setSavingService(true);
      try {
        await saveOnlineSubService({ ...serviceFormData }, editingService?.id);
        toast.success(editingService ? 'Service mis à jour !' : 'Service ajouté !');
        setIsServiceDialogOpen(false);
      } catch { toast.error('Erreur lors de la sauvegarde.'); }
      finally { setSavingService(false); }
    });
  };

  const handleDeleteService = async (id: string) => {
    await withAdminPin('Supprimer le service', async () => {
      setDeletingServiceId(id);
      try {
        await deleteOnlineSubService(id);
        toast.success('Service supprimé.');
      } catch { toast.error('Erreur lors de la suppression.'); }
      finally { setDeletingServiceId(null); }
    });
  };
  
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelToDelete, setParcelToDelete] = useState<Parcel | null>(null);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);

  const [isNavButtonDialogOpen, setIsNavButtonDialogOpen] = useState(false);
  const [editingNavButton, setEditingNavButton] = useState<NavButton | null>(null);
  const [isNavButtonDeleteDialogOpen, setIsNavButtonDeleteDialogOpen] = useState(false);
  const [navButtonToDelete, setNavButtonToDelete] = useState<NavButton | null>(null);
  const [navButtonFormData, setNavButtonFormData] = useState<Partial<NavButton>>({
    label: '',
    iconName: 'Package',
    targetUrl: '',
    redirectionInstruction: '',
    color: '#2563EB',
    order: 0
  });
  
  const [formationPaymentRequests, setFormationPaymentRequests] = useState<any[]>([]);
  const [loadingPaymentRequests, setLoadingPaymentRequests] = useState(false);
  const [processingPaymentId, setProcessingPaymentId] = useState<string | null>(null);

  const fetchFormationPaymentRequests = async () => {
    setLoadingPaymentRequests(true);
    try {
      const res = await fetch('/api/admin/formations/payment-requests', {
        headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
      });
      const json = await res.json();
      setFormationPaymentRequests(json.requests || []);
    } catch { } finally {
      setLoadingPaymentRequests(false);
    }
  };

  useEffect(() => { fetchFormationPaymentRequests(); }, []);

  const handleApprovePaymentRequest = async (id: string) => {
    await withAdminPin('Approuver la demande de paiement', async () => {
      setProcessingPaymentId(id);
      try {
        const res = await fetch(`/api/admin/formations/payment-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
          body: JSON.stringify({ action: 'approve' }),
        });
        if (!res.ok) throw new Error('Erreur');
        toast.success('Accès au cours activé !');
        fetchFormationPaymentRequests();
      } catch { toast.error('Erreur lors de l\'approbation.'); } finally {
        setProcessingPaymentId(null);
      }
    });
  };

  const handleRejectPaymentRequest = async (id: string) => {
    await withAdminPin('Rejeter la demande de paiement', async () => {
      setProcessingPaymentId(id);
      try {
        const res = await fetch(`/api/admin/formations/payment-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
          body: JSON.stringify({ action: 'reject' }),
        });
        if (!res.ok) throw new Error('Erreur');
        toast.success('Demande rejetée.');
        fetchFormationPaymentRequests();
      } catch { toast.error('Erreur lors du rejet.'); } finally {
        setProcessingPaymentId(null);
      }
    });
  };

  const [isFormationDialogOpen, setIsFormationDialogOpen] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [isFormationDeleteDialogOpen, setIsFormationDeleteDialogOpen] = useState(false);
  const [formationToDelete, setFormationToDelete] = useState<Formation | null>(null);
  const [formationFormData, setFormationFormData] = useState<Partial<Formation>>({
    title: '', description: '', shortDescription: '', coverImage: '', previewVideoUrl: '',
    price: 0, originalPrice: undefined, level: 'debutant', published: true, comingSoon: false,
    modules: [], chapters: [], resources: [], pdfUrl: '',
    instructor: '', instructorBio: '', instructorAvatar: '',
    language: 'Français', totalDuration: '', hasCertificate: false,
    category: '', tags: [], prerequisites: '', enrollmentLimit: undefined,
    studentsCount: 0, rating: 0
  });

  const [certificates, setCertificates] = useState<any[]>([]);
  const [loadingCertificates, setLoadingCertificates] = useState(false);
  const [certFormationFilter, setCertFormationFilter] = useState<string>('');
  const [certStudents, setCertStudents] = useState<any[]>([]);
  const [loadingCertStudents, setLoadingCertStudents] = useState(false);
  const [selectedCertFormationId, setSelectedCertFormationId] = useState<string>('');
  const [issuingCertId, setIssuingCertId] = useState<string>('');
  const [revokingCertId, setRevokingCertId] = useState<string>('');
  const [certIssuanceForm, setCertIssuanceForm] = useState<{ student: any; pdfUrl: string } | null>(null);
  const [updatingCertPdf, setUpdatingCertPdf] = useState<string>('');
  const [editingCertPdf, setEditingCertPdf] = useState<{ id: string; pdfUrl: string } | null>(null);

  const fetchCertificates = async (fId?: string) => {
    setLoadingCertificates(true);
    try {
      const url = fId ? `/api/admin/formations/certificates?formationId=${fId}` : '/api/admin/formations/certificates';
      const res = await fetch(url, { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch { toast.error('Impossible de charger les certificats.'); }
    finally { setLoadingCertificates(false); }
  };

  const fetchCertStudents = async (fId: string) => {
    setLoadingCertStudents(true);
    try {
      const res = await fetch(`/api/admin/formations/${fId}/students`, { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
      const data = await res.json();
      setCertStudents(data.students || []);
    } catch { toast.error('Impossible de charger les étudiants.'); }
    finally { setLoadingCertStudents(false); }
  };

  const handleIssueCertificate = async (student: any, pdfUrl?: string) => {
    if (!selectedCertFormationId) return;
    await withAdminPin('Émettre le certificat', async () => {
      const formation = adminFormations.find((f: any) => f.id === selectedCertFormationId);
      setIssuingCertId(student.userId);
      setCertIssuanceForm(null);
      try {
        const res = await fetch('/api/admin/formations/certificate', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
          body: JSON.stringify({
            userId: student.userId, userName: student.userName, userEmail: student.userEmail,
            formationId: selectedCertFormationId, formationTitle: formation?.title || '',
            issuedBy: admin?.fullName || 'Admin',
            ...(pdfUrl ? { pdfUrl } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Erreur');
        toast.success(`Certificat émis pour ${student.userName} !`);
        fetchCertificates(selectedCertFormationId);
      } catch (e: any) { toast.error(e.message); }
      finally { setIssuingCertId(''); }
    });
  };

  const handleRevokeCertificate = async (certId: string) => {
    await withAdminPin('Révoquer le certificat', async () => {
      setRevokingCertId(certId);
      try {
        await fetch(`/api/admin/formations/certificate/${certId}`, { method: 'DELETE', headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
        toast.success('Certificat révoqué.');
        fetchCertificates(selectedCertFormationId || undefined);
      } catch { toast.error('Erreur lors de la révocation.'); }
      finally { setRevokingCertId(''); }
    });
  };

  const handleUpdateCertPdf = async (certId: string, pdfUrl: string) => {
    await withAdminPin('Mettre à jour le PDF', async () => {
      setUpdatingCertPdf(certId);
      try {
        const res = await fetch(`/api/admin/formations/certificate/${certId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
          body: JSON.stringify({ pdfUrl }),
        });
        if (!res.ok) throw new Error('Erreur');
        toast.success('Lien PDF mis à jour.');
        setEditingCertPdf(null);
        fetchCertificates(selectedCertFormationId || undefined);
      } catch { toast.error('Erreur lors de la mise à jour.'); }
      finally { setUpdatingCertPdf(''); }
    });
  };
  const [formationTagInput, setFormationTagInput] = useState('');

  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDeleteDialogOpen, setIsProductDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  
  const [isGameDialogOpen, setIsGameDialogOpen] = useState(false);
  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isGameDeleteDialogOpen, setIsGameDeleteDialogOpen] = useState(false);
  const [gameToDelete, setGameToDelete] = useState<Game | null>(null);
  const [gameFormData, setGameFormData] = useState<Partial<Game>>({
    name: '',
    image: '',
    description: '',
    priceRange: '',
    whatsappMessage: '',
    catalog: []
  });

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardTopup | null>(null);
  const [isCardDeleteDialogOpen, setIsCardDeleteDialogOpen] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<CardTopup | null>(null);
  const [cardFormData, setCardFormData] = useState<Partial<CardTopup>>({
    name: '',
    image: '',
    description: '',
    price: '',
    stock: 0,
    whatsappMessage: '',
    goldRate: 1,
    presets: [],
    feeRules: []
  });
  const [tempCardImageUrl, setTempCardImageUrl] = useState('');
  const [pendingSettings, setPendingSettings] = useState<Partial<AppSettings>>({});

  const [isAwarding, setIsAwarding] = useState(false);
  const [isClearingWinners, setIsClearingWinners] = useState(false);

  const [isWithdrawalRejectionDialogOpen, setIsWithdrawalRejectionDialogOpen] = useState(false);
  const [withdrawalToReject, setWithdrawalToReject] = useState<WithdrawalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const [affiliateViewMode, setAffiliateViewMode] = useState<'table' | 'grid'>('grid');

  // New states for the latest requests
  const [isQuickCreditDialogOpen, setIsQuickCreditDialogOpen] = useState(false);
  const [quickCreditAmount, setQuickCreditAmount] = useState<number>(0);
  const [selectedAffiliateForCredit, setSelectedAffiliateForCredit] = useState<Affiliate | null>(null);
  const [isLockingEdits, setIsLockingEdits] = useState(false);
  const [lockCodeInput, setLockCodeInput] = useState('');
  const [isUnlockDialogOpen, setIsUnlockDialogOpen] = useState(false);
  const [isWithdrawalToggleConfirmOpen, setIsWithdrawalToggleConfirmOpen] = useState(false);
  const [isSponsorSelectorOpen, setIsSponsorSelectorOpen] = useState(false);
  const [selectingSponsorType, setSelectingSponsorType] = useState<'direct' | 'indirect' | 'extra'>('direct');
  const [sponsorSearchQuery, setSponsorSearchQuery] = useState('');

  // Affiliate Search Feature States
  const [affiliateSearchInput, setAffiliateSearchInput] = useState('');
  const [isSearchingAffiliate, setIsSearchingAffiliate] = useState(false);
  const [searchAffiliateResults, setSearchAffiliateResults] = useState<Affiliate[]>([]);
  const [selectedAffiliateDetail, setSelectedAffiliateDetail] = useState<Affiliate | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);
  const [referralDetails, setReferralDetails] = useState<{ directReferrals: Affiliate[], indirectReferrals: Affiliate[] } | null>(null);
  const [searchStatus, setSearchStatus] = useState<'idle' | 'searching' | 'found' | 'not_found'>('idle');

  // Client Management States
  const { clients, loading: clientsLoading } = useAllClients();
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [isClientDeleteDialogOpen, setIsClientDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [clientFormData, setClientFormData] = useState<Partial<Client>>({
    name: '',
    phone: '',
    directSponsorId: '',
    indirectSponsorId: ''
  });
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const deferredClientSearchQuery = useDeferredValue(clientSearchQuery);
  const [isSponsorSelectorForClientOpen, setIsSponsorSelectorForClientOpen] = useState(false);
  const [selectingSponsorTypeForClient, setSelectingSponsorTypeForClient] = useState<'direct' | 'indirect'>('direct');

  const handleSearchAffiliate = async () => {
    if (!affiliateSearchInput.trim()) return;
    
    setIsSearchingAffiliate(true);
    setSearchStatus('searching');
    setSelectedAffiliateDetail(null);
    setSelectedClientDetail(null);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    try {
      const results = await searchAffiliatesByName(affiliateSearchInput.trim());
      const clientResults = await searchClientsByPhone(affiliateSearchInput.trim());
      
      setSearchAffiliateResults(results);
      
      if (results.length > 0) {
        setSearchStatus('found');
        if (results.length === 1 && clientResults.length === 0) {
          handleViewAffiliateDetail(results[0]);
        }
      } else if (clientResults.length > 0) {
        setSearchStatus('found');
        setSelectedClientDetail(clientResults[0]);
      } else {
        setSearchStatus('not_found');
      }
    } catch (error) {
      console.error(error);
      setSearchStatus('not_found');
    } finally {
      setIsSearchingAffiliate(false);
    }
  };

  const handleViewAffiliateDetail = async (affiliate: Affiliate) => {
    setIsSearchingAffiliate(true);
    try {
      const referrals = await getAffiliateReferrals(affiliate.id!);
      setSelectedAffiliateDetail(affiliate);
      setReferralDetails(referrals);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSearchingAffiliate(false);
    }
  };

  const handleSaveClient = async () => {
    if (!clientFormData.name || !clientFormData.phone) {
      toast.error("Le nom et le téléphone sont obligatoires.");
      return;
    }
    await withAdminPin('Enregistrer le client', async () => {
      setIsSaving(true);
      try {
        await saveClient(clientFormData, editingClient?.id);
        toast.success(editingClient ? "Client mis à jour !" : "Client ajouté avec succès !");
        setIsClientDialogOpen(false);
        setEditingClient(null);
        setClientFormData({ name: '', phone: '', directSponsorId: '', indirectSponsorId: '' });
      } catch (error: any) {
        console.error("Save Client Error:", error);
        let errorMessage = "Erreur lors de l'enregistrement du client.";
        try {
          const parsed = JSON.parse(error.message);
          if (parsed.error && parsed.error.includes('permissions')) errorMessage = "Permission refusée. Vérifiez vos accès administrateur.";
        } catch (e) {}
        toast.error(errorMessage);
      } finally { setIsSaving(false); }
    });
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete?.id) return;
    await withAdminPin('Supprimer le client', async () => {
      setIsDeleting(true);
      try {
        await deleteClient(clientToDelete.id);
        toast.success("Client supprimé.");
        setIsClientDeleteDialogOpen(false);
        setClientToDelete(null);
      } catch (error) {
        toast.error("Erreur lors de la suppression.");
      } finally { setIsDeleting(false); }
    });
  };

  const handleSelectSponsorForClient = (sponsor: Affiliate) => {
    if (selectingSponsorTypeForClient === 'direct') {
      setClientFormData(prev => ({ ...prev, directSponsorId: sponsor.id }));
    } else {
      setClientFormData(prev => ({ ...prev, indirectSponsorId: sponsor.id }));
    }
    setIsSponsorSelectorForClientOpen(false);
    setSponsorSearchQuery('');
  };

  const handleContactWhatsApp = (name: string, phone: string, isAffiliate: boolean) => {
    // Standardize phone number: remove non-digits
    const cleanPhone = phone.replace(/\D/g, '');
    const message = isAffiliate 
      ? `Bonjour ${name}, nous vous contactons concernant votre statut d'affilié sur Rena.` 
      : `Bonjour, nous vous contactons concernant votre dossier client Rena (N° ${phone}).`;
    
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Helper to ensure the admin creation dialog is always usable
  const handleOpenAdminDialog = (adminAccount?: AdminAccount) => {
    if (adminAccount) {
      setEditingAdmin(adminAccount);
      setAdminFormData({ ...adminAccount });
    } else {
      setEditingAdmin(null);
      setAdminFormData({
        fullName: '',
        password: '',
        photoUrl: '',
        loginCode: '',
        isSuperAdmin: false,
        permissions: []
      });
    }
    setIsAdminDialogOpen(true);
  };

  const handleSaveAdminAccount = async () => {
    if (!adminFormData.fullName || !adminFormData.password) {
      toast.error("Le nom et le mot de passe sont requis.");
      return;
    }
    await withAdminPin('Enregistrer le compte admin', async () => {
      setIsSaving(true);
      try {
        await saveAdminAccount(adminFormData, editingAdmin?.id);
        toast.success(editingAdmin ? "Compte administrateur mis à jour !" : "Compte administrateur créé !");
        setIsAdminDialogOpen(false);
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors de l'enregistrement.");
      } finally { setIsSaving(false); }
    });
  };

  const handleConfirmDeleteAdmin = async () => {
    if (!adminToDelete?.id) return;
    if (adminToDelete.isSuperAdmin) { toast.error("Impossible de supprimer le super administrateur."); return; }
    await withAdminPin('Supprimer le compte admin', async () => {
      setIsDeleting(true);
      try {
        await deleteAdminAccount(adminToDelete.id);
        toast.success("Compte administrateur supprimé.");
        setIsAdminDeleteDialogOpen(false);
      } catch (error) {
        console.error(error);
        toast.error("Erreur lors de la suppression.");
      } finally { setIsDeleting(false); setAdminToDelete(null); }
    });
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

// New component to isolate state and prevent massive re-renders
const AffiliateEditForm = ({ 
  initialData, 
  onSave, 
  onClose, 
  settings, 
  affiliates, 
  editingAffiliate, 
  handleOpenAffiliateDeleteDialog,
  setSelectingSponsorType,
  setSponsorSearchQuery,
  setIsSponsorSelectorOpen
}: any) => {
  const [affiliateFormData, setAffiliateFormData] = useState<Partial<Affiliate>>(initialData);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(affiliateFormData);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-[2.5rem] border-0 shadow-2xl">
      <div className="relative h-32 bg-gradient-to-r from-primary/20 via-accent-light to-primary/10 p-6 flex flex-col justify-end">
        <div className="absolute top-4 right-6 flex gap-2">
          {editingAffiliate && (
            <Badge className="bg-white/80 text-primary border-0 font-black shadow-sm">ID: {editingAffiliate.id?.slice(0, 8)}</Badge>
          )}
        </div>
        <DialogHeader>
          <DialogTitle className="text-3xl font-black text-dark flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white shadow-md">
              <LucideIcons.Users className="h-6 w-6 text-primary" />
            </div>
            {editingAffiliate ? 'Profil Affilié' : 'Nouveau Compte Affilié'}
          </DialogTitle>
          <DialogDescription className="text-subtext font-medium text-xs ml-12">
            Configuration et ajustement des paramètres de l'affilié.
          </DialogDescription>
        </DialogHeader>
      </div>
      
      <Tabs defaultValue="identity" className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-white px-6 border-b flex justify-between items-center h-12 shadow-sm z-10 overflow-x-auto no-scrollbar">
          <TabsList className="bg-transparent h-full p-0 gap-4 sm:gap-6 flex-nowrap">
            <TabsTrigger value="identity" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Identité</TabsTrigger>
            <TabsTrigger value="financial" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Finances</TabsTrigger>
            <TabsTrigger value="stats" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Statistiques</TabsTrigger>
            <TabsTrigger value="info" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Informations Personnelles</TabsTrigger>
          </TabsList>
          
          <div className="flex items-center gap-2 ml-4 shrink-0">
             {settings?.lockAffiliateEdits && (
               <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 font-black text-[10px] uppercase gap-1.5 px-3 py-1 animate-pulse">
                 < LucideIcons.ShieldAlert className="h-3 w-3" />
                 MODIFICATIONS VERROUILLÉES
               </Badge>
             )}
             <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase">ACTIF</Badge>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-gray-50/30 ${settings?.lockAffiliateEdits ? 'grayscale-[0.5] opacity-80' : ''}`}>
          <TabsContent value="identity" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nom Complet</Label>
                <div className="relative group">
                  < LucideIcons.Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary group-focus-within:scale-110 transition-transform" />
                  <Input 
                    value={affiliateFormData.name} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, name: e.target.value})}
                    className="pl-10 h-12 rounded-2xl border-gray-200 focus:ring-primary shadow-sm bg-white" 
                    placeholder="Jean Dupont"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Code Affilié</Label>
                <div className="relative group">
                  < LucideIcons.Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                  <Input 
                    value={affiliateFormData.code} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, code: e.target.value})}
                    className="pl-10 h-12 rounded-2xl border-gray-200 font-mono font-bold shadow-sm bg-white" 
                    placeholder="AFF2024"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Username (Login)</Label>
                <div className="relative">
                  < LucideIcons.AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    value={affiliateFormData.username} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, username: e.target.value})}
                    className="pl-10 h-12 rounded-2xl border-gray-200 shadow-sm bg-white" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Mot de Passe</Label>
                <div className="relative">
                  < LucideIcons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input 
                    value={affiliateFormData.password} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, password: e.target.value})}
                    className="pl-10 h-12 rounded-2xl border-gray-200 shadow-sm bg-white" 
                    placeholder="********"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Niveau du compte</Label>
                <Select 
                  value={affiliateFormData.level} 
                  onValueChange={(v: any) => setAffiliateFormData({...affiliateFormData, level: v})}
                >
                  <SelectTrigger className="h-12 rounded-2xl border-gray-200 shadow-sm bg-white px-4 font-bold text-dark">
                    <SelectValue placeholder="Niveau" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-gray-100">
                    <SelectItem value="Bronze" className="rounded-xl">🥉 Bronze</SelectItem>
                    <SelectItem value="Silver" className="rounded-xl">🥈 Silver</SelectItem>
                    <SelectItem value="Gold" className="rounded-xl">🥇 Gold</SelectItem>
                    <SelectItem value="Elite" className="rounded-xl">💎 Elite</SelectItem>
                    <SelectItem value="VIP" className="rounded-xl">👑 VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Parrains & Sponsors</Label>
                  <DropdownMenu>
                    <DropdownMenuTrigger 
                      className="inline-flex h-7 items-center justify-center rounded-lg text-[10px] font-black uppercase bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary px-3 transition-colors cursor-pointer outline-none"
                    >
                      < LucideIcons.Plus className="h-3 w-3 mr-1" /> Nouveau Parrain
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl border-gray-100 shadow-xl">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 px-3 py-2">Type de parrain</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectingSponsorType('direct');
                            setSponsorSearchQuery('');
                            setIsSponsorSelectorOpen(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-primary/5 focus:bg-primary/5 group"
                        >
                          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                            < LucideIcons.Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-dark group-hover:text-primary">Parrain Direct</p>
                            <p className="text-[10px] text-gray-400 font-medium">Commission de Niveau 1</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectingSponsorType('indirect');
                            setSponsorSearchQuery('');
                            setIsSponsorSelectorOpen(true);
                          }}
                          className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-primary/5 focus:bg-primary/5 group"
                        >
                          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                            < LucideIcons.Users className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-dark group-hover:text-primary">Parrain Indirect</p>
                            <p className="text-[10px] text-gray-400 font-medium">Commission de Niveau 2</p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <div className="space-y-3">
                  {/* Primary Direct Sponsor */}
                  {affiliateFormData.parentAffiliateId && (
                    <div className="bg-emerald-50/30 border border-emerald-100/50 p-3 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold group-hover:bg-emerald-200 transition-colors shadow-sm">
                          {affiliates.find((a: any) => a.id === affiliateFormData.parentAffiliateId)?.name.charAt(0) || < LucideIcons.Users className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-dark">{affiliates.find((a: any) => a.id === affiliateFormData.parentAffiliateId)?.name || 'Inconnu'}</p>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase px-1.5 py-0">Principal Direct</Badge>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono tracking-tight">{affiliates.find((a: any) => a.id === affiliateFormData.parentAffiliateId)?.code || affiliateFormData.parentAffiliateId}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setAffiliateFormData({...affiliateFormData, parentAffiliateId: ''})}
                        className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                      >
                        < LucideIcons.Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Primary Indirect Sponsor */}
                  {affiliateFormData.grandparentAffiliateId && (
                    <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-2xl flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-200 transition-colors shadow-sm">
                          {affiliates.find((a: any) => a.id === affiliateFormData.grandparentAffiliateId)?.name.charAt(0) || < LucideIcons.Users className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-black text-dark">{affiliates.find((a: any) => a.id === affiliateFormData.grandparentAffiliateId)?.name || 'Inconnu'}</p>
                            <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black uppercase px-1.5 py-0">Principal Indirect</Badge>
                          </div>
                          <p className="text-[10px] text-gray-400 font-mono tracking-tight">{affiliates.find((a: any) => a.id === affiliateFormData.grandparentAffiliateId)?.code || affiliateFormData.grandparentAffiliateId}</p>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => setAffiliateFormData({...affiliateFormData, grandparentAffiliateId: ''})}
                        className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                      >
                        < LucideIcons.Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Additional Sponsors List */}
                  {affiliateFormData.additionalSponsors && affiliateFormData.additionalSponsors.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {affiliateFormData.additionalSponsors.map((sponsor: any) => {
                        const affiliate = affiliates.find((a: any) => a.id === sponsor.id);
                        const isDirect = sponsor.type === 'direct';
                        return (
                          <div key={sponsor.id} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-gray-100 shadow-sm group hover:border-primary/20 transition-all">
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm ${isDirect ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                 {affiliate?.name.charAt(0) || '?'}
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                   <p className="text-xs font-bold text-dark leading-tight">{affiliate?.name || 'Inconnu'}</p>
                                   <Badge variant="outline" className={`${isDirect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'} text-[7px] font-black uppercase px-1.5 py-0 opacity-70`}>Plus {isDirect ? 'Direct' : 'Indirect'}</Badge>
                                 </div>
                                 <p className="text-[9px] text-gray-400 font-mono">{affiliate?.code || sponsor.id}</p>
                              </div>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => setAffiliateFormData({
                                ...affiliateFormData, 
                                additionalSponsors: affiliateFormData.additionalSponsors?.filter((s: any) => s.id !== sponsor.id)
                              })}
                              className="h-8 w-8 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                            >
                              < LucideIcons.Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {!affiliateFormData.parentAffiliateId && !affiliateFormData.grandparentAffiliateId && (!affiliateFormData.additionalSponsors || affiliateFormData.additionalSponsors.length === 0) && (
                    <div className="p-8 rounded-3xl border-2 border-dashed border-gray-100 text-center bg-gray-50/50">
                       <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-300 mx-auto mb-3">
                         < LucideIcons.Users className="h-6 w-6" />
                       </div>
                       <p className="text-xs text-gray-500 font-medium">Aucun parrain défini pour cet affilié.</p>
                       <p className="text-[10px] text-gray-400 mt-1">Cliquez sur Nouveau Parrain pour en ajouter un.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="financial" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
             <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 text-center mb-8 relative overflow-hidden group">
                <div className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm text-emerald-500 scale-110 opacity-50 group-hover:opacity-100 transition-opacity">
                  < LucideIcons.TrendingUp className="h-4 w-4" />
                </div>
                <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Gains Totaux Cumulés</p>
                <p className="text-4xl font-black text-emerald-700">{(affiliateFormData.totalEarnings || 0).toLocaleString()} <span className="text-lg">$</span></p>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex items-center justify-between">
                    Solde Disponible
                    <span className="text-emerald-600 font-black">USD ($)</span>
                  </Label>
                  <div className="relative group">
                    < LucideIcons.Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                    <Input 
                      type="number"
                      value={affiliateFormData.balance} 
                      onChange={(e) => setAffiliateFormData({...affiliateFormData, balance: Number(e.target.value)})}
                      className="pl-10 h-14 rounded-2xl border-gray-200 text-xl font-black text-dark focus:ring-emerald-500 shadow-md bg-white" 
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex items-center justify-between">
                    Points du mois
                    < LucideIcons.Trophy className="h-3 w-3 text-primary" />
                  </Label>
                  <div className="relative">
                    < LucideIcons.Star className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                    <Input 
                      type="number"
                      value={affiliateFormData.points || 0} 
                      onChange={(e) => setAffiliateFormData({...affiliateFormData, points: Number(e.target.value)})}
                      className="pl-10 h-14 rounded-2xl border-gray-200 text-xl font-black text-dark focus:ring-primary shadow-md bg-white" 
                    />
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                <div className="space-y-1 bg-white p-4 rounded-2xl border shadow-sm">
                  <Label className="text-[10px] font-black uppercase text-gray-500">Revenus Directs</Label>
                  <Input 
                    type="number"
                    value={affiliateFormData.directRevenue || 0} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, directRevenue: Number(e.target.value)})}
                    className="border-none shadow-none text-lg font-bold p-0 h-8 focus-visible:ring-0" 
                  />
                </div>
                <div className="space-y-1 bg-white p-4 rounded-2xl border shadow-sm">
                  <Label className="text-[10px] font-black uppercase text-gray-500">Revenus Indirects</Label>
                  <Input 
                    type="number"
                    value={affiliateFormData.indirectRevenue || 0} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, indirectRevenue: Number(e.target.value)})}
                    className="border-none shadow-none text-lg font-bold p-0 h-8 focus-visible:ring-0" 
                  />
                </div>
             </div>
          </TabsContent>

          <TabsContent value="stats" className="mt-0 space-y-6 animate-in fade-in slide-in-from-right-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               <div className="p-6 rounded-[2.5rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center text-center group transition-all hover:bg-indigo-50">
                  <div className="h-12 w-12 rounded-[1.25rem] bg-white shadow-md flex items-center justify-center text-indigo-500 mb-3 group-hover:rotate-12 transition-transform">
                    < LucideIcons.Users className="h-6 w-6" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Affiliés Référés</p>
                  <Input 
                    type="number"
                    value={affiliateFormData.referredClients} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, referredClients: Number(e.target.value)})}
                    className="w-24 text-center border-none shadow-none text-2xl font-black bg-transparent focus-visible:ring-0 h-10 p-0" 
                  />
                  <p className="text-[9px] text-indigo-300 font-bold mt-1">TOTAL HISTORIQUE</p>
               </div>
               
               <div className="p-6 rounded-[2.5rem] bg-orange-50/50 border border-orange-100 flex flex-col items-center text-center group transition-all hover:bg-orange-50">
                  <div className="h-12 w-12 rounded-[1.25rem] bg-white shadow-md flex items-center justify-center text-orange-500 mb-3 group-hover:rotate-12 transition-transform">
                    < LucideIcons.DollarSign className="h-6 w-6" />
                  </div>
                  <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-1">Ventes Mensuelles</p>
                  <Input 
                    type="number"
                    value={affiliateFormData.monthlySales || 0} 
                    onChange={(e) => setAffiliateFormData({...affiliateFormData, monthlySales: Number(e.target.value)})}
                    className="w-24 text-center border-none shadow-none text-2xl font-black bg-transparent focus-visible:ring-0 h-10 p-0" 
                  />
                  <p className="text-[9px] text-orange-300 font-bold mt-1">OBJECTIF: 100 VENTES</p>
               </div>

               <div className="p-4 rounded-3xl bg-gray-100/50 border border-gray-200 sm:col-span-2">
                  <Label className="text-[10px] font-black uppercase text-gray-400 mb-4 block text-center">Référés ce mois</Label>
                  <div className="flex items-center justify-center gap-6">
                     <Button 
                       variant="outline" 
                       size="icon" 
                       className="rounded-xl h-10 w-10 shrink-0 border-gray-200"
                       onClick={() => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: Math.max(0, (affiliateFormData.monthlyReferredClients || 0) - 1)})}
                     >
                       < LucideIcons.Minus className="h-4 w-4" />
                     </Button>
                     <Input 
                        type="number"
                        value={affiliateFormData.monthlyReferredClients || 0} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: Number(e.target.value)})}
                        className="w-32 text-center text-4xl font-black border-none shadow-none bg-transparent h-16 pt-2" 
                      />
                      <Button 
                       variant="outline" 
                       size="icon" 
                       className="rounded-xl h-10 w-10 shrink-0 border-gray-200"
                       onClick={() => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: (affiliateFormData.monthlyReferredClients || 0) + 1})}
                     >
                       < LucideIcons.Plus className="h-4 w-4" />
                     </Button>
                  </div>
               </div>
            </div>
          </TabsContent>

          <TabsContent value="info" className="mt-0 space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-black text-dark flex items-center gap-2">
                < LucideIcons.User className="h-5 w-5 text-primary" />
                Informations Personnelles
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                  <p className="font-bold text-dark">{affiliateFormData.info?.email || 'Non renseigné'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Téléphone</p>
                  <p className="font-bold text-dark">{affiliateFormData.info?.phone || 'Non renseigné'}</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message d'inscription</p>
                  <p className="text-sm text-gray-600 italic">"{affiliateFormData.info?.message || 'Aucun message'}"</p>
                </div>
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date d'approbation</p>
                  <p className="font-bold text-dark">
                    {affiliateFormData.info?.approvedAt ? format(new Date(affiliateFormData.info.approvedAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Inconnue'}
                  </p>
                </div>
              </div>
              
              {settings?.lockAffiliateEdits && (
                <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-4">
                  < LucideIcons.ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-red-900">Modifications impossibles</p>
                    <p className="text-[11px] text-red-700">Le verrouillage global des modifications est activé. Déverrouillez dans les paramètres pour modifier ces informations.</p>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </div>
      </Tabs>

      <div className="p-8 bg-white border-t flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2">
          {editingAffiliate && (
            <Button 
              variant="ghost" 
              onClick={() => {
                handleOpenAffiliateDeleteDialog(editingAffiliate);
                onClose();
              }}
              className="text-red-500 hover:bg-red-50 rounded-2xl h-12 font-bold flex items-center gap-2 group"
            >
              < LucideIcons.Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Supprimer l'affilié</span>
            </Button>
          )}
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button 
            variant="outline" 
            onClick={onClose}
            className="flex-1 sm:flex-none rounded-2xl h-12 font-bold px-8 border-gray-200"
          >
            Fermer
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={isSaving || settings?.lockAffiliateEdits} 
            className={`flex-1 sm:flex-none rounded-2xl h-12 font-bold shadow-xl border-0 px-10 transition-all active:scale-95 ${
              settings?.lockAffiliateEdits 
                ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                : 'bg-primary hover:bg-[#1D4ED8] text-white shadow-accent-light/50'
            }`}
          >
            {isSaving ? < LucideIcons.Loader2 className="h-4 w-4 animate-spin mr-2" /> : < LucideIcons.CheckCircle2 className="h-4 w-4 mr-2" />}
            {editingAffiliate ? 'Mettre à jour' : 'Créer le compte'}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};

// ── Email Logs Panel ──────────────────────────────────────────────────────────
function EmailLogsPanel() {
  const [logs, setLogs] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'sent' | 'failed'>('all');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/email-logs?limit=200');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  const filtered = filter === 'all' ? logs : logs.filter(l => l.status === filter);

  const TYPE_LABELS: Record<string, string> = {
    deposit_submitted: '💰 Dépôt soumis',
    deposit_approved:  '✅ Dépôt approuvé',
    deposit_rejected:  '❌ Dépôt refusé',
    withdrawal_submitted: '🏧 Retrait soumis',
    withdrawal_approved:  '✅ Retrait approuvé',
    withdrawal_rejected:  '❌ Retrait refusé',
    withdrawal_otp:    '🔐 OTP retrait agent',
    agent_withdrawal_confirmed: '✅ Retrait agent confirmé',
    agent_commission:  '💎 Commission agent',
    affiliate_commission: '💎 Commission affilié',
  };

  const sentCount  = logs.filter(l => l.status === 'sent').length;
  const failedCount = logs.filter(l => l.status === 'failed').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold">Logs Emails</h2>
          <p className="text-sm text-gray-500 mt-0.5">Historique de tous les emails envoyés par le système</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          <LucideIcons.RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border bg-white p-4 text-center">
          <p className="text-2xl font-black text-gray-800">{logs.length}</p>
          <p className="text-xs text-gray-500 font-semibold mt-0.5 uppercase tracking-wider">Total</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-2xl font-black text-emerald-700">{sentCount}</p>
          <p className="text-xs text-emerald-600 font-semibold mt-0.5 uppercase tracking-wider">Envoyés</p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
          <p className="text-2xl font-black text-red-600">{failedCount}</p>
          <p className="text-xs text-red-500 font-semibold mt-0.5 uppercase tracking-wider">Échoués</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'sent', 'failed'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              filter === f
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {f === 'all' ? 'Tous' : f === 'sent' ? 'Envoyés' : 'Échoués'}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <LucideIcons.Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <LucideIcons.Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Aucun email trouvé</p>
        </div>
      ) : (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Destinataire</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Montant</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((log: any) => {
                  const to = Array.isArray(log.to) ? log.to.join(', ') : log.to;
                  const sentAt = log.sentAt?.seconds
                    ? new Date(log.sentAt.seconds * 1000).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—';
                  return (
                    <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                        {TYPE_LABELS[log.type] || log.type}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">
                        {to || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {log.amount ? `$${Number(log.amount).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                        {sentAt}
                      </td>
                      <td className="px-4 py-3">
                        {log.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold">
                            <LucideIcons.CheckCircle2 className="h-3 w-3" />Envoyé
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-600 text-xs font-bold" title={log.error || ''}>
                            <LucideIcons.XCircle className="h-3 w-3" />Échec
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

  // Define categorized menu items for better organization
  const menuGroups = [
    {
      title: "Gestion Commerciale",
      items: [
        { value: 'affiliates', label: 'Affiliés', icon: Users, permission: 'affiliates' },
        { value: 'clients', label: 'Base Clients', icon: Smartphone, permission: 'affiliates' },
        { value: 'search', label: 'Recherche Affilié', icon: Search, permission: 'analytics' },
        { value: 'products', label: 'Catalogue', icon: LayoutGrid, permission: 'products' },
        { value: 'formations', label: 'Formations', icon: LucideIcons.GraduationCap, permission: 'products' },
        { value: 'formation_payments', label: 'Paiements Cours', icon: LucideIcons.CreditCard, permission: 'products' },
        { value: 'teachers', label: 'Professeurs', icon: LucideIcons.UserCheck, permission: 'products' },
        { value: 'teacher-withdrawals', label: 'Retraits Professeurs', icon: LucideIcons.Banknote, permission: 'settings' },
        { value: 'online-services', label: 'Services', icon: Globe, permission: 'products' },
        { value: 'promo-codes', label: 'Codes Promo', icon: LucideIcons.Tag, permission: 'products' },
        { value: 'commissions-catalog', label: 'Commissions & Tarifs', icon: LucideIcons.BadgePercent, permission: 'settings' },
        { value: 'contest', label: 'Concours', icon: LucideIcons.Trophy, permission: 'settings' },
      ]
    },
    {
      title: "Logistique & Opérations",
      items: [
        { value: 'parcels', label: 'Colis & Tracking', icon: Package, permission: 'parcels' },
        { value: 'shipping', label: 'Expéditions', icon: Truck, permission: 'shipping' },
        { value: 'cards', label: 'Recharges', icon: CreditCard, permission: 'cards' },
        { value: 'games', label: 'Gaming', icon: Gamepad2, permission: 'games' },
      ]
    },
    {
      title: "Contenu & Interface",
      items: [
        { value: 'slider', label: 'Bannières Slider', icon: ImageIcon, permission: 'slider' },
        { value: 'nav-buttons', label: 'Boutons Navigation', icon: Network, permission: 'nav-buttons' },
        { value: 'notifications', label: 'Alertes Système', icon: Bell, permission: 'notifications' },
      ]
    },
    {
      title: "Administration & Paramètres",
      items: [
        { value: 'agents', label: 'Agents', icon: UserCheck, permission: 'settings' },
        { value: 'free-fire-reseller', label: 'Free Fire Revendeurs', icon: Gamepad2, permission: 'settings' },
        { value: 'profits', label: 'Profits', icon: LucideIcons.TrendingUp, permission: 'settings' },
        { value: 'wallet-management', label: 'Gestion Wallet', icon: Wallet, permission: 'settings' },
        { value: 'admins', label: 'Administrateurs', icon: Shield, permission: 'super_admin_only' },
        { value: 'email-logs', label: 'Logs Emails', icon: LucideIcons.Mail, permission: 'settings' },
        { value: 'settings', label: 'Paramètres Généraux', icon: SettingsIcon, permission: 'settings' },
      ]
    }
  ];

  // Flat list for internal logic compatibility
  const menuItems = menuGroups.flatMap(group => group.items);

  const hasPermission = (permission: string) => {
    if (admin.isSuperAdmin) return true;
    return admin.permissions?.includes(permission);
  };

  const visibleMenuItems = menuItems.filter(item => {
    if (item.permission === 'super_admin_only') return admin.isSuperAdmin;
    return hasPermission(item.permission);
  });

  const [activeTab, setActiveTab] = useState(visibleMenuItems[0]?.value || 'parcels');
  const [isAffiliateDeleteConfirmOpen, setIsAffiliateDeleteConfirmOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null);

  // ── Profit stats state ──────────────────────────────────────────────────────
  const [profitStats, setProfitStats] = useState<{
    feesBalance: number;
    lastReset: any;
    breakdown: {
      clientDepositFees: number;
      clientWithdrawalFees: number;
      formationPlatformFees: number;
      teacherWithdrawalFees: number;
      affiliateWithdrawalFees: number;
    };
  } | null>(null);
  const [profitStatsLoading, setProfitStatsLoading] = useState(false);
  const profitStatsLoaded = useRef(false);
  const [resettingProfit, setResettingProfit] = useState(false);

  // ── Teacher management state ────────────────────────────────────────────────
  const [teachers, setTeachers] = useState<any[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teacherWithdrawals, setTeacherWithdrawals] = useState<any[]>([]);
  const [teacherWithdrawalsLoading, setTeacherWithdrawalsLoading] = useState(false);
  const teacherWithdrawalsLoaded = useRef(false);
  const [teacherFee, setTeacherFee] = useState<number>(0);
  const [teacherFeeInput, setTeacherFeeInput] = useState<string>('');
  const [savingTeacherFee, setSavingTeacherFee] = useState(false);
  const [formationFee, setFormationFee] = useState<number>(0);
  const [formationFeeInput, setFormationFeeInput] = useState<string>('');
  const [savingFormationFee, setSavingFormationFee] = useState(false);
  const [isTeacherDialogOpen, setIsTeacherDialogOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<any | null>(null);
  const [teacherFormData, setTeacherFormData] = useState({ name: '', email: '', password: '' });
  const [savingTeacher, setSavingTeacher] = useState(false);
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [approvingTeacherTx, setApprovingTeacherTx] = useState<string | null>(null);

  const fetchTeachers = async () => {
    setTeachersLoading(true);
    try {
      const res = await fetch('/api/admin/teachers');
      const data = await res.json();
      setTeachers(data.teachers || []);
    } catch { toast.error('Erreur chargement professeurs.'); }
    finally { setTeachersLoading(false); }
  };

  const fetchProfitStats = async () => {
    setProfitStatsLoading(true);
    try {
      const res = await fetch('/api/admin/profit-stats');
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      const data = await res.json();
      setProfitStats(data);
      profitStatsLoaded.current = true;
    } catch { toast.error('Erreur chargement statistiques de profit.'); }
    finally { setProfitStatsLoading(false); }
  };

  const handleProfitReset = async () => {
    if (!confirm('Réinitialiser le solde des profits ? Cette action enregistre un historique et remet les compteurs à zéro.')) return;
    await withAdminPin('Réinitialiser les profits', async () => {
      setResettingProfit(true);
      try {
        const res = await fetch('/api/admin/profit/reset', { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
        toast.success('Solde des profits réinitialisé !');
        fetchProfitStats();
      } catch (e: any) { toast.error(e.message || 'Erreur.'); }
      finally { setResettingProfit(false); }
    });
  };

  const fetchTeacherWithdrawals = async () => {
    setTeacherWithdrawalsLoading(true);
    try {
      const [wdRes, feeRes, formFeeRes] = await Promise.all([
        fetch('/api/admin/teacher-withdrawals'),
        fetch('/api/admin/teacher-fee'),
        fetch('/api/admin/formation-fee'),
      ]);
      const wdData = await wdRes.json();
      const feeData = await feeRes.json();
      const formFeeData = await formFeeRes.json();
      setTeacherWithdrawals(wdData.withdrawals || []);
      setTeacherFee(feeData.fee ?? 0);
      setTeacherFeeInput(String(feeData.fee ?? 0));
      setFormationFee(formFeeData.fee ?? 0);
      setFormationFeeInput(String(formFeeData.fee ?? 0));
      teacherWithdrawalsLoaded.current = true;
    } catch { toast.error('Erreur chargement retraits professeurs.'); }
    finally { setTeacherWithdrawalsLoading(false); }
  };

  const handleSaveFormationFee = async () => {
    const fee = Number(formationFeeInput);
    if (isNaN(fee) || fee < 0 || fee > 100) { toast.error('Frais invalides (0-100%).'); return; }
    await withAdminPin('Modifier les frais de formation', async () => {
      setSavingFormationFee(true);
      try {
        const res = await fetch('/api/admin/formation-fee', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fee }) });
        if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
        toast.success('Frais de vente mis à jour !');
        setFormationFee(fee);
      } catch (e: any) { toast.error(e.message || 'Erreur.'); }
      finally { setSavingFormationFee(false); }
    });
  };

  const handleSaveTeacher = async () => {
    if (!teacherFormData.name.trim() || (!editingTeacher && !teacherFormData.password.trim())) { toast.error('Nom et mot de passe requis.'); return; }
    await withAdminPin('Enregistrer le professeur', async () => {
      setSavingTeacher(true);
      try {
        const url = editingTeacher ? `/api/admin/teachers/${editingTeacher.id}` : '/api/admin/teachers';
        const res = await fetch(url, { method: editingTeacher ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teacherFormData) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erreur');
        toast.success(editingTeacher ? 'Professeur mis à jour !' : 'Professeur créé !');
        setIsTeacherDialogOpen(false);
        fetchTeachers();
      } catch (e: any) { toast.error(e.message || 'Erreur.'); }
      finally { setSavingTeacher(false); }
    });
  };

  const handleDeleteTeacher = async (id: string) => {
    await withAdminPin('Supprimer le professeur', async () => {
      setDeletingTeacherId(id);
      try {
        const res = await fetch(`/api/admin/teachers/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
        toast.success('Professeur supprimé.');
        fetchTeachers();
      } catch (e: any) { toast.error(e.message || 'Erreur.'); }
      finally { setDeletingTeacherId(null); }
    });
  };

  // ── Free Fire Reseller state ────────────────────────────────────────────────
  const [ffResellerAgents, setFFResellerAgents] = useState<any[]>([]);
  const [ffResellerLoading, setFFResellerLoading] = useState(false);
  const ffResellerLoaded = useRef(false);
  const [ffTxs, setFFTxs] = useState<any[]>([]);
  const [ffTxsLoading, setFFTxsLoading] = useState(false);
  const [ffAgentForTx, setFFAgentForTx] = useState<any | null>(null);
  const [ffToggleLoading, setFFToggleLoading] = useState<string | null>(null);
  // Credit dialog
  const [ffCreditDialogOpen, setFFCreditDialogOpen] = useState(false);
  const [ffCreditAgent, setFFCreditAgent] = useState<any | null>(null);
  const [ffCreditOp, setFFCreditOp] = useState<'add' | 'remove'>('add');
  const [ffCreditNote, setFFCreditNote] = useState('');
  const [ffCreditLoading, setFFCreditLoading] = useState(false);
  const [ffSelectedPack, setFFSelectedPack] = useState<any | null>(null);
  const [ffCustomAmount, setFFCustomAmount] = useState('');
  const [ffUseCustom, setFFUseCustom] = useState(false);
  // Packs management
  const [ffCreditPacks, setFFCreditPacks] = useState<any[]>([
    { id: 'pack_5000',  label: 'Pack 5 000',  diamonds: 5000,  priceUSD: 45 },
    { id: 'pack_10000', label: 'Pack 10 000', diamonds: 10000, priceUSD: 85 },
    { id: 'pack_15000', label: 'Pack 15 000', diamonds: 15000, priceUSD: 120 },
    { id: 'pack_20000', label: 'Pack 20 000', diamonds: 20000, priceUSD: 155 },
  ]);
  const [ffPacksLoading, setFFPacksLoading] = useState(false);
  const ffPacksLoaded = useRef(false);
  const [ffPacksDialogOpen, setFFPacksDialogOpen] = useState(false);
  const [ffEditingPacks, setFFEditingPacks] = useState<any[]>([]);
  const [ffPacksSaving, setFFPacksSaving] = useState(false);

  const fetchFFResellerAgents = async () => {
    setFFResellerLoading(true);
    try {
      const res = await fetch('/api/admin/reseller/ff/agents', { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
      const data = await res.json();
      setFFResellerAgents(data.accounts || []);
      ffResellerLoaded.current = true;
    } catch { toast.error('Erreur chargement agents Free Fire.'); }
    finally { setFFResellerLoading(false); }
  };

  const fetchFFPacks = async () => {
    setFFPacksLoading(true);
    try {
      const res = await fetch('/api/admin/reseller/ff/packs', { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
      const data = await res.json();
      if (data.packs?.length) { setFFCreditPacks(data.packs); ffPacksLoaded.current = true; }
    } catch { /* use defaults */ }
    finally { setFFPacksLoading(false); }
  };

  const handleFFPacksSave = async () => {
    await withAdminPin('Enregistrer les packs FF', async () => {
    setFFPacksSaving(true);
    try {
      const res = await fetch('/api/admin/reseller/ff/packs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
        body: JSON.stringify({ packs: ffEditingPacks }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      setFFCreditPacks(ffEditingPacks);
      setFFPacksDialogOpen(false);
      toast.success('Packs de diamants mis à jour !');
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setFFPacksSaving(false); }
  };

  const fetchFFTransactions = async (agentId?: string) => {
    setFFTxsLoading(true);
    try {
      const url = agentId
        ? `/api/admin/reseller/ff/transactions?agentId=${encodeURIComponent(agentId)}&limit=100`
        : '/api/admin/reseller/ff/transactions?limit=100';
      const res = await fetch(url, { headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') } });
      const data = await res.json();
      setFFTxs(data.transactions || []);
    } catch { toast.error('Erreur chargement transactions Free Fire.'); }
    finally { setFFTxsLoading(false); }
  };

  // ── Delete agent ─────────────────────────────────────────────────────────────
  const [agentToDelete, setAgentToDelete] = useState<any | null>(null);
  const [isDeletingAgent, setIsDeletingAgent] = useState(false);
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;
    setIsDeletingAgent(true);
    try {
      const res = await fetch(`/api/admin/agent/${agentToDelete.id}`, {
        method: 'DELETE',
        headers: { 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Erreur lors de la suppression.'); return; }
      toast.success(`Agent "${agentToDelete.name}" supprimé.`);
      setAgentToDelete(null);
      // Refresh lists
      fetchFFResellerAgents();
    } catch { toast.error('Erreur réseau.'); }
    finally { setIsDeletingAgent(false); }
  };

  const handleFFToggle = async (agent: any) => {
    setFFToggleLoading(agent.agentId || agent.id);
    try {
      const res = await fetch('/api/admin/reseller/ff/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
        body: JSON.stringify({ agentId: agent.agentId || agent.id, agentName: agent.agentName || agent.name || '', enabled: !agent.enabled }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      toast.success(agent.enabled ? 'Compte désactivé.' : 'Compte activé !');
      fetchFFResellerAgents();
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setFFToggleLoading(null); }
  };

  const handleFFCreditAdjust = async () => {
    const amount = ffUseCustom ? parseInt(ffCustomAmount) : ffSelectedPack?.diamonds;
    if (!ffCreditAgent || !amount || isNaN(amount) || amount <= 0) { toast.error('Sélectionnez un pack ou entrez un montant.'); return; }
    setFFCreditLoading(true);
    try {
      const res = await fetch('/api/admin/reseller/ff/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-secret': (import.meta.env.VITE_ADMIN_SECRET ?? 'rena-admin-2024') },
        body: JSON.stringify({
          agentId: ffCreditAgent.agentId || ffCreditAgent.id,
          agentName: ffCreditAgent.agentName || ffCreditAgent.name || '',
          amount, operation: ffCreditOp, note: ffCreditNote,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      toast.success(ffCreditOp === 'add'
        ? `+${amount.toLocaleString()} 💎 ajoutés à ${ffCreditAgent.agentName || ffCreditAgent.name} !`
        : `-${amount.toLocaleString()} 💎 retirés.`);
      setFFCreditDialogOpen(false);
      setFFSelectedPack(null); setFFCustomAmount(''); setFFCreditNote(''); setFFCreditAgent(null); setFFUseCustom(false);
      fetchFFResellerAgents();
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setFFCreditLoading(false); }
  };

  const handleTeacherWithdrawalAction = async (id: string, action: 'approve' | 'reject') => {
    setApprovingTeacherTx(id);
    try {
      const res = await fetch(`/api/admin/teacher-withdrawals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      toast.success(action === 'approve' ? 'Retrait approuvé !' : 'Retrait rejeté.');
      fetchTeacherWithdrawals();
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setApprovingTeacherTx(null); }
  };

  const handleSaveTeacherFee = async () => {
    const fee = Number(teacherFeeInput);
    if (isNaN(fee) || fee < 0 || fee > 100) { toast.error('Frais invalides (0-100%).'); return; }
    setSavingTeacherFee(true);
    try {
      const res = await fetch('/api/admin/teacher-fee', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fee }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      setTeacherFee(fee);
      toast.success('Frais de retrait mis à jour !');
    } catch (e: any) { toast.error(e.message || 'Erreur.'); }
    finally { setSavingTeacherFee(false); }
  };

  const [isManualCommissionOpen, setIsManualCommissionOpen] = useState(false);
  const [manualCommissionAffiliateId, setManualCommissionAffiliateId] = useState<string>('');
  const [manualCommissionAffiliateName, setManualCommissionAffiliateName] = useState<string>('');
  const [manualCommissionHTG, setManualCommissionHTG] = useState<string>('');
  const [manualCommissionReason, setManualCommissionReason] = useState<string>('');
  const [isSubmittingManualCommission, setIsSubmittingManualCommission] = useState(false);

  const handleManualCommission = async () => {
    if (!manualCommissionAffiliateId || !manualCommissionHTG) return;
    setIsSubmittingManualCommission(true);
    try {
      const res = await fetch('/api/admin/affiliate/manual-commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: manualCommissionAffiliateId, amountHTG: Number(manualCommissionHTG), reason: manualCommissionReason }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Erreur');
      toast.success(`Commission de ${manualCommissionHTG} HTG envoyée à ${manualCommissionAffiliateName} !`);
      setIsManualCommissionOpen(false);
      setManualCommissionHTG('');
      setManualCommissionReason('');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de l\'envoi de la commission.');
    } finally {
      setIsSubmittingManualCommission(false);
    }
  };
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [affiliateFormData, setAffiliateFormData] = useState<Partial<Affiliate>>({
    name: '',
    username: '',
    password: '',
    code: '',
    balance: 0,
    referredClients: 0,
    points: 0,
    level: 'Bronze',
    directRevenue: 0,
    indirectRevenue: 0,
    totalEarnings: 0,
    parentAffiliateId: '',
    grandparentAffiliateId: '',
    additionalSponsors: []
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  const [tempLogoUrl, setTempLogoUrl] = useState('');
  const [tempProductImageUrl, setTempProductImageUrl] = useState('');
  const [tempProofUrl, setTempProofUrl] = useState('');

  // Form States
  const [formData, setFormData] = useState<Partial<Parcel>>({
    trackingNumber: '',
    status: 'En route',
    currentLocation: '',
    estimatedArrival: '',
    paymentStatus: 'Non payé',
    proofOfDelivery: ''
  });

  const [productFormData, setProductFormData] = useState<Partial<Product>>({
    name: '',
    image: '',
    description: '',
    price: '',
    stock: 0,
    whatsappMessage: '',
    plans: []
  });

  const [tempGameImageUrl, setTempGameImageUrl] = useState('');

  const [notifFilter, setNotifFilter] = useState<'all' | 'registration' | 'withdrawal' | 'deposit' | 'client_tx'>('all');
  const [notifSearch, setNotifSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [pendingTypeFilter, setPendingTypeFilter] = useState<'all' | 'registration' | 'withdrawal' | 'deposit'>('all');
  const deferredNotifSearch = useDeferredValue(notifSearch);
  const [affiliateSearch, setAffiliateSearch] = useState('');
  const deferredAffiliateSearch = useDeferredValue(affiliateSearch);

  const { transactions: walletTransactions, loading: walletTxLoading } = useAllWalletTransactions();
  const { transactions: clientTransactions, loading: clientTxLoading } = useAllClientTransactions();
  const { notifications: adminClientNotifs } = useAdminClientNotifications();
  const [clientTxStatusFilter, setClientTxStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [clientTxTypeFilter, setClientTxTypeFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'purchase'>('all');
  const [clientTxActionLoading, setClientTxActionLoading] = useState<string | null>(null);
  const [purchaseActionLoading, setPurchaseActionLoading] = useState<string | null>(null);

  // ── Credentials modal (approve streaming purchase with login/password) ─────
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [credentialNotif, setCredentialNotif] = useState<any | null>(null);
  const [credentialEmail, setCredentialEmail] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [credentialLoading, setCredentialLoading] = useState(false);

  // ── Promo Codes ────────────────────────────────────────────────────────────
  const { codes: promoCodes, loading: promoCodesLoading, refresh: refreshPromoCodes } = usePromoCodes();
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoEditTarget, setPromoEditTarget] = useState<any | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoServiceName, setPromoServiceName] = useState('');
  const [promoDiscount, setPromoDiscount] = useState('');
  const [promoMaxUses, setPromoMaxUses] = useState('0');
  const [promoActive, setPromoActive] = useState(true);
  const [promoSaving, setPromoSaving] = useState(false);
  const [promoDeleteTarget, setPromoDeleteTarget] = useState<any | null>(null);

  // Affiliate-submitted client requests (client_requests collection)
  const [affiliateClientRequests, setAffiliateClientRequests] = useState<any[]>([]);
  const [affiliateReqLoading, setAffiliateReqLoading] = useState(false);
  const [affiliateReqActionLoading, setAffiliateReqActionLoading] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchAffiliateRequests = async () => {
      setAffiliateReqLoading(true);
      try {
        const res = await fetch('/api/admin/affiliate-requests');
        if (res.ok) {
          const data = await res.json();
          setAffiliateClientRequests(data.requests || []);
        }
      } catch {}
      setAffiliateReqLoading(false);
    };
    fetchAffiliateRequests();
    const interval = setInterval(fetchAffiliateRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAffiliateReqAction = async (reqId: string, action: 'approve' | 'decline') => {
    setAffiliateReqActionLoading(reqId);
    try {
      const res = await fetch(`/api/admin/affiliate-requests/${reqId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      toast.success(action === 'approve' ? 'Dépôt affilié approuvé !' : 'Demande refusée.');
      setAffiliateClientRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: action === 'approve' ? 'approved' : 'declined' } : r));
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setAffiliateReqActionLoading(null);
    }
  };

  const handlePurchaseAction = async (
    notifId: string, transactionId: string, clientId: string,
    amount: number, directSponsorId: string | null, action: 'approve' | 'decline'
  ) => {
    setPurchaseActionLoading(notifId);
    try {
      if (action === 'approve') {
        await approvePurchaseRequest(notifId, transactionId, clientId, amount, directSponsorId);
        toast.success('Achat approuvé !');
      } else {
        await declinePurchaseRequest(notifId, transactionId);
        toast.success('Achat refusé.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setPurchaseActionLoading(null);
    }
  };

  const handleApproveWithCredentials = async () => {
    if (!credentialNotif) return;
    setCredentialLoading(true);
    try {
      const creds = credentialEmail.trim() && credentialPassword.trim()
        ? { email: credentialEmail.trim(), password: credentialPassword.trim() }
        : null;
      await approvePurchaseRequest(
        credentialNotif.id!,
        credentialNotif.transactionId,
        credentialNotif.clientId,
        credentialNotif.amount,
        credentialNotif.directSponsorId || null,
        creds,
        credentialNotif.productName || '',
      );
      toast.success(creds ? '✅ Service approuvé avec identifiants envoyés !' : '✅ Service approuvé !');
      setCredentialsModalOpen(false);
      setCredentialNotif(null);
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setCredentialLoading(false);
    }
  };

  const openPromoDialog = (target: any | null = null) => {
    setPromoEditTarget(target);
    setPromoCode(target?.code || '');
    setPromoServiceName(target?.serviceName || '');
    setPromoDiscount(target?.discountPercent?.toString() || '');
    setPromoMaxUses(target?.maxUses?.toString() || '0');
    setPromoActive(target?.active !== false);
    setPromoDialogOpen(true);
  };

  const handleSavePromoCode = async () => {
    if (!promoCode.trim() || !promoDiscount) { toast.error('Code et réduction requis.'); return; }
    setPromoSaving(true);
    try {
      await savePromoCode({
        code: promoCode.trim(),
        serviceName: promoServiceName.trim(),
        discountPercent: Number(promoDiscount),
        maxUses: Number(promoMaxUses) || 0,
        active: promoActive,
      }, promoEditTarget?.id);
      toast.success(promoEditTarget ? 'Code modifié !' : 'Code créé !');
      setPromoDialogOpen(false);
      refreshPromoCodes();
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setPromoSaving(false);
    }
  };

  const handleDeletePromoCode = async () => {
    if (!promoDeleteTarget) return;
    try {
      await deletePromoCode(promoDeleteTarget.id);
      toast.success('Code supprimé.');
      setPromoDeleteTarget(null);
      refreshPromoCodes();
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    }
  };

  const handleClientTxAction = async (txId: string, status: 'approved' | 'rejected') => {
    setClientTxActionLoading(txId);
    try {
      await updateClientTransactionStatus(txId, status);
      toast.success(status === 'approved' ? 'Transaction approuvée !' : 'Transaction rejetée.');
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setClientTxActionLoading(null);
    }
  };

  const handleWalletTxAction = async (txId: string, status: 'approved' | 'rejected') => {
    setClientTxActionLoading(txId);
    try {
      await updateWalletTransactionStatus(txId, status);
      toast.success(status === 'approved' ? 'Dépôt approuvé !' : 'Dépôt refusé.');
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors du traitement.');
    } finally {
      setClientTxActionLoading(null);
    }
  };

  const filteredClientTransactions = React.useMemo(() => {
    return clientTransactions.filter(tx => {
      const matchStatus = clientTxStatusFilter === 'all' || tx.status === clientTxStatusFilter;
      const matchType = clientTxTypeFilter === 'all' || tx.type === clientTxTypeFilter;
      return matchStatus && matchType;
    });
  }, [clientTransactions, clientTxStatusFilter, clientTxTypeFilter]);

  const pendingClientTxCount = React.useMemo(() => clientTransactions.filter(t => t.status === 'pending').length, [clientTransactions]);

  const pendingClientRequests = React.useMemo(() =>
    clientTransactions.filter(t => t.status === 'pending' && (t.type === 'deposit' || t.type === 'withdrawal')),
    [clientTransactions]
  );

  // Optimized Filtering for Affiliates
  const filteredAffiliatesList = React.useMemo(() => {
    return affiliates.filter(aff => 
      aff.name.toLowerCase().includes(deferredAffiliateSearch.toLowerCase()) ||
      aff.username?.toLowerCase().includes(deferredAffiliateSearch.toLowerCase()) ||
      aff.code?.toLowerCase().includes(deferredAffiliateSearch.toLowerCase())
    );
  }, [affiliates, deferredAffiliateSearch]);

  // Optimized Filtering for Clients
  const filteredClientsList = React.useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(deferredClientSearchQuery.toLowerCase()) ||
      c.phone.includes(deferredClientSearchQuery)
    );
  }, [clients, deferredClientSearchQuery]);

  const [isSliderImageDeleteDialogOpen, setIsSliderImageDeleteDialogOpen] = useState(false);
  const [sliderImageToDelete, setSliderImageToDelete] = useState<{id: string, url: string} | null>(null);
  const [isSliderImageEditDialogOpen, setIsSliderImageEditDialogOpen] = useState(false);
  const [editingSliderImage, setEditingSliderImage] = useState<{ id: string, url: string, title?: string, description?: string } | null>(null);
  const [isSliderUploading, setIsSliderUploading] = useState(false);
  const [tempSliderImageUrl, setTempSliderImageUrl] = useState('');
  const [sliderTitle, setSliderTitle] = useState('');
  const [sliderDescription, setSliderDescription] = useState('');

  const { rankings: officialRankings, loading: officialRankingsLoading } = useMonthlyRankings();
  const { agents: allAgents, loading: agentsLoading } = useAllAgents();
  const [agentPersonalDeposits, setAgentPersonalDeposits] = React.useState<any[]>([]);
  const [agentDepositActionLoading, setAgentDepositActionLoading] = React.useState<string | null>(null);

  React.useEffect(() => {
    const fetchAgentDeposits = async () => {
      try {
        const res = await fetch('/api/admin/agent-personal-transactions');
        if (res.ok) {
          const data = await res.json();
          setAgentPersonalDeposits((data.transactions || []).filter((t: any) => t.type === 'deposit' && t.status === 'pending'));
        }
      } catch {}
    };
    fetchAgentDeposits();
    const interval = setInterval(fetchAgentDeposits, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleAgentDepositAction = async (txId: string, action: 'approve' | 'reject') => {
    setAgentDepositActionLoading(txId);
    try {
      const res = await fetch(`/api/admin/agent-personal-deposit/${txId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      toast.success(action === 'approve' ? 'Dépôt agent approuvé !' : 'Dépôt agent refusé.');
      setAgentPersonalDeposits(prev => prev.filter(t => t.id !== txId));
    } catch (err: any) {
      toast.error(err.message || 'Erreur.');
    } finally {
      setAgentDepositActionLoading(null);
    }
  };

  const [agentSearch, setAgentSearch] = useState('');
  const deferredAgentSearch = useDeferredValue(agentSearch);
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentPhone, setAgentPhone] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [isAgentBalanceDialogOpen, setIsAgentBalanceDialogOpen] = useState(false);
  const [isAutoApproveOn, setIsAutoApproveOn] = useState(true);
  const [nextAutoApproveIn, setNextAutoApproveIn] = useState(60);
  const [selectedAgentForBalance, setSelectedAgentForBalance] = useState<Agent | null>(null);
  const [balanceAdjustment, setBalanceAdjustment] = useState('');
  const [agentWalletType, setAgentWalletType] = useState<'balance' | 'commission'>('balance');
  const [agentWalletNote, setAgentWalletNote] = useState('');

  const filteredAgentsList = React.useMemo(() => {
    return allAgents.filter(a => 
      a.name.toLowerCase().includes(deferredAgentSearch.toLowerCase()) ||
      a.agentCode.includes(deferredAgentSearch)
    );
  }, [allAgents, deferredAgentSearch]);

  const pendingRegistrations = React.useMemo(() => 
    affiliateRequests.filter(r => r.status === 'pending'), 
    [affiliateRequests]
  );
  
  const pendingWithdrawals = React.useMemo(() => 
    allWithdrawals.filter(w => w.status === 'pending'), 
    [allWithdrawals]
  );
  
  const pendingDeposits = React.useMemo(() => 
    walletTransactions.filter(tx => tx.type === 'deposit' && tx.status === 'pending'),
    [walletTransactions]
  );
  
  const pendingTransfersCount = React.useMemo(() => 
    walletTransactions.filter(t => t.type === 'transfer' && t.status === 'pending').length,
    [walletTransactions]
  );
  
  const unreadClientNotifCount = React.useMemo(() => adminClientNotifs.filter(n => !n.read).length, [adminClientNotifs]);
  const totalPending = pendingRegistrations.length + pendingWithdrawals.length + pendingTransfersCount + unreadClientNotifCount;

  useEffect(() => {
    if (totalPending > 0) {
      toast.info(`Vous avez ${totalPending} nouvelle(s) demande(s) en attente.`, {
        id: 'new-requests-toast',
        duration: 8000,
        action: {
          label: 'Voir les demandes',
          onClick: () => setActiveTab('notifications')
        }
      });
    }
  }, [totalPending]);

  const totalAffiliateBalance = React.useMemo(() => {
    return affiliates.reduce((sum, affiliate) => sum + (affiliate.balance || 0), 0);
  }, [affiliates]);

  const allPendingRequests = React.useMemo(() => {
    const registrations = pendingRegistrations.map(r => ({ ...r, type: 'registration' as const }));
    const withdrawals = pendingWithdrawals.map(w => ({ ...w, type: 'withdrawal' as const, name: w.affiliateName }));
    const clientDeposits = pendingClientRequests
      .filter(t => t.type === 'deposit')
      .map(t => ({ ...t, type: 'client_deposit_req' as const, name: t.clientName || 'Client' }));
    const clientWithdrawals = pendingClientRequests
      .filter(t => t.type === 'withdrawal')
      .map(t => ({ ...t, type: 'client_withdrawal_req' as const, name: t.clientName || 'Client' }));

    let combined = [...registrations, ...withdrawals, ...clientDeposits, ...clientWithdrawals];

    if (notifFilter === 'registration') {
      combined = combined.filter(r => r.type === 'registration');
    } else if (notifFilter === 'withdrawal') {
      combined = combined.filter(r => r.type === 'withdrawal');
    } else if (notifFilter === 'deposit') {
      combined = combined.filter(r => r.type === 'client_deposit_req');
    } else if (notifFilter === 'client_tx') {
      combined = combined.filter(r => r.type === 'client_deposit_req' || r.type === 'client_withdrawal_req');
    }

    if (deferredNotifSearch) {
      combined = combined.filter(r => 
        r.name.toLowerCase().includes(deferredNotifSearch.toLowerCase()) ||
        (r.type === 'withdrawal' && (r as any).affiliateCode?.toLowerCase().includes(deferredNotifSearch.toLowerCase()))
      );
    }

    return combined.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return dateB - dateA;
    });
  }, [pendingRegistrations, pendingWithdrawals, pendingClientRequests, affiliates, notifFilter, notifSearch]);

  // Memoize filtered and sorted lists for performance
  const winnersQueue = React.useMemo(() => {
    return [...affiliates]
      .filter(a => (a.points || 0) > 0)
      .sort((a, b) => (b.points || 0) - (a.points || 0))
      .slice(0, 3);
  }, [affiliates]);

  const filteredParcels = React.useMemo(() => {
    return parcels.filter(p => 
      p.trackingNumber.toLowerCase().includes(deferredSearchTerm.toLowerCase()) ||
      p.currentLocation.toLowerCase().includes(deferredSearchTerm.toLowerCase())
    );
  }, [parcels, deferredSearchTerm]);

  const [walletTxFilter, setWalletTxFilter] = useState<'all' | 'deposit' | 'withdrawal' | 'transfer'>('all');
  const [walletStatusFilter, setWalletStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const filteredWalletTransactions = React.useMemo(() => {
    return walletTransactions.filter(tx => {
      const matchesType = walletTxFilter === 'all' || tx.type === walletTxFilter;
      const matchesStatus = walletStatusFilter === 'all' || tx.status === walletStatusFilter;
      return matchesType && matchesStatus;
    });
  }, [walletTransactions, walletTxFilter, walletStatusFilter]);

  const filteredAffiliates = React.useMemo(() => {
    if (!affiliateSearch.trim()) return affiliates;
    const searchTerms = affiliateSearch.toLowerCase().trim().split(/\s+/);
    return affiliates.filter(a => {
      const fullName = (a.name || '').toLowerCase();
      const code = (a.code || '').toLowerCase();
      const username = (a.username || '').toLowerCase();
      const combined = `${fullName} ${code} ${username}`;
      return searchTerms.every(term => combined.includes(term));
    });
  }, [affiliates, affiliateSearch]);

  const handleOpenDialog = (parcel?: Parcel) => {
    if (parcel) {
      setEditingParcel(parcel);
      setFormData(parcel);
    } else {
      setEditingParcel(null);
      setFormData({
        trackingNumber: `NP${Math.floor(100000000 + Math.random() * 900000000)}`,
        status: 'En route',
        currentLocation: '',
        estimatedArrival: '',
        paymentStatus: 'Non payé',
        proofOfDelivery: ''
      });
    }
    setIsDialogOpen(true);
  };

  const handleOpenFormationDialog = (formation?: Formation) => {
    if (formation) {
      setEditingFormation(formation);
      setFormationFormData({ ...formation, modules: formation.modules || [], chapters: formation.chapters || [], resources: formation.resources || [], tags: formation.tags || [] });
    } else {
      setEditingFormation(null);
      setFormationFormData({
        title: '', description: '', shortDescription: '', coverImage: '',
        price: 0, originalPrice: undefined, level: 'debutant', published: true, comingSoon: false,
        modules: [], chapters: [], resources: [], pdfUrl: '',
        instructor: '', instructorBio: '', instructorAvatar: '',
        language: 'Français', totalDuration: '', hasCertificate: false,
        category: '', tags: [], prerequisites: '', enrollmentLimit: undefined,
        studentsCount: 0, rating: 0
      });
    }
    setFormationTagInput('');
    setIsFormationDialogOpen(true);
  };

  const handleSaveFormation = async () => {
    if (!formationFormData.title) { toast.error('Le titre est requis.'); return; }
    setIsSaving(true);
    try {
      await saveAdminFormation(formationFormData, editingFormation?.id);
      toast.success(editingFormation ? 'Formation mise à jour !' : 'Formation créée !');
      setIsFormationDialogOpen(false);
      refreshFormations();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la sauvegarde.');
    } finally { setIsSaving(false); }
  };

  const handleConfirmDeleteFormation = async () => {
    if (!formationToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteAdminFormation(formationToDelete.id);
      toast.success('Formation supprimée.');
      setIsFormationDeleteDialogOpen(false);
      refreshFormations();
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la suppression.');
    } finally { setIsDeleting(false); setFormationToDelete(null); }
  };

  const addFormationModule = () => {
    setFormationFormData(prev => ({
      ...prev,
      modules: [...(prev.modules || []), { id: generateId(), title: '', videoUrl: '', duration: '', order: (prev.modules || []).length + 1, description: '', pdfUrl: '', chapterId: '' }]
    }));
  };

  const updateFormationModule = (id: string, updates: Partial<FormationModule>) => {
    setFormationFormData(prev => ({
      ...prev,
      modules: (prev.modules || []).map(m => m.id === id ? { ...m, ...updates } : m)
    }));
  };

  const removeFormationModule = (id: string) => {
    setFormationFormData(prev => ({ ...prev, modules: (prev.modules || []).filter(m => m.id !== id) }));
  };

  const addFormationChapter = () => {
    setFormationFormData(prev => ({
      ...prev,
      chapters: [...(prev.chapters || []), { id: generateId(), title: '', order: (prev.chapters || []).length + 1, description: '' }]
    }));
  };

  const updateFormationChapter = (id: string, updates: Partial<FormationChapter>) => {
    setFormationFormData(prev => ({
      ...prev,
      chapters: (prev.chapters || []).map(c => c.id === id ? { ...c, ...updates } : c)
    }));
  };

  const removeFormationChapter = (id: string) => {
    setFormationFormData(prev => ({ ...prev, chapters: (prev.chapters || []).filter(c => c.id !== id) }));
  };

  const addFormationResource = () => {
    setFormationFormData(prev => ({
      ...prev,
      resources: [...(prev.resources || []), { id: generateId(), name: '', url: '', type: 'pdf' as const }]
    }));
  };

  const updateFormationResource = (id: string, updates: Partial<FormationResource>) => {
    setFormationFormData(prev => ({
      ...prev,
      resources: (prev.resources || []).map(r => r.id === id ? { ...r, ...updates } : r)
    }));
  };

  const removeFormationResource = (id: string) => {
    setFormationFormData(prev => ({ ...prev, resources: (prev.resources || []).filter(r => r.id !== id) }));
  };

  const handleOpenProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData({
        ...product,
        plans: product.plans || []
      });
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: '',
        image: '',
        description: '',
        price: '',
        stock: 0,
        whatsappMessage: '',
        plans: [],
        allowCustomAmount: false,
        customExchangeRate: undefined
      });
    }
    setIsProductDialogOpen(true);
  };

  const updateProductPlan = (id: string, updates: any) => {
    setProductFormData({
      ...productFormData,
      plans: (productFormData.plans || []).map(plan => plan.id === id ? { ...plan, ...updates } : plan)
    });
  };

  const addProductPlan = () => {
    const generateId = () => Math.random().toString(36).substr(2, 9);
    setProductFormData({
      ...productFormData,
      plans: [...(productFormData.plans || []), { id: generateId(), name: '', price: '' }]
    });
  };

  const removeProductPlan = (id: string) => {
    if (!id) return;
    setProductFormData(prev => ({
      ...prev,
      plans: (prev.plans || []).filter(plan => plan.id !== id)
    }));
    toast.info("Plan retiré. N'oubliez pas d'enregistrer.");
  };

  const handleSaveProduct = async () => {
    setIsSaving(true);
    try {
      await saveProduct(productFormData, editingProduct?.id);
      toast.success(editingProduct ? "Produit mis à jour !" : "Produit ajouté !");
      setIsProductDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenCardDialog = (card?: CardTopup) => {
    if (card) {
      setEditingCard(card);
      setCardFormData({ 
        ...card,
        goldRate: card.goldRate || 1,
        presets: card.presets || [],
        feeRules: card.feeRules || []
      });
    } else {
      setEditingCard(null);
      setCardFormData({
        name: '',
        image: '',
        description: '',
        price: '',
        stock: 0,
        whatsappMessage: '',
        goldRate: 1,
        presets: [],
        feeRules: []
      });
    }
    setTempCardImageUrl('');
    setIsCardDialogOpen(true);
  };

  const handleSaveCard = async () => {
    if (!cardFormData.name || !cardFormData.price) {
      toast.error("Le nom et le prix sont requis.");
      return;
    }
    setIsSaving(true);
    try {
      await saveCardTopup(cardFormData, editingCard?.id);
      toast.success(editingCard ? "Carte mise à jour." : "Carte ajoutée.");
      setIsCardDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteCard = async () => {
    if (!cardToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteCardTopup(cardToDelete.id);
      toast.success("Carte supprimée.");
      setIsCardDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setCardToDelete(null);
    }
  };

  const handleCardImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      const url = await uploadLogo(compressedFile, (p) => setUploadProgress(p));
      setCardFormData(prev => ({ ...prev, image: url }));
      toast.success("Image carte téléchargée !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement de l'image.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenGameDialog = (game?: Game) => {
    if (game) {
      setEditingGame(game);
      setGameFormData({
        name: game.name || '',
        image: game.image || '',
        description: game.description || '',
        priceRange: game.priceRange || '',
        whatsappMessage: game.whatsappMessage || '',
        catalog: (game.catalog || []).map(item => ({
          ...item,
          id: item.id || generateId()
        }))
      });
    } else {
      setEditingGame(null);
      setGameFormData({
        name: '',
        image: '',
        description: '',
        priceRange: '',
        whatsappMessage: '',
        catalog: []
      });
    }
    setIsGameDialogOpen(true);
  };

  const handleSaveGame = async () => {
    if (!gameFormData.name || !gameFormData.image || !gameFormData.priceRange) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }
    setIsSaving(true);
    try {
      await saveGame(gameFormData, editingGame?.id);
      toast.success(editingGame ? "Jeu mis à jour !" : "Jeu ajouté !");
      setIsGameDialogOpen(false);
    } catch (error: any) {
      console.error('Save game error:', error);
      const isPermission = error.message?.includes('permissions');
      toast.error(isPermission ? "Erreur de permissions (Droits admin requis)" : `Erreur lors de l'enregistrement: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateCatalogItem = (id: string, updates: any) => {
    setGameFormData({
      ...gameFormData,
      catalog: (gameFormData.catalog || []).map(item => item.id === id ? { ...item, ...updates } : item)
    });
  };

  const addCatalogItem = () => {
    setGameFormData({
      ...gameFormData,
      catalog: [...(gameFormData.catalog || []), { id: generateId(), name: '', price: '', whatsappMessage: '' }]
    });
  };

  const removeCatalogItem = (id: string) => {
    if (!id) return;
    setGameFormData(prev => ({
      ...prev,
      catalog: (prev.catalog || []).filter(item => item.id !== id)
    }));
    toast.info("Pack retiré. N'oubliez pas d'enregistrer.");
  };

  const handleConfirmDeleteGame = async () => {
    if (!gameToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteGame(gameToDelete.id);
      toast.success("Jeu supprimé.");
      setIsGameDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setGameToDelete(null);
    }
  };

  const handleGameImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const compressed = await compressImage(file);
      const url = await uploadProof(compressed, `game_${Date.now()}`, (p) => setUploadProgress(p));
      setGameFormData({ ...gameFormData, image: url });
      toast.success("Image du jeu téléchargée !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleAwardPrizes = async () => {
    setIsAwarding(true);
    try {
      const winners = await awardMonthlyPrizes();
      if (winners.length > 0) {
        let message = "Prix décernés avec succès ! ";
        winners.forEach((w, i) => {
          const prize = i === 0 ? 500 : i === 1 ? 250 : 150;
          message += `${i+1}er: ${w.name} (+${prize} G) | `;
        });
        toast.success(message, { duration: 6000 });
      } else {
        toast.info("Aucun affilié éligible pour les prix ce mois-ci.");
      }
    } catch (error) {
      toast.error("Erreur lors de la distribution des prix.");
    } finally {
      setIsAwarding(false);
    }
  };

  const handleClearWinners = async () => {
    setIsClearingWinners(true);
    try {
      await clearMonthlyWinners();
      toast.success("Classement vidé !");
    } catch (error) {
      toast.error("Erreur lors de la réinitialisation.");
    } finally {
      setIsClearingWinners(false);
    }
  };

  const handleToggleWinnerStatus = async (affiliate: Affiliate) => {
    try {
      await saveAffiliate({ isMonthlyWinner: !affiliate.isMonthlyWinner }, affiliate.id);
      toast.success(affiliate.isMonthlyWinner ? "Retiré du classement" : "Ajouté au classement");
    } catch (error) {
      toast.error("Erreur lors de la modification.");
    }
  };

  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteProduct(productToDelete.id);
      toast.success("Produit supprimé.");
      setIsProductDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setProductToDelete(null);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const url = await uploadLogo(file, (p) => setUploadProgress(p));
      await updateSettings({ logoUrl: url });
      toast.success("Logo mis à jour !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement du logo.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleSliderImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSliderUploading(true);
    setUploadProgress(0);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      const url = await uploadLogo(compressedFile, (p) => setUploadProgress(p));
      await saveSliderImage(url, sliderTitle, sliderDescription);
      setSliderTitle('');
      setSliderDescription('');
      toast.success("Image slider ajoutée !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement de l'image.");
    } finally {
      setIsSliderUploading(false);
      setUploadProgress(0);
    }
  };

  const handleConfirmDeleteSliderImage = async () => {
    if (!sliderImageToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteSliderImage(sliderImageToDelete.id);
      toast.success("Image supprimée.");
      setIsSliderImageDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setSliderImageToDelete(null);
    }
  };

  const handleSaveSliderUrl = async () => {
    if (!tempSliderImageUrl.trim()) {
      toast.error("Veuillez entrer une URL valide.");
      return;
    }
    setIsSaving(true);
    try {
      await saveSliderImage(tempSliderImageUrl.trim(), sliderTitle, sliderDescription);
      setTempSliderImageUrl('');
      setSliderTitle('');
      setSliderDescription('');
      toast.success("Image ajoutée via lien !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'ajout de l'image.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSliderImage = async () => {
    if (!editingSliderImage?.id) return;
    setIsSaving(true);
    try {
      await updateSliderImage(editingSliderImage.id, {
        url: editingSliderImage.url,
        title: editingSliderImage.title,
        description: editingSliderImage.description
      });
      toast.success("Image slider mise à jour !");
      setIsSliderImageEditDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
      setEditingSliderImage(null);
    }
  };

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      const url = await uploadLogo(compressedFile, (p) => setUploadProgress(p)); // Reuse uploadLogo for generic images
      setProductFormData(prev => ({ ...prev, image: url }));
      toast.success("Image produit téléchargée !");
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du téléchargement de l'image.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleOpenDeleteDialog = (parcel: Parcel) => {
    setParcelToDelete(parcel);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!parcelToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteParcel(parcelToDelete.id);
      toast.success("Colis supprimé avec succès.");
      setIsDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setParcelToDelete(null);
    }
  };

  const handleSaveAffiliate = async (formData: Partial<Affiliate>) => {
    if (!formData.name || !formData.username || !formData.password || !formData.code) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    setIsSaving(true);
    try {
      await saveAffiliate(formData, editingAffiliate?.id);
      toast.success(editingAffiliate ? "Affilié mis à jour !" : "Affilié ajouté !");
      setIsAffiliateDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAffiliateDeleteDialog = (affiliate: Affiliate) => {
    setAffiliateToDelete(affiliate);
    setIsAffiliateDeleteConfirmOpen(true);
  };

  const handleConfirmAffiliateDelete = async () => {
    if (!affiliateToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteAffiliate(affiliateToDelete.id);
      toast.success("Affilié supprimé avec succès.");
      setIsAffiliateDeleteConfirmOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setAffiliateToDelete(null);
    }
  };

  const handleOpenNavButtonDialog = (button?: NavButton) => {
    if (button) {
      setEditingNavButton(button);
      setNavButtonFormData(button);
    } else {
      setEditingNavButton(null);
      setNavButtonFormData({
        label: '',
        iconName: 'Package',
        targetUrl: '',
        redirectionInstruction: '',
        color: '#2563EB',
        order: (buttons.length || 0) + 1
      });
    }
    setIsNavButtonDialogOpen(true);
  };

  const handleSaveNavButton = async () => {
    if (!navButtonFormData.label || !navButtonFormData.targetUrl) {
      toast.error("Le libellé et l'URL sont requis.");
      return;
    }
    setIsSaving(true);
    try {
      await saveNavButton(navButtonFormData, editingNavButton?.id);
      toast.success(editingNavButton ? "Bouton mis à jour !" : "Bouton ajouté !");
      setIsNavButtonDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDeleteNavButton = async () => {
    if (!navButtonToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteNavButton(navButtonToDelete.id);
      toast.success("Bouton supprimé.");
      setIsNavButtonDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setNavButtonToDelete(null);
    }
  };

  const handleAddAgent = async () => {
    if (!agentName || !agentEmail) {
      toast.error("Le nom et l'email Google sont requis.");
      return;
    }
    setIsSaving(true);
    try {
      const code = await createAgent(agentName, agentPhone, agentEmail.trim().toLowerCase());
      toast.success(`Agent créé ! Code: ${code}. L'agent peut maintenant se connecter avec Google.`);
      setIsAgentDialogOpen(false);
      setAgentName('');
      setAgentPhone('');
      setAgentEmail('');
    } catch (error) {
      toast.error("Erreur lors de la création de l'agent.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateAgentBalanceAction = async (type: 'credit' | 'debit') => {
    if (!selectedAgentForBalance?.id || !balanceAdjustment) return;
    const amount = parseFloat(balanceAdjustment);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/agent/${selectedAgentForBalance.id}/wallet/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, wallet: agentWalletType, amount, note: agentWalletNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      const walletLabel = agentWalletType === 'commission' ? 'Wallet Affilié' : 'Wallet Agent';
      toast.success(`${walletLabel} mis à jour.`);
      setIsAgentBalanceDialogOpen(false);
      setBalanceAdjustment('');
      setAgentWalletNote('');
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleAgentLock = async (agent: Agent) => {
    if (!agent.id) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/agent/${agent.id}/toggle-lock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur serveur.');
      toast.success(data.walletLocked ? '🔒 Wallet Agent verrouillé.' : '🔓 Wallet Agent déverrouillé.');
    } catch (error: any) {
      toast.error(error.message || "Erreur.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveTransferAction = async (tx: WalletTransaction) => {
    setIsSaving(true);
    try {
      await approveTransfer(tx);
      toast.success("Transfert approuvé !");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors de l'approbation.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRejectTransferAction = async (tx: WalletTransaction) => {
    if (!tx.id) return;
    setIsSaving(true);
    try {
      await rejectTransfer(tx.id);
      toast.success("Transfert rejeté.");
    } catch (error: any) {
      toast.error(error.message || "Erreur lors du rejet.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApproveAllTransfers = async () => {
    const pending = walletTransactions.filter(t => t.type === 'transfer' && t.status === 'pending');
    if (pending.length === 0) return;

    setIsSaving(true);
    let successCount = 0;
    let failCount = 0;

    for (const tx of pending) {
      try {
        await approveTransfer(tx);
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    if (successCount > 0) toast.success(`${successCount} transferts approuvés automatiquement.`);
    if (failCount > 0) console.error(`${failCount} transferts ont échoué lors de l'auto-approbation (solde insuffisant).`);
    setIsSaving(false);
    setNextAutoApproveIn(60);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    let countdown: NodeJS.Timeout;

    if (isAutoApproveOn) {
      interval = setInterval(() => {
        handleApproveAllTransfers();
      }, 60000);

      countdown = setInterval(() => {
        setNextAutoApproveIn((prev) => (prev > 0 ? prev - 1 : 60));
      }, 1000);
    } else {
      setNextAutoApproveIn(60);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (countdown) clearInterval(countdown);
    };
  }, [isAutoApproveOn, walletTransactions, handleApproveAllTransfers]);

  const handleWithdrawalAction = async (request: WithdrawalRequest, status: 'approved' | 'rejected') => {
    if (status === 'rejected') {
      setWithdrawalToReject(request);
      setRejectionReason('');
      setIsWithdrawalRejectionDialogOpen(true);
      return;
    }

    try {
      await updateWithdrawalStatus(request.id!, status);
      toast.success(`Demande approuvée !`);
      
      const message = `Bonjour ${request.affiliateName},\n\nVotre demande de retrait de ${request.amount} $ a été validée avec succès. Vous recevrez le paiement sur votre compte ${request.method} dans les plus brefs délais.\n\nMerci pour votre patience et votre engagement avec Rena Affilié.\n\nCordialement,\nL'équipe Rena`;
      
      toast.success("Message de confirmation prêt.");
      console.log("Message pour l'affilié:", message);
      
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut.");
    }
  };

  const handleConfirmRejectionBase = async () => {
    if (!withdrawalToReject?.id || !rejectionReason.trim()) return;
    setIsSaving(true);
    try {
      await updateWithdrawalStatus(withdrawalToReject.id, 'rejected', rejectionReason);
      toast.success("Demande rejetée.");
      setIsWithdrawalRejectionDialogOpen(false);
      setWithdrawalToReject(null);
      setRejectionReason('');
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors du rejet.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleWithdrawals = async () => {
    if (!settings) return;
    try {
      await updateSettings({ withdrawalsEnabled: !settings.withdrawalsEnabled });
      toast.success(settings.withdrawalsEnabled ? "Demandes de retrait désactivées." : "Demandes de retrait réactivées.");
      setIsWithdrawalToggleConfirmOpen(false);
    } catch (error) {
      toast.error("Erreur lors de la mise à jour des paramètres.");
    }
  };

  const handleToggleLockEdits = async () => {
    if (!settings) return;
    
    // If we are currently LOCKED, we need a code to UNLOCK
    if (settings.lockAffiliateEdits) {
      if (lockCodeInput !== (settings.lockAffiliateEditsCode || '0000')) {
        toast.error("Code de déverrouillage incorrect.");
        return;
      }
    }

    try {
      await updateSettings({ lockAffiliateEdits: !settings.lockAffiliateEdits });
      toast.success(settings.lockAffiliateEdits ? "Modifications déverrouillées." : "Modifications verrouillées.");
      setIsUnlockDialogOpen(false);
      setLockCodeInput('');
    } catch (error) {
      toast.error("Erreur lors de la mise à jour des paramètres.");
    }
  };

  const handleQuickCredit = async () => {
    if (!selectedAffiliateForCredit || quickCreditAmount === 0) return;
    setIsSaving(true);
    try {
      const exchangeRate = settings?.exchangeRate || 146;
      const usdAmount = Number((quickCreditAmount / exchangeRate).toFixed(2));
      const newBalance = (selectedAffiliateForCredit.balance || 0) + usdAmount;
      const newEarnings = (selectedAffiliateForCredit.totalEarnings || 0) + (usdAmount > 0 ? usdAmount : 0);
      
      await saveAffiliate({
        balance: newBalance,
        totalEarnings: newEarnings,
        updatedAt: serverTimestamp()
      }, selectedAffiliateForCredit.id);

      // Record Transaction for transparency
      await addDoc(collection(db, 'wallet_transactions'), {
        affiliateId: selectedAffiliateForCredit.id,
        type: 'deposit',
        amount: usdAmount,
        status: 'completed',
        description: `Dépôt Admin (${quickCreditAmount.toLocaleString()} HTG @ ${exchangeRate})`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      
      toast.success(`Le compte de ${selectedAffiliateForCredit.name} a été crédité de ${usdAmount} $ (${quickCreditAmount} G).`);
      setIsQuickCreditDialogOpen(false);
      setQuickCreditAmount(0);
      setSelectedAffiliateForCredit(null);
    } catch (error) {
      console.error("Credit error:", error);
      toast.error("Erreur lors du crédit du compte.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAffiliateRequestAction = async (request: AffiliateRequest, status: 'approved' | 'rejected') => {
    try {
      await updateAffiliateRequestStatus(request.id!, status);
      toast.success(`Demande d'inscription ${status === 'approved' ? 'approuvée' : 'rejetée'} !`);
      
      if (status === 'approved') {
        // Open the affiliate dialog with pre-filled data
        setEditingAffiliate(null);
        setAffiliateFormData({
          name: request.name,
          username: request.email.split('@')[0],
          password: Math.random().toString(36).slice(-8),
          code: `AFF${Math.floor(1000 + Math.random() * 9000)}`,
          balance: 0,
          referredClients: 0,
          level: 'Bronze',
          directRevenue: 0,
          indirectRevenue: 0,
          totalEarnings: 0,
          points: 0,
          parentAffiliateId: '',
          grandparentAffiliateId: '',
          additionalSponsors: []
        });
        setIsAffiliateDialogOpen(true);
      }
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour de la demande.");
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveParcel(formData, editingParcel?.id);
      toast.success(editingParcel ? "Colis mis à jour !" : "Colis ajouté avec succès !");
      setIsDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Une erreur est survenue lors de l'enregistrement.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadProgress(0);
    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      const url = await uploadProof(compressedFile, formData.trackingNumber!, (p) => setUploadProgress(p));
      setFormData(prev => ({ ...prev, proofOfDelivery: url }));
      toast.success("Image téléchargée et optimisée !");
    } catch (error) {
      console.error(error);
      toast.error("Échec du téléchargement de l'image.");
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const renderAgents = () => (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-dark tracking-tight">Agents</h2>
          <p className="text-gray-400 text-sm mt-1">Gérez les agents de dépôt physique, leurs wallets et leurs demandes.</p>
        </div>
        <Button
          onClick={() => setIsAgentDialogOpen(true)}
          className="rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white shadow-lg shadow-primary/25 h-12 px-6 font-black uppercase tracking-widest text-[10px] border-0"
        >
          <PlusCircle className="h-4 w-4 mr-2" />
          Nouvel Agent
        </Button>
      </div>

      {/* ── Dépôts en attente ── */}
      {agentPersonalDeposits.length > 0 && (
        <div className="rounded-3xl border-2 border-amber-200 bg-amber-50/60 overflow-hidden">
          <div className="flex items-center gap-3 px-6 py-5 border-b border-amber-200">
            <div className="h-10 w-10 rounded-2xl bg-amber-400 flex items-center justify-center shadow-md shadow-amber-200">
              <ArrowDown className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-black text-amber-900 text-base">Dépôts en attente d'approbation</p>
              <p className="text-xs text-amber-600 mt-0.5">Ces agents ont soumis une demande de recharge — approuvez ou refusez.</p>
            </div>
            <span className="h-7 min-w-[28px] px-2 flex items-center justify-center rounded-full bg-amber-400 text-white text-xs font-black shadow">
              {agentPersonalDeposits.length}
            </span>
          </div>
          <div className="divide-y divide-amber-200">
            {agentPersonalDeposits.map(tx => (
              <div key={tx.id} className="flex items-center gap-4 px-6 py-4">
                <div className="h-10 w-10 rounded-2xl bg-white border-2 border-amber-200 flex items-center justify-center shrink-0">
                  <UserCheck className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-dark truncate">{tx.agentName || tx.agentCode}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tx.method}{tx.accountNumber ? ` · ${tx.accountNumber}` : ''}</p>
                </div>
                <p className="text-xl font-black text-emerald-600 shrink-0">${tx.amount}</p>
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-500 hover:bg-emerald-600 h-9 text-[10px] font-black uppercase px-4 rounded-xl border-0 shadow-sm"
                    disabled={agentDepositActionLoading === tx.id}
                    onClick={() => handleAgentDepositAction(tx.id, 'approve')}
                  >
                    {agentDepositActionLoading === tx.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '✓ Approuver'}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-9 text-[10px] font-black uppercase px-4 rounded-xl"
                    disabled={agentDepositActionLoading === tx.id}
                    onClick={() => handleAgentDepositAction(tx.id, 'reject')}
                  >
                    ✕ Refuser
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Barre de recherche ── */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Rechercher par nom ou code agent..."
          value={agentSearch}
          onChange={(e) => setAgentSearch(e.target.value)}
          className="pl-12 h-13 rounded-2xl bg-white border-2 border-gray-100 focus:border-primary/30 focus:ring-0 text-base font-medium shadow-sm"
        />
      </div>

      {/* ── Liste des agents ── */}
      {agentsLoading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-300">
          <Loader2 className="h-12 w-12 animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest">Chargement…</p>
        </div>
      ) : filteredAgentsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-gray-200">
          <UserCheck className="h-16 w-16" />
          <p className="text-sm font-black uppercase tracking-widest text-gray-400">Aucun agent trouvé</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredAgentsList.map((agent) => (
            <div
              key={agent.id}
              className="bg-white rounded-3xl border-2 border-gray-100 hover:border-primary/20 hover:shadow-lg transition-all duration-200 p-5"
            >
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  {agent.photoUrl
                    ? <img src={agent.photoUrl} className="h-14 w-14 rounded-2xl object-cover" alt={agent.name} />
                    : <span className="text-xl font-black text-primary">{(agent.name || '?')[0].toUpperCase()}</span>
                  }
                </div>

                {/* Infos principales */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-black text-dark text-lg leading-tight">{agent.name}</p>
                    <Badge className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase border-0 ${
                      agent.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'
                    }`}>
                      {agent.status === 'active' ? 'Actif' : 'Inactif'}
                    </Badge>
                    {agent.walletLocked && (
                      <Badge className="rounded-lg px-2 py-0.5 text-[10px] font-black uppercase border-0 bg-red-100 text-red-600">
                        🔒 Verrouillé
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs font-mono text-gray-400">CODE: {agent.agentCode}</span>
                    {agent.phone && <span className="text-xs text-gray-400">{agent.phone}</span>}
                    {agent.email && <span className="text-xs text-gray-400">{agent.email}</span>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedAgentForBalance(agent);
                      setAgentWalletType('balance');
                      setBalanceAdjustment('');
                      setAgentWalletNote('');
                      setIsAgentBalanceDialogOpen(true);
                    }}
                    className="rounded-xl border-2 border-gray-100 hover:border-primary hover:text-primary transition-all h-9 px-3 text-xs font-black"
                  >
                    <Wallet className="h-3.5 w-3.5 mr-1.5" />
                    Wallets
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleAgentLock(agent)}
                    disabled={isSaving}
                    className={`rounded-xl border-2 h-9 w-9 p-0 transition-all ${agent.walletLocked ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-gray-100 text-gray-400 hover:border-gray-300'}`}
                    title={agent.walletLocked ? 'Déverrouiller' : 'Verrouiller'}
                  >
                    {agent.walletLocked ? '🔒' : '🔓'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAgentToDelete(agent)}
                    className="rounded-xl border-2 border-red-100 text-red-400 hover:bg-red-50 hover:border-red-300 h-9 w-9 p-0 transition-all"
                    title="Supprimer l'agent"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Wallets */}
              <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-100">
                <div className="rounded-2xl bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-400 mb-1">Wallet Agent</p>
                  <p className="text-2xl font-black text-blue-700">${(agent.balance || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-blue-400 mt-0.5">Caisse opérationnelle</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">Commissions</p>
                  <p className="text-2xl font-black text-amber-600">${(agent.commissionBalance || 0).toFixed(2)}</p>
                  <p className="text-[10px] text-amber-400 mt-0.5">Gains accumulés</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Agent Dialog */}
      <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
        <DialogContent className="rounded-[2.5rem] p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Créer un Nouvel Agent</DialogTitle>
            <DialogDescription>
              Un code unique de 8 chiffres sera généré automatiquement. L'agent peut l'utiliser pour valider les dépôts physiques.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium">
              L'agent se connectera uniquement via son compte Google. L'email doit correspondre exactement.
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Nom de l'Agent *</Label>
              <Input 
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                placeholder="Ex: Jean Pierre"
                className="h-14 rounded-2xl bg-gray-50 border-0 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Email Google de l'Agent *</Label>
              <Input 
                type="email"
                value={agentEmail}
                onChange={(e) => setAgentEmail(e.target.value)}
                placeholder="agent@gmail.com"
                className="h-14 rounded-2xl bg-gray-50 border-0 focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Téléphone (optionnel)</Label>
              <Input 
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                placeholder="+509 ..."
                className="h-14 rounded-2xl bg-gray-50 border-0 focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <DialogFooter className="mt-8 flex gap-3">
            <Button variant="ghost" onClick={() => { setIsAgentDialogOpen(false); setAgentName(''); setAgentPhone(''); setAgentEmail(''); }} className="rounded-2xl h-12 flex-1">Annuler</Button>
            <Button 
              onClick={handleAddAgent}
              disabled={isSaving}
              className="rounded-2xl h-12 flex-1 bg-primary hover:bg-primary-dark text-white font-black uppercase tracking-widest text-[11px] border-0"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : 'Créer Agent'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Balance Adjustment Dialog */}
      <Dialog open={isAgentBalanceDialogOpen} onOpenChange={(v) => { setIsAgentBalanceDialogOpen(v); if (!v) { setBalanceAdjustment(''); setAgentWalletNote(''); setAgentWalletType('balance'); } }}>
        <DialogContent className="rounded-[2.5rem] p-8 border-0 shadow-2xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Gestion des Wallets</DialogTitle>
            <DialogDescription>
              Agent: <span className="font-black text-dark">{selectedAgentForBalance?.name}</span>
              <span className="ml-2 font-mono text-xs text-gray-400">#{selectedAgentForBalance?.agentCode}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="pt-4 space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center bg-slate-900 text-white p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 block mb-1">Wallet Agent</span>
                <span className="text-2xl font-black">{selectedAgentForBalance?.balance.toLocaleString()} $</span>
                {selectedAgentForBalance?.walletLocked && <span className="text-[9px] text-red-400 block mt-0.5 font-black">🔒 Verrouillé</span>}
              </div>
              <div className="text-center bg-amber-50 border-2 border-amber-200 p-4 rounded-2xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 block mb-1">Wallet Affilié</span>
                <span className="text-2xl font-black text-amber-700">{(selectedAgentForBalance?.commissionBalance || 0).toFixed(2)} $</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Wallet à ajuster</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setAgentWalletType('balance')}
                  className={`h-11 rounded-2xl font-black text-sm border-2 transition-all ${agentWalletType === 'balance' ? 'bg-slate-900 text-white border-slate-900' : 'border-gray-200 text-gray-500 hover:border-slate-400'}`}
                >
                  Wallet Agent
                </button>
                <button
                  onClick={() => setAgentWalletType('commission')}
                  className={`h-11 rounded-2xl font-black text-sm border-2 transition-all ${agentWalletType === 'commission' ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-500 hover:border-amber-400'}`}
                >
                  Wallet Affilié
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Montant ($)</Label>
              <Input 
                type="number"
                value={balanceAdjustment}
                onChange={(e) => setBalanceAdjustment(e.target.value)}
                placeholder="0.00"
                min="0.01"
                step="0.01"
                className="h-14 rounded-2xl bg-gray-50 border-0 focus:ring-2 focus:ring-primary/20 text-center text-2xl font-black"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-gray-500 ml-1">Note (optionnel)</Label>
              <Input
                value={agentWalletNote}
                onChange={(e) => setAgentWalletNote(e.target.value)}
                placeholder="Raison de l'ajustement..."
                className="h-11 rounded-2xl bg-gray-50 border-0 focus:ring-2 focus:ring-primary/20"
                maxLength={200}
              />
            </div>
            <div className="flex gap-3">
              <Button 
                onClick={() => handleUpdateAgentBalanceAction('credit')}
                disabled={isSaving || !balanceAdjustment}
                className="flex-1 h-14 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase text-[11px] shadow-lg shadow-emerald-500/20 border-0"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '+ Créditer'}
              </Button>
              <Button 
                onClick={() => handleUpdateAgentBalanceAction('debit')}
                disabled={isSaving || !balanceAdjustment}
                variant="destructive"
                className="flex-1 h-14 rounded-2xl font-black uppercase text-[11px] shadow-lg shadow-red-500/20 border-0"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '− Débiter'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Agent Confirmation */}
      <Dialog open={!!agentToDelete} onOpenChange={v => { if (!v) setAgentToDelete(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Supprimer l'agent
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'agent <span className="font-bold text-gray-900">{agentToDelete?.name}</span> ?
              Cette action est irréversible et supprimera son compte ainsi que son compte revendeur Free Fire.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAgentToDelete(null)} disabled={isDeletingAgent}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteAgent} disabled={isDeletingAgent}>
              {isDeletingAgent ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  const renderTransfers = () => {
    const pendingTransfers = walletTransactions.filter(t => t.type === 'transfer' && t.status === 'pending');
    
    return (
      <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-black text-dark tracking-tight">Approbation des Transferts</h2>
            <p className="text-gray-500 text-sm">Validez les transferts entre affiliés.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {pendingTransfers.length > 1 && (
              <Button 
                onClick={handleApproveAllTransfers}
                disabled={isSaving}
                className="rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 h-12 px-6 font-black uppercase tracking-widest text-[10px] border-0"
              >
                {isSaving ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <CheckCircle2 className="h-5 w-5 mr-2" />}
                Approuver Tout ({pendingTransfers.length})
              </Button>
            )}
            <Button
              onClick={() => setIsAutoApproveOn(!isAutoApproveOn)}
              variant={isAutoApproveOn ? "default" : "outline"}
              className={`rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] transition-all duration-300 ${isAutoApproveOn ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'border-2 text-gray-400'}`}
            >
              <div className="flex flex-col items-center justify-center leading-tight">
                <div className="flex items-center">
                  {isAutoApproveOn ? <Zap className="h-3 w-3 mr-2 animate-pulse text-yellow-300" /> : <Clock className="h-4 w-4 mr-2" />}
                  Auto-Approbation: {isAutoApproveOn ? 'ON' : 'OFF'}
                </div>
                {isAutoApproveOn && (
                  <span className="text-[7px] opacity-80 mt-1">Prochain check dans {nextAutoApproveIn}s</span>
                )}
              </div>
            </Button>
          </div>
        </div>

        <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
          <CardHeader className="border-b border-gray-100 p-8 pb-6 flex flex-row items-center justify-between">
             <div className="flex items-center gap-2">
                <Badge className="rounded-full h-8 w-8 flex items-center justify-center p-0 bg-primary/10 text-primary font-black">
                   {pendingTransfers.length}
                </Badge>
                <span className="font-black uppercase tracking-widest text-[10px] text-gray-400">Demandes en attente</span>
             </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-gray-50/50">
                <TableRow className="border-0">
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-14 px-8 text-gray-500">Expéditeur / Destinataire</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-14 text-right text-gray-500">Montant</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-14 text-center text-gray-500">Date</TableHead>
                  <TableHead className="font-black uppercase text-[10px] tracking-widest h-14 text-right px-8 text-gray-500">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingTransfers.map((tx) => (
                  <TableRow key={tx.id} className="group border-gray-100 hover:bg-gray-50/50 transition-colors">
                    <TableCell className="px-8 py-5">
                      <div className="flex items-center gap-4">
                         <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase">DE</span>
                            <span className="font-black text-dark">
                              {affiliates.find(a => a.id === tx.affiliateId)?.name || tx.affiliateId.slice(-6)}
                            </span>
                         </div>
                         <ArrowRightLeft className="h-4 w-4 text-gray-300" />
                         <div className="flex flex-col text-left">
                            <span className="text-[10px] font-black text-gray-400 uppercase">VERS</span>
                            <span className="font-black text-dark">{tx.relatedAffiliateName || tx.recipientWalletId}</span>
                         </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xl font-black text-primary">{tx.amount.toLocaleString()} $</span>
                    </TableCell>
                    <TableCell className="text-center text-xs font-medium text-gray-500">
                      {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'Pp', { locale: fr }) : '-'}
                    </TableCell>
                    <TableCell className="text-right px-8">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm"
                          onClick={() => handleRejectTransferAction(tx)}
                          disabled={isSaving}
                          variant="ghost"
                          className="rounded-xl text-red-500 hover:bg-red-50 font-black uppercase text-[10px] tracking-widest h-10 px-4 border-0"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Rejeter"}
                        </Button>
                        <Button 
                          size="sm"
                          onClick={() => handleApproveTransferAction(tx)}
                          disabled={isSaving}
                          className="rounded-xl bg-primary hover:bg-primary-dark text-white font-black uppercase text-[10px] tracking-widest h-10 px-4 shadow-md shadow-primary/20 border-0"
                        >
                          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approuver"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {pendingTransfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-64 text-center">
                      <div className="flex flex-col items-center gap-2 opacity-30">
                        <CheckCircle2 className="h-20 w-20 text-emerald-500" />
                        <span className="font-black uppercase tracking-widest text-sm">Aucun transfert en attente</span>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Livré': return <CheckCircle2 className="h-4 w-4 text-primary" />;
      case 'Arrivé': return <Package className="h-4 w-4 text-primary" />;
      case 'En transit': return <Truck className="h-4 w-4 text-primary" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* ── PIN setup obligatoire pour les admins ── */}
      <PinSetupModal
        open={showPinSetup}
        role="admin"
        identifier={admin.id}
        onSuccess={() => setShowPinSetup(false)}
      />
      <PinEntryModal open={pinModalOpen} title={pinModalTitle} description={pinModalDesc} onConfirm={handlePinConfirm} onCancel={handlePinCancel} />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-dark tracking-tight flex items-center gap-3">
            <span className="bg-primary text-white p-2 rounded-2xl rotate-3 shadow-lg shadow-accent-light/50 relative">
              <Shield className="h-6 w-6" />
              {totalPending > 0 && (
                <span className="absolute -top-2 -right-2 flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-600 animate-pulse text-[10px] font-black text-white border-2 border-white shadow-md z-10 rotate-[-3deg]">
                  {totalPending}
                </span>
              )}
            </span>
            Administration
          </h1>
          <p className="text-subtext text-sm mt-1 font-medium">
            Connecté : <span className="text-primary font-bold">{admin.fullName}</span> {admin.isSuperAdmin && <span className="bg-accent-light text-primary text-[10px] uppercase px-2 py-0.5 rounded-full ml-2 font-bold tracking-wider">Super Admin</span>}
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            variant="outline"
            className="flex-none h-11 px-3 sm:px-4 rounded-2xl border-gray-200 bg-gray-50 hover:bg-white hover:border-primary/40 hover:text-primary font-bold gap-2"
          >
            {isSidebarOpen ? <LucideIcons.X className="h-5 w-5 shrink-0" /> : <LucideIcons.Menu className="h-5 w-5 shrink-0" />}
            <span className="hidden sm:inline text-sm max-w-[120px] truncate">
              {visibleMenuItems.find(i => i.value === activeTab)?.label || 'Menu'}
            </span>
          </Button>
          {admin.isSuperAdmin && (
            <Button 
              variant="outline" 
              onClick={() => setIsLogsDialogOpen(true)}
              className="flex-1 sm:flex-none h-11 rounded-2xl border-gray-100 bg-gray-50/50 hover:bg-white hover:border-accent-light hover:text-primary font-bold"
            >
              <History className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Logs</span>
            </Button>
          )}
          <Button 
            variant="ghost" 
            onClick={onLogout}
            className="flex-1 sm:flex-none h-11 rounded-2xl text-red-500 hover:bg-red-50 font-bold"
          >
            <LogOut className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Déconnexion</span>
          </Button>
        </div>
      </div>

      {/* Burger Menu Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            />
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-80 bg-white z-50 shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-2xl bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/30">
                    <Shield className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-black text-dark text-sm leading-tight">Navigation</p>
                    <p className="text-[11px] text-gray-400 font-medium truncate max-w-[150px]">{admin.fullName}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}
                  className="h-9 w-9 rounded-xl hover:bg-gray-100 shrink-0">
                  <LucideIcons.X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {menuGroups.map((group, groupIdx) => {
                  const visibleItemsInGroup = group.items.filter(item =>
                    visibleMenuItems.some(v => v.value === item.value)
                  );
                  if (visibleItemsInGroup.length === 0) return null;
                  return (
                    <div key={groupIdx} className="space-y-1">
                      <h4 className="px-2 text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                        <span className="h-px bg-gray-100 flex-1" />
                        {group.title}
                        <span className="h-px bg-gray-100 flex-1" />
                      </h4>
                      {visibleItemsInGroup.map((item) => (
                        <button
                          key={item.value}
                          onClick={() => { setActiveTab(item.value); setIsSidebarOpen(false); }}
                          className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl transition-all text-left relative ${
                            activeTab === item.value
                              ? 'bg-primary text-white shadow-lg shadow-primary/25'
                              : 'text-gray-600 hover:bg-gray-50 hover:text-primary'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="font-bold text-sm flex-1">{item.label}</span>
                          {item.value === 'affiliates' && pendingRegistrations.length > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">
                              {pendingRegistrations.length}
                            </span>
                          )}
                          {item.value === 'withdrawals' && pendingWithdrawals.length > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                              {pendingWithdrawals.length}
                            </span>
                          )}
                          {item.value === 'client-requests' && (pendingClientRequests.length + affiliateClientRequests.filter(r => r.status === 'pending').length) > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                              {pendingClientRequests.length + affiliateClientRequests.filter(r => r.status === 'pending').length}
                            </span>
                          )}
                          {item.value === 'clients-tx' && pendingClientTxCount > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-primary text-[10px] font-black text-white">
                              {pendingClientTxCount}
                            </span>
                          )}
                          {item.value === 'transfers' && pendingTransfersCount > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-white">
                              {pendingTransfersCount}
                            </span>
                          )}
                          {item.value === 'notifications' && totalPending > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-red-600 text-[10px] font-black text-white">
                              {totalPending}
                            </span>
                          )}
                          {item.value === 'agents' && agentPersonalDeposits.length > 0 && (
                            <span className="flex min-w-[20px] h-5 px-1 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-white">
                              {agentPersonalDeposits.length}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="w-full">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="space-y-8">

            <TabsContent value="parcels" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Gestion des Colis</h2>
            <Button onClick={() => handleOpenDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouveau Colis
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-accent-light/30 border-accent-light">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary uppercase">Total Colis</p>
                    <p className="text-3xl font-bold text-dark">{parcels.length}</p>
                  </div>
                  <Package className="h-8 w-8 text-primary/30" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-accent-light/30 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary uppercase">En Transit</p>
                    <p className="text-3xl font-bold text-dark">
                      {parcels.filter(p => p.status === 'En transit' || p.status === 'En route').length}
                    </p>
                  </div>
                  <Truck className="h-8 w-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>
            <Card className="bg-accent-light/30 border-primary/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-primary uppercase">Livrés</p>
                    <p className="text-3xl font-bold text-dark">
                      {parcels.filter(p => p.status === 'Livré').length}
                    </p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-primary/40" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardHeader className="border-b bg-gray-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4">
              <CardTitle className="text-lg font-semibold">Liste des expéditions</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Rechercher..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm w-full"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {parcelsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des données...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="w-[180px]">N° de Suivi</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Localisation</TableHead>
                        <TableHead>Paiement</TableHead>
                        <TableHead>Dernière MÀJ</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredParcels.map((parcel) => (
                        <TableRow key={parcel.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="font-mono font-medium text-primary">
                            {parcel.trackingNumber}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-dark">
                              {getStatusIcon(parcel.status)}
                              <span className="text-sm font-medium">{parcel.status}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {parcel.currentLocation}
                          </TableCell>
                          <TableCell>
                            <Badge variant={parcel.paymentStatus === 'Payé' ? 'default' : 'destructive'} className="text-[10px] uppercase tracking-wider">
                              {parcel.paymentStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {parcel.updatedAt ? format(parcel.updatedAt.toDate(), 'dd/MM/yy HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(parcel)}>
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => handleOpenDeleteDialog(parcel)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredParcels.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                            Aucun colis trouvé.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Gestion des Produits / Services</h2>
            <Button onClick={() => handleOpenProductDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouveau Produit
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {productsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des produits...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Image</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell>
                            <img 
                              src={product.image} 
                              className="h-10 w-10 object-cover rounded-lg border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/rena/100/100';
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-accent-light bg-accent-light/50">
                              {product.price}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                            {product.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenProductDialog(product)} className="h-8 w-8 p-0">
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setProductToDelete(product);
                                setIsProductDeleteDialogOpen(true);
                              }} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white/50 border border-transparent hover:border-red-100 px-2 font-medium text-xs">
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                <span className="hidden sm:inline">Supprimer</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                            Aucun produit ajouté.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formations" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Gestion des Formations</h2>
            <Button onClick={() => handleOpenFormationDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouvelle Formation
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {formationsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des formations...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Couverture</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Niveau</TableHead>
                        <TableHead>Modules</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {adminFormations.map((formation) => (
                        <TableRow key={formation.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell>
                            {formation.coverImage ? (
                              <img src={formation.coverImage} className="h-10 w-16 object-cover rounded-lg border" onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/formation/100/60'; }} />
                            ) : (
                              <div className="h-10 w-16 rounded-lg bg-blue-50 flex items-center justify-center border border-blue-100">
                                <LucideIcons.GraduationCap className="h-5 w-5 text-blue-300" />
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">{formation.title}</p>
                              {formation.instructor && <p className="text-xs text-gray-400">{formation.instructor}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-primary/20 bg-blue-50/50">
                              {formation.price === 0 ? 'Gratuit' : `${(formation.price || 0).toLocaleString()} HTG`}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={formation.level === 'debutant' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : formation.level === 'intermediaire' ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-purple-700 bg-purple-50 border-purple-200'}>
                              {formation.level === 'debutant' ? 'Débutant' : formation.level === 'intermediaire' ? 'Intermédiaire' : 'Avancé'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{(formation.modules || []).length} modules</TableCell>
                          <TableCell>
                            {formation.comingSoon ? (
                              <Badge variant="outline" className="text-orange-600 bg-orange-50 border-orange-200">
                                À venir
                              </Badge>
                            ) : formation.published ? (
                              <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200">
                                Publié
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500 bg-gray-50 border-gray-200">
                                Brouillon
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenFormationDialog(formation)} className="h-8 w-8 p-0">
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => { setFormationToDelete(formation); setIsFormationDeleteDialogOpen(true); }} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white/50 border border-transparent hover:border-red-100 px-2 font-medium text-xs">
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                <span className="hidden sm:inline">Supprimer</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {adminFormations.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-gray-400">
                            Aucune formation créée. Cliquez sur "Nouvelle Formation" pour commencer.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="formation_payments" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark">Gestion des Paiements Formations</h2>
              <p className="text-sm text-subtext mt-1">Approuvez ou rejetez les demandes de paiement externes (MonCash / NatCash)</p>
            </div>
            <Button onClick={fetchFormationPaymentRequests} variant="outline" className="flex items-center gap-2 text-sm">
              <LucideIcons.RefreshCw className="h-4 w-4" /> Actualiser
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {loadingPaymentRequests ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des demandes...</p>
                </div>
              ) : formationPaymentRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <LucideIcons.CreditCard className="h-12 w-12 text-gray-200 mb-3" />
                  <p className="font-semibold">Aucune demande de paiement en cours.</p>
                  <p className="text-xs mt-1">Les demandes MonCash / NatCash apparaîtront ici.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Utilisateur</TableHead>
                        <TableHead>Cours</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Code transaction</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {formationPaymentRequests.map((req: any) => (
                        <TableRow key={req.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm">{req.userName}</p>
                              {req.userEmail && <p className="text-xs text-gray-400">{req.userEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            <p className="text-sm font-medium text-dark max-w-[180px] truncate">{req.formationTitle}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-primary/20 bg-blue-50/50">
                              {(req.amount || 0).toLocaleString()} HTG
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={req.method === 'MonCash' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'}>
                              {req.method}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{req.transactionCode}</code>
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {req.createdAt?.seconds ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={
                              req.status === 'pending' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                              req.status === 'approved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                              'text-red-700 bg-red-50 border-red-200'
                            }>
                              {req.status === 'pending' ? 'En attente' : req.status === 'approved' ? 'Approuvé' : 'Rejeté'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {req.status === 'pending' && (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="sm"
                                  className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3"
                                  disabled={processingPaymentId === req.id}
                                  onClick={() => handleApprovePaymentRequest(req.id)}
                                >
                                  {processingPaymentId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '✅ Approuver'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 text-red-500 hover:bg-red-50 hover:text-red-600 text-xs px-3"
                                  disabled={processingPaymentId === req.id}
                                  onClick={() => handleRejectPaymentRequest(req.id)}
                                >
                                  {processingPaymentId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : '❌ Rejeter'}
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* ── Certificats ── */}
          <div className="space-y-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div>
                <h2 className="text-lg font-bold text-dark flex items-center gap-2">
                  <LucideIcons.Award className="h-5 w-5 text-amber-500" /> Gestion des Certificats
                </h2>
                <p className="text-sm text-subtext mt-1">Émettez des certificats aux étudiants ayant terminé une formation</p>
              </div>
            </div>

            {/* Formation selector */}
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <select
                value={selectedCertFormationId}
                onChange={e => {
                  setSelectedCertFormationId(e.target.value);
                  if (e.target.value) {
                    fetchCertificates(e.target.value);
                    fetchCertStudents(e.target.value);
                  } else {
                    setCertStudents([]);
                    fetchCertificates();
                  }
                }}
                className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[240px]"
              >
                <option value="">— Sélectionner une formation —</option>
                {(adminFormations as any[]).map((f: any) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
              {selectedCertFormationId && (
                <Button variant="outline" size="sm" onClick={() => { fetchCertificates(selectedCertFormationId); fetchCertStudents(selectedCertFormationId); }} className="h-10 rounded-xl">
                  <LucideIcons.RefreshCw className="h-4 w-4 mr-1" /> Actualiser
                </Button>
              )}
            </div>

            {selectedCertFormationId && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Students list */}
                {/* ── Certificate issuance dialog ─────────────────────────────── */}
                {certIssuanceForm && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-10 w-10 bg-amber-100 rounded-xl flex items-center justify-center">
                          <LucideIcons.Award className="h-5 w-5 text-amber-500" />
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-dark">Émettre un certificat</h3>
                          <p className="text-xs text-gray-400">{certIssuanceForm.student.userName}</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 mb-1 block">Lien PDF (optionnel)</label>
                          <input
                            type="url"
                            placeholder="https://... (laissez vide pour un modèle auto-généré)"
                            value={certIssuanceForm.pdfUrl}
                            onChange={e => setCertIssuanceForm(prev => prev ? { ...prev, pdfUrl: e.target.value } : null)}
                            className="w-full h-9 px-3 text-xs border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-300"
                          />
                          <p className="text-[10px] text-gray-400 mt-1">Si vide, l'étudiant pourra générer un certificat PDF depuis l'interface.</p>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <Button variant="ghost" size="sm" className="flex-1 h-9 text-xs" onClick={() => setCertIssuanceForm(null)}>
                            Annuler
                          </Button>
                          <Button
                            size="sm"
                            className="flex-1 h-9 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                            disabled={issuingCertId === certIssuanceForm.student.userId}
                            onClick={() => handleIssueCertificate(certIssuanceForm.student, certIssuanceForm.pdfUrl || undefined)}
                          >
                            {issuingCertId === certIssuanceForm.student.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : '🎓 Confirmer'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <Card className="shadow-sm border-gray-200">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-bold text-sm text-dark">Étudiants inscrits</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Cliquez sur "Émettre" pour délivrer un certificat</p>
                    </div>
                    {loadingCertStudents ? (
                      <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : certStudents.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">Aucun étudiant inscrit</div>
                    ) : (
                      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {certStudents.map((s: any) => {
                          const alreadyIssued = certificates.some(c => c.userId === s.userId);
                          return (
                            <div key={s.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                              <div>
                                <p className="text-sm font-semibold text-dark">{s.userName}</p>
                                {s.userEmail && <p className="text-xs text-gray-400">{s.userEmail}</p>}
                              </div>
                              {alreadyIssued ? (
                                <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                                  <LucideIcons.Award className="h-3 w-3 mr-1" /> Certifié
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-amber-500 hover:bg-amber-600 text-white"
                                  disabled={issuingCertId === s.userId}
                                  onClick={() => setCertIssuanceForm({ student: s, pdfUrl: '' })}
                                >
                                  {issuingCertId === s.userId ? <Loader2 className="h-3 w-3 animate-spin" /> : '🎓 Émettre'}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Issued certificates */}
                <Card className="shadow-sm border-gray-200">
                  <CardContent className="p-0">
                    <div className="p-4 border-b border-gray-100">
                      <h3 className="font-bold text-sm text-dark flex items-center gap-2">
                        <LucideIcons.Award className="h-4 w-4 text-amber-500" /> Certificats émis ({certificates.length})
                      </h3>
                    </div>
                    {loadingCertificates ? (
                      <div className="flex items-center justify-center py-10 text-gray-400"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : certificates.length === 0 ? (
                      <div className="py-10 text-center text-gray-400 text-sm">Aucun certificat émis</div>
                    ) : (
                      <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto">
                        {certificates.map((cert: any) => (
                          <div key={cert.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-dark">{cert.userName}</p>
                                <code className="text-[10px] text-gray-400 font-mono">{cert.certificateCode}</code>
                                <p className="text-[10px] text-gray-300 mt-0.5">
                                  {cert.issuedAt?.seconds ? new Date(cert.issuedAt.seconds * 1000).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </p>
                                {cert.pdfUrl && (
                                  <a href={cert.pdfUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5 mt-0.5 truncate max-w-[180px]">
                                    <LucideIcons.Link className="h-2.5 w-2.5 shrink-0" /> PDF lié
                                  </a>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 text-[10px] text-blue-400 hover:text-blue-600 hover:bg-blue-50 px-2"
                                  onClick={() => setEditingCertPdf({ id: cert.id, pdfUrl: cert.pdfUrl || '' })}
                                >
                                  <LucideIcons.Link className="h-3 w-3 mr-1" />PDF
                                </Button>
                                <Button
                                  variant="ghost" size="sm"
                                  className="h-7 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 px-2"
                                  disabled={revokingCertId === cert.id}
                                  onClick={() => handleRevokeCertificate(cert.id)}
                                >
                                  {revokingCertId === cert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <LucideIcons.Trash2 className="h-3 w-3" />}
                                </Button>
                              </div>
                            </div>
                            {/* Inline PDF URL editor */}
                            {editingCertPdf?.id === cert.id && (
                              <div className="mt-2 flex gap-2">
                                <input
                                  type="url"
                                  placeholder="https://... (lien PDF du certificat)"
                                  value={editingCertPdf.pdfUrl}
                                  onChange={e => setEditingCertPdf({ id: cert.id, pdfUrl: e.target.value })}
                                  className="flex-1 h-8 px-2 text-xs border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                <Button
                                  size="sm" className="h-8 text-xs bg-blue-500 hover:bg-blue-600 text-white px-3"
                                  disabled={updatingCertPdf === cert.id}
                                  onClick={() => handleUpdateCertPdf(cert.id, editingCertPdf.pdfUrl)}
                                >
                                  {updatingCertPdf === cert.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'OK'}
                                </Button>
                                <Button variant="ghost" size="sm" className="h-8 text-xs px-2" onClick={() => setEditingCertPdf(null)}>
                                  ✕
                                </Button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="games" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
            <div>
              <h2 className="text-xl font-bold text-dark">Prix des Jeux (FazerCards)</h2>
              <p className="text-xs text-gray-400 mt-0.5">Les jeux et offres viennent de FazerCards. Personnalisez ici les prix HTG affichés aux clients.</p>
            </div>
          </div>
          <FazerPriceManager />
        </TabsContent>

        <TabsContent value="cards" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Gestion des Cartes (Recharge)</h2>
            <Button onClick={() => handleOpenCardDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouvelle Carte
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {cardsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des cartes...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Image</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Prix</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cards.map((card) => (
                        <TableRow key={card.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell>
                            <img 
                              src={card.image} 
                              className="h-10 w-10 object-cover rounded-lg border"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/card/100/100';
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{card.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-primary border-accent-light bg-accent-light/50">
                              {card.price}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                            {card.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenCardDialog(card)} className="h-8 w-8 p-0">
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setCardToDelete(card);
                                setIsCardDeleteDialogOpen(true);
                              }} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white/50 border border-transparent hover:border-red-100 px-2 font-medium text-xs">
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                <span className="hidden sm:inline">Supprimer</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {cards.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                            Aucune carte enregistrée.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="slider" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Images du Slider Hero</CardTitle>
                <CardDescription>Gérez les images qui défilent sur la page d'accueil (titre et description personnalisés par image).</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-xl border space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Titre du slide</Label>
                    <Input 
                      placeholder="Ex: Rena Services" 
                      value={sliderTitle}
                      onChange={(e) => setSliderTitle(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description du slide</Label>
                    <Input 
                      placeholder="Ex: Accès rapide et sécurisé..." 
                      value={sliderDescription}
                      onChange={(e) => setSliderDescription(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 pt-2 border-t mt-4">
                  <div className="flex items-center gap-2 flex-grow w-full sm:w-auto">
                    <Input 
                      placeholder="URL de l'image (ex: https://...)" 
                      value={tempSliderImageUrl}
                      onChange={(e) => setTempSliderImageUrl(e.target.value)}
                      className="flex-grow h-10"
                    />
                    <Button 
                      onClick={handleSaveSliderUrl} 
                      disabled={isSaving || !tempSliderImageUrl.trim()}
                      className="bg-primary hover:bg-[#1D4ED8] h-10 whitespace-nowrap border-0"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Lien
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-sm text-gray-400 font-medium hidden sm:inline">OU</span>
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleSliderImageUpload}
                      className="hidden" 
                      id="slider-upload"
                      disabled={isSliderUploading}
                    />
                    <Button asChild disabled={isSliderUploading} className="bg-primary hover:bg-[#1D4ED8] h-10 w-full sm:w-auto border-0">
                      <label htmlFor="slider-upload" className="cursor-pointer flex items-center justify-center gap-2">
                        {isSliderUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Télécharger
                      </label>
                    </Button>
                  </div>
                </div>
              </div>

              {isSliderUploading && (
                <div className="mb-6 space-y-2">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Téléchargement en cours...</span>
                    <span>{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className="bg-primary h-full transition-all duration-300" 
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {sliderLoading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : sliderImages.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {sliderImages.map((image) => (
                    <div key={image.id} className="relative group rounded-xl overflow-hidden border bg-gray-50 aspect-video shadow-sm hover:shadow-md transition-all">
                      <img 
                        src={image.url} 
                        alt="Slider" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-4 opacity-100 transition-opacity">
                         <div className="mb-2">
                           <p className="text-white font-bold text-sm truncate">{image.title || 'Pas de titre'}</p>
                           <p className="text-white/70 text-xs truncate">{image.description || 'Pas de description'}</p>
                         </div>
                         <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="rounded-lg px-3 h-8 text-xs flex-grow bg-white/20 hover:bg-white/40 text-white border-none"
                            onClick={() => {
                              setEditingSliderImage({...image});
                              setIsSliderImageEditDialogOpen(true);
                            }}
                          >
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            Modifier
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            className="rounded-lg px-3 h-8 text-xs flex-grow"
                            onClick={() => {
                              setSliderImageToDelete(image);
                              setIsSliderImageDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                  <ImageIcon className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune image personnalisée. Les images par défaut sont affichées.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Slider Delete Confirmation Dialog */}
          <Dialog open={isSliderImageDeleteDialogOpen} onOpenChange={setIsSliderImageDeleteDialogOpen}>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Confirmer la suppression</DialogTitle>
                <DialogDescription>
                  Êtes-vous sûr de vouloir supprimer cette image du slider ? Cette action est irréversible.
                </DialogDescription>
              </DialogHeader>
              <div className="flex justify-center py-4">
                <div className="h-32 w-full rounded-lg overflow-hidden border">
                  <img src={sliderImageToDelete?.url} className="w-full h-full object-cover" alt="To delete" />
                </div>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setIsSliderImageDeleteDialogOpen(false)}>Annuler</Button>
                <Button 
                  variant="destructive" 
                  onClick={handleConfirmDeleteSliderImage}
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                  Supprimer l'image
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Slider Edit Dialog */}
          <Dialog open={isSliderImageEditDialogOpen} onOpenChange={setIsSliderImageEditDialogOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Modifier le Slide</DialogTitle>
                <DialogDescription>
                  Mettez à jour le titre, la description ou l'URL de cette image du slider.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-6 py-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL de l'image (Lien direct)</Label>
                    <Input 
                      value={editingSliderImage?.url || ''}
                      onChange={(e) => setEditingSliderImage(prev => prev ? {...prev, url: e.target.value} : null)}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Titre du slide</Label>
                    <Input 
                      value={editingSliderImage?.title || ''}
                      onChange={(e) => setEditingSliderImage(prev => prev ? {...prev, title: e.target.value} : null)}
                      placeholder="Ex: Rena Services"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description du slide</Label>
                    <Textarea 
                      value={editingSliderImage?.description || ''}
                      onChange={(e) => setEditingSliderImage(prev => prev ? {...prev, description: e.target.value} : null)}
                      placeholder="Ex: Accès rapide et sécurisé..."
                      className="min-h-[100px]"
                    />
                  </div>
                </div>

                <div className="rounded-lg overflow-hidden border bg-gray-50 aspect-video relative">
                  {editingSliderImage?.url ? (
                    <img src={editingSliderImage.url} className="w-full h-full object-cover" alt="Preview" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      Aperçu de l'image
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSliderImageEditDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleUpdateSliderImage} disabled={isSaving} className="bg-primary hover:bg-[#1D4ED8] border-0">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Enregistrer les modifications
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="transfers" className="space-y-6 pt-6 px-6 pb-20 custom-scrollbar overflow-y-auto h-full">
          {renderTransfers()}
        </TabsContent>

        <TabsContent value="affiliates" className="space-y-0 h-full flex flex-col">
          <Tabs defaultValue="list" className="w-full h-full flex flex-col">
            <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md py-4 border-b -mx-6 px-6 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
              <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                <h2 className="text-xl font-bold text-dark whitespace-nowrap">Gestion des Affiliés</h2>
                <TabsList className="bg-gray-100/80 p-1 rounded-xl h-auto border border-gray-200/50">
                  <TabsTrigger 
                    value="list" 
                    className="rounded-lg px-6 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                  >
                    <Users className="h-3 w-3 mr-2" />
                    Liste & Stats
                  </TabsTrigger>
                  <TabsTrigger 
                    value="search" 
                    className="rounded-lg px-6 py-2 text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm transition-all"
                  >
                    <Search className="h-3 w-3 mr-2" />
                    Recherche & Généalogie
                  </TabsTrigger>
                </TabsList>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pt-6 custom-scrollbar">
              <TabsContent value="list" className="space-y-6 mt-0 px-6 pb-20">
                {/* ── Stats ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <Card className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center shrink-0">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Total Affiliés</p>
                          <p className="text-3xl font-black text-gray-900 leading-none">{affiliates.length}</p>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-gradient-to-r from-blue-400 to-blue-600" />
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center shrink-0">
                          <Wallet className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Total à Payer</p>
                          <p className="text-3xl font-black text-gray-900 leading-none">{totalAffiliateBalance} <span className="text-base font-bold text-gray-400">USD</span></p>
                          <p className="text-[11px] text-gray-400 font-medium mt-1">≈ {(totalAffiliateBalance * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-gradient-to-r from-emerald-400 to-emerald-600" />
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-sm overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-4 p-5">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0">
                          <Trophy className="h-6 w-6 text-amber-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] font-black uppercase tracking-widest text-gray-400 mb-0.5">Points Totaux</p>
                          <p className="text-3xl font-black text-gray-900 leading-none">
                            {affiliates.reduce((sum, a) => sum + (a.points || 0), 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="h-1 w-full bg-gradient-to-r from-amber-400 to-amber-600" />
                    </CardContent>
                  </Card>
                </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b bg-gray-50/50 flex flex-col sm:flex-row items-center justify-between gap-4 py-3">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg font-semibold">Répertoire des Affiliés</CardTitle>
                    <div className="flex bg-gray-100 p-1 rounded-lg ml-2">
                      <button 
                        onClick={() => setAffiliateViewMode('table')}
                        className={`p-1.5 rounded-md transition-all ${affiliateViewMode === 'table' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <LucideIcons.Table className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setAffiliateViewMode('grid')}
                        className={`p-1.5 rounded-md transition-all ${affiliateViewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Chercher un affilié..." 
                      className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-primary shadow-sm"
                      value={affiliateSearch}
                      onChange={(e) => setAffiliateSearch(e.target.value)}
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {affiliatesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>Chargement des affiliés...</p>
                    </div>
                  ) : affiliateViewMode === 'table' ? (
                    <div className="overflow-x-auto max-h-[600px] overflow-y-auto custom-scrollbar">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/50">
                            <TableHead>Identité</TableHead>
                            <TableHead>Code / Niveau</TableHead>
                            <TableHead>Performance</TableHead>
                            <TableHead>Solde</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <AffiliateTableBody 
                            affiliates={affiliates}
                            searchQuery={affiliateSearch}
                            onEdit={(a) => {
                              setEditingAffiliate(a);
                              setAffiliateFormData(a);
                              setIsAffiliateDialogOpen(true);
                            }}
                            onDelete={(a) => handleOpenAffiliateDeleteDialog(a)}
                          />
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto custom-scrollbar">
                      {filteredAffiliates.map((a) => (
                        <motion.div
                          key={a.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          whileHover={{ y: -4 }}
                          className="group relative"
                        >
                          <Card 
                            className="border-0 shadow-sm rounded-3xl overflow-hidden cursor-pointer bg-white border border-gray-100 hover:shadow-xl hover:border-primary/20 transition-all duration-300"
                            onClick={() => {
                              setEditingAffiliate(a);
                              setAffiliateFormData(a);
                              setIsAffiliateDialogOpen(true);
                            }}
                          >
                            <CardContent className="p-5">
                              <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/10 to-accent-light flex items-center justify-center text-primary font-black text-xl shadow-inner group-hover:scale-110 transition-transform">
                                    {a.name.charAt(0)}
                                  </div>
                                  <div>
                                    <h4 className="font-black text-dark group-hover:text-primary transition-colors truncate max-w-[150px]">{a.name}</h4>
                                    <p className="text-[10px] text-primary font-black tracking-widest uppercase">{a.level || 'Bronze'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] text-gray-400 font-mono tracking-tighter">{a.code}</p>
                        <span className="text-[8px] text-gray-300">|</span>
                        <p className="text-[10px] text-emerald-600 font-mono tracking-tighter">{a.walletId?.match(/.{1,4}/g)?.join(' ')}</p>
                      </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-black text-emerald-600 leading-tight">{a.balance} $</p>
                                  <p className="text-[9px] text-gray-400 uppercase font-black">≈ {( (a.balance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-2 py-3 border-y border-gray-50 mb-3">
                                <div className="text-center">
                                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Points</p>
                                  <p className="text-xs font-black text-dark">{a.points || 0}</p>
                                </div>
                                <div className="text-center border-x">
                                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Ventes</p>
                                  <p className="text-xs font-black text-dark">{a.monthlySales || 0}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[9px] text-gray-400 font-bold uppercase mb-1">Référés</p>
                                  <p className="text-xs font-black text-dark">{a.referredClients || 0}</p>
                                </div>
                              </div>

                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-9 w-9 p-0 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                  onClick={() => {
                                    setSelectedAffiliateForCredit(a);
                                    setIsQuickCreditDialogOpen(true);
                                  }}
                                  title="Ajout rapide d'argent"
                                >
                                  <PlusCircle className="h-4 w-4" />
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="flex-1 rounded-xl h-9 bg-gray-50 hover:bg-accent-light hover:text-primary text-[10px] font-black uppercase"
                                  onClick={() => {
                                    setEditingAffiliate(a);
                                    setAffiliateFormData(a);
                                    setIsAffiliateDialogOpen(true);
                                  }}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" /> Détails
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="rounded-xl h-9 w-9 p-0 bg-red-50 text-red-500 hover:bg-red-100"
                                  onClick={() => handleOpenAffiliateDeleteDialog(a)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {filteredAffiliates.length === 0 && !affiliatesLoading && (
                    <div className="text-center py-20 text-gray-400">
                      <Users className="h-16 w-16 mx-auto mb-4 opacity-10" />
                      <p className="text-lg font-medium">Aucun affilié trouvé</p>
                      <p className="text-sm">Essayez une autre recherche.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

                <div className="space-y-5">

                  {/* File d'attente des Prix */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
                      <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                          <Trophy className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        File d'attente — Prix
                      </CardTitle>
                      <p className="text-[11px] text-gray-400 mt-1.5 leading-relaxed">
                        Candidats actuels par points. Officialisez-les dans le classement public.
                      </p>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                      {winnersQueue.length > 0 ? (
                        <>
                          {winnersQueue.map((w, idx) => (
                            <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                                idx === 0 ? 'bg-amber-400 text-white' :
                                idx === 1 ? 'bg-gray-300 text-gray-700' :
                                'bg-orange-200 text-orange-700'
                              }`}>
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900 truncate">{w.name}</p>
                                <p className="text-[10px] text-gray-400 font-medium">{w.points} pts</p>
                              </div>
                              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                idx === 0 ? 'bg-amber-100 text-amber-700' :
                                idx === 1 ? 'bg-gray-100 text-gray-600' :
                                'bg-orange-100 text-orange-600'
                              }`}>
                                {idx === 0 ? '500 G' : idx === 1 ? '250 G' : '150 G'}
                              </span>
                            </div>
                          ))}
                          <Button
                            className="w-full h-10 bg-primary hover:bg-blue-700 text-white font-bold rounded-xl border-0 text-[12px] mt-1"
                            onClick={handleAwardPrizes}
                            disabled={isAwarding}
                          >
                            {isAwarding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            Décerner les prix
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-5 text-gray-400">
                          <Trophy className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-xs">Aucun affilié avec des points ce mois-ci.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Classement officiel */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
                      <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700 flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Trophy className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        Classement Officiel
                      </CardTitle>
                      <p className="text-[11px] text-gray-400 mt-1.5">Ce que les affiliés voient actuellement.</p>
                    </CardHeader>
                    <CardContent className="p-5 space-y-2">
                      {officialRankingsLoading ? (
                        <div className="flex justify-center py-5">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                      ) : officialRankings.length > 0 ? (
                        officialRankings.map((w, idx) => (
                          <div key={w.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0 ${
                              idx === 0 ? 'bg-primary text-white' :
                              idx === 1 ? 'bg-gray-400 text-white' :
                              'bg-blue-300 text-white'
                            }`}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{w.name}</p>
                              <p className="text-[10px] text-gray-400 font-medium">{w.points} pts</p>
                            </div>
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 uppercase tracking-wide">Officiel</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-5 text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                          <p className="text-xs">Aucun classement publié.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Actions mensuelles */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
                      <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Actions Mensuelles</CardTitle>
                    </CardHeader>
                    <CardContent className="p-5 space-y-2.5">
                      <Button
                        variant="outline"
                        className="w-full h-10 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold text-[12px]"
                        onClick={handleClearWinners}
                        disabled={isClearingWinners}
                      >
                        {isClearingWinners ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Vider le classement
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full h-10 border-blue-200 text-blue-700 hover:bg-blue-50 rounded-xl font-bold text-[12px]"
                        onClick={async () => { await resetMonthlyStats(); toast.success("Statistiques réinitialisées !"); }}
                      >
                        <Trophy className="h-4 w-4 mr-2" />
                        Réinitialiser le mois
                      </Button>
                      <p className="text-[10px] text-gray-400 text-center pt-1">Décernez les prix avant de réinitialiser.</p>
                    </CardContent>
                  </Card>

                  {/* Demandes d'inscription */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Inscriptions</CardTitle>
                        {pendingRegistrations.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingRegistrations.length}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                      {affiliateRequestsLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                      ) : affiliateRequests.filter(r => r.status === 'pending').length > 0 ? (
                        affiliateRequests.filter(r => r.status === 'pending').map((r) => (
                          <div key={r.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{r.name}</p>
                                <p className="text-[11px] text-gray-400 truncate">{r.email}</p>
                                <p className="text-[11px] text-gray-400">{r.phone}</p>
                              </div>
                              <span className="text-[9px] font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full uppercase shrink-0">Nouveau</span>
                            </div>
                            {r.message && (
                              <p className="text-[11px] text-gray-600 bg-white p-2.5 rounded-xl border border-gray-100 italic leading-relaxed">"{r.message}"</p>
                            )}
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-primary hover:bg-blue-700 h-9 border-0 rounded-xl font-bold text-[11px]"
                                onClick={() => handleAffiliateRequestAction(r, 'approved')}>Approuver</Button>
                              <Button size="sm" variant="outline" className="flex-1 h-9 border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold text-[11px]"
                                onClick={() => handleAffiliateRequestAction(r, 'rejected')}>Rejeter</Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <p className="text-[11px]">Aucune demande en attente.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Demandes de retrait */}
                  <Card className="border-0 shadow-sm">
                    <CardHeader className="pb-3 pt-5 px-5 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-[13px] font-black uppercase tracking-widest text-gray-700">Retraits Affiliés</CardTitle>
                        {pendingWithdrawals.length > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{pendingWithdrawals.length}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="p-5 space-y-3">
                      {allWithdrawalsLoading ? (
                        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                      ) : allWithdrawals.filter(w => w.status === 'pending').length > 0 ? (
                        allWithdrawals.filter(w => w.status === 'pending').map((w) => (
                          <div key={w.id} className="p-4 rounded-2xl border border-gray-100 bg-gray-50 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="font-bold text-gray-900 truncate">{w.affiliateName}</p>
                                <p className="text-[11px] text-gray-400 font-mono">Code: {w.affiliateCode}</p>
                                <div className="mt-2 p-2.5 bg-blue-50 rounded-xl border border-blue-100">
                                  <p className="text-[9px] uppercase font-black text-blue-500 mb-0.5">Compte</p>
                                  <p className="text-[12px] font-bold text-gray-800 break-all">{w.method}: {w.accountNumber}</p>
                                </div>
                              </div>
                              <span className="font-black text-emerald-600 text-sm shrink-0">{w.amount} $</span>
                            </div>
                            <p className="text-[10px] text-gray-400">≈ {((w.amount || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1 bg-primary hover:bg-blue-700 h-9 border-0 rounded-xl font-bold text-[11px]"
                                onClick={() => handleWithdrawalAction(w, 'approved')}>Approuver</Button>
                              <Button size="sm" variant="destructive" className="flex-1 h-9 rounded-xl font-bold text-[11px]"
                                onClick={() => handleWithdrawalAction(w, 'rejected')}>Rejeter</Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-gray-400">
                          <p className="text-[11px]">Aucun retrait en attente.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                </div>
          </div>
        </TabsContent>

        <TabsContent value="withdrawals" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Demandes de Retraits</h2>
          </div>
          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {allWithdrawalsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des retraits...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Affilié</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Méthode</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {allWithdrawals.map((w) => (
                        <TableRow key={w.id} className="hover:bg-gray-50/30 transition-colors">
                          <TableCell className="font-bold">{w.affiliateName}</TableCell>
                          <TableCell className="font-mono text-emerald-600 font-bold">{w.amount} $</TableCell>
                          <TableCell className="text-xs">
                            <span className="font-black uppercase text-[9px] block text-gray-400">{w.method}</span>
                            {w.accountNumber}
                          </TableCell>
                          <TableCell>
                            <Badge variant={w.status === 'approved' ? 'default' : w.status === 'rejected' ? 'destructive' : 'outline'} className="uppercase text-[9px] font-black">
                              {w.status === 'pending' ? 'En attente' : w.status === 'approved' ? 'Terminé' : 'Refusé'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {w.status === 'pending' && (
                              <div className="flex gap-2">
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700 h-8 rounded-xl text-[10px] font-black uppercase"
                                  onClick={() => handleWithdrawalAction(w, 'approved')}
                                >
                                  Accepter
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive" 
                                  className="h-8 rounded-xl text-[10px] font-black uppercase"
                                  onClick={() => handleWithdrawalAction(w, 'rejected')}
                                >
                                  Rejeter
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet-tx" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Flux Financiers & Dépôts</h2>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardHeader className="border-b bg-gray-50/50 py-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-gray-500">Historique des Flux Financiers</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <Select value={walletTxFilter} onValueChange={(v: any) => setWalletTxFilter(v)}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous types</SelectItem>
                      <SelectItem value="deposit">Dépôts</SelectItem>
                      <SelectItem value="withdrawal">Retraits</SelectItem>
                      <SelectItem value="transfer">Transferts</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={walletStatusFilter} onValueChange={(v: any) => setWalletStatusFilter(v)}>
                    <SelectTrigger className="w-[140px] h-9 text-xs">
                      <SelectValue placeholder="Statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous statuts</SelectItem>
                      <SelectItem value="pending">En attente</SelectItem>
                      <SelectItem value="approved">Approuvé</SelectItem>
                      <SelectItem value="rejected">Rejeté</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {walletTxLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <Loader2 className="h-8 w-8 animate-spin mb-2" />
                  <p>Chargement des flux...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Type</TableHead>
                        <TableHead>Affilié</TableHead>
                        <TableHead>Montant</TableHead>
                        <TableHead>Détails</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredWalletTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <Badge variant="outline" className={`uppercase text-[10px] ${
                              tx.type === 'deposit' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              tx.type === 'withdrawal' ? 'bg-red-50 text-red-600 border-red-100' :
                              'bg-blue-50 text-blue-600 border-blue-100'
                            }`}>
                              {tx.type === 'deposit' ? 'Dépôt' : tx.type === 'withdrawal' ? 'Retrait' : 'Transfert'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-bold">
                            {affiliates.find(a => a.id === tx.affiliateId)?.name || tx.affiliateId.slice(0,8)}
                          </TableCell>
                          <TableCell className={`font-mono font-bold ${
                            tx.type === 'deposit' ? 'text-emerald-600' :
                            tx.type === 'withdrawal' ? 'text-red-600' :
                            'text-blue-600'
                          }`}>
                            {tx.type === 'withdrawal' ? '-' : '+'}{tx.amount} G
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 max-w-[200px] truncate">
                            {tx.description}
                            {tx.recipientWalletId && ` -> Dest: ${tx.recipientWalletId}`}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.status === 'approved' ? 'default' : tx.status === 'rejected' ? 'destructive' : 'outline'} className="uppercase text-[9px] font-black">
                              {tx.status === 'pending' ? 'En attente' : tx.status === 'approved' ? 'Validé' : 'Refusé'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-400">
                            {tx.createdAt ? format(tx.createdAt.toDate(), 'dd/MM/yy HH:mm') : '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.type === 'deposit' && tx.status === 'pending' && (
                              <div className="flex justify-end gap-2">
                                <Button 
                                  size="sm" 
                                  className="bg-emerald-600 hover:bg-emerald-700 h-8 text-[10px] font-black uppercase px-3"
                                  onClick={async () => {
                                    try {
                                      await updateWalletTransactionStatus(tx.id!, 'approved');
                                      toast.success("Dépôt approuvé !");
                                    } catch (e) {
                                      toast.error("Erreur.");
                                    }
                                  }}
                                >
                                  Valider
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="h-8 text-[10px] font-black uppercase px-3"
                                  onClick={async () => {
                                    try {
                                      await updateWalletTransactionStatus(tx.id!, 'rejected');
                                      toast.success("Dépôt rejeté !");
                                    } catch (e) {
                                      toast.error("Erreur.");
                                    }
                                  }}
                                >
                                  Refuser
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filteredWalletTransactions.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="h-32 text-center text-gray-400">
                            Aucune transaction trouvée.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== DEMANDES CLIENTS TAB ===== */}
        <TabsContent value="client-requests" className="space-y-6 pt-6 px-6 pb-20">

          {/* ── Section : Dépôts soumis par les Affiliés ── */}
          {(() => {
            const pending = affiliateClientRequests.filter(r => r.status === 'pending');
            return (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-black text-dark flex items-center gap-2">
                    <div className="h-7 w-7 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <Users className="h-4 w-4 text-indigo-600" />
                    </div>
                    Dépôts soumis par les Affiliés
                    {pending.length > 0 && (
                      <span className="h-6 px-2 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center animate-pulse">{pending.length}</span>
                    )}
                  </h2>
                </div>
                {affiliateReqLoading ? (
                  <div className="flex items-center gap-2 py-6 justify-center text-gray-400">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Chargement...</span>
                  </div>
                ) : pending.length === 0 ? (
                  <div className="rounded-2xl bg-gray-50 border border-gray-100 py-6 text-center text-gray-400 text-sm">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-300" />
                    Aucun dépôt affilié en attente
                  </div>
                ) : (
                  <div className="space-y-3">
                    {pending.map(req => {
                      const isLoading = affiliateReqActionLoading === req.id;
                      return (
                        <Card key={req.id} className="border-2 border-indigo-200 overflow-hidden shadow-sm">
                          <div className="h-1.5 w-full bg-indigo-400" />
                          <CardContent className="p-5">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                              <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0">
                                <ArrowDown className="h-6 w-6 text-indigo-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-2">
                                  <p className="font-black text-dark">{req.clientName || 'Client'}</p>
                                  <Badge className="bg-indigo-100 text-indigo-700 border-0 text-[11px] font-black">↓ DÉPÔT AFFILIÉ</Badge>
                                  <Badge className="bg-amber-100 text-amber-700 border-0 text-[11px] font-black">EN ATTENTE</Badge>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1">
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Montant ($)</p>
                                    <p className="font-black text-lg text-indigo-600">${req.amount}</p>
                                    <p className="text-xs text-gray-400">≈ {(req.amount * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Affilié</p>
                                    <p className="font-bold text-dark text-sm">{req.affiliateName || '—'}</p>
                                    {req.affiliateCode && <p className="text-xs text-gray-400 font-mono">{req.affiliateCode}</p>}
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">ID Wallet Client</p>
                                    <p className="font-mono text-sm text-indigo-700">{req.clientWalletId || '—'}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Méthode</p>
                                    <p className="font-bold text-dark text-sm">{req.method || '—'}</p>
                                  </div>
                                </div>
                                {req.createdAt && (
                                  <p className="text-[10px] text-gray-400 mt-2">
                                    <Clock className="h-3 w-3 inline mr-1" />
                                    {(() => { try { const d = req.createdAt?._seconds ? new Date(req.createdAt._seconds * 1000) : new Date(req.createdAt); return format(d, 'dd MMM yyyy, HH:mm', { locale: fr }); } catch { return '—'; } })()}
                                  </p>
                                )}
                              </div>
                              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                                <Button
                                  className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm gap-2"
                                  disabled={isLoading}
                                  onClick={() => handleAffiliateReqAction(req.id, 'approve')}
                                >
                                  {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CheckCircle2 className="h-5 w-5" /> Approuver</>}
                                </Button>
                                <Button
                                  variant="outline"
                                  className="flex-1 h-12 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-black text-sm gap-2"
                                  disabled={isLoading}
                                  onClick={() => handleAffiliateReqAction(req.id, 'decline')}
                                >
                                  <XCircle className="h-5 w-5" /> Refuser
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="h-px bg-gray-200 flex-1" />
            <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Demandes Clients Directes</span>
            <div className="h-px bg-gray-200 flex-1" />
          </div>

          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Demandes Clients
              </h2>
              <p className="text-sm text-subtext mt-0.5">
                {pendingClientRequests.length > 0
                  ? <span className="text-amber-600 font-bold flex items-center gap-1 mt-1"><Clock className="h-4 w-4" />{pendingClientRequests.length} demande{pendingClientRequests.length > 1 ? 's' : ''} en attente d'approbation</span>
                  : 'Toutes les demandes ont été traitées.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingClientRequests.length > 0 && (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white text-sm font-black animate-pulse">
                  {pendingClientRequests.length}
                </span>
              )}
            </div>
          </div>

          {/* Stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Dépôts en attente</p>
              <p className="text-3xl font-black text-emerald-700 mt-1">
                {pendingClientRequests.filter(t => t.type === 'deposit').length}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">
                {pendingClientRequests.filter(t => t.type === 'deposit').reduce((s, t) => s + (t.htgAmount || Math.round(t.amount * (settings?.exchangeRate || 146))), 0).toLocaleString()} HTG total
              </p>
            </div>
            <div className="rounded-2xl bg-red-50 border border-red-100 p-4">
              <p className="text-[10px] font-black text-red-700 uppercase tracking-widest">Retraits en attente</p>
              <p className="text-3xl font-black text-red-700 mt-1">
                {pendingClientRequests.filter(t => t.type === 'withdrawal').length}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                {pendingClientRequests.filter(t => t.type === 'withdrawal').reduce((s, t) => s + (t.htgAmount || t.htgEquivalent || Math.round(t.amount * (settings?.exchangeRate || 146))), 0).toLocaleString()} HTG total
              </p>
            </div>
            <div className="rounded-2xl bg-gray-50 border border-gray-100 p-4 col-span-2 sm:col-span-1">
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Taux en cours</p>
              <p className="text-3xl font-black text-dark mt-1">{settings?.exchangeRate || 146}</p>
              <p className="text-xs text-gray-400 mt-0.5">HTG par 1 USD</p>
            </div>
          </div>

          {/* Request cards */}
          {clientTxLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Chargement des demandes...</p>
            </div>
          ) : pendingClientRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400">
              <CheckCircle2 className="h-14 w-14 mb-4 text-emerald-300" />
              <p className="text-lg font-bold text-gray-500">Aucune demande en attente</p>
              <p className="text-sm mt-1">Toutes les demandes de dépôt et retrait ont été traitées.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingClientRequests.map(tx => {
                const isDeposit = tx.type === 'deposit';
                const htgAmt = tx.htgAmount || tx.htgEquivalent || Math.round((tx.usdAmount || tx.amount) * (settings?.exchangeRate || 146));
                const usdAmt = (tx.usdAmount || tx.amount).toFixed(2);
                const isLoading = clientTxActionLoading === tx.id;
                return (
                  <Card key={tx.id} className={`overflow-hidden border-2 shadow-sm ${isDeposit ? 'border-emerald-200' : 'border-red-200'}`}>
                    <div className={`h-1.5 w-full ${isDeposit ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">

                        {/* Icon */}
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center shrink-0 ${isDeposit ? 'bg-emerald-100' : 'bg-red-100'}`}>
                          {isDeposit
                            ? <ArrowDown className="h-7 w-7 text-emerald-600" />
                            : <ArrowUp className="h-7 w-7 text-red-600" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="font-black text-dark text-base">{tx.clientName || 'Client'}</p>
                            <Badge className={`text-[11px] font-black ${isDeposit ? 'bg-emerald-100 text-emerald-700 border-0' : 'bg-red-100 text-red-700 border-0'}`}>
                              {isDeposit ? '↓ DÉPÔT' : '↑ RETRAIT'}
                            </Badge>
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-[11px] font-black">EN ATTENTE</Badge>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1 text-sm">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Montant</p>
                              <p className={`font-black text-lg ${isDeposit ? 'text-emerald-600' : 'text-red-600'}`}>
                                {isDeposit ? '+' : '-'}{htgAmt.toLocaleString()} HTG
                              </p>
                              <p className="text-xs text-gray-400">≈ ${usdAmt} USD</p>
                            </div>
                            {tx.method && (
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Méthode</p>
                                <p className="font-bold text-dark">{tx.method}</p>
                                {tx.accountNumber && <p className="text-xs text-gray-500 font-mono">{tx.accountNumber}</p>}
                              </div>
                            )}
                            {tx.txId && (
                              <div>
                                <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Réf. Transaction</p>
                                <p className="font-mono text-indigo-600 text-sm">{tx.txId}</p>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Date</p>
                              <p className="text-xs text-gray-600">
                                {tx.createdAt?.toDate ? format(tx.createdAt.toDate(), 'dd MMM yyyy, HH:mm', { locale: fr }) : '—'}
                              </p>
                            </div>
                          </div>
                          {/* Proof image */}
                          {tx.proofImageBase64 && (
                            <div className="mt-3 pt-3 border-t border-gray-100">
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider mb-2">Preuve de paiement</p>
                              <a href={tx.proofImageBase64} target="_blank" rel="noopener noreferrer"
                                className="inline-block rounded-xl overflow-hidden border-2 border-emerald-200 hover:border-emerald-400 transition-colors">
                                <img src={tx.proofImageBase64} alt="Preuve" className="h-28 w-auto object-cover" />
                              </a>
                              <p className="text-[10px] text-gray-400 mt-1">Cliquez pour agrandir</p>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col sm:flex-row gap-3 shrink-0 sm:min-w-[200px]">
                          <Button
                            className="flex-1 h-12 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm gap-2"
                            disabled={isLoading}
                            onClick={() => handleClientTxAction(tx.id!, 'approved')}
                          >
                            {isLoading
                              ? <Loader2 className="h-5 w-5 animate-spin" />
                              : <><CheckCircle2 className="h-5 w-5" /> Approuver</>}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 h-12 rounded-2xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-black text-sm gap-2"
                            disabled={isLoading}
                            onClick={() => handleClientTxAction(tx.id!, 'rejected')}
                          >
                            <XCircle className="h-5 w-5" /> Rejeter
                          </Button>
                        </div>

                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ===== PAIEMENTS CLIENTS (history) TAB ===== */}
        <TabsContent value="clients-tx" className="space-y-6 pt-6 px-6 pb-20">

          {/* Real-time notification banner */}
          {unreadClientNotifCount > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-black animate-pulse">{unreadClientNotifCount}</span>
                  <p className="font-black text-amber-800 text-sm">Nouvelles demandes non lues</p>
                </div>
                <button
                  onClick={() => markAllAdminNotificationsRead()}
                  className="text-[11px] font-bold text-amber-600 hover:text-amber-800 underline underline-offset-2 transition-colors"
                >
                  Tout marquer comme lu
                </button>
              </div>
              <div className="divide-y divide-amber-100 max-h-72 overflow-y-auto">
                {adminClientNotifs.filter(n => !n.read).map(notif => {
                  const isDeposit = notif.type === 'client_deposit';
                  const isWithdrawal = notif.type === 'client_withdrawal';
                  const isPurchase = notif.type === 'client_purchase';
                  return (
                  <div key={notif.id} className="flex items-start gap-3 px-4 py-3 hover:bg-amber-50/80 transition-colors">
                    <div className={`mt-0.5 h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${isDeposit ? 'bg-emerald-100' : isWithdrawal ? 'bg-red-100' : 'bg-primary/10'}`}>
                      {isDeposit ? <ArrowDown className="h-4 w-4 text-emerald-600" />
                        : isWithdrawal ? <ArrowUp className="h-4 w-4 text-red-600" />
                        : <ShoppingBag className="h-4 w-4 text-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-black text-dark text-sm">{notif.clientName}</p>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${isDeposit ? 'bg-emerald-100 text-emerald-700' : isWithdrawal ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary'}`}>
                          {isDeposit ? '↓ DÉPÔT' : isWithdrawal ? '↑ RETRAIT' : '🛍️ ACHAT'}
                        </span>
                        {isPurchase && (notif as any).productName && (
                          <span className="text-[10px] font-bold text-gray-500">{(notif as any).productName}</span>
                        )}
                        {notif.clientWalletId && (
                          <span className="text-[10px] font-mono text-gray-400">#{notif.clientWalletId}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                        <span className="text-sm font-black text-dark">
                          {isDeposit || isWithdrawal
                            ? `$${(notif.amount || 0).toFixed(2)}`
                            : `${(notif.amount || 0).toLocaleString()} HTG`}
                        </span>
                        {notif.method && (
                          <span className="text-[11px] text-gray-500 font-medium">via {notif.method}</span>
                        )}
                        {notif.accountNumber && (
                          <span className="text-[11px] text-gray-500 font-mono">{notif.accountNumber}</span>
                        )}
                        {notif.txId && (
                          <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Réf: {notif.txId}</span>
                        )}
                        <span className="text-[10px] text-gray-400">
                          {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'dd MMM, HH:mm', { locale: fr }) : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => markAdminNotificationRead(notif.id!)}
                      className="ml-2 shrink-0 text-[10px] font-bold text-gray-400 hover:text-gray-600 transition-colors mt-1"
                      title="Marquer comme lu"
                    >
                      ✓ Lu
                    </button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark">Paiements & Transactions Clients</h2>
              {pendingClientTxCount > 0 && (
                <p className="text-sm text-amber-600 font-bold mt-1 flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {pendingClientTxCount} transaction(s) en attente d'approbation
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={clientTxTypeFilter} onValueChange={(v: any) => setClientTxTypeFilter(v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="deposit">Dépôts</SelectItem>
                  <SelectItem value="withdrawal">Retraits</SelectItem>
                  <SelectItem value="purchase">Achats</SelectItem>
                </SelectContent>
              </Select>
              <Select value={clientTxStatusFilter} onValueChange={(v: any) => setClientTxStatusFilter(v)}>
                <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous statuts</SelectItem>
                  <SelectItem value="pending">En attente</SelectItem>
                  <SelectItem value="approved">Approuvé</SelectItem>
                  <SelectItem value="rejected">Rejeté</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {clientTxLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="h-8 w-8 animate-spin mb-2" />
              <p>Chargement des transactions clients...</p>
            </div>
          ) : filteredClientTransactions.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Wallet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Aucune transaction trouvée.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClientTransactions.map(tx => {
                const isDeposit = tx.type === 'deposit';
                const isWithdrawal = tx.type === 'withdrawal';
                const isPurchase = tx.type === 'purchase';
                const isPending = tx.status === 'pending';
                const statusColors: Record<string, string> = {
                  pending: 'bg-amber-100 text-amber-700',
                  approved: 'bg-emerald-100 text-emerald-700',
                  rejected: 'bg-red-100 text-red-700',
                  completed: 'bg-blue-100 text-blue-700',
                };
                const typeColors: Record<string, string> = {
                  deposit: 'bg-emerald-100',
                  withdrawal: 'bg-red-100',
                  purchase: 'bg-primary/10',
                };
                const typeIcons: Record<string, React.ReactNode> = {
                  deposit: <ArrowDown className="h-5 w-5 text-emerald-600" />,
                  withdrawal: <ArrowUp className="h-5 w-5 text-red-600" />,
                  purchase: <DollarSign className="h-5 w-5 text-primary" />,
                };
                const typeLabels: Record<string, string> = {
                  deposit: 'Dépôt',
                  withdrawal: 'Retrait',
                  purchase: 'Achat produit',
                  transfer_received: 'Reçu',
                  refund: 'Remboursement',
                };
                return (
                  <Card key={tx.id} className={`overflow-hidden border ${isPending ? 'border-amber-200 bg-amber-50/20' : 'border-gray-100'}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 ${typeColors[tx.type] || 'bg-gray-100'}`}>
                          {typeIcons[tx.type] || <DollarSign className="h-5 w-5 text-gray-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-black text-dark">{tx.clientName || 'Client'}</p>
                            <Badge className={`text-[10px] font-black ${statusColors[tx.status] || 'bg-gray-100 text-gray-500'}`}>
                              {tx.status === 'pending' ? 'En attente' : tx.status === 'approved' ? 'Approuvé' : tx.status === 'rejected' ? 'Rejeté' : 'Complété'}
                            </Badge>
                            <Badge variant="outline" className="text-[10px]">{typeLabels[tx.type] || tx.type}</Badge>
                          </div>
                          <p className="text-sm text-subtext">{tx.description || (isPurchase && tx.productName ? `Achat: ${tx.productName}` : '')}</p>
                          {tx.method && <p className="text-xs text-gray-400 mt-0.5">Via {tx.method}{tx.accountNumber ? ` → ${tx.accountNumber}` : ''}</p>}
                          {tx.createdAt?.toDate && (
                            <p className="text-[10px] text-gray-400 mt-1">
                              {format(tx.createdAt.toDate(), 'dd MMM yyyy HH:mm', { locale: fr })}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <p className={`text-xl font-black ${isDeposit ? 'text-emerald-600' : isWithdrawal || isPurchase ? 'text-red-600' : 'text-dark'}`}>
                            {isDeposit ? '+' : '-'}{tx.amount.toLocaleString()} HTG
                          </p>
                          {isPending && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black"
                                disabled={clientTxActionLoading === tx.id}
                                onClick={() => handleClientTxAction(tx.id!, 'approved')}
                              >
                                {clientTxActionLoading === tx.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approuver'}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-9 px-4 rounded-xl text-xs font-black"
                                disabled={clientTxActionLoading === tx.id}
                                onClick={() => handleClientTxAction(tx.id!, 'rejected')}
                              >
                                Refuser
                              </Button>
                            </div>
                          )}
                          {tx.rejectionReason && (
                            <p className="text-xs text-red-500 italic">Motif: {tx.rejectionReason}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="search" className="mt-0 h-full bg-white/50">
            <div className="max-w-6xl mx-auto space-y-6 px-6 py-8 pb-32">
              <IntelligenceSearch 
                onSearch={async (query) => {
                  setAffiliateSearchInput(query);
                  // We need to trigger the search logic
                  // Because IntelligenceSearch has its own state, we use the callback
                  const results = await searchAffiliatesByName(query);
                  setSearchAffiliateResults(results);
                  if (results.length === 1) {
                    await handleViewAffiliateDetail(results[0]);
                  } else if (results.length > 0) {
                    setSearchStatus('found');
                  } else {
                    setSearchStatus('not_found');
                  }
                }}
                isSearching={isSearchingAffiliate}
              />

              <div className="min-h-[500px]">
                {searchStatus === 'searching' && (
                  <div className="flex flex-col items-center justify-center py-32 text-primary">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse rounded-full"></div>
                      <div className="relative h-24 w-24 rounded-full border-4 border-primary/10 border-t-primary animate-spin"></div>
                      <Search className="absolute inset-0 m-auto h-8 w-8 animate-bounce" />
                    </div>
                    <p className="text-2xl font-black tracking-widest uppercase">Exploration Sémantique...</p>
                    <p className="text-sm text-gray-400 font-black mt-2">Recherche de "{affiliateSearchInput}" dans la base de données.</p>
                  </div>
                )}

                {searchStatus === 'not_found' && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border border-red-100 shadow-sm"
                  >
                    <div className="p-6 bg-red-50 rounded-full mb-6 text-red-500">
                      <AlertCircle className="h-12 w-12" />
                    </div>
                    <h3 className="text-2xl font-black text-dark mb-2">Aucun Résultat Crital</h3>
                    <p className="text-gray-400 font-medium mb-8">Nous n'avons trouvé aucun profil correspondant à votre recherche.</p>
                    <Button variant="outline" className="border-red-200 text-red-600 font-black px-10 h-12 rounded-xl" onClick={() => setSearchStatus('idle')}>ESSAYER À NOUVEAU</Button>
                  </motion.div>
                )}

                {searchStatus === 'found' && !selectedAffiliateDetail && (
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 px-2 border-l-4 border-emerald-500 py-1 ml-2">
                       <p className="text-lg font-black text-dark uppercase tracking-tighter">{searchAffiliateResults.length} Correspondance(s) Identifiée(s)</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {searchAffiliateResults.map(a => (
                        <motion.div 
                          key={a.id} 
                          onClick={() => handleViewAffiliateDetail(a)}
                          whileHover={{ y: -8, scale: 1.02 }}
                          className="p-6 rounded-[2.5rem] bg-white border border-gray-100 shadow-sm hover:shadow-2xl hover:border-primary/30 transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-5 mb-4">
                            <div className="h-16 w-16 rounded-3xl bg-accent-light text-primary flex items-center justify-center font-black text-2xl group-hover:bg-primary group-hover:text-white transition-colors duration-500">
                              {a.name.charAt(0)}
                            </div>
                            <div>
                               <p className="font-black text-dark group-hover:text-primary transition-colors text-xl leading-tight">{a.name}</p>
                               <div className="flex flex-wrap gap-2 mt-2">
                                 <Badge variant="outline" className="text-[10px] font-black uppercase bg-gray-50 border-gray-200">#{a.code}</Badge>
                                 <Badge className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-600 border-0">{a.level}</Badge>
                               </div>
                            </div>
                          </div>
                          <div className="pt-4 border-t border-gray-50 flex items-center justify-between">
                            <span className="text-[11px] font-black text-gray-300 uppercase tracking-widest">Ouvrir l'Analyse</span>
                            <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-primary transition-all group-hover:translate-x-2" />
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAffiliateDetail && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          if (searchAffiliateResults.length > 1) setSelectedAffiliateDetail(null);
                          else setSearchStatus('idle');
                        }}
                        className="h-12 rounded-2xl text-primary font-black uppercase tracking-widest bg-white shadow-sm border border-gray-100 hover:bg-accent-light"
                      >
                        <ChevronLeft className="h-5 w-5 mr-3" /> Retourner aux résultats
                      </Button>
                      <div className="flex items-center gap-2 px-6 py-2 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-500/20 font-black text-xs uppercase tracking-widest">
                        <CheckCircle2 className="h-4 w-4" /> Analyse Active
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                       {/* Left Sidebar: Profile Dashboard */}
                       <div className="lg:col-span-1 space-y-6">
                         <Card className="rounded-[3rem] border-0 shadow-2xl bg-white overflow-hidden group">
                           <div className="h-32 bg-navy relative overflow-hidden">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-transparent"></div>
                           </div>
                           <div className="px-8 pb-10 -mt-16 text-center relative z-10">
                             <div className="h-32 w-32 rounded-[2.5rem] bg-white shadow-2xl mx-auto flex items-center justify-center text-primary text-5xl font-black border-8 border-white mb-6 group-hover:scale-105 transition-transform duration-500">
                               {selectedAffiliateDetail.name.charAt(0)}
                             </div>
                             <h3 className="text-2xl font-black text-dark leading-tight">{selectedAffiliateDetail.name}</h3>
                             <div className="flex flex-col items-center gap-1 mt-1">
                               <p className="text-gray-400 font-mono font-bold text-xs">ID: {selectedAffiliateDetail.id.substring(0, 10)}...</p>
                               {selectedAffiliateDetail.walletId && (
                                 <div className="mt-2 inline-flex flex-col items-center px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-100">
                                   <p className="text-[8px] font-black text-emerald-600/60 uppercase tracking-[0.2em] mb-0.5">Wallet ID</p>
                                   <p className="text-sm font-mono font-black tracking-[0.2em] text-emerald-950">
                                     {selectedAffiliateDetail.walletId.match(/.{1,4}/g)?.join(' ')}
                                   </p>
                                 </div>
                               )}
                             </div>
                             
                             <div className="mt-8 space-y-3">
                                <Button 
                                  onClick={() => handleContactWhatsApp(selectedAffiliateDetail.name, selectedAffiliateDetail.info?.phone || '', true)}
                                  className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-black uppercase tracking-widest text-[11px] shadow-lg shadow-[#25D366]/20 border-0"
                                >
                                  <LucideIcons.MessageSquare className="h-4 w-4 mr-2" />
                                  Contact WhatsApp
                                </Button>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                   <span className="text-[11px] font-black text-gray-400 uppercase">Niveau actuel</span>
                                   <Badge className="bg-primary hover:bg-primary text-white border-0 font-black px-4">{selectedAffiliateDetail.level}</Badge>
                                </div>
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-gray-50 border border-gray-100">
                                   <span className="text-[11px] font-black text-gray-400 uppercase">Performance</span>
                                   <span className="text-lg font-black text-dark">{selectedAffiliateDetail.points || 0} pts</span>
                                </div>
                             </div>

                             <Button 
                               className="w-full mt-8 rounded-2xl h-16 bg-navy text-white font-black text-[13px] uppercase tracking-widest hover:bg-primary transition-all duration-300 shadow-xl shadow-navy/20"
                               onClick={() => {
                                 setEditingAffiliate(selectedAffiliateDetail);
                                 setAffiliateFormData(selectedAffiliateDetail);
                                 setIsAffiliateDialogOpen(true);
                               }}
                             >
                               Configuration Avancée
                             </Button>
                           </div>
                         </Card>

                         <Card className="rounded-[2.5rem] bg-white border border-emerald-100 p-8 shadow-2xl shadow-emerald-600/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                             <div className="absolute bottom-0 left-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                            <div className="relative z-10">
                               <p className="text-emerald-600/60 text-[10px] font-black uppercase tracking-widest mb-1 opacity-80 font-bold">Capitaux Disponibles</p>
                               <p className="text-5xl font-black tracking-tighter">{(selectedAffiliateDetail.balance || 0).toLocaleString()} <span className="text-xl font-bold opacity-30 text-emerald-950/20">$</span></p>
                               <p className="text-xs font-bold text-emerald-600/40 mt-1">≈ {((selectedAffiliateDetail.balance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                               <div className="mt-8 grid grid-cols-2 gap-3 text-left">
                                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-50 transition-all hover:bg-emerald-50">
                                     <p className="text-[9px] font-black uppercase text-emerald-600/60 tracking-wider">Direct</p>
                                     <p className="text-lg font-black text-emerald-950 mt-1">{(selectedAffiliateDetail.directRevenue || 0).toLocaleString()} <span className="text-[10px] text-gray-300 font-bold ml-1">$</span></p>
                                  </div>
                                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-50 transition-all hover:bg-emerald-50">
                                     <p className="text-[9px] font-black uppercase text-emerald-600/60 tracking-wider">Indirect</p>
                                     <p className="text-lg font-black text-emerald-950 mt-1">{(selectedAffiliateDetail.indirectRevenue || 0).toLocaleString()} <span className="text-[10px] text-gray-300 font-bold ml-1">$</span></p>
                                  </div>
                               </div>

                            </div>
                         </Card>
                       </div>

                       {/* Right/Main Area: Genealogy Map */}
                       <div className="lg:col-span-3 space-y-8">
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <Card className="rounded-[3rem] p-8 bg-white border border-gray-100 shadow-xl relative group">
                               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                                 <Users className="h-20 w-20" />
                               </div>
                               <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                                 <div className="h-2 w-2 rounded-full bg-primary animate-pulse"></div>
                                 Structure Ascendante (N+1 & N+2)
                               </h4>
                               
                               <div className="space-y-6">
                                  <div className="relative">
                                    {selectedAffiliateDetail.parentAffiliateId ? (
                                      <motion.button 
                                        onClick={() => {
                                          const sponsor = affiliates.find(a => a.id === selectedAffiliateDetail.parentAffiliateId);
                                          if (sponsor) handleViewAffiliateDetail(sponsor);
                                        }}
                                        whileHover={{ x: 10 }}
                                        className="w-full text-left p-6 rounded-[2rem] bg-gray-50 border border-gray-100 hover:border-primary transition-all flex items-center justify-between"
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className="h-14 w-14 rounded-2xl bg-white shadow-md text-primary flex items-center justify-center font-black text-xl">
                                            {affiliates.find(a => a.id === selectedAffiliateDetail.parentAffiliateId)?.name.charAt(0)}
                                          </div>
                                          <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Direct Sponsor</p>
                                            <p className="text-xl font-black text-dark">{affiliates.find(a => a.id === selectedAffiliateDetail.parentAffiliateId)?.name}</p>
                                          </div>
                                        </div>
                                        <ArrowRight className="h-5 w-5 text-primary" />
                                      </motion.button>
                                    ) : (
                                      <div className="p-10 rounded-[2rem] border-2 border-dashed border-gray-100 bg-gray-50/50 text-center">
                                        <p className="text-sm font-bold text-gray-300 italic">Pas de sponsor de 1er rang</p>
                                      </div>
                                    )}
                                    <div className="absolute left-12 top-full h-8 w-1 bg-gradient-to-b from-gray-100 to-transparent"></div>
                                  </div>

                                  {selectedAffiliateDetail.grandparentAffiliateId ? (
                                    <motion.button 
                                      onClick={() => {
                                        const sponsor = affiliates.find(a => a.id === selectedAffiliateDetail.grandparentAffiliateId);
                                        if (sponsor) handleViewAffiliateDetail(sponsor);
                                      }}
                                      whileHover={{ x: 10 }}
                                      className="w-full text-left p-6 rounded-[2rem] bg-white border border-gray-50 transition-all flex items-center justify-between shadow-sm"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center font-black text-lg">
                                          {affiliates.find(a => a.id === selectedAffiliateDetail.grandparentAffiliateId)?.name.charAt(0)}
                                        </div>
                                        <div>
                                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">Indirect Sponsor</p>
                                          <p className="text-lg font-black text-dark/70">{affiliates.find(a => a.id === selectedAffiliateDetail.grandparentAffiliateId)?.name}</p>
                                        </div>
                                      </div>
                                      <ArrowRight className="h-5 w-5 text-gray-300" />
                                    </motion.button>
                                  ) : (
                                    <div className="p-8 rounded-[2.5rem] border-2 border-dashed border-gray-50 bg-white/50 text-center">
                                      <p className="text-sm font-bold text-gray-300 italic">Pas de sponsor de 2ème rang</p>
                                    </div>
                                  )}
                               </div>
                            </Card>

                            <Card className="rounded-[3rem] p-8 bg-navy text-white shadow-2xl relative overflow-hidden">
                               <div className="absolute top-0 right-0 h-48 w-48 bg-primary/20 rounded-full blur-[80px] -mr-24 -mt-24"></div>
                               <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-8 relative z-10">Rapport de Compression Réseau</h4>
                               <div className="space-y-6 relative z-10">
                                  <div className="flex items-center justify-between py-4 border-b border-white/5">
                                     <span className="text-gray-400 font-bold">Volume Total Réseau</span>
                                     <span className="text-xl font-black">{(selectedAffiliateDetail.directRevenue || 0) + (selectedAffiliateDetail.indirectRevenue || 0)} $</span>
                                  </div>
                                  <div className="flex items-center justify-between py-4 border-b border-white/5">
                                     <span className="text-gray-400 font-bold">Nombre de Clients Référés</span>
                                     <span className="text-xl font-black">{selectedAffiliateDetail.referredClients || 0}</span>
                                  </div>
                                  <div className="flex items-center justify-between py-4">
                                     <span className="text-gray-400 font-bold">Code Promo Actif</span>
                                     <Badge className="bg-white/10 text-primary font-mono text-lg py-2 px-6 rounded-xl border-white/10">{selectedAffiliateDetail.code}</Badge>
                                  </div>
                               </div>
                            </Card>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Direct Referrals Generation 1 */}
                            <div className="space-y-6">
                              <div className="flex items-center justify-between px-6">
                                <h4 className="text-xs font-black font-mono uppercase tracking-tighter text-gray-400">Génération 1 / Direct Downline</h4>
                                <Badge className="bg-primary/10 text-primary border-0 font-black">{referralDetails?.directReferrals.length || 0}</Badge>
                              </div>
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar overscroll-contain">
                                {referralDetails?.directReferrals.length ? (
                                  referralDetails.directReferrals.map(ref => (
                                    <motion.button 
                                      whileHover={{ scale: 1.02 }}
                                      key={ref.id} 
                                      onClick={() => handleViewAffiliateDetail(ref)}
                                      className="w-full text-left p-5 rounded-[2.5rem] bg-white border border-gray-100 hover:border-primary shadow-sm hover:shadow-xl transition-all flex items-center justify-between group/down"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="h-12 w-12 rounded-2xl bg-accent-light text-primary flex items-center justify-center font-black">
                                          {ref.name.charAt(0)}
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-dark group-hover/down:text-primary transition-colors">{ref.name}</p>
                                          <p className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full w-fit mt-1">{ref.balance} $</p>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                         <Badge variant="outline" className="text-[9px] border-gray-100 bg-gray-50/50 font-black uppercase">{ref.level}</Badge>
                                         <ChevronRight className="h-4 w-4 text-gray-300 group-hover/down:translate-x-1 transition-transform" />
                                      </div>
                                    </motion.button>
                                  ))
                                ) : (
                                  <div className="py-20 rounded-[3rem] bg-white border border-dashed border-gray-100 text-center">
                                    <Users className="h-10 w-10 text-gray-100 mx-auto mb-4" />
                                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest leading-relaxed px-10">Aucun profil de premier rang détecté</p>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Indirect Referrals Generation 2 */}
                            <div className="space-y-6">
                              <div className="flex items-center justify-between px-6">
                                <h4 className="text-xs font-black font-mono uppercase tracking-tighter text-gray-400">Génération 2 / Indirect Downline</h4>
                                <Badge className="bg-gray-100 text-gray-500 border-0 font-black">{referralDetails?.indirectReferrals.length || 0}</Badge>
                              </div>
                              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-3 custom-scrollbar overscroll-contain">
                                {referralDetails?.indirectReferrals.length ? (
                                  referralDetails.indirectReferrals.map(ref => (
                                    <motion.button 
                                      whileHover={{ scale: 1.02 }}
                                      key={ref.id} 
                                      onClick={() => handleViewAffiliateDetail(ref)}
                                      className="w-full text-left p-5 rounded-[2.5rem] bg-gray-50/50 border border-transparent hover:bg-white hover:border-primary hover:shadow-xl transition-all flex items-center justify-between group/down"
                                    >
                                      <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-xl bg-white shadow-sm text-gray-400 flex items-center justify-center font-black">
                                          {ref.name.charAt(0)}
                                        </div>
                                        <div>
                                          <p className="text-sm font-black text-dark/70 group-hover/down:text-primary transition-colors">{ref.name}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                             <span className="text-[9px] font-black text-gray-300 uppercase">Points: {ref.points || 0}</span>
                                          </div>
                                        </div>
                                      </div>
                                      <ChevronRight className="h-4 w-4 text-gray-300 group-hover/down:translate-x-1 transition-transform" />
                                    </motion.button>
                                  ))
                                ) : (
                                  <div className="py-20 rounded-[3rem] bg-gray-50/50 border border-dashed border-gray-100 text-center">
                                    <Network className="h-10 w-10 text-gray-100 mx-auto mb-4" />
                                    <p className="text-xs font-black text-gray-300 uppercase tracking-widest leading-relaxed px-10">Réseau indirect vide ou inexistant</p>
                                  </div>
                                )}
                              </div>
                            </div>
                         </div>
                       </div>
                    </div>
                  </motion.div>
                )}

                 {selectedClientDetail && (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-8"
                  >
                    <div className="flex items-center justify-between">
                      <Button 
                        variant="ghost" 
                        onClick={() => {
                          if (searchAffiliateResults.length > 0) setSelectedClientDetail(null);
                          else setSearchStatus('idle');
                        }}
                        className="h-12 rounded-2xl text-primary font-black uppercase tracking-widest bg-white shadow-sm border border-gray-100 hover:bg-accent-light"
                      >
                        <ChevronLeft className="h-5 w-5 mr-3" /> Retourner
                      </Button>
                      <div className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-500/20 font-black text-xs uppercase tracking-widest">
                        <Smartphone className="h-4 w-4" /> Analyse Client
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                       <Card className="lg:col-span-1 rounded-[3rem] p-8 bg-white border-0 shadow-xl text-center">
                          <div className="h-24 w-24 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mx-auto mb-6 text-3xl font-black">
                            {selectedClientDetail.name.charAt(0)}
                          </div>
                          <h3 className="text-2xl font-black text-dark">{selectedClientDetail.name}</h3>
                          <p className="text-primary font-bold text-lg mt-2">{selectedClientDetail.phone}</p>
                          
                          <div className="mt-8 space-y-3">
                             <Button 
                                onClick={() => handleContactWhatsApp(selectedClientDetail.name, selectedClientDetail.phone, false)}
                                className="w-full h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-black uppercase tracking-widest text-[10px] shadow-lg shadow-[#25D366]/20 border-0"
                             >
                               <LucideIcons.MessageSquare className="h-4 w-4 mr-2" />
                               Contacter sur WhatsApp
                             </Button>
                          </div>
                          
                          <div className="mt-8 pt-8 border-t border-gray-50 flex justify-center">
                             <Badge variant="outline" className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{selectedClientDetail.id?.substring(0, 8)}</Badge>
                          </div>
                       </Card>

                       <Card className="lg:col-span-2 rounded-[3rem] p-8 bg-navy text-white shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 h-40 w-40 bg-primary/20 rounded-full blur-[60px] -mr-20 -mt-20"></div>
                          <h4 className="text-xs font-black uppercase tracking-widest text-primary mb-8 relative z-10">Structure de Parrainage</h4>
                          
                          <div className="space-y-6 relative z-10">
                             <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                <div>
                                   <p className="text-[10px] font-black text-primary uppercase mb-1">Parrain Direct (N+1)</p>
                                   <p className="text-xl font-black">
                                      {selectedClientDetail.directSponsorId 
                                        ? (affiliates.find(a => a.id === selectedClientDetail.directSponsorId)?.name || "Chargement...") 
                                        : "Aucun"}
                                   </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-white/30" />
                             </div>

                             <div className="flex items-center justify-between p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                                <div>
                                   <p className="text-[10px] font-black text-primary uppercase mb-1">Parrain Indirect (N+2)</p>
                                   <p className="text-xl font-black">
                                      {selectedClientDetail.indirectSponsorId 
                                        ? (affiliates.find(a => a.id === selectedClientDetail.indirectSponsorId)?.name || "Chargement...") 
                                        : "Aucun"}
                                   </p>
                                </div>
                                <ArrowRight className="h-5 w-5 text-white/30" />
                             </div>
                          </div>
                       </Card>
                    </div>
                  </motion.div>
                )}

                {searchStatus === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-200">
                     <div className="p-12 rounded-[50%] bg-gray-50 border border-gray-100 mb-10 shadow-inner relative">
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                          className="absolute inset-0 m-auto h-32 w-32 border-2 border-dashed border-primary/20 rounded-full"
                        ></motion.div>
                        <Network className="h-20 w-20 opacity-10 relative z-10" />
                     </div>
                     <h3 className="text-2xl font-black text-dark/20 uppercase tracking-widest">En attente de déploiement</h3>
                     <p className="text-sm font-medium text-gray-400 mt-4 max-w-sm text-center leading-relaxed">Le système d'analyse d'intention est inactif. Veuillez interroger la base de données via le moteur de recherche ci-dessus.</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </TabsContent>

        <TabsContent value="clients" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-dark">
              <Smartphone className="h-5 w-5 text-primary" />
              Base de Données Clients
            </h2>
            <Button 
                onClick={() => {
                   setEditingClient(null);
                   setClientFormData({ name: '', phone: '', directSponsorId: '', indirectSponsorId: '' });
                   setIsClientDialogOpen(true);
                }} 
                className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0 h-11 px-6 rounded-2xl shadow-lg shadow-primary/20 font-black uppercase text-xs"
            >
              <Plus className="h-4 w-4" />
              Ajouter un Client
            </Button>
          </div>

          <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden">
            <ClientsSearchHeader 
              searchQuery={clientSearchQuery}
              onSearchChange={setClientSearchQuery}
              totalClients={clients.length}
            />

            <div className="overflow-x-auto overflow-y-auto max-h-[600px] custom-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-gray-50">
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Client</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Numéro</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Parrain Direct</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400">Parrain Indirect</TableHead>
                    <TableHead className="font-black text-[10px] uppercase tracking-widest text-gray-400 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <ClientsTableBody 
                    clients={clients}
                    searchQuery={clientSearchQuery}
                    affiliates={affiliates}
                    onEdit={(client) => {
                      setEditingClient(client);
                      setClientFormData(client);
                      setIsClientDialogOpen(true);
                    }}
                    onDelete={(client) => {
                      setClientToDelete(client);
                      setIsClientDeleteDialogOpen(true);
                    }}
                  />
                </TableBody>
              </Table>
            </div>
            {clients.length === 0 && (
              <div className="text-center py-20">
                <Smartphone className="h-12 w-12 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold">Aucun client enregistré pour le moment.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          {/* Push notification activation banner */}
          {pushSupported && pushPermission !== 'denied' && (
            <div className={`flex items-center justify-between gap-3 p-4 rounded-2xl border ${pushSub ? 'bg-emerald-50 border-emerald-200' : 'bg-violet-50 border-violet-200'}`}>
              <div className="flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${pushSub ? 'bg-emerald-100' : 'bg-violet-100'}`}>
                  <Bell className={`h-5 w-5 ${pushSub ? 'text-emerald-600' : 'text-violet-600'}`} />
                </div>
                <div>
                  <p className={`text-sm font-black ${pushSub ? 'text-emerald-800' : 'text-violet-800'}`}>
                    {pushSub ? '✅ Notifications push activées' : '🔔 Recevoir des alertes même hors-ligne'}
                  </p>
                  <p className={`text-xs mt-0.5 ${pushSub ? 'text-emerald-600' : 'text-violet-500'}`}>
                    {pushSub
                      ? 'Vous recevrez des alertes pour chaque dépôt et retrait, même si vous n\'êtes pas sur le site.'
                      : 'Activez les notifications pour être alerté de chaque dépôt et retrait en temps réel.'}
                  </p>
                </div>
              </div>
              <button
                onClick={pushSub ? pushUnsubscribe : pushSubscribe}
                disabled={pushLoading}
                className={`shrink-0 px-4 py-2 rounded-xl text-xs font-black transition-all ${pushSub
                  ? 'bg-emerald-100 hover:bg-emerald-200 text-emerald-700'
                  : 'bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-200'
                } disabled:opacity-50`}
              >
                {pushLoading ? '...' : pushSub ? 'Désactiver' : 'Activer'}
              </button>
            </div>
          )}
          {pushSupported && pushPermission === 'denied' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
              <Bell className="h-5 w-5 text-red-400 shrink-0" />
              <p className="text-xs text-red-600">Les notifications sont bloquées dans votre navigateur. Autorisez-les dans les paramètres du site pour les activer.</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2 text-dark">
              <Bell className="h-5 w-5 text-primary" />
              Centre de Notifications
              {unreadClientNotifCount > 0 && (
                <span className="ml-1 flex h-5 px-1.5 items-center rounded-full bg-primary text-white text-[10px] font-black animate-pulse">
                  +{unreadClientNotifCount} client
                </span>
              )}
            </h2>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Select value={notifFilter} onValueChange={(v: any) => setNotifFilter(v)}>
                <SelectTrigger className="w-full sm:w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filtrer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  <SelectItem value="registration">Inscriptions</SelectItem>
                  <SelectItem value="withdrawal">Retraits</SelectItem>
                  <SelectItem value="deposit">Dépôts</SelectItem>
                  <SelectItem value="client_tx">Demandes Clients</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* ── Toutes les activités clients (dépôts, retraits, achats) ── */}
          {adminClientNotifs.length > 0 && (
            <Card className="shadow-sm border-gray-200 overflow-hidden">
              <CardHeader className="border-b bg-gradient-to-r from-gray-800 to-gray-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-3 px-4">
                <CardTitle className="text-base font-black text-white flex items-center gap-2">
                  <Bell className="h-4 w-4 text-white" />
                  Activités Clients — Dépôts, Retraits &amp; Achats
                  {unreadClientNotifCount > 0 && (
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 animate-pulse">
                      {unreadClientNotifCount} nouveau{unreadClientNotifCount > 1 ? 'x' : ''}
                    </span>
                  )}
                </CardTitle>
                <div className="flex items-center gap-3">
                  {unreadClientNotifCount > 0 && (
                    <button onClick={() => markAllAdminNotificationsRead()}
                      className="text-[11px] font-bold text-gray-300 hover:text-white underline underline-offset-2 transition-colors">
                      Tout marquer lu
                    </button>
                  )}
                  {confirmClear ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-red-300">Confirmer ?</span>
                      <button
                        disabled={clearingHistory}
                        onClick={async () => {
                          setClearingHistory(true);
                          try {
                            await clearAllAdminNotifications();
                            toast.success('Historique effacé avec succès');
                          } catch {
                            toast.error('Erreur lors de la suppression');
                          } finally {
                            setClearingHistory(false);
                            setConfirmClear(false);
                          }
                        }}
                        className="text-[11px] font-black text-red-400 hover:text-red-200 px-2 py-0.5 rounded bg-red-500/20 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                        {clearingHistory ? '...' : 'Oui, effacer'}
                      </button>
                      <button
                        onClick={() => setConfirmClear(false)}
                        className="text-[11px] font-bold text-gray-400 hover:text-gray-200 transition-colors">
                        Annuler
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmClear(true)}
                      className="text-[11px] font-bold text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors flex items-center gap-1">
                      🗑 Effacer l'historique
                    </button>
                  )}
                  <button onClick={() => setActiveTab('clients-tx')}
                    className="text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                    Voir transactions →
                  </button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100 max-h-[480px] overflow-y-auto">
                  {adminClientNotifs.slice(0, 50).map(notif => {
                    const isDeposit = notif.type === 'client_deposit';
                    const isWithdrawal = notif.type === 'client_withdrawal';
                    const isPurchase = notif.type === 'client_purchase';
                    const isAlreadyResolved = (notif as any).status === 'approved' || (notif as any).status === 'declined';
                    const iconBg = isDeposit ? 'bg-emerald-100' : isWithdrawal ? 'bg-red-100' : 'bg-violet-100';
                    const badgeCls = isDeposit
                      ? 'bg-emerald-100 text-emerald-700'
                      : isWithdrawal
                        ? 'bg-red-100 text-red-700'
                        : 'bg-violet-100 text-violet-700';
                    const label = isDeposit ? '↓ DÉPÔT' : isWithdrawal ? '↑ RETRAIT' : '🛍️ ACHAT';
                    const isPurchaseLoading = purchaseActionLoading === notif.id;
                    return (
                      <div key={notif.id} className={`px-4 py-3 transition-colors ${notif.read ? 'bg-white hover:bg-gray-50' : isPurchase ? 'bg-violet-50/50 hover:bg-violet-50' : 'bg-amber-50/60 hover:bg-amber-50'}`}>
                        {isPurchase ? (
                          /* ── Purchase notification: structured card ── */
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start gap-3">
                              <div className="mt-0.5 h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-violet-100">
                                <ShoppingBag className="h-5 w-5 text-violet-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-black text-dark text-sm">{notif.clientName}</span>
                                  <Badge className="text-[10px] font-black px-2 py-0 border-0 bg-violet-100 text-violet-700">🛍️ ACHAT</Badge>
                                  {!notif.read && <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary text-white">NOUVEAU</span>}
                                  {isAlreadyResolved && (
                                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${(notif as any).status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                      {(notif as any).status === 'approved' ? '✓ TERMINÉ' : '✗ REFUSÉ'}
                                    </span>
                                  )}
                                </div>
                                {/* Service + Price */}
                                <div className="mt-1.5 rounded-xl bg-white border border-violet-100 px-3 py-2 space-y-1">
                                  {(notif as any).productName && (
                                    <p className="font-black text-violet-700 text-sm leading-tight">{(notif as any).productName}</p>
                                  )}
                                  {(notif as any).productPrice && (
                                    <p className="text-xs text-gray-500 font-bold">{(notif as any).productPrice}</p>
                                  )}
                                  <p className="font-black text-dark text-base">{(notif.amount || 0).toLocaleString()} HTG</p>
                                  {(notif as any).directSponsorId && (
                                    <div className="flex items-center gap-1.5 pt-1">
                                      <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                        ✓ Commission auto-envoyée
                                      </span>
                                      <span className="text-[10px] text-gray-400 font-medium">
                                        Parrain: {affiliates.find(a => a.id === (notif as any).directSponsorId)?.name || '—'}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                    {(notif as any).clientWalletId && (
                                      <span className="text-[10px] font-mono text-gray-400">Wallet #{(notif as any).clientWalletId}</span>
                                    )}
                                    {(notif as any).clientPhone && (
                                      <span className="text-[10px] text-gray-400">📱 {(notif as any).clientPhone}</span>
                                    )}
                                    <span className="text-[10px] text-gray-400">
                                      {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'dd MMM, HH:mm', { locale: fr }) : ''}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              {!notif.read && (
                                <button onClick={() => markAdminNotificationRead(notif.id!)}
                                  className="shrink-0 text-[10px] font-bold text-gray-400 hover:text-gray-600 mt-1 transition-colors"
                                  title="Marquer comme lu">✓ Lu</button>
                              )}
                            </div>
                            {/* Action buttons for unresolved purchases */}
                            {!isAlreadyResolved && (notif as any).transactionId && (
                              <div className="flex gap-2 ml-13 pl-13">
                                <Button
                                  size="sm"
                                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black gap-1.5"
                                  disabled={isPurchaseLoading}
                                  onClick={() => {
                                    setCredentialNotif(notif);
                                    setCredentialEmail('');
                                    setCredentialPassword('');
                                    setCredentialsModalOpen(true);
                                  }}
                                >
                                  {isPurchaseLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4" /> Approuver</>}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-3 rounded-xl text-xs font-black border-red-200 text-red-600 hover:bg-red-50 gap-1"
                                  disabled={isPurchaseLoading}
                                  onClick={() => handlePurchaseAction(
                                    notif.id!,
                                    (notif as any).transactionId,
                                    (notif as any).clientId,
                                    notif.amount,
                                    (notif as any).directSponsorId || null,
                                    'decline'
                                  )}
                                >
                                  <XCircle className="h-4 w-4" /> Refuser
                                </Button>
                                {(notif as any).clientPhone && (
                                  <a
                                    href={`https://wa.me/${((notif as any).clientPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(`✅ Bonjour ${notif.clientName},\n\nVotre service *${(notif as any).productName || 'Service'}* au prix de *${(notif.amount || 0).toLocaleString()} HTG* a été *traité* avec succès.\n\nMerci de votre confiance — Équipe Rena 🙏`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="h-9 px-3 rounded-xl text-xs font-black border-2 border-green-200 text-green-700 hover:bg-green-50 flex items-center gap-1 transition-colors"
                                  >
                                    📲 WhatsApp
                                  </a>
                                )}
                                {(notif as any).directSponsorId && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 px-3 rounded-xl text-xs font-black border-violet-200 text-violet-600 hover:bg-violet-50 gap-1"
                                    onClick={() => {
                                      const sponsorId = (notif as any).directSponsorId;
                                      const sponsorName = affiliates.find(a => a.id === sponsorId)?.name || '';
                                      setManualCommissionAffiliateId(sponsorId);
                                      setManualCommissionAffiliateName(sponsorName);
                                      setManualCommissionReason(`Vente: ${(notif as any).productName || 'Service'}`);
                                      setIsManualCommissionOpen(true);
                                    }}
                                  >
                                    <DollarSign className="h-4 w-4" /> + Commission
                                  </Button>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          /* ── Deposit / Withdrawal notification: compact row ── */
                          <div className="flex items-start gap-3">
                            <div className={`mt-0.5 h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
                              {isDeposit ? <ArrowDown className="h-4 w-4 text-emerald-600" /> : <ArrowUp className="h-4 w-4 text-red-600" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-dark text-sm">{notif.clientName}</span>
                                <Badge className={`text-[10px] font-black px-2 py-0 border-0 ${badgeCls}`}>{label}</Badge>
                                {(notif as any).clientWalletId && (
                                  <span className="text-[10px] font-mono text-gray-400">#{(notif as any).clientWalletId}</span>
                                )}
                                {!notif.read && (
                                  <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-primary text-white">NOUVEAU</span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                                <span className="font-black text-dark text-sm">${(notif.amount || 0).toFixed(2)}</span>
                                {notif.method && <span className="text-[11px] text-gray-500">via {notif.method}</span>}
                                {(notif as any).accountNumber && <span className="text-[11px] font-mono text-gray-500">{(notif as any).accountNumber}</span>}
                                {(notif as any).txId && <span className="text-[11px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Réf: {(notif as any).txId}</span>}
                                {(notif as any).clientPhone && <span className="text-[10px] text-gray-400">📱 {(notif as any).clientPhone}</span>}
                                <span className="text-[10px] text-gray-400">
                                  {notif.createdAt?.toDate ? format(notif.createdAt.toDate(), 'dd MMM, HH:mm', { locale: fr }) : ''}
                                </span>
                              </div>
                            </div>
                            {!notif.read && (
                              <button onClick={() => markAdminNotificationRead(notif.id!)}
                                className="shrink-0 text-[10px] font-bold text-gray-400 hover:text-gray-600 mt-1 transition-colors"
                                title="Marquer comme lu">✓ Lu</button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Demandes en attente — vue cartes ── */}
          <div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <h3 className="text-lg font-black text-dark flex items-center gap-2">
                <span className="h-7 w-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-600" />
                </span>
                Demandes en attente
                {allPendingRequests.length > 0 && (
                  <span className="ml-1 h-6 px-2 rounded-full bg-amber-500 text-white text-[11px] font-black flex items-center">
                    {allPendingRequests.length}
                  </span>
                )}
              </h3>
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Rechercher…"
                  className="pl-9 h-9 text-sm"
                  value={notifSearch}
                  onChange={(e) => setNotifSearch(e.target.value)}
                />
              </div>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-4">
              {([
                { key: 'all', label: 'Toutes', color: 'bg-gray-800 text-white', inactive: 'bg-gray-100 text-gray-500 hover:bg-gray-200' },
                { key: 'deposit', label: '↓ Dépôts', color: 'bg-emerald-600 text-white', inactive: 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' },
                { key: 'withdrawal', label: '↑ Retraits', color: 'bg-red-600 text-white', inactive: 'bg-red-50 text-red-700 hover:bg-red-100' },
                { key: 'registration', label: '👤 Inscriptions', color: 'bg-violet-600 text-white', inactive: 'bg-violet-50 text-violet-700 hover:bg-violet-100' },
              ] as const).map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setPendingTypeFilter(pill.key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition-all ${pendingTypeFilter === pill.key ? pill.color : pill.inactive}`}
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {allPendingRequests.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {allPendingRequests.filter(req => {
                  if (pendingTypeFilter === 'all') return true;
                  if (pendingTypeFilter === 'registration') return req.type === 'registration';
                  if (pendingTypeFilter === 'withdrawal') return req.type === 'withdrawal' || req.type === 'client_withdrawal_req';
                  if (pendingTypeFilter === 'deposit') return req.type === 'deposit_request' || req.type === 'client_deposit_req';
                  return true;
                }).map((req) => {
                  const isRegistration = req.type === 'registration';
                  const isWithdrawal = req.type === 'withdrawal';
                  const isClientWithdrawal = req.type === 'client_withdrawal_req';
                  const isClientDeposit = req.type === 'client_deposit_req';
                  const isDeposit = req.type === 'deposit_request';

                  const typeColor = isRegistration
                    ? { bg: 'bg-violet-50', border: 'border-violet-200', icon: 'bg-violet-100 text-violet-600', badge: 'bg-violet-100 text-violet-700', amount: 'text-violet-700' }
                    : isWithdrawal || isClientWithdrawal
                    ? { bg: 'bg-red-50', border: 'border-red-200', icon: 'bg-red-100 text-red-600', badge: 'bg-red-100 text-red-700', amount: 'text-red-600' }
                    : { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'bg-emerald-100 text-emerald-600', badge: 'bg-emerald-100 text-emerald-700', amount: 'text-emerald-600' };

                  const typeLabel = isRegistration ? 'Inscription' : isWithdrawal ? 'Retrait affilié' : isClientWithdrawal ? '↑ Retrait client' : isClientDeposit ? '↓ Dépôt client' : '↓ Dépôt';
                  const TypeIcon = isRegistration ? Users : (isWithdrawal || isClientWithdrawal) ? ArrowUp : ArrowDown;
                  const loading = clientTxActionLoading === (req as any).id;

                  return (
                    <div key={req.id} className={`relative rounded-2xl border ${typeColor.border} ${typeColor.bg} p-4 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow`}>
                      <div className="flex items-start gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${typeColor.icon}`}>
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-black text-dark text-sm leading-tight truncate">{req.name}</p>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${typeColor.badge}`}>{typeLabel}</span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {req.createdAt?.toDate ? format(req.createdAt.toDate(), 'dd MMM, HH:mm', { locale: fr }) : 'Date inconnue'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        {isRegistration && (
                          <>
                            {(req as any).email && <p className="text-xs text-gray-600 truncate">📧 {(req as any).email}</p>}
                            {(req as any).phone && <p className="text-xs text-gray-500">📱 {(req as any).phone}</p>}
                          </>
                        )}
                        {(isWithdrawal || isDeposit) && (
                          <>
                            <p className={`text-xl font-black ${typeColor.amount}`}>{(req as any).amount} $</p>
                            {(req as any).method && (
                              <div className="flex items-center gap-1.5">
                                <Smartphone className="h-3 w-3 text-gray-400" />
                                <span className="text-xs font-bold text-gray-600">{(req as any).method}{(req as any).accountNumber ? ` · ${(req as any).accountNumber}` : ''}</span>
                              </div>
                            )}
                          </>
                        )}
                        {(isClientDeposit || isClientWithdrawal) && (
                          <>
                            <p className={`text-xl font-black ${typeColor.amount}`}>{(req as any).amount?.toLocaleString()} HTG</p>
                            <div className="flex flex-wrap gap-1.5">
                              {(req as any).method && (
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/70 border border-gray-200 text-gray-600">via {(req as any).method}</span>
                              )}
                              {(req as any).accountNumber && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-white/70 border border-gray-200 text-gray-500">{(req as any).accountNumber}</span>
                              )}
                              {(req as any).txId && (
                                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-600">#{(req as any).txId}</span>
                              )}
                            </div>
                            {(req as any).clientWalletId && (
                              <p className="text-[11px] text-gray-400 font-mono">Wallet: {(req as any).clientWalletId}</p>
                            )}
                            {(req as any).message && (
                              <p className="text-[11px] text-gray-500 italic bg-white/60 rounded-lg px-2 py-1">"{(req as any).message}"</p>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex gap-2 mt-auto pt-1">
                        <Button
                          size="sm"
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 border-0 text-white font-black h-9 rounded-xl"
                          disabled={loading}
                          onClick={() => {
                            if (isRegistration) handleAffiliateRequestAction(req as any, 'approved');
                            else if (isWithdrawal) handleWithdrawalAction(req as any, 'approved');
                            else if (isClientDeposit || isClientWithdrawal) handleClientTxAction(req.id!, 'approved');
                            else handleWalletTxAction(req.id!, 'approved');
                          }}
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓ Approuver'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 font-black h-9 rounded-xl"
                          disabled={loading}
                          onClick={() => {
                            if (isRegistration) handleAffiliateRequestAction(req as any, 'rejected');
                            else if (isWithdrawal) handleWithdrawalAction(req as any, 'rejected');
                            else if (isClientDeposit || isClientWithdrawal) handleClientTxAction(req.id!, 'rejected');
                            else handleWalletTxAction(req.id!, 'rejected');
                          }}
                        >
                          ✕ Rejeter
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl bg-gray-50 border border-dashed border-gray-200">
                <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-3">
                  <Bell className="h-7 w-7 text-gray-300" />
                </div>
                <p className="text-base font-black text-gray-400">Aucune demande en attente</p>
                <p className="text-sm text-gray-300 mt-1">Toutes les demandes ont été traitées.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="email-logs" className="space-y-6">
          <EmailLogsPanel />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <h2 className="text-xl font-bold text-center sm:text-left">Paramètres du Site</h2>
          <Card className="max-w-2xl mx-auto sm:mx-0">
            <CardHeader>
              <CardTitle>Identité Visuelle</CardTitle>
              <CardDescription>Gérez le logo de votre plateforme Rena.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Logo du site</Label>
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-100 overflow-hidden shrink-0">
                    {settings?.logoUrl ? (
                      <img 
                        src={settings.logoUrl} 
                        className="w-full h-full object-contain p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <ImageIcon className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="space-y-2 w-full sm:w-auto">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload}
                      className="hidden" 
                      id="logo-upload"
                    />
                    <Button asChild variant="outline" disabled={uploading} className="w-full sm:w-auto">
                      <label htmlFor="logo-upload" className="cursor-pointer flex items-center justify-center">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Changer le logo
                      </label>
                    </Button>
                    {uploading && (
                      <div className="w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-primary h-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500 text-center sm:text-left">Format recommandé: PNG ou SVG, fond transparent.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lien du logo (externe)</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      placeholder="https://..." 
                      value={tempLogoUrl} 
                      onChange={(e) => setTempLogoUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button 
                      onClick={() => {
                        if (tempLogoUrl) {
                          updateSettings({ logoUrl: tempLogoUrl });
                          setTempLogoUrl('');
                          toast.success("Lien du logo appliqué !");
                        }
                      }}
                      className="bg-primary hover:bg-[#1D4ED8] w-full sm:w-auto border-0"
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-bold text-dark flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-emerald-600" />
                        Coordonnées de Paiement Clients
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* MonCash Settings */}
                        <div className="space-y-4 p-4 rounded-3xl bg-rose-50/30 border border-rose-100">
                           <div className="flex items-center gap-2 mb-2">
                             <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                               <Smartphone className="h-4 w-4 text-rose-500" />
                             </div>
                             <span className="text-sm font-black text-rose-700">Mon Cash</span>
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-rose-600/60 uppercase">Numéro de téléphone</Label>
                             <Input 
                               placeholder="Ex: +509..." 
                               value={pendingSettings?.moncashNumber ?? settings?.moncashNumber ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, moncashNumber: e.target.value }))}
                               className="rounded-xl border-rose-100 focus:ring-rose-200"
                             />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-rose-600/60 uppercase">Lien QR Code</Label>
                             <Input 
                               placeholder="https://..." 
                               value={pendingSettings?.moncashQR ?? settings?.moncashQR ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, moncashQR: e.target.value }))}
                               className="rounded-xl border-rose-100 focus:ring-rose-200"
                             />
                           </div>
                        </div>

                        {/* NatCash Settings */}
                        <div className="space-y-4 p-4 rounded-3xl bg-amber-50/30 border border-amber-100">
                           <div className="flex items-center gap-2 mb-2">
                             <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                               <Smartphone className="h-4 w-4 text-amber-500" />
                             </div>
                             <span className="text-sm font-black text-amber-700">Natcash</span>
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-amber-600/60 uppercase">Numéro de téléphone</Label>
                             <Input 
                               placeholder="Ex: +509..." 
                               value={pendingSettings?.natcashNumber ?? settings?.natcashNumber ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, natcashNumber: e.target.value }))}
                               className="rounded-xl border-amber-100 focus:ring-amber-200"
                             />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-amber-600/60 uppercase">Lien QR Code</Label>
                             <Input 
                               placeholder="https://..." 
                               value={pendingSettings?.natcashQR ?? settings?.natcashQR ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, natcashQR: e.target.value }))}
                               className="rounded-xl border-amber-100 focus:ring-amber-200"
                             />
                           </div>
                        </div>

                        {/* Admi Settings */}
                        <div className="space-y-4 p-4 rounded-3xl bg-indigo-50/30 border border-indigo-100">
                           <div className="flex items-center gap-2 mb-2">
                             <div className="h-8 w-8 rounded-xl bg-white shadow-sm flex items-center justify-center">
                               <Landmark className="h-4 w-4 text-indigo-500" />
                             </div>
                             <span className="text-sm font-black text-indigo-700">Admi</span>
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-indigo-600/60 uppercase">Coordonnées / Numéro</Label>
                             <Input 
                               placeholder="Ex: 5500-0000" 
                               value={pendingSettings?.admiNumber ?? settings?.admiNumber ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, admiNumber: e.target.value }))}
                               className="rounded-xl border-indigo-100 focus:ring-indigo-200"
                             />
                           </div>
                           <div className="space-y-1">
                             <Label className="text-[10px] font-bold text-indigo-600/60 uppercase">Lien QR Code</Label>
                             <Input 
                               placeholder="https://..." 
                               value={pendingSettings?.admiQR ?? settings?.admiQR ?? ''}
                               onChange={(e) => setPendingSettings(prev => ({ ...prev, admiQR: e.target.value }))}
                               className="rounded-xl border-indigo-100 focus:ring-indigo-200"
                             />
                           </div>
                        </div>
                      </div>

                      <Button 
                        onClick={async () => {
                          const dataToUpdate = {
                            moncashNumber: pendingSettings.moncashNumber !== undefined ? pendingSettings.moncashNumber : settings?.moncashNumber,
                            moncashQR: pendingSettings.moncashQR !== undefined ? pendingSettings.moncashQR : settings?.moncashQR,
                            natcashNumber: pendingSettings.natcashNumber !== undefined ? pendingSettings.natcashNumber : settings?.natcashNumber,
                            natcashQR: pendingSettings.natcashQR !== undefined ? pendingSettings.natcashQR : settings?.natcashQR,
                            admiNumber: pendingSettings.admiNumber !== undefined ? pendingSettings.admiNumber : settings?.admiNumber,
                            admiQR: pendingSettings.admiQR !== undefined ? pendingSettings.admiQR : settings?.admiQR,
                          };
                          await updateSettings(dataToUpdate);
                          toast.success("Coordonnées de paiement mises à jour !");
                        }}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-2xl h-14 shadow-xl active:scale-95 transition-all"
                      >
                        Enregistrer les coordonnées de paiement
                      </Button>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <h3 className="text-sm font-bold text-dark flex items-center gap-2">
                        < LucideIcons.Palette className="h-4 w-4 text-primary" />
                        Gestion des logos de paiement
                      </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Logo MonCash (URL)</Label>
                      <Input 
                        placeholder="https://..." 
                        value={pendingSettings?.moncashLogoUrl ?? settings?.moncashLogoUrl ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, moncashLogoUrl: e.target.value }))}
                        className="rounded-xl border-gray-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Logo NatCash (URL)</Label>
                      <Input 
                        placeholder="https://..." 
                        value={pendingSettings?.natcashLogoUrl ?? settings?.natcashLogoUrl ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, natcashLogoUrl: e.target.value }))}
                        className="rounded-xl border-gray-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Logo Admin (URL - Optionnel)</Label>
                      <Input 
                        placeholder="https://..." 
                        value={pendingSettings?.adminLogoUrl ?? settings?.adminLogoUrl ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, adminLogoUrl: e.target.value }))}
                        className="rounded-xl border-gray-100"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Taux de Change (1 USD = ? HTG)</Label>
                      <Input 
                        type="number"
                        placeholder="146" 
                        value={pendingSettings?.exchangeRate ?? settings?.exchangeRate ?? 146}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, exchangeRate: parseFloat(e.target.value) }))}
                        className="rounded-xl border-gray-100"
                      />
                    </div>
                    <Button 
                      onClick={async () => {
                        const dataToUpdate = {
                          moncashLogoUrl: pendingSettings.moncashLogoUrl !== undefined ? pendingSettings.moncashLogoUrl : settings?.moncashLogoUrl,
                          natcashLogoUrl: pendingSettings.natcashLogoUrl !== undefined ? pendingSettings.natcashLogoUrl : settings?.natcashLogoUrl,
                          adminLogoUrl: pendingSettings.adminLogoUrl !== undefined ? pendingSettings.adminLogoUrl : settings?.adminLogoUrl,
                          exchangeRate: pendingSettings.exchangeRate !== undefined ? pendingSettings.exchangeRate : (settings?.exchangeRate || 146),
                        };
                        await updateSettings(dataToUpdate);
                        toast.success("Paramètres mis à jour !");
                      }}
                      className="w-full bg-navy hover:bg-navy/90 text-white font-bold rounded-xl"
                    >
                      Enregistrer les paramètres
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-dark flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    Annonce Globale
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100">
                      <div>
                        <p className="text-sm font-bold text-dark">Message de bienvenue / Annonce</p>
                        <p className="text-xs text-gray-500">Afficher un message à tous les visiteurs.</p>
                      </div>
                      <Checkbox 
                        checked={pendingSettings?.showGlobalAnnouncement ?? settings?.showGlobalAnnouncement} 
                        onCheckedChange={(checked) => setPendingSettings(prev => ({ ...prev, showGlobalAnnouncement: !!checked }))}
                      />
                    </div>
                    <div className="space-y-2">
                       <Label className="text-xs font-bold text-gray-500">Contenu du message</Label>
                       <Textarea 
                          placeholder="Entrez le message à afficher sur tout le site..."
                          value={pendingSettings?.globalAnnouncement ?? settings?.globalAnnouncement ?? ''}
                          onChange={(e) => setPendingSettings(prev => ({ ...prev, globalAnnouncement: e.target.value }))}
                          className="rounded-2xl border-gray-100 min-h-[80px]"
                       />
                       <p className="text-xs text-gray-400">Ce message apparaîtra en haut de chaque page.</p>
                    </div>
                    <Button 
                      onClick={async () => {
                        const dataToUpdate = {
                          showGlobalAnnouncement: pendingSettings.showGlobalAnnouncement !== undefined ? pendingSettings.showGlobalAnnouncement : settings?.showGlobalAnnouncement,
                          globalAnnouncement: pendingSettings.globalAnnouncement !== undefined ? pendingSettings.globalAnnouncement : settings?.globalAnnouncement
                        };
                        await updateSettings(dataToUpdate);
                        toast.success("Annonce enregistrée !");
                      }}
                      className="w-full bg-primary hover:bg-[#1D4ED8] text-white font-bold rounded-xl"
                    >
                      Enregistrer l'annonce
                    </Button>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-dark">Sécurité & Retraits</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Card className={`border shadow-sm transition-colors ${settings?.withdrawalsEnabled ? 'border-emerald-200 bg-emerald-50/30' : 'border-red-200 bg-red-50/30'}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-dark">Demandes de Retrait</p>
                          <p className="text-xs text-gray-500">{settings?.withdrawalsEnabled ? 'Activées' : 'Désactivées temporairement'}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant={settings?.withdrawalsEnabled ? "destructive" : "default"}
                          className={settings?.withdrawalsEnabled ? "bg-red-600" : "bg-emerald-600 hover:bg-emerald-700 border-0"}
                          onClick={() => setIsWithdrawalToggleConfirmOpen(true)}
                        >
                          {settings?.withdrawalsEnabled ? 'Désactiver' : 'Activer'}
                        </Button>
                      </CardContent>
                    </Card>

                    <Card className={`border shadow-sm transition-colors ${settings?.lockAffiliateEdits ? 'border-red-200 bg-red-50/30' : 'border-emerald-200 bg-emerald-50/30'}`}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-dark">Verrouillage des Infos</p>
                          <p className="text-xs text-gray-500">{settings?.lockAffiliateEdits ? 'Modifications verrouillées' : 'Modifications libres'}</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant={settings?.lockAffiliateEdits ? "default" : "destructive"}
                          className={settings?.lockAffiliateEdits ? "bg-emerald-600 hover:bg-emerald-700 border-0" : "bg-red-600"}
                          onClick={() => settings?.lockAffiliateEdits ? setIsUnlockDialogOpen(true) : handleToggleLockEdits()}
                        >
                          {settings?.lockAffiliateEdits ? 'Déverrouiller' : 'Verrouiller'}
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-sm font-bold text-dark flex items-center gap-2">
                    <span className="text-base">💰</span>
                    Gestion des Frais
                  </h3>

                  {/* Fees balance display */}
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1">Solde Admin — Parts de frais accumulées</p>
                      <p className="text-3xl font-black text-emerald-700">
                        ${((settings?.feesBalance || 0)).toFixed(2)}
                      </p>
                      <p className="text-xs text-emerald-600/70 font-medium mt-0.5">
                        ≈ {((settings?.feesBalance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG
                      </p>
                    </div>
                    <Button
                      disabled={!settings?.feesBalance || settings.feesBalance <= 0 || isSaving}
                      onClick={async () => {
                        if (!settings?.feesBalance || settings.feesBalance <= 0) return;
                        setIsSaving(true);
                        try {
                          await fetch('/api/admin/fees/withdraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: settings.feesBalance }) });
                          await updateSettings({ feesBalance: 0 });
                          toast.success(`${settings.feesBalance.toFixed(2)}$ de frais retirés !`);
                        } catch { toast.error("Erreur lors du retrait des frais."); }
                        finally { setIsSaving(false); }
                      }}
                      className="rounded-2xl h-12 px-5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] uppercase tracking-widest border-0 shadow-lg shadow-emerald-500/20 shrink-0 disabled:opacity-40"
                    >
                      Retirer
                    </Button>
                  </div>

                  {/* ── Affiliate commissions (moved from logo section) ── */}
                  <div className="space-y-3 pt-2 pb-4 border-b border-dashed border-gray-200">
                    {/* Commission Rates */}
                    <div className="space-y-3 pt-4 border-t border-dashed">
                      <h4 className="text-xs font-black text-dark uppercase tracking-wide flex items-center gap-2">
                        <LucideIcons.Percent className="h-4 w-4 text-violet-500" />
                        Commissions Affiliés
                      </h4>

                      {/* Mode toggle */}
                      <div className="flex rounded-xl overflow-hidden border border-gray-200">
                        {(['fixed', 'percentage'] as const).map(mode => {
                          const active = (pendingSettings.commissionMode ?? settings?.commissionMode ?? 'fixed') === mode;
                          return (
                            <button
                              key={mode}
                              onClick={() => setPendingSettings(prev => ({ ...prev, commissionMode: mode }))}
                              className={`flex-1 py-2 text-[11px] font-black transition-all ${active ? 'bg-violet-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                            >
                              {mode === 'fixed' ? '🔒 Montants fixes (HTG)' : '📊 % du montant'}
                            </button>
                          );
                        })}
                      </div>

                      {(pendingSettings.commissionMode ?? settings?.commissionMode ?? 'fixed') === 'fixed' ? (
                        <>
                          <p className="text-[10px] text-gray-400">Montants HTG fixes crédités à chaque vente, peu importe le prix de l'article.</p>
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              { key: 'commissionPurchaseHTG',         label: 'Achat — Direct (HTG)',                  placeholder: '2' },
                              { key: 'commissionPurchaseParentHTG',    label: 'Achat — Parrain (HTG)',                 placeholder: '0.5' },
                              { key: 'commissionPurchaseGpHTG',        label: 'Achat — Grand-parrain (HTG)',           placeholder: '0.5' },
                              { key: 'commissionSubscriptionHTG',      label: 'Abonnement — Direct (HTG)',             placeholder: '75' },
                              { key: 'commissionSubscriptionParentHTG',label: 'Abonnement — Parrain (HTG)',            placeholder: '15' },
                              { key: 'commissionSubscriptionGpHTG',    label: 'Abonnement — Grand-parrain (HTG)',      placeholder: '10' },
                              { key: 'commissionVirtualCardHTG',       label: 'Carte Virtuelle — Direct (HTG)',        placeholder: '350' },
                              { key: 'commissionVirtualCardParentHTG', label: 'Carte Virtuelle — Parrain (HTG)',       placeholder: '40' },
                              { key: 'commissionVirtualCardGpHTG',     label: 'Carte Virtuelle — Grand-parrain (HTG)', placeholder: '10' },
                            ] as {key:string;label:string;placeholder:string}[]).map(({ key, label, placeholder }) => (
                              <div key={key} className="space-y-1">
                                <Label className="text-[10px] font-bold text-gray-500">{label}</Label>
                                <Input
                                  type="number"
                                  placeholder={placeholder}
                                  value={(pendingSettings as any)?.[key] ?? (settings as any)?.[key] ?? placeholder}
                                  onChange={(e) => setPendingSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                  className="rounded-xl border-gray-100 h-9 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] text-gray-400">Pourcentage du montant de la transaction. Ex: 5 = 5% du prix crédité à l'affilié.</p>
                          <div className="grid grid-cols-3 gap-3">
                            {([
                              { key: 'commissionPurchasePct',          label: 'Achat Direct (%)',               placeholder: '0' },
                              { key: 'commissionPurchaseParentPct',     label: 'Achat Parrain (%)',              placeholder: '0' },
                              { key: 'commissionPurchaseGpPct',         label: 'Achat Grand-parrain (%)',        placeholder: '0' },
                              { key: 'commissionSubscriptionPct',       label: 'Abonnement Direct (%)',          placeholder: '0' },
                              { key: 'commissionSubscriptionParentPct', label: 'Abonn. Parrain (%)',             placeholder: '0' },
                              { key: 'commissionSubscriptionGpPct',     label: 'Abonn. Grand-parrain (%)',       placeholder: '0' },
                              { key: 'commissionVirtualCardPct',        label: 'Carte Virt. Direct (%)',         placeholder: '0' },
                              { key: 'commissionVirtualCardParentPct',  label: 'Carte Virt. Parrain (%)',        placeholder: '0' },
                              { key: 'commissionVirtualCardGpPct',      label: 'Carte Virt. Grand-parrain (%)',  placeholder: '0' },
                            ] as {key:string;label:string;placeholder:string}[]).map(({ key, label, placeholder }) => (
                              <div key={key} className="space-y-1">
                                <Label className="text-[10px] font-bold text-gray-500">{label}</Label>
                                <div className="relative">
                                  <Input
                                    type="number" min="0" max="100" step="0.1"
                                    placeholder={placeholder}
                                    value={(pendingSettings as any)?.[key] ?? (settings as any)?.[key] ?? ''}
                                    onChange={(e) => setPendingSettings(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
                                    className="rounded-xl border-gray-100 h-9 text-sm pr-6"
                                  />
                                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">%</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}

                      <Button
                        onClick={async () => {
                          const mode = pendingSettings.commissionMode ?? settings?.commissionMode ?? 'fixed';
                          const keys = mode === 'fixed'
                            ? ['commissionPurchaseHTG','commissionPurchaseParentHTG','commissionPurchaseGpHTG',
                               'commissionSubscriptionHTG','commissionSubscriptionParentHTG','commissionSubscriptionGpHTG',
                               'commissionVirtualCardHTG','commissionVirtualCardParentHTG','commissionVirtualCardGpHTG']
                            : ['commissionPurchasePct','commissionPurchaseParentPct','commissionPurchaseGpPct',
                               'commissionSubscriptionPct','commissionSubscriptionParentPct','commissionSubscriptionGpPct',
                               'commissionVirtualCardPct','commissionVirtualCardParentPct','commissionVirtualCardGpPct'];
                          const dataToUpdate: Record<string, any> = { commissionMode: mode };
                          keys.forEach(k => {
                            dataToUpdate[k] = (pendingSettings as any)[k] !== undefined
                              ? (pendingSettings as any)[k]
                              : (settings as any)?.[k] ?? 0;
                          });
                          await updateSettings(dataToUpdate);
                          toast.success("Commissions affiliés mises à jour !");
                        }}
                        className="w-full bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-xl"
                      >
                        Enregistrer les commissions
                      </Button>
                    </div>

                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Frais Dépôt Client (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="0"
                        value={pendingSettings?.depositFeePercent ?? settings?.depositFeePercent ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, depositFeePercent: parseFloat(e.target.value) || 0 }))}
                        className="rounded-xl border-gray-100 font-bold text-center"
                      />
                      <p className="text-[10px] text-gray-400">Ex: 2 = 2% déduit à l'approbation</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Frais Retrait Client (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="0"
                        value={pendingSettings?.withdrawalFeePercent ?? settings?.withdrawalFeePercent ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, withdrawalFeePercent: parseFloat(e.target.value) || 0 }))}
                        className="rounded-xl border-gray-100 font-bold text-center"
                      />
                      <p className="text-[10px] text-gray-400">Ex: 2 = 2% déduit au retrait</p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-gray-500">Frais Transfert Wallet (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        step="0.1"
                        placeholder="0"
                        value={pendingSettings?.transferFeePercent ?? settings?.transferFeePercent ?? ''}
                        onChange={(e) => setPendingSettings(prev => ({ ...prev, transferFeePercent: parseFloat(e.target.value) || 0 }))}
                        className="rounded-xl border-gray-100 font-bold text-center"
                      />
                      <p className="text-[10px] text-gray-400">Ex: 1 = 1% déduit du transfert</p>
                    </div>
                  </div>

                  {/* ── Affiliate fee sharing ── */}
                  <div className="space-y-3 pt-4 border-t border-dashed border-gray-200">
                    <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1.5">
                      <span>🤝</span> Part Affilié sur les Frais Clients
                    </p>
                    <p className="text-[11px] text-gray-400">Portion des frais reversée à l'affilié parrain du client à chaque approbation.</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-500">Part Affilié — Frais Dépôt (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="0"
                          value={pendingSettings?.affiliateDepositFeeSharePercent ?? settings?.affiliateDepositFeeSharePercent ?? ''}
                          onChange={(e) => setPendingSettings(prev => ({ ...prev, affiliateDepositFeeSharePercent: parseFloat(e.target.value) || 0 }))}
                          className="rounded-xl border-gray-100 font-bold text-center"
                        />
                        <p className="text-[10px] text-gray-400">% du frais dépôt reversé à l'affilié</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-500">Part Admin — Frais Dépôt (%)</Label>
                        <Input
                          type="number"
                          readOnly
                          value={100 - (pendingSettings?.affiliateDepositFeeSharePercent ?? settings?.affiliateDepositFeeSharePercent ?? 0)}
                          className="rounded-xl border-gray-100 font-bold text-center bg-gray-50 text-gray-500"
                        />
                        <p className="text-[10px] text-gray-400">Calculé automatiquement</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-500">Part Affilié — Frais Retrait (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          placeholder="0"
                          value={pendingSettings?.affiliateWithdrawalFeeSharePercent ?? settings?.affiliateWithdrawalFeeSharePercent ?? ''}
                          onChange={(e) => setPendingSettings(prev => ({ ...prev, affiliateWithdrawalFeeSharePercent: parseFloat(e.target.value) || 0 }))}
                          className="rounded-xl border-gray-100 font-bold text-center"
                        />
                        <p className="text-[10px] text-gray-400">% du frais retrait reversé à l'affilié</p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-gray-500">Part Admin — Frais Retrait (%)</Label>
                        <Input
                          type="number"
                          readOnly
                          value={100 - (pendingSettings?.affiliateWithdrawalFeeSharePercent ?? settings?.affiliateWithdrawalFeeSharePercent ?? 0)}
                          className="rounded-xl border-gray-100 font-bold text-center bg-gray-50 text-gray-500"
                        />
                        <p className="text-[10px] text-gray-400">Calculé automatiquement</p>
                      </div>
                    </div>
                  </div>

                  {/* ── Agent fee engine ── */}
                  <div className="space-y-4 pt-4 border-t border-dashed border-gray-200">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <span>🤝</span> Moteur de Frais Agent
                    </p>

                    {/* ── Deposit commission ── */}
                    <div className="space-y-2 p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl">
                      <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wide">💵 Commission sur Dépôt</p>
                      <div className="flex rounded-xl overflow-hidden border border-emerald-200">
                        {(['percent', 'fixed'] as const).map(mode => {
                          const active = (pendingSettings.agentDepositFeeMode ?? settings?.agentDepositFeeMode ?? 'percent') === mode;
                          return (
                            <button key={mode}
                              onClick={() => setPendingSettings(prev => ({ ...prev, agentDepositFeeMode: mode }))}
                              className={`flex-1 py-1.5 text-[10px] font-black transition-all ${active ? 'bg-emerald-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                            >
                              {mode === 'percent' ? '% Pourcentage' : '$ Montant fixe (USD)'}
                            </button>
                          );
                        })}
                      </div>
                      {(pendingSettings.agentDepositFeeMode ?? settings?.agentDepositFeeMode ?? 'percent') === 'percent' ? (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">% du montant de la transaction</Label>
                          <div className="relative">
                            <Input type="number" min="0" max="20" step="0.1" placeholder="0"
                              value={pendingSettings?.agentDepositCommissionPercent ?? settings?.agentDepositCommissionPercent ?? ''}
                              onChange={(e) => setPendingSettings(prev => ({ ...prev, agentDepositCommissionPercent: parseFloat(e.target.value) || 0 }))}
                              className="rounded-xl border-gray-100 font-bold text-center pr-7"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">%</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Ex: 2 = l'agent gagne 2% du montant déposé</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">Montant fixe par dépôt (USD)</Label>
                          <div className="relative">
                            <Input type="number" min="0" step="0.01" placeholder="0.00"
                              value={pendingSettings?.agentDepositCommissionFixed ?? settings?.agentDepositCommissionFixed ?? ''}
                              onChange={(e) => setPendingSettings(prev => ({ ...prev, agentDepositCommissionFixed: parseFloat(e.target.value) || 0 }))}
                              className="rounded-xl border-gray-100 font-bold text-center pl-7"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">$</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Ex: 0.50 = l'agent gagne $0.50 par dépôt, quel que soit le montant</p>
                        </div>
                      )}
                    </div>

                    {/* ── Withdrawal fee ── */}
                    <div className="space-y-2 p-3 bg-rose-50/50 border border-rose-100 rounded-2xl">
                      <p className="text-[11px] font-black text-rose-700 uppercase tracking-wide">🏧 Frais sur Retrait</p>
                      <div className="flex rounded-xl overflow-hidden border border-rose-200">
                        {(['percent', 'fixed'] as const).map(mode => {
                          const active = (pendingSettings.agentWithdrawFeeMode ?? settings?.agentWithdrawFeeMode ?? 'percent') === mode;
                          return (
                            <button key={mode}
                              onClick={() => setPendingSettings(prev => ({ ...prev, agentWithdrawFeeMode: mode }))}
                              className={`flex-1 py-1.5 text-[10px] font-black transition-all ${active ? 'bg-rose-600 text-white' : 'bg-white text-gray-400 hover:text-gray-600'}`}
                            >
                              {mode === 'percent' ? '% Pourcentage' : '$ Montant fixe (USD)'}
                            </button>
                          );
                        })}
                      </div>
                      {(pendingSettings.agentWithdrawFeeMode ?? settings?.agentWithdrawFeeMode ?? 'percent') === 'percent' ? (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">% du montant du retrait</Label>
                          <div className="relative">
                            <Input type="number" min="0" max="20" step="0.1" placeholder="0"
                              value={pendingSettings?.agentWithdrawPercent ?? settings?.agentWithdrawPercent ?? ''}
                              onChange={(e) => setPendingSettings(prev => ({ ...prev, agentWithdrawPercent: parseFloat(e.target.value) || 0 }))}
                              className="rounded-xl border-gray-100 font-bold text-center pr-7"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">%</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Frais total prélevé sur le retrait du client</p>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">Montant fixe par retrait (USD)</Label>
                          <div className="relative">
                            <Input type="number" min="0" step="0.01" placeholder="0.00"
                              value={pendingSettings?.agentWithdrawFixed ?? settings?.agentWithdrawFixed ?? ''}
                              onChange={(e) => setPendingSettings(prev => ({ ...prev, agentWithdrawFixed: parseFloat(e.target.value) || 0 }))}
                              className="rounded-xl border-gray-100 font-bold text-center pl-7"
                            />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 font-bold">$</span>
                          </div>
                          <p className="text-[10px] text-gray-400">Ex: 1.00 = $1 prélevé sur chaque retrait</p>
                        </div>
                      )}
                      {/* Agent / Admin share — always shown */}
                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">Part Agent (%)</Label>
                          <div className="relative">
                            <Input type="number" min="0" max="100" step="1" placeholder="100"
                              value={pendingSettings?.agentWithdrawAgentSharePercent ?? settings?.agentWithdrawAgentSharePercent ?? ''}
                              onChange={(e) => setPendingSettings(prev => ({ ...prev, agentWithdrawAgentSharePercent: parseFloat(e.target.value) || 0 }))}
                              className="rounded-xl border-gray-100 font-bold text-center pr-7"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">%</span>
                          </div>
                          <p className="text-[10px] text-gray-400">% des frais retrait → agent</p>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px] font-bold text-gray-500">Part Admin (%)</Label>
                          <Input type="number" readOnly
                            value={100 - (pendingSettings?.agentWithdrawAgentSharePercent ?? settings?.agentWithdrawAgentSharePercent ?? 100)}
                            className="rounded-xl border-gray-100 font-bold text-center bg-gray-50 text-gray-500"
                          />
                          <p className="text-[10px] text-gray-400">Calculé automatiquement</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={async () => {
                      const depositMode  = pendingSettings.agentDepositFeeMode  ?? settings?.agentDepositFeeMode  ?? 'percent';
                      const withdrawMode = pendingSettings.agentWithdrawFeeMode ?? settings?.agentWithdrawFeeMode ?? 'percent';
                      await updateSettings({
                        depositFeePercent: pendingSettings.depositFeePercent !== undefined ? pendingSettings.depositFeePercent : (settings?.depositFeePercent || 0),
                        withdrawalFeePercent: pendingSettings.withdrawalFeePercent !== undefined ? pendingSettings.withdrawalFeePercent : (settings?.withdrawalFeePercent || 0),
                        transferFeePercent: pendingSettings.transferFeePercent !== undefined ? pendingSettings.transferFeePercent : (settings?.transferFeePercent || 0),
                        affiliateDepositFeeSharePercent: pendingSettings.affiliateDepositFeeSharePercent !== undefined ? pendingSettings.affiliateDepositFeeSharePercent : (settings?.affiliateDepositFeeSharePercent || 0),
                        affiliateWithdrawalFeeSharePercent: pendingSettings.affiliateWithdrawalFeeSharePercent !== undefined ? pendingSettings.affiliateWithdrawalFeeSharePercent : (settings?.affiliateWithdrawalFeeSharePercent || 0),
                        agentDepositFeeMode: depositMode,
                        agentDepositCommissionPercent: pendingSettings.agentDepositCommissionPercent !== undefined ? pendingSettings.agentDepositCommissionPercent : (settings?.agentDepositCommissionPercent || 0),
                        agentDepositCommissionFixed: pendingSettings.agentDepositCommissionFixed !== undefined ? pendingSettings.agentDepositCommissionFixed : (settings?.agentDepositCommissionFixed || 0),
                        agentWithdrawFeeMode: withdrawMode,
                        agentWithdrawPercent: pendingSettings.agentWithdrawPercent !== undefined ? pendingSettings.agentWithdrawPercent : (settings?.agentWithdrawPercent || 0),
                        agentWithdrawFixed: pendingSettings.agentWithdrawFixed !== undefined ? pendingSettings.agentWithdrawFixed : (settings?.agentWithdrawFixed || 0),
                        agentWithdrawAgentSharePercent: pendingSettings.agentWithdrawAgentSharePercent !== undefined ? pendingSettings.agentWithdrawAgentSharePercent : (settings?.agentWithdrawAgentSharePercent ?? 100),
                      });
                      toast.success("Frais mis à jour !");
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl border-0"
                  >
                    Enregistrer les frais
                  </Button>
                </div>

                {/* ── Historique des frais agent ── */}
                <AgentFeeHistory />

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Code de déverrouillage</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      placeholder="Ex: 1234" 
                      value={pendingSettings?.lockAffiliateEditsCode ?? settings?.lockAffiliateEditsCode ?? ''} 
                      onChange={(e) => setPendingSettings(prev => ({ ...prev, lockAffiliateEditsCode: e.target.value }))}
                      className="font-mono text-xl font-bold tracking-widest text-primary"
                    />
                    <Button 
                      onClick={async () => {
                        if (pendingSettings.lockAffiliateEditsCode !== undefined) {
                          await updateSettings({ lockAffiliateEditsCode: pendingSettings.lockAffiliateEditsCode });
                          toast.success("Code de verrouillage enregistré !");
                        }
                      }}
                      className="bg-primary hover:bg-[#1D4ED8] text-white font-bold rounded-xl"
                    >
                      Enregistrer le code
                    </Button>
                  </div>
                  <p className="text-[10px] text-gray-400 italic">Le code actuel est: <span className="font-bold text-primary">{settings?.lockAffiliateEditsCode || "Non défini"}</span></p>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label className="text-xs font-bold text-gray-500 uppercase">Numéro WhatsApp Admin</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input 
                      placeholder="+509..." 
                      value={pendingSettings?.whatsappAdminNumber ?? settings?.whatsappAdminNumber ?? ''} 
                      onChange={(e) => setPendingSettings(prev => ({ ...prev, whatsappAdminNumber: e.target.value }))}
                      className="rounded-xl"
                    />
                    <Button 
                      onClick={async () => {
                        if (pendingSettings.whatsappAdminNumber !== undefined) {
                          await updateSettings({ whatsappAdminNumber: pendingSettings.whatsappAdminNumber });
                          toast.success("Numéro WhatsApp enregistré !");
                        }
                      }}
                      className="bg-primary hover:bg-[#1D4ED8] text-white font-bold rounded-xl"
                    >
                      Enregistrer le numéro
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">
                    Ce numéro recevra les demandes de retrait des affiliés. Actuel: <span className="font-bold text-primary">{settings?.whatsappAdminNumber || 'Non configuré'}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="wallet-management" className="space-y-6 pt-6 px-6 pb-20 custom-scrollbar overflow-y-auto h-full">
          <AdminWalletManager />
        </TabsContent>

        <TabsContent value="shipping">
          <AdminShippingManager />
        </TabsContent>

        <TabsContent value="commissions-catalog" className="space-y-6">
          <AdminCatalogCommissions />
        </TabsContent>

        <TabsContent value="online-services" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark">Gestion des Services</h2>
              <p className="text-sm text-gray-500 mt-0.5">Gérez les services affichés dans la section Services de l'application.</p>
            </div>
            <Button onClick={() => handleOpenServiceDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouveau Service
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {onlineServicesLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Loader2 className="h-7 w-7 animate-spin mb-2" />
                  <p>Chargement…</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Ordre</TableHead>
                        <TableHead>Libellé</TableHead>
                        <TableHead>Icône</TableHead>
                        <TableHead>Cible</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(onlineServices || []).map((svc: any) => (
                        <TableRow key={svc.id} className="hover:bg-gray-50/50 transition-colors">
                          <TableCell className="font-mono text-sm text-gray-500">{svc.order}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-bold text-dark text-sm">{svc.label}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[200px]">{svc.description}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">{svc.icon}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={svc.target === 'url' ? 'text-blue-600 border-blue-200 bg-blue-50' : 'text-emerald-600 border-emerald-200 bg-emerald-50'}>
                              {svc.target === 'tracking' ? 'Tracking' : svc.target === 'shipping' ? 'Expédition' : svc.url?.slice(0, 25) || 'URL'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={svc.active ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-gray-500 border-gray-200 bg-gray-50'}>
                              {svc.active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenServiceDialog(svc)} className="h-8 w-8 p-0">
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button
                                variant="ghost" size="sm"
                                disabled={deletingServiceId === svc.id}
                                onClick={() => handleDeleteService(svc.id)}
                                className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50 bg-white/50 border border-transparent hover:border-red-100 px-2 font-medium text-xs"
                              >
                                {deletingServiceId === svc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                                <span className="hidden sm:inline">Supprimer</span>
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {(onlineServices || []).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-gray-400">
                            Aucun service ajouté. Cliquez sur "Nouveau Service" pour commencer.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dialog add/edit service */}
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogContent className="max-w-lg rounded-2xl">
              <DialogHeader>
                <DialogTitle>{editingService ? 'Modifier le service' : 'Nouveau service'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Libellé *</label>
                    <Input value={serviceFormData.label} onChange={e => setServiceFormData(p => ({ ...p, label: e.target.value }))} placeholder="Ex: Suivi de Colis" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Description</label>
                    <Input value={serviceFormData.description} onChange={e => setServiceFormData(p => ({ ...p, description: e.target.value }))} placeholder="Courte description du service" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Icône (nom Lucide)</label>
                    <Input value={serviceFormData.icon} onChange={e => setServiceFormData(p => ({ ...p, icon: e.target.value }))} placeholder="Ex: Globe, Package, Truck…" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Ordre d'affichage</label>
                    <Input type="number" value={serviceFormData.order} onChange={e => setServiceFormData(p => ({ ...p, order: Number(e.target.value) }))} />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">Cible</label>
                    <select
                      value={serviceFormData.target}
                      onChange={e => setServiceFormData(p => ({ ...p, target: e.target.value as any }))}
                      className="w-full h-10 rounded-xl border border-gray-200 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                    >
                      <option value="url">URL externe</option>
                      <option value="tracking">Suivi de colis</option>
                      <option value="shipping">Expédition</option>
                    </select>
                  </div>
                  {serviceFormData.target === 'url' && (
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-600 mb-1">URL</label>
                      <Input value={serviceFormData.url} onChange={e => setServiceFormData(p => ({ ...p, url: e.target.value }))} placeholder="https://…" />
                    </div>
                  )}
                  <div className="col-span-2 flex items-center gap-3">
                    <input type="checkbox" id="svc-active" checked={serviceFormData.active} onChange={e => setServiceFormData(p => ({ ...p, active: e.target.checked }))} className="h-4 w-4 accent-primary" />
                    <label htmlFor="svc-active" className="text-sm font-semibold text-gray-700 cursor-pointer">Service actif (visible sur l'app)</label>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsServiceDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSaveService} disabled={savingService} className="bg-primary text-white border-0 hover:bg-[#1D4ED8]">
                  {savingService ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {editingService ? 'Enregistrer' : 'Ajouter'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="promo-codes" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark">Codes Promotionnels</h2>
              <p className="text-sm text-gray-500 mt-0.5">Créez et gérez des codes promo pour vos services.</p>
            </div>
            <Button onClick={() => openPromoDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" /> Nouveau Code
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardContent className="p-0">
              {promoCodesLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : promoCodes.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                  <LucideIcons.Tag className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-semibold">Aucun code promo</p>
                  <p className="text-xs mt-1">Créez votre premier code promotionnel.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead>Code</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Réduction</TableHead>
                        <TableHead>Utilisations</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {promoCodes.map((pc: any) => (
                        <TableRow key={pc.id} className="hover:bg-gray-50/50">
                          <TableCell>
                            <span className="font-mono font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg text-sm">{pc.code}</span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">{pc.serviceName || <span className="text-gray-300 italic">Tous les services</span>}</TableCell>
                          <TableCell>
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 font-black">-{pc.discountPercent}%</Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {pc.usedCount || 0}{pc.maxUses > 0 ? ` / ${pc.maxUses}` : ' / ∞'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={pc.active ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : 'text-gray-500 border-gray-200 bg-gray-50'}>
                              {pc.active ? 'Actif' : 'Inactif'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => openPromoDialog(pc)} className="h-8 w-8 p-0 rounded-lg">
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPromoDeleteTarget(pc)} className="h-8 w-8 p-0 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nav-buttons" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Boutons de Navigation Rapide</h2>
            <Button onClick={() => handleOpenNavButtonDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 border-0">
              <Plus className="h-4 w-4" />
              Nouveau Bouton
            </Button>
          </div>

          <Card className="shadow-sm border-gray-200">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Ordre</TableHead>
                  <TableHead>Libellé</TableHead>
                  <TableHead>Icône</TableHead>
                  <TableHead>Cible / URL</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buttonsLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                       <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : buttons.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      Aucun bouton de navigation configuré.
                    </TableCell>
                  </TableRow>
                ) : (
                  buttons.map((btn) => (
                    <TableRow key={btn.id}>
                      <TableCell className="font-mono">{btn.order}</TableCell>
                      <TableCell className="font-bold">{btn.label}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-gray-50">
                            <LucideIcon name={btn.iconName} className="h-5 w-5" color={btn.color} />
                          </div>
                          <span className="text-xs text-gray-400 font-mono">{btn.iconName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-gray-500">
                        {btn.targetUrl}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleOpenNavButtonDialog(btn)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setNavButtonToDelete(btn);
                            setIsNavButtonDeleteDialogOpen(true);
                          }} className="text-red-500 hover:bg-red-50">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="contest" className="space-y-6">
          <AdminContestManager />
        </TabsContent>

        <TabsContent value="admins" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-dark">Gestion des Administrateurs</h2>
            <Button onClick={() => handleOpenAdminDialog()} className="w-full sm:w-auto bg-primary hover:bg-[#1D4ED8] text-white flex items-center justify-center gap-2 rounded-2xl h-11 px-6 font-bold shadow-lg shadow-accent-light/50 border-0">
              <Plus className="h-4 w-4" />
              Nouvel Admin
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {admins.map((acc) => (
              <motion.div
                key={acc.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-0 shadow-sm rounded-[2rem] overflow-hidden hover:shadow-xl transition-all duration-300 bg-white group border border-primary/5 hover:border-primary/20">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          {acc.photoUrl ? (
                             <div className="h-16 w-16 rounded-2xl overflow-hidden border-2 border-accent-light shadow-md shrink-0 ring-4 ring-white transition-transform group-hover:scale-105">
                              <img 
                                src={acc.photoUrl} 
                                alt={acc.fullName} 
                                className="h-full w-full object-cover" 
                                referrerPolicy="no-referrer"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(acc.fullName)}&background=random`;
                                }}
                              />
                            </div>
                          ) : (
                            <div className={`h-16 w-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 shadow-md ${acc.isSuperAdmin ? 'bg-primary text-white' : 'bg-gray-100 text-gray-400'}`}>
                              {acc.isSuperAdmin ? <Shield className="h-8 w-8" /> : <ShieldAlertIcon className="h-8 w-8" />}
                            </div>
                          )}
                          {acc.isSuperAdmin && (
                            <div className="absolute -top-2 -right-2 bg-yellow-400 text-white p-1 rounded-full shadow-sm border-2 border-white">
                              <Star className="h-3 w-3 fill-current" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="font-black text-dark group-hover:text-primary transition-colors text-lg leading-tight">{acc.fullName}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="secondary" className={`text-[10px] uppercase font-black px-2 py-0 border-0 ${acc.isSuperAdmin ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-500'}`}>
                              {acc.isSuperAdmin ? "Super Admin" : "Moderator"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenAdminDialog(acc)} 
                          className="rounded-full h-8 w-8 hover:bg-accent-light hover:text-primary"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {(acc.id !== admin.id && admin.isSuperAdmin) && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              setAdminToDelete(acc);
                              setIsAdminDeleteDialogOpen(true);
                            }} 
                            className="rounded-full h-8 w-8 hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-gray-50/50 p-3 rounded-2xl border border-gray-100">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Permissions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {acc.permissions.length === 0 ? (
                            <span className="text-[10px] text-gray-400 italic">Aucune permission spécifique</span>
                          ) : acc.permissions.includes('all') ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[10px] font-black">TOUT ACCÈS</Badge>
                          ) : (
                            acc.permissions.map(p => (
                              <Badge key={p} variant="outline" className="bg-white text-gray-600 border-gray-200 text-[9px] font-bold">
                                {menuItems.find(m => m.permission === p)?.label || p}
                              </Badge>
                            ))
                          )}
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center text-[10px]">
                         <div className="flex items-center gap-2">
                           <div className={`w-2 h-2 rounded-full ${acc.failedAttempts > 0 ? 'bg-red-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse'}`} />
                           <span className="text-gray-500 font-bold uppercase tracking-wider">
                             Status: {acc.failedAttempts > 0 ? `${acc.failedAttempts} échecs` : 'Sain'}
                           </span>
                         </div>
                         <p className="text-gray-400 font-medium">MAJ {acc.updatedAt ? format(acc.updatedAt instanceof Timestamp ? acc.updatedAt.toDate() : new Date(acc.updatedAt), 'dd/MM/yyyy', { locale: fr }) : '-'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* ── TEACHERS TAB ───────────────────────────────────────────────── */}
        <TabsContent value="teachers" className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-dark flex items-center gap-2">
                <LucideIcons.UserCheck className="h-5 w-5 text-violet-600" />
                Professeurs
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Gérez les comptes professeurs et leurs soldes.</p>
            </div>
            <Button
              onClick={() => { fetchTeachers(); setEditingTeacher(null); setTeacherFormData({ name: '', email: '', password: '' }); setIsTeacherDialogOpen(true); }}
              className="w-full sm:w-auto bg-violet-600 hover:bg-violet-700 text-white border-0 rounded-2xl shadow-lg shadow-violet-200 font-bold"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nouveau Professeur
            </Button>
          </div>
          {(() => { if (!teachers.length && !teachersLoading) fetchTeachers(); return null; })()}
          {teachersLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
          ) : teachers.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="py-16 text-center text-gray-400">
                <LucideIcons.GraduationCap className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="font-semibold">Aucun professeur enregistré</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {teachers.map(t => (
                <Card key={t.id} className="border border-gray-100 shadow-sm rounded-2xl overflow-hidden">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center">
                        <LucideIcons.GraduationCap className="h-5 w-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-black text-sm text-dark">{t.name}</p>
                        <p className="text-[10px] text-violet-500 font-bold uppercase tracking-widest">Professeur</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-center">
                        <p className="text-xs text-gray-400 font-bold">Solde</p>
                        <p className="font-black text-emerald-600 text-sm">{Math.round((t.balance || 0) * (settings?.exchangeRate || 146)).toLocaleString()} HTG</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-400 font-bold">Formations</p>
                        <p className="font-black text-dark text-sm">{t.formationsCount || 0}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => { setEditingTeacher(t); setTeacherFormData({ name: t.name, email: t.email || '', password: '' }); setIsTeacherDialogOpen(true); }}
                        className="flex-1 flex items-center justify-center gap-1 py-2 text-xs font-bold text-violet-600 hover:bg-violet-50 rounded-xl transition-colors border border-violet-100"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Modifier
                      </button>
                      <button
                        onClick={() => handleDeleteTeacher(t.id)}
                        disabled={deletingTeacherId === t.id}
                        className="flex items-center justify-center gap-1 py-2 px-3 text-xs font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-red-100"
                      >
                        {deletingTeacherId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── TEACHER WITHDRAWALS TAB ─────────────────────────────────────── */}
        <TabsContent value="teacher-withdrawals" className="space-y-6">
          <div>
            <h2 className="text-xl font-bold text-dark flex items-center gap-2">
              <LucideIcons.Banknote className="h-5 w-5 text-violet-600" />
              Retraits Professeurs
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">Approuvez ou rejetez les demandes de retrait des professeurs.</p>
          </div>
          {(() => { if (!teacherWithdrawalsLoaded.current && !teacherWithdrawalsLoading) fetchTeacherWithdrawals(); return null; })()}

          {/* Teacher withdrawal fee */}
          <Card className="border border-violet-100 bg-violet-50/50 shadow-none rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs font-black uppercase tracking-widest text-violet-600 mb-3">Frais de retrait professeurs</p>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min="0" max="100"
                  value={teacherFeeInput}
                  onChange={e => setTeacherFeeInput(e.target.value)}
                  className="w-28 h-10 rounded-xl text-center font-bold text-lg"
                  placeholder="0"
                />
                <span className="font-black text-gray-600 text-lg">%</span>
                <Button onClick={handleSaveTeacherFee} disabled={savingTeacherFee}
                  className="bg-violet-600 hover:bg-violet-700 text-white border-0 rounded-xl h-10 font-bold text-sm shadow-md shadow-violet-200">
                  {savingTeacherFee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </Button>
                {teacherFee > 0 && <span className="text-xs text-gray-500 font-semibold">Actuel : {teacherFee}%</span>}
              </div>
            </CardContent>
          </Card>

          {/* Formation sale platform fee */}
          <Card className="border border-indigo-100 bg-indigo-50/50 shadow-none rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs font-black uppercase tracking-widest text-indigo-600 mb-1">Commission plateforme — vente de formations</p>
              <p className="text-[11px] text-gray-500 mb-3">Part prélevée sur chaque vente de formation avant crédit professeur.</p>
              <div className="flex items-center gap-3">
                <Input
                  type="number" min="0" max="100"
                  value={formationFeeInput}
                  onChange={e => setFormationFeeInput(e.target.value)}
                  className="w-28 h-10 rounded-xl text-center font-bold text-lg"
                  placeholder="0"
                />
                <span className="font-black text-gray-600 text-lg">%</span>
                <Button onClick={handleSaveFormationFee} disabled={savingFormationFee}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 rounded-xl h-10 font-bold text-sm shadow-md shadow-indigo-200">
                  {savingFormationFee ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enregistrer'}
                </Button>
                {formationFee > 0 && <span className="text-xs text-gray-500 font-semibold">Actuel : {formationFee}%</span>}
              </div>
            </CardContent>
          </Card>

          {teacherWithdrawalsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400"><Loader2 className="h-7 w-7 animate-spin" /></div>
          ) : teacherWithdrawals.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="py-14 text-center text-gray-400">
                <LucideIcons.Banknote className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="font-semibold">Aucune demande de retrait</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teacherWithdrawals.map(wd => {
                const htgWd = wd.htgAmount || Math.round((wd.amount || 0) * (settings?.exchangeRate || 146));
                const usdWd = (wd.amount || 0).toFixed(2);
                const isPending = wd.status === 'pending';
                const isApproved = wd.status === 'approved';
                const isRejected = wd.status === 'rejected';
                const isActing = approvingTeacherTx === wd.id;
                return (
                  <Card key={wd.id} className={`overflow-hidden border-2 shadow-sm ${
                    isPending ? 'border-amber-200' :
                    isApproved ? 'border-emerald-200' : 'border-red-200'
                  }`}>
                    <div className={`h-1.5 w-full ${isPending ? 'bg-amber-400' : isApproved ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-violet-100 flex items-center justify-center shrink-0">
                          <LucideIcons.GraduationCap className="h-6 w-6 text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <p className="font-black text-dark text-sm">{wd.teacherName || 'Professeur'}</p>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                              isPending ? 'bg-amber-100 text-amber-700' :
                              isApproved ? 'bg-emerald-100 text-emerald-700' :
                              'bg-red-100 text-red-600'
                            }`}>
                              {isPending ? 'En attente' : isApproved ? 'Approuvé' : 'Rejeté'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Montant</p>
                              <p className="font-black text-red-600 text-base">{htgWd.toLocaleString()} HTG</p>
                              <p className="text-[11px] text-gray-400">${usdWd} USD</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Méthode</p>
                              <p className="font-bold text-dark text-sm">{wd.method || '—'}</p>
                              {wd.accountNumber && <p className="text-[11px] text-gray-500 font-mono">{wd.accountNumber}</p>}
                            </div>
                            <div className="col-span-2">
                              <p className="text-[10px] text-gray-400 uppercase font-black tracking-wider">Date</p>
                              <p className="text-xs text-gray-600">
                                {wd.createdAt?._seconds ? format(new Date(wd.createdAt._seconds * 1000), 'dd MMM yyyy, HH:mm', { locale: fr }) : '—'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {isPending && (
                        <div className="flex gap-2 mt-4">
                          <Button
                            className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 text-white border-0 rounded-2xl text-sm font-bold shadow-sm"
                            onClick={() => handleTeacherWithdrawalAction(wd.id, 'approve')}
                            disabled={isActing}
                          >
                            {isActing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LucideIcons.CheckCircle2 className="h-4 w-4 mr-1.5" />Approuver</>}
                          </Button>
                          <Button
                            variant="outline"
                            className="flex-1 h-10 border-2 border-red-200 text-red-600 hover:bg-red-50 rounded-2xl text-sm font-bold"
                            onClick={() => handleTeacherWithdrawalAction(wd.id, 'reject')}
                            disabled={isActing}
                          >
                            <LucideIcons.XCircle className="h-4 w-4 mr-1.5" />Rejeter
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── AGENTS TAB ───────────────────────────────────────────────────── */}
        <TabsContent value="agents" className="space-y-6 pt-6 px-6 pb-20">
          {renderAgents()}
        </TabsContent>

        {/* ── FREE FIRE REVENDEURS TAB ────────────────────────────────────── */}
        <TabsContent value="free-fire-reseller" className="space-y-0 pb-20">
          {(() => {
            if (!ffResellerLoaded.current && !ffResellerLoading) { fetchFFResellerAgents(); fetchFFPacks(); }
            return null;
          })()}

          {/* ── Hero Banner ── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-[#FF6B00] via-[#FF8C00] to-[#FFB347] px-6 pt-8 pb-16 mb-0">
            <div className="absolute top-0 right-0 w-56 h-56 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute top-6 right-6 opacity-10"><Gamepad2 className="h-28 w-28 text-white" /></div>
            <div className="relative">
              <p className="text-white/60 text-[10px] font-black uppercase tracking-widest mb-1">Administration</p>
              <h2 className="text-2xl font-black text-white mb-1">Free Fire Revendeurs 💎</h2>
              <p className="text-white/60 text-sm font-medium">Tous les agents disposent d'un compte revendeur activé automatiquement.</p>
              {/* Global stats */}
              {ffResellerAgents.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mt-5">
                  {[
                    { label: 'Agents', value: ffResellerAgents.length },
                    { label: '💎 Vendus', value: ffResellerAgents.reduce((s, a) => s + (a.totalSold || 0), 0).toLocaleString() },
                    { label: 'Commandes', value: ffResellerAgents.reduce((s, a) => s + (a.totalOrders || 0), 0) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/10 border border-white/15 rounded-2xl p-3 text-center">
                      <p className="text-white font-black text-lg leading-tight">{value}</p>
                      <p className="text-white/50 text-[9px] font-black uppercase tracking-wider mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="px-6 space-y-4 -mt-6 relative z-10">

            {/* ── Action bar ── */}
            <div className="flex gap-2">
              <Button
                onClick={fetchFFResellerAgents}
                variant="outline"
                size="sm"
                className="rounded-2xl h-10 px-4 font-black text-[10px] uppercase tracking-widest border-2 border-gray-100 gap-2 bg-white shadow-sm"
              >
                <LucideIcons.RefreshCw className="h-3.5 w-3.5" /> Actualiser
              </Button>
              <Button
                onClick={() => { setFFEditingPacks(ffCreditPacks.map(p => ({ ...p }))); setFFPacksDialogOpen(true); }}
                size="sm"
                className="rounded-2xl h-10 px-4 font-black text-[10px] uppercase tracking-widest bg-orange-500 hover:bg-orange-600 text-white border-0 gap-2 shadow-sm"
              >
                <LucideIcons.Settings className="h-3.5 w-3.5" /> Packs Diamants
              </Button>
            </div>

            {/* ── Packs preview ── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ffCreditPacks.map(pack => (
                <div key={pack.id} className="bg-white border border-orange-100 rounded-2xl p-3 text-center shadow-sm">
                  <p className="text-2xl mb-1">💎</p>
                  <p className="font-black text-slate-900 text-sm">{pack.diamonds.toLocaleString()}</p>
                  <p className="text-orange-500 font-black text-xs">${pack.priceUSD}</p>
                </div>
              ))}
            </div>

            {/* ── Agents list ── */}
            {ffResellerLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-10 w-10 animate-spin text-orange-400" /></div>
            ) : ffResellerAgents.length === 0 ? (
              <div className="bg-white rounded-3xl shadow-sm p-12 text-center">
                <Gamepad2 className="h-14 w-14 text-gray-200 mx-auto mb-4" />
                <p className="text-gray-400 font-bold">Aucun agent trouvé.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 px-1">{ffResellerAgents.length} agents</p>
                {ffResellerAgents.map(a => {
                  const agentId = a.agentId || a.id;
                  const agentName = a.agentName || a.name || agentId;
                  const isPending = !!a.pending; // not yet in Firestore
                  return (
                    <div key={agentId} className={`bg-white rounded-3xl shadow-sm border overflow-hidden ${!a.enabled ? 'border-red-100' : 'border-transparent'}`}>
                      <div className="p-4">
                        {/* Agent info */}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-lg font-black ${a.enabled ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                            {agentName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-black text-slate-900 truncate">{agentName}</p>
                              {isPending ? (
                                <span className="text-[9px] font-black bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full uppercase">Compte non init.</span>
                              ) : (
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${a.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'}`}>
                                  {a.enabled ? '● Actif' : '● Désactivé'}
                                </span>
                              )}
                            </div>
                            <div className="flex gap-3 mt-0.5">
                              <span className="text-sm font-black text-orange-500">{(a.diamondBalance || 0).toLocaleString()} 💎</span>
                              <span className="text-xs text-gray-400 font-medium">{a.totalOrders || 0} cmd · {(a.totalSold || 0).toLocaleString()} vendus</span>
                            </div>
                          </div>
                        </div>

                        {/* Balance bar */}
                        {!isPending && (
                          <div className="mb-3">
                            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all"
                                style={{ width: `${Math.min(100, ((a.diamondBalance || 0) / 20000) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            onClick={() => { setFFCreditAgent(a); setFFCreditOp('add'); setFFSelectedPack(null); setFFUseCustom(false); setFFCreditNote(''); setFFCreditDialogOpen(true); }}
                            className="flex-1 h-8 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                          >
                            + Créditer
                          </button>
                          <button
                            onClick={() => { setFFCreditAgent(a); setFFCreditOp('remove'); setFFSelectedPack(null); setFFUseCustom(false); setFFCreditNote(''); setFFCreditDialogOpen(true); }}
                            className="flex-1 h-8 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-red-100 transition-colors"
                          >
                            − Débiter
                          </button>
                          <button
                            onClick={() => handleFFToggle(a)}
                            disabled={ffToggleLoading === agentId}
                            className={`flex-1 h-8 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors border ${
                              a.enabled
                                ? 'bg-gray-50 hover:bg-gray-100 text-gray-500 border-gray-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border-emerald-200'
                            }`}
                          >
                            {ffToggleLoading === agentId
                              ? <Loader2 className="h-3 w-3 animate-spin inline" />
                              : (a.enabled ? 'Désactiver' : 'Activer')}
                          </button>
                          <button
                            onClick={() => { setFFAgentForTx(a); fetchFFTransactions(agentId); }}
                            className="h-8 px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-[10px] font-black uppercase transition-colors"
                          >
                            <LucideIcons.History className="h-3.5 w-3.5 inline mr-1" />Ventes
                          </button>
                        </div>
                      </div>

                      {/* Transaction accordion */}
                      {ffAgentForTx?.id === agentId && (
                        <div className="border-t border-gray-50 bg-gray-50/50 px-4 pb-4 pt-3 space-y-2">
                          <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Dernières ventes</p>
                            <button onClick={() => setFFAgentForTx(null)} className="text-[10px] text-gray-400 font-black">✕ Fermer</button>
                          </div>
                          {ffTxsLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-gray-300" /></div>
                          ) : ffTxs.length === 0 ? (
                            <p className="text-center text-gray-400 text-xs py-3">Aucune vente enregistrée.</p>
                          ) : (
                            ffTxs.slice(0, 15).map(tx => (
                              <div key={tx.id} className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-gray-100">
                                <span className="text-base shrink-0">
                                  {tx.status === 'success' ? '✅' : tx.status === 'failed' ? '❌' : '⏳'}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-black text-slate-800 truncate">{tx.packageLabel} → ID {tx.playerId}</p>
                                  <p className="text-[10px] text-gray-400">{tx.region} · {tx.createdAt?._seconds ? format(new Date(tx.createdAt._seconds * 1000), 'dd/MM/yy HH:mm') : '—'}</p>
                                </div>
                                <span className={`text-xs font-black shrink-0 ${tx.status === 'success' ? 'text-emerald-600' : 'text-red-400'}`}>
                                  {tx.status === 'success' ? `-${(tx.diamonds || 0).toLocaleString()} 💎` : '—'}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── PROFITS TAB ──────────────────────────────────────────────────── */}
        <TabsContent value="profits" className="space-y-6">
          {(() => { if (!profitStatsLoaded.current && !profitStatsLoading) fetchProfitStats(); return null; })()}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-dark flex items-center gap-2">
                <LucideIcons.TrendingUp className="h-5 w-5 text-emerald-600" />
                Profits de la Plateforme
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">Cumul de tous les frais perçus sur l'ensemble des opérations.</p>
            </div>
            <Button
              onClick={handleProfitReset}
              disabled={resettingProfit}
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-bold text-sm h-10 gap-2"
            >
              {resettingProfit ? <Loader2 className="h-4 w-4 animate-spin" /> : <LucideIcons.RotateCcw className="h-4 w-4" />}
              Réinitialiser
            </Button>
          </div>

          {profitStatsLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : profitStats ? (
            <>
              {/* Total profit card */}
              <Card className="border-0 shadow-xl rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                <CardContent className="p-7">
                  <p className="text-emerald-100 text-xs font-black uppercase tracking-widest mb-1">Profit Total Accumulé</p>
                  <p className="text-5xl font-black tracking-tight">
                    ${((profitStats.feesBalance || 0) + (profitStats.formationFees || 0)).toFixed(2)}
                  </p>
                  <p className="text-emerald-200 text-sm mt-1 font-semibold">
                    ≈ {Math.round(((profitStats.feesBalance || 0) + (profitStats.formationFees || 0)) * (settings?.exchangeRate || 146)).toLocaleString()} HTG
                  </p>
                  {profitStats.lastReset?._seconds && (
                    <p className="text-emerald-200/70 text-xs mt-3 font-semibold">
                      Dernière réinitialisation : {format(new Date(profitStats.lastReset._seconds * 1000), 'dd/MM/yyyy à HH:mm', { locale: fr })}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Breakdown grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  {
                    label: 'Frais Dépôts Clients',
                    value: profitStats.breakdown.clientDepositFees,
                    icon: LucideIcons.ArrowDownCircle,
                    color: 'text-blue-600',
                    bg: 'bg-blue-50',
                    border: 'border-blue-100',
                  },
                  {
                    label: 'Frais Retraits Clients',
                    value: profitStats.breakdown.clientWithdrawalFees,
                    icon: LucideIcons.ArrowUpCircle,
                    color: 'text-orange-600',
                    bg: 'bg-orange-50',
                    border: 'border-orange-100',
                  },
                  {
                    label: 'Commission Formations',
                    value: profitStats.breakdown.formationPlatformFees,
                    icon: LucideIcons.GraduationCap,
                    color: 'text-violet-600',
                    bg: 'bg-violet-50',
                    border: 'border-violet-100',
                  },
                  {
                    label: 'Frais Retraits Professeurs',
                    value: profitStats.breakdown.teacherWithdrawalFees,
                    icon: LucideIcons.Banknote,
                    color: 'text-indigo-600',
                    bg: 'bg-indigo-50',
                    border: 'border-indigo-100',
                  },
                  {
                    label: 'Frais Retraits Affiliés',
                    value: profitStats.breakdown.affiliateWithdrawalFees,
                    icon: LucideIcons.Users,
                    color: 'text-pink-600',
                    bg: 'bg-pink-50',
                    border: 'border-pink-100',
                  },
                ].map(({ label, value, icon: Icon, color, bg, border }) => (
                  <Card key={label} className={`border ${border} shadow-none rounded-2xl`}>
                    <CardContent className="p-5 flex items-center gap-4">
                      <div className={`h-12 w-12 rounded-2xl ${bg} flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`h-6 w-6 ${color}`} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                        <p className={`text-2xl font-black ${color} mt-0.5`}>${value.toFixed(2)}</p>
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">
                          ≈ {Math.round(value * (settings?.exchangeRate || 146)).toLocaleString()} HTG
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <p className="text-xs text-gray-400 text-center font-medium">
                Les commissions formations sont calculées sur l'ensemble de l'historique. Les frais clients/affiliés/professeurs sont remis à zéro lors de la réinitialisation.
              </p>
            </>
          ) : (
            <Card className="border-dashed border-2 border-gray-200 shadow-none">
              <CardContent className="py-14 text-center text-gray-400">
                <LucideIcons.TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="font-semibold">Aucune donnée disponible</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>


          </Tabs>
        </div>

      {/* Teacher dialog */}
      <Dialog open={isTeacherDialogOpen} onOpenChange={setIsTeacherDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-3xl border-0 shadow-2xl p-0 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-violet-600 to-indigo-600" />
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 font-black text-dark">
              <LucideIcons.GraduationCap className="h-5 w-5 text-violet-600" />
              {editingTeacher ? 'Modifier le professeur' : 'Nouveau professeur'}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4 mt-2">
            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">Nom</Label>
              <Input value={teacherFormData.name}
                onChange={e => setTeacherFormData(p => ({ ...p, name: e.target.value }))}
                placeholder="Nom du professeur" className="rounded-2xl h-12" />
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">
                Email Google <span className="text-gray-400 font-normal">(pour connexion Google)</span>
              </Label>
              <Input type="email" value={teacherFormData.email}
                onChange={e => setTeacherFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="professeur@gmail.com" className="rounded-2xl h-12" />
            </div>
            <div>
              <Label className="text-xs font-bold text-gray-500 mb-1.5 block">
                Mot de passe {editingTeacher && '(laisser vide pour ne pas changer)'}
              </Label>
              <Input type="password" value={teacherFormData.password}
                onChange={e => setTeacherFormData(p => ({ ...p, password: e.target.value }))}
                placeholder="••••••••" className="rounded-2xl h-12" />
            </div>
            <Button onClick={handleSaveTeacher} disabled={savingTeacher}
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-black rounded-2xl border-0 shadow-lg shadow-violet-200">
              {savingTeacher ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingTeacher ? 'Mettre à jour' : 'Créer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Record Sale Dialog */}
      <Dialog open={isManualCommissionOpen} onOpenChange={setIsManualCommissionOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-violet-600" />
              Commission manuelle
            </DialogTitle>
            <DialogDescription>
              Ajouter une commission à <span className="font-bold text-gray-900">{manualCommissionAffiliateName}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Montant (HTG)</Label>
              <Input
                type="number"
                placeholder="Ex: 75"
                value={manualCommissionHTG}
                onChange={(e) => setManualCommissionHTG(e.target.value)}
                className="rounded-xl"
              />
              {manualCommissionHTG && (
                <p className="text-[10px] text-gray-500">
                  ≈ {(Number(manualCommissionHTG) / (settings?.exchangeRate || 146)).toFixed(4)} $
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Raison (optionnel)</Label>
              <Input
                placeholder="Ex: Vente Netflix Premium"
                value={manualCommissionReason}
                onChange={(e) => setManualCommissionReason(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsManualCommissionOpen(false)}>Annuler</Button>
            <Button
              onClick={handleManualCommission}
              disabled={isSubmittingManualCommission || !manualCommissionHTG}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {isSubmittingManualCommission ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nav Button Edit/Add Dialog */}
      <Dialog open={isNavButtonDialogOpen} onOpenChange={setIsNavButtonDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingNavButton ? 'Modifier le bouton' : 'Ajouter un bouton'}</DialogTitle>
            <DialogDescription>
              Configurez le libellé, l'icône et l'action du bouton.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nav-label" className="text-right">Libellé</Label>
              <Input 
                id="nav-label" 
                value={navButtonFormData.label} 
                onChange={(e) => setNavButtonFormData({...navButtonFormData, label: e.target.value})}
                className="col-span-3"
                placeholder="Ex: Jeux"
              />
            </div>
            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="nav-instruction" className="text-right pt-2 text-xs">Instruction dynamique</Label>
              <div className="col-span-3 space-y-2">
                <Textarea 
                  id="nav-instruction" 
                  value={navButtonFormData.redirectionInstruction} 
                  onChange={(e) => setNavButtonFormData({...navButtonFormData, redirectionInstruction: e.target.value})}
                  className="min-h-[60px] text-xs"
                  placeholder="Ex: Rediriger vers la page des jeux à jour ou Aller à la section Jeux"
                />
                <p className="text-[10px] text-gray-500 leading-tight">
                  Une phrase décrivant l'action (optionnel).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nav-targetUrl" className="text-right">Cible (URL/#)</Label>
              <div className="col-span-3 space-y-2">
                <Input 
                  id="nav-targetUrl" 
                  value={navButtonFormData.targetUrl} 
                  onChange={(e) => setNavButtonFormData({...navButtonFormData, targetUrl: e.target.value})}
                  placeholder="Ex: #services ou /billing"
                />
                <div className="flex flex-wrap gap-1">
                  {[
                    { label: 'Ancre Services', value: '#services' },
                    { label: 'Ancre Produits', value: '#products' },
                    { label: 'Ancre Paiement', value: '#payment' },
                    { label: 'Page Suivi', value: 'tracking' },
                    { label: 'Page Shipping', value: 'shipping' },
                    { label: 'Page Affiliation', value: 'affiliate' }
                  ].map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => setNavButtonFormData({...navButtonFormData, targetUrl: s.value})}
                      className="text-[10px] px-2 py-1 bg-accent-light text-primary rounded-md border border-accent-light hover:bg-accent-light/50 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nav-iconName" className="text-right">Icône Lucide</Label>
              <Input 
                id="nav-iconName" 
                value={navButtonFormData.iconName} 
                onChange={(e) => setNavButtonFormData({...navButtonFormData, iconName: e.target.value})}
                className="col-span-3"
                placeholder="Ex: Gamepad2, Package, Star..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nav-color" className="text-right">Couleur</Label>
              <Input 
                id="nav-color" 
                type="color"
                value={navButtonFormData.color} 
                onChange={(e) => setNavButtonFormData({...navButtonFormData, color: e.target.value})}
                className="col-span-3 h-10 p-1"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nav-order" className="text-right">Ordre</Label>
              <Input 
                id="nav-order" 
                type="number"
                value={navButtonFormData.order} 
                onChange={(e) => setNavButtonFormData({...navButtonFormData, order: parseInt(e.target.value) || 0})}
                className="col-span-3"
              />
            </div>
            <div className="flex justify-center p-4 border rounded-xl bg-gray-50 bg-opacity-50">
               <div className="flex flex-col items-center gap-2">
                 <p className="text-[10px] uppercase font-bold text-gray-400">Aperçu</p>
                 <div
                    className="bg-white border rounded-[16px] px-6 h-[52px] shadow-sm flex items-center justify-center pointer-events-none"
                  >
                    <LucideIcon name={navButtonFormData.iconName || 'HelpCircle'} className="mr-2 h-5 w-5" color={navButtonFormData.color} />
                    <span className="font-heading font-bold" style={{ color: navButtonFormData.color }}>{navButtonFormData.label || 'Aperçu'}</span>
                  </div>
               </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNavButtonDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveNavButton} className="bg-primary hover:bg-[#1D4ED8] text-white border-0">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Rejection Reason Dialog */}
      <Dialog open={isWithdrawalRejectionDialogOpen} onOpenChange={setIsWithdrawalRejectionDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-black">
              <ShieldAlertIcon className="h-5 w-5" />
              Rejeter la demande
            </DialogTitle>
            <DialogDescription className="font-medium">
              Veuillez indiquer la raison pour laquelle vous rejetez le retrait de <span className="font-black text-gray-900">{withdrawalToReject?.affiliateName}</span> ({withdrawalToReject?.amount} G).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rejection-reason" className="text-xs font-bold uppercase text-gray-400 mb-2 block">Raison du rejet</Label>
            <Textarea
              id="rejection-reason"
              placeholder="Ex: Numéro de compte invalide, Solde insuffisant, etc."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="min-h-[120px] rounded-2xl border-gray-200 focus:ring-primary focus:border-primary"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsWithdrawalRejectionDialogOpen(false)} className="rounded-xl font-bold">
              Annuler
            </Button>
            <Button 
              onClick={handleConfirmRejectionBase} 
              disabled={isSaving || !rejectionReason.trim()}
              variant="destructive"
              className="rounded-xl font-bold"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isNavButtonDeleteDialogOpen} onOpenChange={setIsNavButtonDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Supprimer le bouton
            </DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer le bouton <span className="font-bold">"{navButtonToDelete?.label}"</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNavButtonDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteNavButton} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Affiliate Edit/Add Dialog */}
      <Dialog open={isAffiliateDialogOpen} onOpenChange={setIsAffiliateDialogOpen}>
        <DialogContent className="sm:max-w-4xl border-0 shadow-2xl">
          <div className="relative h-32 bg-gradient-to-r from-primary/20 via-accent-light to-primary/10 p-6 flex flex-col justify-end">
             <div className="absolute top-4 right-6 flex gap-2">
               {editingAffiliate && (
                 <Badge className="bg-white/80 text-primary border-0 font-black shadow-sm">ID: {editingAffiliate.id?.slice(0, 8)}</Badge>
               )}
             </div>
             <DialogHeader>
                <DialogTitle className="text-3xl font-black text-dark flex items-center gap-3">
                  <div className="p-2 rounded-2xl bg-white shadow-md">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  {editingAffiliate ? 'Profil Affilié' : 'Nouveau Compte Affilié'}
                </DialogTitle>
                <DialogDescription className="text-subtext font-medium text-xs ml-12">
                  Configuration et ajustement des paramètres de l'affilié.
                </DialogDescription>
             </DialogHeader>
          </div>
          
          <Tabs defaultValue="identity" className="flex-1 flex flex-col overflow-hidden">
            <div className="bg-white px-6 border-b flex justify-between items-center h-12 shadow-sm z-10 overflow-x-auto no-scrollbar">
              <TabsList className="bg-transparent h-full p-0 gap-4 sm:gap-6 flex-nowrap">
                <TabsTrigger value="identity" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Identité</TabsTrigger>
                <TabsTrigger value="financial" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Finances</TabsTrigger>
                <TabsTrigger value="stats" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Statistiques</TabsTrigger>
                <TabsTrigger value="info" className="h-full rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none font-bold text-[10px] sm:text-xs uppercase tracking-widest text-gray-400 data-[state=active]:text-primary mb-[-1px] whitespace-nowrap">Informations Personnelles</TabsTrigger>
              </TabsList>
              
              <div className="flex items-center gap-2 ml-4 shrink-0">
                 {settings?.lockAffiliateEdits && (
                   <Badge variant="outline" className="bg-red-50 text-red-600 border-red-200 font-black text-[10px] uppercase gap-1.5 px-3 py-1 animate-pulse">
                     <ShieldAlertIcon className="h-3 w-3" />
                     MODIFICATIONS VERROUILLÉES
                   </Badge>
                 )}
                 <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[10px] uppercase">ACTIF</Badge>
              </div>
            </div>

            <div className={`flex-1 overflow-y-auto px-8 py-6 custom-scrollbar bg-gray-50/30 ${settings?.lockAffiliateEdits ? 'grayscale-[0.5] opacity-80' : ''}`}>
              <TabsContent value="identity" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nom Complet</Label>
                    <div className="relative group">
                      <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary group-focus-within:scale-110 transition-transform" />
                      <Input 
                        value={affiliateFormData.name} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, name: e.target.value})}
                        className="pl-10 h-12 rounded-2xl border-gray-200 focus:ring-primary shadow-sm bg-white" 
                        placeholder="Jean Dupont"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Code Affilié</Label>
                    <div className="relative group">
                      <Zap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
                      <Input 
                        value={affiliateFormData.code} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, code: e.target.value})}
                        className="pl-10 h-12 rounded-2xl border-gray-200 font-mono font-bold shadow-sm bg-white" 
                        placeholder="AFF2024"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Username (Login)</Label>
                    <div className="relative">
                      <LucideIcons.AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        value={affiliateFormData.username} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, username: e.target.value})}
                        className="pl-10 h-12 rounded-2xl border-gray-200 shadow-sm bg-white" 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Mot de Passe</Label>
                    <div className="relative">
                      <LucideIcons.Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                        value={affiliateFormData.password} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, password: e.target.value})}
                        className="pl-10 h-12 rounded-2xl border-gray-200 shadow-sm bg-white" 
                        placeholder="********"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Niveau du compte</Label>
                    <Select 
                      value={affiliateFormData.level} 
                      onValueChange={(v: any) => setAffiliateFormData({...affiliateFormData, level: v})}
                    >
                      <SelectTrigger className="h-12 rounded-2xl border-gray-200 shadow-sm bg-white px-4 font-bold text-dark">
                        <SelectValue placeholder="Niveau" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-gray-100">
                        <SelectItem value="Bronze" className="rounded-xl">🥉 Bronze</SelectItem>
                        <SelectItem value="Silver" className="rounded-xl">🥈 Silver</SelectItem>
                        <SelectItem value="Gold" className="rounded-xl">🥇 Gold</SelectItem>
                        <SelectItem value="Elite" className="rounded-xl">💎 Elite</SelectItem>
                        <SelectItem value="VIP" className="rounded-xl">👑 VIP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-gray-400 ml-1">Parrains & Sponsors</Label>
                      <DropdownMenu>
                        <DropdownMenuTrigger 
                          className="inline-flex h-7 items-center justify-center rounded-lg text-[10px] font-black uppercase bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary px-3 transition-colors cursor-pointer outline-none"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Nouveau Parrain
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl border-gray-100 shadow-xl">
                          <DropdownMenuGroup>
                            <DropdownMenuLabel className="text-[10px] font-black uppercase text-gray-400 px-3 py-2">Type de parrain</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectingSponsorType('direct');
                                setSponsorSearchQuery('');
                                setIsSponsorSelectorOpen(true);
                              }}
                              className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-primary/5 focus:bg-primary/5 group"
                            >
                              <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600">
                                <Users className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-dark group-hover:text-primary">Parrain Direct</p>
                                <p className="text-[10px] text-gray-400 font-medium">Commission de Niveau 1</p>
                              </div>
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectingSponsorType('indirect');
                                setSponsorSearchQuery('');
                                setIsSponsorSelectorOpen(true);
                              }}
                              className="flex items-center gap-2 cursor-pointer p-3 rounded-lg hover:bg-primary/5 focus:bg-primary/5 group"
                            >
                              <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                <Users className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-dark group-hover:text-primary">Parrain Indirect</p>
                                <p className="text-[10px] text-gray-400 font-medium">Commission de Niveau 2</p>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="space-y-3">
                      {/* Primary Direct Sponsor */}
                      {affiliateFormData.parentAffiliateId && (
                        <div className="bg-emerald-50/30 border border-emerald-100/50 p-3 rounded-2xl flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-600 font-bold group-hover:bg-emerald-200 transition-colors shadow-sm">
                              {affiliates.find(a => a.id === affiliateFormData.parentAffiliateId)?.name.charAt(0) || <Users className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-dark">{affiliates.find(a => a.id === affiliateFormData.parentAffiliateId)?.name || 'Inconnu'}</p>
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase px-1.5 py-0">Principal Direct</Badge>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono tracking-tight">{affiliates.find(a => a.id === affiliateFormData.parentAffiliateId)?.code || affiliateFormData.parentAffiliateId}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setAffiliateFormData({...affiliateFormData, parentAffiliateId: ''})}
                            className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Primary Indirect Sponsor */}
                      {affiliateFormData.grandparentAffiliateId && (
                        <div className="bg-blue-50/30 border border-blue-100/50 p-3 rounded-2xl flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 font-bold group-hover:bg-blue-200 transition-colors shadow-sm">
                              {affiliates.find(a => a.id === affiliateFormData.grandparentAffiliateId)?.name.charAt(0) || <Users className="h-5 w-5" />}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-black text-dark">{affiliates.find(a => a.id === affiliateFormData.grandparentAffiliateId)?.name || 'Inconnu'}</p>
                                <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-100 text-[8px] font-black uppercase px-1.5 py-0">Principal Indirect</Badge>
                              </div>
                              <p className="text-[10px] text-gray-400 font-mono tracking-tight">{affiliates.find(a => a.id === affiliateFormData.grandparentAffiliateId)?.code || affiliateFormData.grandparentAffiliateId}</p>
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setAffiliateFormData({...affiliateFormData, grandparentAffiliateId: ''})}
                            className="h-9 w-9 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}

                      {/* Additional Sponsors List */}
                      {affiliateFormData.additionalSponsors && affiliateFormData.additionalSponsors.length > 0 && (
                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {affiliateFormData.additionalSponsors.map(sponsor => {
                            const affiliate = affiliates.find(a => a.id === sponsor.id);
                            const isDirect = sponsor.type === 'direct';
                            return (
                              <div key={sponsor.id} className="flex items-center justify-between p-3 rounded-2xl bg-white border border-gray-100 shadow-sm group hover:border-primary/20 transition-all">
                                <div className="flex items-center gap-3">
                                  <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-sm ${isDirect ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                     {affiliate?.name.charAt(0) || '?'}
                                  </div>
                                  <div>
                                     <div className="flex items-center gap-2">
                                       <p className="text-xs font-bold text-dark leading-tight">{affiliate?.name || 'Inconnu'}</p>
                                       <Badge variant="outline" className={`${isDirect ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-blue-50 text-blue-600 border-blue-100'} text-[7px] font-black uppercase px-1.5 py-0 opacity-70`}>Plus {isDirect ? 'Direct' : 'Indirect'}</Badge>
                                     </div>
                                     <p className="text-[9px] text-gray-400 font-mono">{affiliate?.code || sponsor.id}</p>
                                  </div>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => setAffiliateFormData({
                                    ...affiliateFormData, 
                                    additionalSponsors: affiliateFormData.additionalSponsors?.filter(s => s.id !== sponsor.id)
                                  })}
                                  className="h-8 w-8 rounded-xl text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all hover:scale-110 active:scale-95"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {!affiliateFormData.parentAffiliateId && !affiliateFormData.grandparentAffiliateId && (!affiliateFormData.additionalSponsors || affiliateFormData.additionalSponsors.length === 0) && (
                        <div className="p-8 rounded-3xl border-2 border-dashed border-gray-100 text-center bg-gray-50/50">
                           <div className="h-12 w-12 bg-white rounded-2xl shadow-sm flex items-center justify-center text-gray-300 mx-auto mb-3">
                             <Users className="h-6 w-6" />
                           </div>
                           <p className="text-xs text-gray-500 font-medium">Aucun parrain défini pour cet affilié.</p>
                           <p className="text-[10px] text-gray-400 mt-1">Cliquez sur Nouveau Parrain pour en ajouter un.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="financial" className="mt-0 space-y-6 animate-in fade-in slide-in-from-bottom-2">
                 <div className="bg-emerald-50/50 p-6 rounded-[2rem] border border-emerald-100 text-center mb-8 relative overflow-hidden group">
                    <div className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-sm text-emerald-500 scale-110 opacity-50 group-hover:opacity-100 transition-opacity">
                      <TrendingUp className="h-4 w-4" />
                    </div>
                    <p className="text-[10px] font-black uppercase text-emerald-600 tracking-widest mb-1">Gains Totaux Cumulés</p>
                    <p className="text-4xl font-black text-emerald-700">{(affiliateFormData.totalEarnings || 0).toLocaleString()} <span className="text-lg">$</span></p>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex items-center justify-between">
                        Solde Disponible
                        <span className="text-emerald-600 font-black">USD ($)</span>
                      </Label>
                      <div className="relative group">
                        <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-emerald-500" />
                        <Input 
                          type="number"
                          value={affiliateFormData.balance} 
                          onChange={(e) => setAffiliateFormData({...affiliateFormData, balance: Number(e.target.value)})}
                          className="pl-10 h-14 rounded-2xl border-gray-200 text-xl font-black text-dark focus:ring-emerald-500 shadow-md bg-white" 
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-black uppercase text-gray-400 ml-1 flex items-center justify-between">
                        Points du mois
                        <Trophy className="h-3 w-3 text-primary" />
                      </Label>
                      <div className="relative">
                        <Star className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
                        <Input 
                          type="number"
                          value={affiliateFormData.points || 0} 
                          onChange={(e) => setAffiliateFormData({...affiliateFormData, points: Number(e.target.value)})}
                          className="pl-10 h-14 rounded-2xl border-gray-200 text-xl font-black text-dark focus:ring-primary shadow-md bg-white" 
                        />
                      </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t">
                    <div className="space-y-1 bg-white p-4 rounded-2xl border shadow-sm">
                      <Label className="text-[10px] font-black uppercase text-gray-500">Revenus Directs</Label>
                      <Input 
                        type="number"
                        value={affiliateFormData.directRevenue || 0} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, directRevenue: Number(e.target.value)})}
                        className="border-none shadow-none text-lg font-bold p-0 h-8 focus-visible:ring-0" 
                      />
                    </div>
                    <div className="space-y-1 bg-white p-4 rounded-2xl border shadow-sm">
                      <Label className="text-[10px] font-black uppercase text-gray-500">Revenus Indirects</Label>
                      <Input 
                        type="number"
                        value={affiliateFormData.indirectRevenue || 0} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, indirectRevenue: Number(e.target.value)})}
                        className="border-none shadow-none text-lg font-bold p-0 h-8 focus-visible:ring-0" 
                      />
                    </div>
                 </div>
              </TabsContent>

              <TabsContent value="stats" className="mt-0 space-y-6 animate-in fade-in slide-in-from-right-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                   <div className="p-6 rounded-[2.5rem] bg-indigo-50/50 border border-indigo-100 flex flex-col items-center text-center group transition-all hover:bg-indigo-50">
                      <div className="h-12 w-12 rounded-[1.25rem] bg-white shadow-md flex items-center justify-center text-indigo-500 mb-3 group-hover:rotate-12 transition-transform">
                        <Users className="h-6 w-6" />
                      </div>
                      <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">Affiliés Référés</p>
                      <Input 
                        type="number"
                        value={affiliateFormData.referredClients} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, referredClients: Number(e.target.value)})}
                        className="w-24 text-center border-none shadow-none text-2xl font-black bg-transparent focus-visible:ring-0 h-10 p-0" 
                      />
                      <p className="text-[9px] text-indigo-300 font-bold mt-1">TOTAL HISTORIQUE</p>
                   </div>
                   
                   <div className="p-6 rounded-[2.5rem] bg-orange-50/50 border border-orange-100 flex flex-col items-center text-center group transition-all hover:bg-orange-50">
                      <div className="h-12 w-12 rounded-[1.25rem] bg-white shadow-md flex items-center justify-center text-orange-500 mb-3 group-hover:rotate-12 transition-transform">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <p className="text-[10px] font-black uppercase text-orange-400 tracking-widest mb-1">Ventes Mensuelles</p>
                      <Input 
                        type="number"
                        value={affiliateFormData.monthlySales || 0} 
                        onChange={(e) => setAffiliateFormData({...affiliateFormData, monthlySales: Number(e.target.value)})}
                        className="w-24 text-center border-none shadow-none text-2xl font-black bg-transparent focus-visible:ring-0 h-10 p-0" 
                      />
                      <p className="text-[9px] text-orange-300 font-bold mt-1">OBJECTIF: 100 VENTES</p>
                   </div>

                   <div className="p-4 rounded-3xl bg-gray-100/50 border border-gray-200 sm:col-span-2">
                      <Label className="text-[10px] font-black uppercase text-gray-400 mb-4 block text-center">Référés ce mois</Label>
                      <div className="flex items-center justify-center gap-6">
                         <Button 
                           variant="outline" 
                           size="icon" 
                           className="rounded-xl h-10 w-10 shrink-0 border-gray-200"
                           onClick={() => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: Math.max(0, (affiliateFormData.monthlyReferredClients || 0) - 1)})}
                         >
                           <LucideIcons.Minus className="h-4 w-4" />
                         </Button>
                         <Input 
                            type="number"
                            value={affiliateFormData.monthlyReferredClients || 0} 
                            onChange={(e) => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: Number(e.target.value)})}
                            className="w-32 text-center text-4xl font-black border-none shadow-none bg-transparent h-16 pt-2" 
                          />
                          <Button 
                           variant="outline" 
                           size="icon" 
                           className="rounded-xl h-10 w-10 shrink-0 border-gray-200"
                           onClick={() => setAffiliateFormData({...affiliateFormData, monthlyReferredClients: (affiliateFormData.monthlyReferredClients || 0) + 1})}
                         >
                           <LucideIcons.Plus className="h-4 w-4" />
                         </Button>
                      </div>
                   </div>
                </div>
              </TabsContent>

              <TabsContent value="info" className="mt-0 space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-black text-dark flex items-center gap-2">
                    <LucideIcons.User className="h-5 w-5 text-primary" />
                    Informations Personnelles
                  </h3>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Email</p>
                      <p className="font-bold text-dark">{affiliateFormData.info?.email || 'Non renseigné'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Téléphone</p>
                      <p className="font-bold text-dark">{affiliateFormData.info?.phone || 'Non renseigné'}</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Message d'inscription</p>
                      <p className="text-sm text-gray-600 italic">"{affiliateFormData.info?.message || 'Aucun message'}"</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-1">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Date d'approbation</p>
                      <p className="font-bold text-dark">
                        {affiliateFormData.info?.approvedAt ? format(new Date(affiliateFormData.info.approvedAt), 'dd/MM/yyyy HH:mm', { locale: fr }) : 'Inconnue'}
                      </p>
                    </div>
                  </div>
                  
                  {settings?.lockAffiliateEdits && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-4">
                      <ShieldAlertIcon className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-red-900">Modifications impossibles</p>
                        <p className="text-[11px] text-red-700">Le verrouillage global des modifications est activé. Déverrouillez dans les paramètres pour modifier ces informations.</p>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="p-8 bg-white border-t flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2">
              {editingAffiliate && (
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    handleOpenAffiliateDeleteDialog(editingAffiliate);
                    setIsAffiliateDialogOpen(false);
                  }}
                  className="text-red-500 hover:bg-red-50 rounded-2xl h-12 font-bold flex items-center gap-2 group"
                >
                  <Trash2 className="h-4 w-4 group-hover:shake" />
                  <span className="hidden sm:inline">Supprimer l'affilié</span>
                </Button>
              )}
            </div>
            <div className="flex gap-3 w-full sm:w-auto">
              <Button 
                variant="outline" 
                onClick={() => setIsAffiliateDialogOpen(false)}
                className="flex-1 sm:flex-none rounded-2xl h-12 font-bold px-8 border-gray-200"
              >
                Fermer
              </Button>
              <Button 
                onClick={() => handleSaveAffiliate(affiliateFormData)} 
                disabled={isSaving || settings?.lockAffiliateEdits} 
                className={`flex-1 sm:flex-none rounded-2xl h-12 font-bold shadow-xl border-0 px-10 transition-all active:scale-95 ${
                  settings?.lockAffiliateEdits 
                    ? 'bg-gray-400 cursor-not-allowed opacity-50' 
                    : 'bg-primary hover:bg-[#1D4ED8] text-white shadow-accent-light/50'
                }`}
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                {editingAffiliate ? 'Mettre à jour' : 'Créer le compte'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      


      {/* Affiliate Delete Confirmation Dialog */}
      <Dialog open={isAffiliateDeleteConfirmOpen} onOpenChange={setIsAffiliateDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer l'affilié <span className="font-bold text-gray-900">{affiliateToDelete?.name}</span> ? 
              Cette action est irréversible et supprimera toutes les données associées.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsAffiliateDeleteConfirmOpen(false)} disabled={isDeleting}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleConfirmAffiliateDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer définitivement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Delete Confirmation */}
      <Dialog open={isProductDeleteDialogOpen} onOpenChange={setIsProductDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Supprimer le produit
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <span className="font-bold">{productToDelete?.name}</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsProductDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteProduct} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isGameDeleteDialogOpen} onOpenChange={setIsGameDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Supprimer le jeu
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer <span className="font-bold">{gameToDelete?.name}</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsGameDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteGame} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Edit/Add Dialog */}
      {/* ─── Formation Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={isFormationDialogOpen} onOpenChange={setIsFormationDialogOpen}>
        <DialogContent className="sm:max-w-4xl flex flex-col overflow-hidden max-h-[94vh]" showCloseButton={false}>
          <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 p-8 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/5 rounded-full blur-3xl" />
            <DialogHeader>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/10">
                    <LucideIcons.GraduationCap className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight">
                      {editingFormation ? 'Modifier la Formation' : 'Nouvelle Formation'}
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1">
                      Configuration du cours en ligne
                    </DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-all border border-white/5">
                  <LucideIcons.X className="h-5 w-5 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-8 overscroll-contain pb-24 custom-scrollbar">
            {/* ── Section: Infos de base ── */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <LucideIcons.FileText className="h-3.5 w-3.5" /> Informations de base
              </h3>
              <div className="grid grid-cols-1 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2">
                  <Label className="sm:text-right text-xs font-bold text-gray-500">Titre *</Label>
                  <Input value={formationFormData.title || ''} onChange={e => setFormationFormData(p => ({ ...p, title: e.target.value }))} className="sm:col-span-3 h-10 rounded-xl" placeholder="Ex: Maîtriser le e-commerce en Haïti" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right text-xs font-bold text-gray-500 pt-2">Résumé court</Label>
                  <Input value={formationFormData.shortDescription || ''} onChange={e => setFormationFormData(p => ({ ...p, shortDescription: e.target.value }))} className="sm:col-span-3 h-10 rounded-xl" placeholder="Une phrase accrocheur pour la carte..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                  <Label className="sm:text-right text-xs font-bold text-gray-500 pt-2">Description complète</Label>
                  <textarea value={formationFormData.description || ''} onChange={e => setFormationFormData(p => ({ ...p, description: e.target.value }))} className="sm:col-span-3 flex min-h-[100px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Description détaillée de la formation..." />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2">
                  <Label className="sm:text-right text-xs font-bold text-gray-500">Image couverture</Label>
                  <Input value={formationFormData.coverImage || ''} onChange={e => setFormationFormData(p => ({ ...p, coverImage: e.target.value }))} className="sm:col-span-3 h-10 rounded-xl" placeholder="https://images.unsplash.com/..." />
                </div>
                {formationFormData.coverImage && (
                  <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2">
                    <div className="sm:col-start-2 sm:col-span-3">
                      <img src={formationFormData.coverImage} className="h-32 w-full object-cover rounded-xl border" onError={e => (e.currentTarget.style.display='none')} />
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2">
                  <Label className="sm:text-right text-xs font-bold text-gray-500">
                    <span className="flex items-center gap-1"><LucideIcons.Play className="h-3 w-3 text-emerald-500" /> Vidéo de présentation</span>
                    <span className="block text-[10px] font-normal text-gray-400 mt-0.5">Visible gratuitement</span>
                  </Label>
                  <Input value={formationFormData.previewVideoUrl || ''} onChange={e => setFormationFormData(p => ({ ...p, previewVideoUrl: e.target.value }))} className="sm:col-span-3 h-10 rounded-xl" placeholder="URL YouTube / Vimeo — aperçu gratuit du cours" />
                </div>
              </div>
            </div>

            {/* ── Section: Prix & Niveau ── */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <LucideIcons.DollarSign className="h-3.5 w-3.5" /> Prix, Niveau & Catégorie
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Prix (HTG)</Label>
                  <Input type="number" value={formationFormData.price ?? 0} onChange={e => setFormationFormData(p => ({ ...p, price: Number(e.target.value) }))} className="h-10 rounded-xl" min="0" placeholder="0 = Gratuit" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Prix original / barré (HTG)</Label>
                  <Input type="number" value={formationFormData.originalPrice ?? ''} onChange={e => setFormationFormData(p => ({ ...p, originalPrice: e.target.value ? Number(e.target.value) : undefined }))} className="h-10 rounded-xl" min="0" placeholder="Ex: 5000 (optionnel)" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Niveau</Label>
                  <select value={formationFormData.level || 'debutant'} onChange={e => setFormationFormData(p => ({ ...p, level: e.target.value as any }))} className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                    <option value="debutant">Débutant</option>
                    <option value="intermediaire">Intermédiaire</option>
                    <option value="avance">Avancé</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Catégorie</Label>
                  <Input value={formationFormData.category || ''} onChange={e => setFormationFormData(p => ({ ...p, category: e.target.value }))} className="h-10 rounded-xl" placeholder="Ex: Finance, Marketing, Tech..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Langue</Label>
                  <Input value={formationFormData.language || 'Français'} onChange={e => setFormationFormData(p => ({ ...p, language: e.target.value }))} className="h-10 rounded-xl" placeholder="Français" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Durée totale</Label>
                  <Input value={formationFormData.totalDuration || ''} onChange={e => setFormationFormData(p => ({ ...p, totalDuration: e.target.value }))} className="h-10 rounded-xl" placeholder="Ex: 3h 30min" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Limite d'inscription</Label>
                  <Input type="number" value={formationFormData.enrollmentLimit ?? ''} onChange={e => setFormationFormData(p => ({ ...p, enrollmentLimit: e.target.value ? Number(e.target.value) : undefined }))} className="h-10 rounded-xl" min="0" placeholder="Illimité si vide" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Note (0–5)</Label>
                  <Input type="number" value={formationFormData.rating ?? 0} onChange={e => setFormationFormData(p => ({ ...p, rating: Number(e.target.value) }))} className="h-10 rounded-xl" min="0" max="5" step="0.1" />
                </div>
              </div>
              <div className="flex flex-wrap gap-6 pt-2">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" onClick={() => setFormationFormData(p => ({ ...p, hasCertificate: !p.hasCertificate }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${formationFormData.hasCertificate ? 'bg-primary' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formationFormData.hasCertificate ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <LucideIcons.BadgeCheck className="h-4 w-4 text-amber-500" /> Formation certifiante
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" onClick={() => setFormationFormData(p => ({ ...p, comingSoon: !p.comingSoon, published: p.comingSoon ? p.published : false }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${formationFormData.comingSoon ? 'bg-orange-400' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formationFormData.comingSoon ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                    <LucideIcons.Clock className="h-4 w-4 text-orange-400" /> À venir (pas encore disponible)
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button type="button" onClick={() => setFormationFormData(p => ({ ...p, published: !p.published, comingSoon: !p.published ? false : p.comingSoon }))}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${formationFormData.published ? 'bg-emerald-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${formationFormData.published ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-gray-700">Publié (visible et achetable)</span>
                </label>
              </div>
            </div>

            {/* ── Section: Instructeur ── */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <LucideIcons.User className="h-3.5 w-3.5" /> Instructeur
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Nom de l'instructeur</Label>
                  <Input value={formationFormData.instructor || ''} onChange={e => setFormationFormData(p => ({ ...p, instructor: e.target.value }))} className="h-10 rounded-xl" placeholder="Ex: Jean Paul Dupont" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Photo de l'instructeur (URL)</Label>
                  <Input value={formationFormData.instructorAvatar || ''} onChange={e => setFormationFormData(p => ({ ...p, instructorAvatar: e.target.value }))} className="h-10 rounded-xl" placeholder="https://..." />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold text-gray-500">Bio de l'instructeur</Label>
                  <Input value={formationFormData.instructorBio || ''} onChange={e => setFormationFormData(p => ({ ...p, instructorBio: e.target.value }))} className="h-10 rounded-xl" placeholder="Ex: Expert en finance avec 10 ans d'expérience..." />
                </div>
              </div>
            </div>

            {/* ── Section: Prérequis & Tags ── */}
            <div className="space-y-4">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                <LucideIcons.Tag className="h-3.5 w-3.5" /> Prérequis & Tags
              </h3>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500">Prérequis</Label>
                <textarea value={formationFormData.prerequisites || ''} onChange={e => setFormationFormData(p => ({ ...p, prerequisites: e.target.value }))} className="w-full min-h-[72px] rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring" placeholder="Ex: Avoir un smartphone, connaître les bases de Facebook..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500">PDF de support (URL)</Label>
                <Input value={formationFormData.pdfUrl || ''} onChange={e => setFormationFormData(p => ({ ...p, pdfUrl: e.target.value }))} className="h-10 rounded-xl" placeholder="https://..." />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-500">Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {(formationFormData.tags || []).map(tag => (
                    <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                      #{tag}
                      <button type="button" onClick={() => setFormationFormData(p => ({ ...p, tags: (p.tags || []).filter(t => t !== tag) }))} className="hover:text-red-500 ml-1">
                        <LucideIcons.X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={formationTagInput} onChange={e => setFormationTagInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && formationTagInput.trim()) { e.preventDefault(); setFormationFormData(p => ({ ...p, tags: [...new Set([...(p.tags || []), formationTagInput.trim()])] })); setFormationTagInput(''); }}} className="h-9 rounded-xl flex-1" placeholder="Tapez un tag et appuyez Entrée..." />
                  <Button type="button" size="sm" variant="outline" className="h-9 rounded-xl" onClick={() => { if (formationTagInput.trim()) { setFormationFormData(p => ({ ...p, tags: [...new Set([...(p.tags || []), formationTagInput.trim()])] })); setFormationTagInput(''); }}}>
                    Ajouter
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Section: Chapitres ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LucideIcons.Layers className="h-3.5 w-3.5" /> Chapitres (optionnel)
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addFormationChapter} className="h-8 rounded-xl text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un chapitre
                </Button>
              </div>
              <div className="space-y-3">
                {(formationFormData.chapters || []).map((chapter, idx) => {
                  const hasQuiz = !!(chapter.quiz);
                  const quizEnabled = hasQuiz || false;
                  return (
                    <div key={chapter.id} className="rounded-2xl bg-gray-50 border border-gray-100 overflow-hidden">
                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-[10px] font-black">Chapitre {idx + 1}</Badge>
                          <Button type="button" variant="ghost" size="sm" onClick={() => removeFormationChapter(chapter.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                            <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input value={chapter.title} onChange={e => updateFormationChapter(chapter.id, { title: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="Titre du chapitre" />
                          <Input value={chapter.description || ''} onChange={e => updateFormationChapter(chapter.id, { description: e.target.value })} className="h-9 rounded-xl text-sm" placeholder="Description (optionnel)" />
                        </div>
                      </div>

                      {/* ── Quiz d'évaluation ── */}
                      <div className="border-t border-gray-100 bg-violet-50/40 p-3 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-violet-700 uppercase tracking-widest flex items-center gap-1.5">
                            <LucideIcons.ClipboardList className="h-3.5 w-3.5" /> Quiz d'évaluation (seuil 80%)
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              if (hasQuiz) {
                                updateFormationChapter(chapter.id, { quiz: undefined });
                              } else {
                                updateFormationChapter(chapter.id, { quiz: { questions: [], passPercent: 80 } });
                              }
                            }}
                            className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${hasQuiz ? 'bg-violet-200 text-violet-800 hover:bg-violet-300' : 'bg-white border border-violet-200 text-violet-600 hover:bg-violet-100'}`}
                          >
                            {hasQuiz ? '✓ Quiz activé' : '+ Activer le quiz'}
                          </button>
                        </div>

                        {hasQuiz && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Seuil de réussite :</span>
                              <Input
                                type="number" min={50} max={100}
                                value={chapter.quiz?.passPercent ?? 80}
                                onChange={e => updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, passPercent: Number(e.target.value) } })}
                                className="h-7 w-20 rounded-lg text-xs"
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </div>

                            {(chapter.quiz?.questions || []).map((q, qi) => (
                              <div key={q.id} className="bg-white rounded-xl p-3 border border-violet-100 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5">Q{qi + 1}</Badge>
                                  <Input
                                    value={q.question}
                                    onChange={e => {
                                      const qs = [...(chapter.quiz?.questions || [])];
                                      qs[qi] = { ...qs[qi], question: e.target.value };
                                      updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, questions: qs } });
                                    }}
                                    className="h-8 rounded-lg text-xs flex-1"
                                    placeholder="Question..."
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const qs = (chapter.quiz?.questions || []).filter((_, i) => i !== qi);
                                      updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, questions: qs } });
                                    }}
                                    className="text-red-400 hover:text-red-600 shrink-0 p-1"
                                  >
                                    <LucideIcons.X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-1.5">
                                  {(q.options || ['', '', '', '']).map((opt, oi) => (
                                    <div key={oi} className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const qs = [...(chapter.quiz?.questions || [])];
                                          qs[qi] = { ...qs[qi], correctIndex: oi };
                                          updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, questions: qs } });
                                        }}
                                        className={`h-5 w-5 rounded-full shrink-0 border-2 transition-all ${q.correctIndex === oi ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 hover:border-emerald-400'}`}
                                        title="Réponse correcte"
                                      />
                                      <Input
                                        value={opt}
                                        onChange={e => {
                                          const qs = [...(chapter.quiz?.questions || [])];
                                          const newOpts = [...(qs[qi].options || ['', '', '', ''])];
                                          newOpts[oi] = e.target.value;
                                          qs[qi] = { ...qs[qi], options: newOpts };
                                          updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, questions: qs } });
                                        }}
                                        className="h-7 rounded-lg text-xs flex-1"
                                        placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                                      />
                                    </div>
                                  ))}
                                </div>
                                <p className="text-[10px] text-gray-400">● = réponse correcte</p>
                              </div>
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                const newQ = { id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), question: '', options: ['', '', '', ''], correctIndex: 0 };
                                updateFormationChapter(chapter.id, { quiz: { ...chapter.quiz!, questions: [...(chapter.quiz?.questions || []), newQ] } });
                              }}
                              className="w-full text-xs text-violet-600 hover:text-violet-800 border border-dashed border-violet-200 hover:border-violet-400 rounded-xl py-2 transition-all"
                            >
                              + Ajouter une question
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(formationFormData.chapters || []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-gray-100 rounded-2xl">Aucun chapitre — les modules seront affichés sans regroupement</p>
                )}
              </div>
            </div>

            {/* ── Section: Modules ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LucideIcons.Video className="h-3.5 w-3.5" /> Modules / Vidéos
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addFormationModule} className="h-8 rounded-xl text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter un module
                </Button>
              </div>
              <div className="space-y-3">
                {(formationFormData.modules || []).map((mod, idx) => (
                  <div key={mod.id} className="p-4 rounded-2xl bg-blue-50/50 border border-blue-100 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-[10px] font-black text-blue-700 bg-white border-blue-200">Module {idx + 1}</Badge>
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeFormationModule(mod.id)} className="h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full">
                        <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input value={mod.title} onChange={e => updateFormationModule(mod.id, { title: e.target.value })} className="h-9 rounded-xl text-sm bg-white" placeholder="Titre du module *" />
                      <Input value={mod.duration} onChange={e => updateFormationModule(mod.id, { duration: e.target.value })} className="h-9 rounded-xl text-sm bg-white" placeholder="Durée (ex: 14:30)" />
                      <Input value={mod.videoUrl} onChange={e => updateFormationModule(mod.id, { videoUrl: e.target.value })} className="h-9 rounded-xl text-sm bg-white sm:col-span-2" placeholder="URL Vidéo (YouTube, Vimeo, Drive...)" />
                      <Input value={mod.pdfUrl || ''} onChange={e => updateFormationModule(mod.id, { pdfUrl: e.target.value })} className="h-9 rounded-xl text-sm bg-white" placeholder="URL PDF du module (optionnel)" />
                      <Input value={mod.description || ''} onChange={e => updateFormationModule(mod.id, { description: e.target.value })} className="h-9 rounded-xl text-sm bg-white" placeholder="Description courte (optionnel)" />
                      {(formationFormData.chapters || []).length > 0 && (
                        <div className="sm:col-span-2">
                          <select value={mod.chapterId || ''} onChange={e => updateFormationModule(mod.id, { chapterId: e.target.value })} className="w-full h-9 rounded-xl border border-blue-100 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30">
                            <option value="">— Aucun chapitre —</option>
                            {(formationFormData.chapters || []).map(c => (
                              <option key={c.id} value={c.id}>{c.title || `Chapitre ${c.order}`}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {(formationFormData.modules || []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4 border-2 border-dashed border-blue-100 rounded-2xl">Aucun module ajouté</p>
                )}
              </div>
            </div>

            {/* ── Section: Ressources ── */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <LucideIcons.FileText className="h-3.5 w-3.5" /> Ressources supplémentaires
                </h3>
                <Button type="button" variant="outline" size="sm" onClick={addFormationResource} className="h-8 rounded-xl text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter
                </Button>
              </div>
              <div className="space-y-3">
                {(formationFormData.resources || []).map((res, idx) => (
                  <div key={res.id} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <Badge variant="outline" className="text-[10px] shrink-0">#{idx + 1}</Badge>
                    <Input value={res.name} onChange={e => updateFormationResource(res.id, { name: e.target.value })} className="h-9 rounded-xl text-sm flex-1" placeholder="Nom de la ressource" />
                    <Input value={res.url} onChange={e => updateFormationResource(res.id, { url: e.target.value })} className="h-9 rounded-xl text-sm flex-1" placeholder="URL" />
                    <select value={res.type} onChange={e => updateFormationResource(res.id, { type: e.target.value as any })} className="h-9 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none">
                      <option value="pdf">PDF</option>
                      <option value="link">Lien</option>
                      <option value="file">Fichier</option>
                    </select>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFormationResource(res.id)} className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-full shrink-0">
                      <LucideIcons.Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                {(formationFormData.resources || []).length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3 border-2 border-dashed border-gray-100 rounded-2xl">Aucune ressource ajoutée</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-gray-50/50 border-t border-gray-100 gap-3 shrink-0">
            <Button variant="ghost" onClick={() => setIsFormationDialogOpen(false)} className="h-12 rounded-2xl font-bold px-8">Annuler</Button>
            <Button onClick={handleSaveFormation} disabled={isSaving} className="h-12 rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white font-black px-12 shadow-xl shadow-primary/20">
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingFormation ? 'Mettre à jour' : 'Créer la formation')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formation Delete Confirmation */}
      <Dialog open={isFormationDeleteDialogOpen} onOpenChange={setIsFormationDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[3rem] p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 text-2xl font-black">
              <AlertTriangle className="h-6 w-6" /> Supprimer Formation
            </DialogTitle>
            <DialogDescription className="text-gray-500 pt-2 font-medium">
              Action irréversible. Supprimer <span className="font-bold text-gray-900">"{formationToDelete?.title}"</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsFormationDeleteDialogOpen(false)} className="rounded-2xl h-12 font-bold px-6">Garder</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteFormation} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-2xl h-12 font-bold px-8 shadow-lg shadow-red-100">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-3xl flex flex-col overflow-hidden max-h-[94vh]" showCloseButton={false}>
          <div className="bg-indigo-900 p-8 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" />
            <DialogHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md shrink-0 border border-white/10">
                    <LucideIcons.Package className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">
                      {editingProduct ? 'Modifier le Produit' : 'Nouveau Produit'}
                    </DialogTitle>
                    <DialogDescription className="text-white/60 text-[10px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-2">
                       Configuration du catalogue dynamique
                    </DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-all group active:scale-90 border border-white/5">
                  <LucideIcons.X className="h-5 w-5 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto p-8 space-y-10 overscroll-contain pb-24 custom-scrollbar">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-xs font-bold uppercase text-gray-500">Nom</Label>
                <Input 
                  value={productFormData.name} 
                  onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                  className="sm:col-span-3 h-10 rounded-xl" 
                  placeholder="Ex: Netflix Premium 1 Mois"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Prix</Label>
                <Input 
                  value={productFormData.price} 
                  onChange={(e) => setProductFormData({...productFormData, price: e.target.value})}
                  className="sm:col-span-3 h-10 rounded-xl" 
                  placeholder="Ex: 1500 HTG"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-xs font-bold uppercase text-gray-400">Plans / Variantes</Label>
                <div className="sm:col-span-3 space-y-4">
                  <div className="flex flex-col gap-3">
                    {productFormData.plans?.map((plan, idx) => (
                      <div key={plan.id} className="p-4 rounded-2xl bg-gray-50 border border-gray-100 flex flex-col gap-3 relative group">
                        <div className="flex items-center gap-2">
                           <Badge variant="outline" className="h-5 px-2 rounded-md bg-white border-gray-200 text-gray-400 text-[8px] font-black uppercase">Plan #{idx + 1}</Badge>
                           <Button 
                             variant="ghost" 
                             size="icon-sm" 
                             className="h-6 w-6 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 ml-auto"
                             onClick={() => removeProductPlan(plan.id)}
                           >
                             <LucideIcons.Trash2 className="h-3 w-3" />
                           </Button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Input 
                            value={plan.name} 
                            placeholder="Nom du plan (ex: 1 Mois)"
                            className="h-10 rounded-xl bg-white border-gray-200 focus:ring-primary text-xs"
                            onChange={(e) => updateProductPlan(plan.id, { name: e.target.value })}
                          />
                          <Input 
                            value={plan.price} 
                            placeholder="Prix (ex: 1500 HTG)"
                            className="h-10 rounded-xl bg-white border-gray-200 focus:ring-primary text-xs"
                            onChange={(e) => updateProductPlan(plan.id, { price: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                    
                    <Button 
                      onClick={addProductPlan}
                      variant="outline"
                      type="button"
                      className="w-full h-12 rounded-2xl border-dashed border-2 hover:border-primary hover:text-primary transition-all group"
                    >
                      <LucideIcons.Plus className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />
                      Ajouter un plan / variante
                    </Button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Description</Label>
                <textarea 
                  value={productFormData.description} 
                  onChange={(e) => setProductFormData({...productFormData, description: e.target.value})}
                  className="sm:col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Détails du service..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Msg WhatsApp</Label>
                <Input 
                  value={productFormData.whatsappMessage} 
                  onChange={(e) => setProductFormData({...productFormData, whatsappMessage: e.target.value})}
                  className="sm:col-span-3" 
                  placeholder="Message auto personnalisé..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Stock</Label>
                <Input 
                  type="number"
                  value={productFormData.stock || 0} 
                  onChange={(e) => setProductFormData({...productFormData, stock: Number(e.target.value)})}
                  className="sm:col-span-3" 
                  placeholder="Quantité en stock"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Montant personnalisé</Label>
                <div className="sm:col-span-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProductFormData({...productFormData, allowCustomAmount: !productFormData.allowCustomAmount})}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${productFormData.allowCustomAmount ? 'bg-primary' : 'bg-gray-200'}`}
                  >
                    <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${productFormData.allowCustomAmount ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm text-gray-600">Permettre à l'utilisateur de saisir un montant en dollars</span>
                </div>
              </div>
              {productFormData.allowCustomAmount && (
                <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                  <Label className="sm:text-right text-sm">Taux de change (HTG/$)</Label>
                  <div className="sm:col-span-3 space-y-1">
                    <Input
                      type="number"
                      value={productFormData.customExchangeRate || ''}
                      onChange={(e) => setProductFormData({...productFormData, customExchangeRate: e.target.value ? Number(e.target.value) : undefined})}
                      className="h-10 rounded-xl"
                      placeholder="Ex: 146 (laisser vide pour taux global)"
                      min="1"
                    />
                    <p className="text-[10px] text-gray-400">Taux personnalisé pour ce produit. Si vide, le taux global de l'application sera utilisé.</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Image (Lien)</Label>
                <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2">
                  <Input 
                    value={tempProductImageUrl} 
                    onChange={(e) => setTempProductImageUrl(e.target.value)}
                    placeholder="https://exemple.com/image.jpg"
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => {
                      if (tempProductImageUrl) {
                        setProductFormData({...productFormData, image: tempProductImageUrl});
                        setTempProductImageUrl('');
                        toast.success("Lien d'image appliqué !");
                      }
                    }}
                    className="bg-primary hover:bg-[#1D4ED8] w-full sm:w-auto border-0"
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
              <Label className="sm:text-right text-sm">Image (Fichier)</Label>
              <div className="sm:col-span-3 space-y-4">
                {productFormData.image && (
                  <div className="relative h-40 sm:h-48 w-full rounded-xl overflow-hidden border bg-gray-50">
                    <img 
                      src={productFormData.image} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/rena/400/400';
                      }}
                    />
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => setProductFormData({...productFormData, image: ''})}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleProductImageUpload}
                      className="hidden" 
                      id="product-image-upload"
                    />
                    <Button asChild variant="outline" className="w-full cursor-pointer" disabled={uploading}>
                      <label htmlFor="product-image-upload" className="flex items-center justify-center">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Télécharger l'image
                      </label>
                    </Button>
                  </div>
                  {uploading && (
                    <div className="w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          </div>
          
          <div className="shrink-0 p-8 pt-4 bg-white/80 backdrop-blur-md border-t border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2 w-full sm:w-auto">
              {editingProduct && (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setProductToDelete(editingProduct);
                    setIsProductDeleteDialogOpen(true);
                    setIsProductDialogOpen(false);
                  }} 
                  className="h-14 px-6 rounded-2xl text-red-500 hover:bg-red-50 border-red-100 font-black uppercase text-[10px] tracking-widest gap-2 flex-1 sm:flex-none"
                >
                  <LucideIcons.Trash2 className="h-4 w-4" />
                  Supprimer
                </Button>
              )}
              <Button variant="ghost" onClick={() => setIsProductDialogOpen(false)} className="h-14 px-6 rounded-2xl font-black uppercase text-[10px] tracking-widest text-gray-400 flex-1 sm:flex-none">Annuler</Button>
            </div>
            
            <Button 
              onClick={handleSaveProduct} 
              disabled={isSaving} 
              className="w-full sm:w-auto h-14 px-10 rounded-2xl bg-indigo-900 hover:bg-indigo-950 text-white font-black text-lg shadow-xl shadow-indigo-900/20 transition-all flex items-center justify-center gap-3"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <LucideIcons.Save className="h-5 w-5" />}
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Game Editor Dialog */}
      <Dialog open={isGameDialogOpen} onOpenChange={setIsGameDialogOpen}>
        <DialogContent className="sm:max-w-4xl">
          <DialogHeader className="pb-4 border-b -mx-4 -mt-4 p-6 bg-white z-20">
            <DialogTitle className="text-xl font-black">{editingGame ? 'Modifier le jeu' : 'Nouveau jeu'}</DialogTitle>
            <DialogDescription className="text-xs">Ajoutez un jeu pour le service de Top-up.</DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto pr-2 -mr-2 py-4 custom-scrollbar overscroll-contain">
            <div className="grid gap-6">
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-xs font-bold uppercase text-gray-500">Nom</Label>
                <Input 
                  value={gameFormData.name} 
                  onChange={(e) => setGameFormData({...gameFormData, name: e.target.value})}
                  className="sm:col-span-3 h-10 rounded-xl" 
                  placeholder="Ex: Free Fire"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Prix (Range)</Label>
                <Input 
                  value={gameFormData.priceRange} 
                  onChange={(e) => setGameFormData({...gameFormData, priceRange: e.target.value})}
                  className="sm:col-span-3" 
                  placeholder="Ex: À partir de 100 G"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Description</Label>
                <textarea 
                  value={gameFormData.description} 
                  onChange={(e) => setGameFormData({...gameFormData, description: e.target.value})}
                  className="sm:col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Détails du jeu..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Msg WhatsApp</Label>
                <Input 
                  value={gameFormData.whatsappMessage} 
                  onChange={(e) => setGameFormData({...gameFormData, whatsappMessage: e.target.value})}
                  className="sm:col-span-3" 
                  placeholder="Message auto personnalisé..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
                <Label className="sm:text-right text-sm">Image (Lien)</Label>
                <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2">
                  <Input 
                    value={tempGameImageUrl} 
                    onChange={(e) => setTempGameImageUrl(e.target.value)}
                    placeholder="https://exemple.com/image.jpg"
                    className="flex-1"
                  />
                  <Button 
                    onClick={() => {
                      if (tempGameImageUrl) {
                        setGameFormData({...gameFormData, image: tempGameImageUrl});
                        setTempGameImageUrl('');
                        toast.success("Lien d'image appliqué !");
                      }
                    }}
                    className="bg-primary hover:bg-[#1D4ED8] w-full sm:w-auto border-0"
                  >
                    Ajouter
                  </Button>
                </div>
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
              <Label className="sm:text-right text-sm">Image (Fichier)</Label>
              <div className="sm:col-span-3 space-y-4">
                {gameFormData.image && (
                  <div className="relative h-40 sm:h-48 w-full rounded-xl overflow-hidden border bg-gray-50">
                    <img 
                      src={gameFormData.image} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/game/400/400';
                      }}
                    />
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      className="absolute top-2 right-2"
                      onClick={() => setGameFormData({...gameFormData, image: ''})}
                    >
                      Supprimer
                    </Button>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleGameImageUpload}
                      className="hidden" 
                      id="game-image-upload"
                    />
                    <Button asChild variant="outline" className="w-full cursor-pointer" disabled={uploading}>
                      <label htmlFor="game-image-upload" className="flex items-center justify-center">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Télécharger l'image
                      </label>
                    </Button>
                  </div>
                  {uploading && (
                    <div className="w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t relative">
              <div className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10 py-2 -mx-2 px-2 rounded-lg mb-2">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  Catalogue de prix
                </Label>
                <Button variant="ghost" size="sm" onClick={addCatalogItem} className="h-8 text-primary hover:text-dark hover:bg-accent-light font-bold">
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un pack
                </Button>
              </div>
              
              <div className="space-y-3">
                {gameFormData.catalog?.map((item, idx) => (
                  <div key={item.id} className="p-4 rounded-xl border bg-gray-50 space-y-3 relative group transition-all hover:border-primary/20">
                    <div className="flex justify-between items-center bg-white px-3 py-1 rounded-full border text-[10px] font-bold text-gray-400 w-fit shadow-sm">
                      PACK {idx + 1}
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Produit (ex: 100 Diamants)</Label>
                        <Input 
                          value={item.name} 
                          onChange={(e) => updateCatalogItem(item.id, { name: e.target.value })} 
                          placeholder="Ex: 500 G"
                          className="h-9 bg-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase text-gray-500 font-bold">Prix (ex: 150 G)</Label>
                        <Input 
                          value={item.price} 
                          onChange={(e) => updateCatalogItem(item.id, { price: e.target.value })} 
                          placeholder="Prix"
                          className="h-9 bg-white"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-gray-500 font-bold">Message WhatsApp personnalisé (Optionnel)</Label>
                      <Input 
                        value={item.whatsappMessage} 
                        onChange={(e) => updateCatalogItem(item.id, { whatsappMessage: e.target.value })} 
                        placeholder="Laisse vide pour message par défaut"
                        className="h-9 bg-white"
                      />
                    </div>
                    
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        removeCatalogItem(item.id);
                        toast.info("Pack retiré. N'oubliez pas d'enregistrer.");
                      }}
                      className="absolute top-2 right-2 h-8 w-8 text-red-500 hover:bg-red-50 hover:text-red-600 transition-all border border-red-100 bg-white shadow-sm z-30"
                      title="Supprimer ce pack"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {(!gameFormData.catalog || gameFormData.catalog.length === 0) && (
                  <div className="text-center py-6 border-2 border-dashed rounded-xl text-gray-400 text-sm">
                    Aucun pack défini.
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
          <DialogFooter className="sticky bottom-0 z-30 mt-auto border-t pt-4 pb-2 bg-white/95 backdrop-blur-md flex flex-row justify-between items-center sm:justify-between w-full -mx-4 px-6 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
            <div className="flex gap-2">
              {editingGame && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setGameToDelete(editingGame);
                    setIsGameDeleteDialogOpen(true);
                    setIsGameDialogOpen(false);
                  }} 
                  className="text-red-500 hover:bg-red-50 hover:text-red-600 px-2 h-9 text-[10px] sm:text-xs border border-transparent hover:border-red-200"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  <span className="hidden xs:inline">Supprimer</span>
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsGameDialogOpen(false)} className="rounded-xl h-9 text-xs px-4">Annuler</Button>
              <Button 
                onClick={handleSaveGame} 
                disabled={isSaving} 
                className="bg-primary hover:bg-[#1D4ED8] text-white font-bold h-9 rounded-xl shadow-lg shadow-accent-light/50 border-0 px-6 min-w-[100px]"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Delete Confirmation Dialog */}
      <Dialog open={isCardDeleteDialogOpen} onOpenChange={setIsCardDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Supprimer la carte
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer la carte "{cardToDelete?.name}" ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsCardDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteCard} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card Editor Dialog */}
      <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
        <DialogContent className="sm:max-w-4xl flex flex-col overflow-hidden max-h-[94vh]" showCloseButton={false}>
          <div className="bg-emerald-900 p-8 text-white relative overflow-hidden shrink-0">
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/5 rounded-full blur-3xl animate-pulse" />
            <DialogHeader>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-md shrink-0 border border-white/10">
                    <CreditCard className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight leading-none">
                      {editingCard ? 'Modifier la Carte' : 'Nouvelle Carte'}
                    </DialogTitle>
                    <DialogDescription className="text-emerald-300/80 text-[10px] font-black uppercase tracking-widest mt-1.5 flex items-center gap-2">
                       Gestion des cartes de recharge
                    </DialogDescription>
                  </div>
                </div>
                <DialogClose className="rounded-full bg-white/10 p-2.5 hover:bg-white/20 transition-all group active:scale-90 border border-white/5">
                  <LucideIcons.X className="h-5 w-5 text-white" />
                </DialogClose>
              </div>
            </DialogHeader>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-2">
                <Label htmlFor="card-name">Nom de la carte</Label>
                <Input 
                  id="card-name" 
                  value={cardFormData.name} 
                  onChange={(e) => setCardFormData({...cardFormData, name: e.target.value})}
                  placeholder="Ex: Carte Visa Prépayée"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="card-price">Prix / Frais</Label>
                <Input 
                  id="card-price" 
                  value={cardFormData.price} 
                  onChange={(e) => setCardFormData({...cardFormData, price: e.target.value})}
                  placeholder="Ex: 500 HTG"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-description">Description</Label>
                <Input 
                  id="card-description" 
                  value={cardFormData.description} 
                  onChange={(e) => setCardFormData({...cardFormData, description: e.target.value})}
                  placeholder="Détails sur la carte..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-gold-rate">Taux Gold (par 1 USD)</Label>
                <Input 
                  id="card-gold-rate" 
                  type="number"
                  step="0.01"
                  value={cardFormData.goldRate || 1} 
                  onChange={(e) => setCardFormData({...cardFormData, goldRate: Number(e.target.value)})}
                  placeholder="Ex: 1 USD = 10 Gold. Entrez 10"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-presets">Montants Prédéfinis (USD, séparés par virgules)</Label>
                <Input 
                  id="card-presets" 
                  placeholder="Ex: 5, 10, 20, 50" 
                  value={cardFormData.presets?.join(', ') || ''} 
                  onChange={(e) => {
                    const values = e.target.value.split(',').map(v => v.trim()).filter(v => v !== '').map(v => parseFloat(v)).filter(v => !isNaN(v));
                    setCardFormData({...cardFormData, presets: values});
                  }}
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Taux de frais personnalisés (USD)</Label>
                  <button
                    type="button"
                    onClick={() => setCardFormData(prev => ({ ...prev, feeRules: [...(prev.feeRules || []), { min: 0, max: 0, fee: 0 }] }))}
                    className="flex items-center gap-1.5 text-xs font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-xl transition-colors"
                  >
                    <LucideIcons.Plus className="h-3.5 w-3.5" /> Ajouter une tranche
                  </button>
                </div>
                {(cardFormData.feeRules || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic bg-gray-50 rounded-xl px-4 py-3">Aucun frais configuré. Cliquez sur "Ajouter une tranche" pour définir des frais par tranche de montant.</p>
                ) : (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">De ($)</span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">À ($)</span>
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Frais ($)</span>
                      <span />
                    </div>
                    {(cardFormData.feeRules || []).map((rule, idx) => (
                      <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center bg-amber-50 border border-amber-100 rounded-xl p-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="5"
                          value={rule.min || ''}
                          onChange={(e) => {
                            const updated = [...(cardFormData.feeRules || [])];
                            updated[idx] = { ...updated[idx], min: parseFloat(e.target.value) || 0 };
                            setCardFormData(prev => ({ ...prev, feeRules: updated }));
                          }}
                          className="h-9 text-sm font-bold bg-white"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="10"
                          value={rule.max || ''}
                          onChange={(e) => {
                            const updated = [...(cardFormData.feeRules || [])];
                            updated[idx] = { ...updated[idx], max: parseFloat(e.target.value) || 0 };
                            setCardFormData(prev => ({ ...prev, feeRules: updated }));
                          }}
                          className="h-9 text-sm font-bold bg-white"
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="3"
                          value={rule.fee || ''}
                          onChange={(e) => {
                            const updated = [...(cardFormData.feeRules || [])];
                            updated[idx] = { ...updated[idx], fee: parseFloat(e.target.value) || 0 };
                            setCardFormData(prev => ({ ...prev, feeRules: updated }));
                          }}
                          className="h-9 text-sm font-bold bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updated = (cardFormData.feeRules || []).filter((_, i) => i !== idx);
                            setCardFormData(prev => ({ ...prev, feeRules: updated }));
                          }}
                          className="h-9 w-9 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-500 transition-colors"
                        >
                          <LucideIcons.Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <p className="text-[10px] text-gray-400 italic px-1">Ex : De 5 à 10$ → Frais 3$ signifie que pour tout montant entre 5$ et 10$, un frais de 3$ sera ajouté.</p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-whatsapp">Message WhatsApp personnalisé (Optionnel)</Label>
                <Input 
                  id="card-whatsapp" 
                  value={cardFormData.whatsappMessage} 
                  onChange={(e) => setCardFormData({...cardFormData, whatsappMessage: e.target.value})}
                  placeholder="Message automatique quand l'utilisateur clique..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="card-stock">Stock disponible</Label>
                <Input 
                  id="card-stock" 
                  type="number"
                  value={cardFormData.stock || 0} 
                  onChange={(e) => setCardFormData({...cardFormData, stock: Number(e.target.value)})}
                  placeholder="Quantité en stock"
                />
              </div>

              <div className="space-y-4">
                <Label>Image de la carte</Label>
                <div className="flex flex-col gap-4">
                  <div className="flex gap-2">
                    <Input 
                      value={tempCardImageUrl} 
                      onChange={(e) => setTempCardImageUrl(e.target.value)}
                      placeholder="Coller l'URL de l'image..."
                      className="flex-1"
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (tempCardImageUrl) {
                          setCardFormData({...cardFormData, image: tempCardImageUrl});
                          setTempCardImageUrl('');
                          toast.success("URL de l'image appliquée !");
                        }
                      }}
                    >
                      Appliquer
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-gray-400">Ou télécharger</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-4 gap-4 bg-gray-50/50">
                    {cardFormData.image ? (
                      <div className="relative group w-full aspect-video bg-white rounded-lg overflow-hidden border">
                        <img 
                          src={cardFormData.image} 
                          className="w-full h-full object-contain"
                          alt="Previsualisation" 
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                          <Button variant="destructive" size="sm" onClick={() => setCardFormData({...cardFormData, image: ''})}>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center space-y-2">
                        <ImageIcon className="h-10 w-10 text-gray-300 mx-auto" />
                        <p className="text-sm text-gray-500">Aucune image sélectionnée</p>
                      </div>
                    )}
                    
                    <div className="w-full">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleCardImageUpload}
                        className="hidden" 
                        id="card-image-upload"
                      />
                      <Button asChild variant="outline" className="w-full cursor-pointer" disabled={uploading}>
                        <label htmlFor="card-image-upload">
                          {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                          {cardFormData.image ? 'Changer l\'image' : 'Télécharger une image'}
                        </label>
                      </Button>
                      {uploading && (
                        <div className="mt-2 w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-primary h-full transition-all duration-300" 
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t bg-gray-50/50 sticky bottom-0 left-0 right-0 z-10 w-full flex flex-row items-center justify-between sm:justify-between">
            <div className="flex items-center gap-2">
              {editingCard && (
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    setCardToDelete(editingCard);
                    setIsCardDeleteDialogOpen(true);
                  }}
                  className="bg-red-500 hover:bg-red-600 border-0 h-10 px-4"
                  title="Supprimer cette carte"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setIsCardDialogOpen(false)} className="h-10 px-6">Annuler</Button>
              <Button onClick={handleSaveCard} disabled={isSaving} className="bg-primary hover:bg-[#1D4ED8] h-10 px-8 text-white font-bold shadow-md shadow-accent-light/50 active:scale-95 transition-all border-0">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer le colis <span className="font-mono font-bold">{parcelToDelete?.trackingNumber}</span> ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash className="h-4 w-4 mr-2" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingParcel ? 'Modifier le colis' : 'Ajouter un nouveau colis'}</DialogTitle>
            <DialogDescription>
              Remplissez les informations ci-dessous pour mettre à jour le suivi.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="tracking" className="sm:text-right">N° Suivi</Label>
              <Input 
                id="tracking" 
                value={formData.trackingNumber} 
                onChange={(e) => setFormData({...formData, trackingNumber: e.target.value})}
                className="sm:col-span-3 font-mono" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="status" className="sm:text-right">Statut</Label>
              <div className="sm:col-span-3 w-full">
                <Select 
                  value={formData.status} 
                  onValueChange={(v: ParcelStatus) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="En route">En route</SelectItem>
                    <SelectItem value="En transit">En transit</SelectItem>
                    <SelectItem value="Arrivé">Arrivé</SelectItem>
                    <SelectItem value="Livré">Livré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="location" className="sm:text-right">Lieu</Label>
              <Input 
                id="location" 
                value={formData.currentLocation} 
                onChange={(e) => setFormData({...formData, currentLocation: e.target.value})}
                className="sm:col-span-3" 
                placeholder="Ex: Miami, USA"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="arrival" className="sm:text-right">Arrivée Est.</Label>
              <Input 
                id="arrival" 
                type="date"
                value={formData.estimatedArrival} 
                onChange={(e) => setFormData({...formData, estimatedArrival: e.target.value})}
                className="sm:col-span-3" 
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label htmlFor="payment" className="sm:text-right">Paiement</Label>
              <div className="sm:col-span-3 w-full">
                <Select 
                  value={formData.paymentStatus} 
                  onValueChange={(v: PaymentStatus) => setFormData({...formData, paymentStatus: v})}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Statut paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payé">Payé</SelectItem>
                    <SelectItem value="Non payé">Non payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start sm:items-center gap-2 sm:gap-4">
              <Label className="sm:text-right">Preuve (Lien)</Label>
              <div className="sm:col-span-3 flex flex-col sm:flex-row gap-2">
                <Input 
                  value={tempProofUrl} 
                  onChange={(e) => setTempProofUrl(e.target.value)}
                  placeholder="Lien de l'image de preuve..."
                  className="flex-1"
                />
                <Button 
                  onClick={() => {
                    if (tempProofUrl) {
                      setFormData({...formData, proofOfDelivery: tempProofUrl});
                      setTempProofUrl('');
                      toast.success("Lien de preuve appliqué !");
                    }
                  }}
                  className="bg-primary hover:bg-[#1D4ED8] w-full sm:w-auto border-0"
                >
                  Ajouter
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 items-start gap-2 sm:gap-4">
              <Label className="sm:text-right">Preuve (Fichier)</Label>
              <div className="sm:col-span-3 space-y-2">
                {formData.proofOfDelivery && (
                  <div className="relative group rounded-lg overflow-hidden border h-40 sm:h-48 bg-gray-50">
                    <img 
                      src={formData.proofOfDelivery} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/rena/400/400';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button variant="destructive" size="sm" onClick={() => setFormData({...formData, proofOfDelivery: ''})}>Supprimer</Button>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                      className="hidden" 
                      id="file-upload"
                    />
                    <Button 
                      asChild 
                      variant="outline" 
                      className="w-full cursor-pointer"
                      disabled={uploading}
                    >
                      <label htmlFor="file-upload" className="flex items-center justify-center">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        {formData.proofOfDelivery ? 'Changer l\'image' : 'Télécharger une preuve'}
                      </label>
                    </Button>
                  </div>
                  {uploading && (
                    <div className="w-full bg-accent-light/30 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-primary h-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-primary hover:bg-[#1D4ED8] border-0">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Credit Dialog */}
      <Dialog open={isQuickCreditDialogOpen} onOpenChange={setIsQuickCreditDialogOpen}>
        <DialogContent className="w-[94%] sm:max-w-[400px] p-0 overflow-y-auto max-h-[92vh] rounded-[2rem] border-0 shadow-2xl custom-scrollbar relative">
          <DialogHeader className="p-6 bg-emerald-600 text-white rounded-t-[2rem] sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-2xl font-black">
                <PlusCircle className="h-6 w-6" />
                Ajout Rapide
              </DialogTitle>
              <DialogClose className="rounded-full bg-white/20 p-2 hover:bg-white/30 transition-colors">
                <X className="h-5 w-5 text-white" />
              </DialogClose>
            </div>
            <DialogDescription className="text-emerald-100 opacity-90">
              Ajouter des Gouds au compte de {selectedAffiliateForCredit?.name} (#{selectedAffiliateForCredit?.code}).
              <div className="mt-1 text-[10px] text-emerald-600 font-mono">ID Wallet: {selectedAffiliateForCredit?.walletId?.match(/.{1,4}/g)?.join(' ')}</div>
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 space-y-6">
            <div className="space-y-3">
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest text-center">Montant à Ajouter (HTG)</p>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-300">G</div>
                <Input 
                  type="number"
                  value={quickCreditAmount}
                  onChange={(e) => setQuickCreditAmount(Number(e.target.value))}
                  placeholder="0.00"
                  className="pl-12 h-14 rounded-2xl text-2xl font-black border-emerald-100 focus:ring-emerald-200"
                />
              </div>
              <div className="flex flex-col items-center gap-1">
                <p className="text-[11px] text-gray-400 text-center">Conversion: <span className="font-bold text-emerald-600">{(quickCreditAmount / (settings?.exchangeRate || 146)).toFixed(2)} $</span></p>
                <p className="text-[9px] text-gray-300 italic">Taux actuel: 1$ = {settings?.exchangeRate || 146} HTG</p>
              </div>
              <p className="text-[11px] text-gray-400 text-center pt-2 border-t border-gray-50">Solde actuel de {selectedAffiliateForCredit?.name}: <span className="font-bold text-dark">{selectedAffiliateForCredit?.balance} $</span></p>
            </div>

            <div className="flex gap-2 flex-wrap justify-center">
              {[50, 100, 250, 500, 1000].map(amt => (
                <Button 
                  key={amt} 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setQuickCreditAmount(amt)}
                  className="rounded-xl border-emerald-100 hover:bg-emerald-50 text-emerald-600 font-bold"
                >
                  +{amt}
                </Button>
              ))}
            </div>
          </div>
          <DialogFooter className="p-8 border-t bg-gray-50 rounded-b-[2rem] gap-2">
            <Button variant="outline" onClick={() => setIsQuickCreditDialogOpen(false)} className="rounded-xl h-12 font-bold">Annuler</Button>
            <Button 
              onClick={handleQuickCredit} 
              disabled={isSaving || quickCreditAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-black px-8 shadow-lg shadow-emerald-200 border-0 flex-1"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Confirmer l'ajout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sponsor Selector Dialog */}
      <Dialog open={isSponsorSelectorOpen} onOpenChange={setIsSponsorSelectorOpen}>
        <DialogContent className="w-[94%] sm:max-w-[500px] rounded-[2rem] p-0 border-0 shadow-2xl max-h-[92vh] flex flex-col overflow-hidden">
          <DialogHeader className="p-6 bg-primary text-white shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl font-black">
              <Search className="h-6 w-6" />
              Sélectionner un {selectingSponsorType === 'direct' ? 'Parrain Direct' : selectingSponsorType === 'indirect' ? 'Parrain Indirect' : 'Parrain Additionnel'}
            </DialogTitle>
            <DialogDescription className="text-white/80">
              Choisissez un affilié dans la liste ci-dessous.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-gray-50 border-b shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Rechercher par nom ou code..." 
                value={sponsorSearchQuery}
                onChange={(e) => setSponsorSearchQuery(e.target.value)}
                className="pl-10 h-10 rounded-xl border-gray-200 focus:ring-primary shadow-sm bg-white"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
            <div className="space-y-2">
              {affiliates
                .filter(a => 
                  a.id !== (editingAffiliate?.id) && // Can't be your own sponsor
                  (a.name.toLowerCase().includes(sponsorSearchQuery.toLowerCase()) || 
                   a.code.toLowerCase().includes(sponsorSearchQuery.toLowerCase()))
                )
                .map(a => (
                  <div 
                    key={a.id}
                    onClick={() => {
                      if (selectingSponsorType === 'direct') {
                        // If primary is empty, set it, otherwise add to additional
                        if (!affiliateFormData.parentAffiliateId) {
                          setAffiliateFormData({...affiliateFormData, parentAffiliateId: a.id});
                        } else {
                          const currentExtras = affiliateFormData.additionalSponsors || [];
                          if (!currentExtras.find(s => s.id === a.id)) {
                            setAffiliateFormData({...affiliateFormData, additionalSponsors: [...currentExtras, { id: a.id!, type: 'direct' }]});
                          }
                        }
                      } else if (selectingSponsorType === 'indirect') {
                        // If primary is empty, set it, otherwise add to additional
                        if (!affiliateFormData.grandparentAffiliateId) {
                          setAffiliateFormData({...affiliateFormData, grandparentAffiliateId: a.id});
                        } else {
                          const currentExtras = affiliateFormData.additionalSponsors || [];
                          if (!currentExtras.find(s => s.id === a.id)) {
                            setAffiliateFormData({...affiliateFormData, additionalSponsors: [...currentExtras, { id: a.id!, type: 'indirect' }]});
                          }
                        }
                      }
                      setIsSponsorSelectorOpen(false);
                    }}
                    className="p-3 rounded-2xl border border-gray-100 hover:border-primary/30 hover:bg-primary/5 cursor-pointer transition-all flex items-center justify-between group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center text-primary font-bold group-hover:bg-primary/10">
                        {a.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-dark text-sm">{a.name}</p>
                        <p className="text-[10px] text-gray-400 font-mono uppercase">{a.code}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary transition-colors" />
                  </div>
                ))}
            </div>
          </div>
          <div className="p-4 border-t bg-gray-50 flex justify-end shrink-0">
            <Button variant="outline" onClick={() => setIsSponsorSelectorOpen(false)} className="rounded-xl font-bold">Fermer</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Edits Dialog */}
      <Dialog open={isUnlockDialogOpen} onOpenChange={setIsUnlockDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-2xl">
              <Shield className="h-6 w-6 text-primary" />
              Déverrouiller
            </DialogTitle>
            <DialogDescription>
              Entrez le code de sécurité pour déverrouiller la modification des affiliés.
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <Input 
              type="password"
              placeholder="Code de sécurité"
              value={lockCodeInput}
              onChange={(e) => setLockCodeInput(e.target.value)}
              className="h-14 rounded-2xl text-center text-4xl font-black tracking-[1em]"
              maxLength={4}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsUnlockDialogOpen(false)} className="rounded-xl h-11 font-bold">Annuler</Button>
            <Button onClick={handleToggleLockEdits} className="bg-primary hover:bg-[#1D4ED8] text-white rounded-xl h-11 font-bold flex-1 border-0">
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Withdrawal Toggle Confirm Dialog */}
      <Dialog open={isWithdrawalToggleConfirmOpen} onOpenChange={setIsWithdrawalToggleConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black text-2xl">
              <AlertCircle className="h-6 w-6 text-red-500" />
              {settings?.withdrawalsEnabled ? 'Désactiver les retraits ?' : 'Réactiver les retraits ?'}
            </DialogTitle>
            <DialogDescription>
              {settings?.withdrawalsEnabled 
                ? 'Cette action bloquera toutes les nouvelles demandes de retrait pour les affiliés.' 
                : 'Cette action autorisera à nouveau les affiliés à faire des demandes de retrait.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsWithdrawalToggleConfirmOpen(false)} className="rounded-xl h-11 font-bold flex-1">Annuler</Button>
            <Button 
              onClick={handleToggleWithdrawals}
              className={`rounded-xl h-11 font-bold flex-1 border-0 ${settings?.withdrawalsEnabled ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'} text-white`}
            >
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <DialogHeader className="p-8 bg-primary text-white rounded-b-[2rem] shrink-0">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <Shield className="h-6 w-6" />
              {editingAdmin ? 'Modifier Admin' : 'Créer un Admin'}
            </DialogTitle>
            <DialogDescription className="text-accent-light opacity-90">
              Gérez les accès et les permissions de cet administrateur.
            </DialogDescription>
          </DialogHeader>
          
          <div className="p-8 space-y-6 overflow-y-auto flex-grow">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Nom Complet</Label>
                <Input 
                  value={adminFormData.fullName} 
                  onChange={(e) => setAdminFormData({...adminFormData, fullName: e.target.value})}
                  placeholder="Ex: John Doe"
                  className="rounded-2xl h-11 bg-gray-50/50 border-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Mot de Passe</Label>
                <Input 
                  value={adminFormData.password} 
                  onChange={(e) => setAdminFormData({...adminFormData, password: e.target.value})}
                  placeholder="Mot de passe"
                  className="rounded-2xl h-11 bg-gray-50/50 border-gray-100"
                  type="text" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Lien de la Photo de Profil</Label>
                <Input 
                  value={adminFormData.photoUrl} 
                  onChange={(e) => setAdminFormData({...adminFormData, photoUrl: e.target.value})}
                  placeholder="Ex: https://images.com/profile.jpg"
                  className="rounded-2xl h-11 bg-gray-50/50 border-gray-100"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Code de Connexion (Super Admin)</Label>
                <Input 
                  value={adminFormData.loginCode} 
                  onChange={(e) => setAdminFormData({...adminFormData, loginCode: e.target.value})}
                  placeholder="Ex: 123456"
                  className="rounded-2xl h-11 bg-gray-50/50 border-gray-100 font-mono"
                />
                <p className="text-[10px] text-gray-400 px-1">Seulement requis si coché comme Super Admin.</p>
              </div>
              
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox 
                  id="is-super" 
                  checked={adminFormData.isSuperAdmin} 
                  onCheckedChange={(checked) => setAdminFormData({...adminFormData, isSuperAdmin: !!checked})}
                />
                <Label htmlFor="is-super" className="text-sm font-bold text-gray-700">Définir comme Super Administrateur</Label>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <Label className="text-xs font-bold text-gray-400 uppercase tracking-wider">Permissions</Label>
              <div className="grid grid-cols-2 gap-3">
                {menuItems.filter(m => m.permission !== 'super_admin_only').map(item => (
                  <div key={item.permission} className="flex items-center space-x-2 p-2 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                    <Checkbox 
                      id={`p-${item.permission}`}
                      checked={adminFormData.permissions?.includes(item.permission) || adminFormData.permissions?.includes('all')}
                      onCheckedChange={(checked) => {
                        const current = adminFormData.permissions || [];
                        if (checked) {
                          setAdminFormData({...adminFormData, permissions: [...current, item.permission]});
                        } else {
                          setAdminFormData({...adminFormData, permissions: current.filter(p => p !== item.permission && p !== 'all')});
                        }
                      }}
                    />
                    <Label htmlFor={`p-${item.permission}`} className="text-xs font-medium cursor-pointer truncate">
                      {item.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 border-t bg-gray-50/50 flex flex-col sm:flex-row gap-3 shrink-0">
            {editingAdmin && !editingAdmin.isSuperAdmin && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  setAdminToDelete(editingAdmin);
                  setIsAdminDeleteDialogOpen(true);
                  setIsAdminDialogOpen(false);
                }}
                className="text-red-500 hover:bg-red-50 h-12 rounded-2xl font-bold order-2 sm:order-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            )}
            <div className="flex gap-2 ml-auto w-full sm:w-auto order-1 sm:order-2">
              <Button variant="outline" onClick={() => setIsAdminDialogOpen(false)} className="flex-1 sm:flex-none h-12 rounded-2xl border-gray-100 font-bold bg-white">Annuler</Button>
              <Button onClick={handleSaveAdminAccount} disabled={isSaving} className="flex-1 sm:flex-none h-12 rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white font-bold px-8 shadow-xl shadow-accent-light/50 border-0">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enregistrer l'Admin
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Login Logs Dialog */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col p-0 rounded-3xl border-0 shadow-2xl overflow-hidden">
          <DialogHeader className="p-8 bg-dark text-white">
            <DialogTitle className="text-2xl font-black flex items-center gap-3 text-white">
              <History className="h-6 w-6 text-primary" />
              Logs de Connexion
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Historique des tentatives de connexion réussies et échouées.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div className="space-y-2">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 rounded-2xl border bg-white hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${log.success ? 'bg-accent-light/50 text-primary' : 'bg-red-50 text-red-600'}`}>
                      {log.success ? <Shield className="h-4 w-4" /> : < ShieldAlertIcon className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{log.adminName}</p>
                      <p className="text-[10px] text-gray-400">
                        {log.timestamp ? format(log.timestamp instanceof Timestamp ? log.timestamp.toDate() : new Date(log.timestamp), 'dd MMMM yyyy HH:mm', { locale: fr }) : '-'}
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${log.success ? 'bg-accent-light text-primary border border-primary/20' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                    {log.success ? 'Réussi' : 'Échec'}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="p-6 border-t bg-gray-50/50">
            <Button variant="outline" onClick={() => setIsLogsDialogOpen(false)} className="w-full sm:w-auto h-11 rounded-2xl border-gray-100 font-bold px-8">Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Delete Confirmation Dialog */}
      <Dialog open={isAdminDeleteDialogOpen} onOpenChange={setIsAdminDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-3xl p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 text-2xl font-black">
              <ShieldAlertIcon className="h-6 w-6" />
              Supprimer Admin
            </DialogTitle>
            <DialogDescription className="text-gray-500 pt-2">
              Êtes-vous sûr de vouloir supprimer l'administrateur <span className="font-bold text-gray-900 leading-none">{adminToDelete?.fullName}</span> ? Cette action retirera tous ses accès immédiatement.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsAdminDeleteDialogOpen(false)} className="rounded-2xl h-12 font-bold px-6">Annuler</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteAdmin} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-2xl h-12 font-bold px-8 shadow-lg shadow-red-100">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Supprimer l'accès
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sponsor Selector Dialog for Client */}
      <Dialog open={isSponsorSelectorForClientOpen} onOpenChange={setIsSponsorSelectorForClientOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[3rem] p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-dark text-2xl font-black">
              <div className="h-12 w-12 rounded-2xl bg-accent-light text-primary flex items-center justify-center">
                <Search className="h-6 w-6" />
              </div>
              Sélectionner un Parrain
            </DialogTitle>
            <DialogDescription className="text-gray-400 font-medium">
              Veuillez sélectionner l'affilié qui servira de parrain {selectingSponsorTypeForClient === 'direct' ? 'direct (N+1)' : 'indirect (N+2)'} pour ce client.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Nom ou code de l'affilié..." 
                className="pl-10 h-12 rounded-xl"
                value={sponsorSearchQuery}
                onChange={(e) => setSponsorSearchQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {affiliates
                .filter(a => a.name.toLowerCase().includes(sponsorSearchQuery.toLowerCase()) || a.code.toLowerCase().includes(sponsorSearchQuery.toLowerCase()))
                .map(sponsor => (
                  <button
                    key={sponsor.id}
                    onClick={() => handleSelectSponsorForClient(sponsor)}
                    className="w-full flex items-center justify-between p-4 rounded-2xl bg-gray-50 hover:bg-primary/5 hover:border-primary/20 border border-transparent transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center font-black text-gray-400 group-hover:text-primary">
                        {sponsor.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-dark">{sponsor.name}</p>
                        <p className="text-[10px] font-black text-primary uppercase">{sponsor.code}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Save/Edit Client Dialog */}
      <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-[3.5rem] p-0 border-0 shadow-2xl overflow-hidden">
          <div className="p-10">
            <DialogHeader className="mb-8">
              <DialogTitle className="flex items-center gap-4 text-dark text-3xl font-black">
                <div className="h-14 w-14 rounded-[1.25rem] bg-navy text-white flex items-center justify-center shadow-xl shadow-navy/20">
                  {editingClient ? <Edit2 className="h-6 w-6" /> : <Smartphone className="h-6 w-6" />}
                </div>
                {editingClient ? 'Modifier Client' : 'Nouveau Client'}
              </DialogTitle>
              <DialogDescription className="text-gray-400 font-medium pt-2 text-lg">
                Enregistrez manuellement les informations du client dans le réseau.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6">
                 <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-4">Nom complet</Label>
                    <Input 
                      placeholder="Ex: Jean Dupont" 
                      className="h-14 rounded-2xl bg-gray-50 border-gray-100 px-6 font-bold focus:bg-white transition-colors"
                      value={clientFormData.name}
                      onChange={(e) => setClientFormData(prev => ({ ...prev, name: e.target.value }))}
                    />
                 </div>
                 <div className="space-y-3">
                    <Label className="text-[11px] font-black uppercase tracking-widest text-gray-400 ml-4">Numéro de téléphone</Label>
                    <Input 
                      placeholder="Ex: 01 23 45 67 89" 
                      className="h-14 rounded-2xl bg-gray-50 border-gray-100 px-6 font-bold font-mono focus:bg-white transition-colors"
                      value={clientFormData.phone}
                      onChange={(e) => setClientFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                 </div>
              </div>

              <div className="space-y-4">
                 <h4 className="text-[11px] font-black uppercase tracking-widest text-primary ml-4">Attribution de Parrainage</h4>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                      onClick={() => {
                        setSelectingSponsorTypeForClient('direct');
                        setIsSponsorSelectorForClientOpen(true);
                      }}
                      className="p-5 rounded-3xl bg-gray-50 border border-gray-100 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                    >
                       <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Direct (N+1)</p>
                       <p className="font-bold text-dark truncate">
                         {clientFormData.directSponsorId 
                           ? (affiliates.find(a => a.id === clientFormData.directSponsorId)?.name || 'Sélectionné') 
                           : 'Non rattaché'}
                       </p>
                    </div>

                    <div 
                      onClick={() => {
                        setSelectingSponsorTypeForClient('indirect');
                        setIsSponsorSelectorForClientOpen(true);
                      }}
                      className="p-5 rounded-3xl bg-gray-50 border border-gray-100 hover:border-primary hover:bg-primary/5 transition-all cursor-pointer group"
                    >
                       <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Indirect (N+2)</p>
                       <p className="font-bold text-dark truncate">
                         {clientFormData.indirectSponsorId 
                           ? (affiliates.find(a => a.id === clientFormData.indirectSponsorId)?.name || 'Sélectionné') 
                           : 'Non rattaché'}
                       </p>
                    </div>
                 </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-8 bg-gray-50/50 border-t border-gray-100 gap-4">
            <Button variant="ghost" onClick={() => setIsClientDialogOpen(false)} className="h-14 rounded-2xl font-bold px-8">Annuler</Button>
            <Button 
                onClick={handleSaveClient} 
                disabled={isSaving}
                className="h-14 rounded-2xl bg-primary hover:bg-[#1D4ED8] text-white font-black px-12 shadow-xl shadow-primary/20 flex-1 sm:flex-none"
            >
              {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingClient ? 'Mettre à jour' : 'Enregistrer Client')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Free Fire Credit Dialog ── */}
      <Dialog open={ffCreditDialogOpen} onOpenChange={v => { if (!v) { setFFSelectedPack(null); setFFCustomAmount(''); setFFUseCustom(false); } setFFCreditDialogOpen(v); }}>
        <DialogContent className="max-w-sm rounded-3xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          {/* Header */}
          <div className={`px-6 pt-6 pb-5 ${ffCreditOp === 'add' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-red-500 to-rose-600'}`}>
            <DialogTitle className="text-white font-black text-lg flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 opacity-80" />
              {ffCreditOp === 'add' ? 'Ajouter du Crédit' : 'Retirer du Crédit'}
            </DialogTitle>
            <p className="text-white/70 text-sm mt-1 font-medium">
              {ffCreditAgent?.agentName || ffCreditAgent?.name || '—'} ·{' '}
              <span className="font-black text-white">{(ffCreditAgent?.diamondBalance || 0).toLocaleString()} 💎</span> actuellement
            </p>
          </div>

          <div className="px-6 py-5 space-y-5 overflow-y-auto max-h-[60vh]">
            {/* Pack selection (add only) */}
            {ffCreditOp === 'add' && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Choisir un pack</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ffCreditPacks.map(pack => (
                    <button
                      key={pack.id}
                      onClick={() => { setFFSelectedPack(pack); setFFUseCustom(false); }}
                      className={`flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
                        !ffUseCustom && ffSelectedPack?.id === pack.id
                          ? 'border-emerald-400 bg-emerald-50'
                          : 'border-gray-100 bg-gray-50 hover:border-emerald-200'
                      }`}
                    >
                      <span className="text-2xl">💎</span>
                      <p className={`font-black text-sm ${!ffUseCustom && ffSelectedPack?.id === pack.id ? 'text-emerald-700' : 'text-slate-800'}`}>
                        {pack.diamonds.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-400 font-medium">${pack.priceUSD}</p>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => { setFFUseCustom(true); setFFSelectedPack(null); }}
                  className={`w-full text-center py-2.5 rounded-2xl border-2 text-[10px] font-black uppercase tracking-widest transition-all ${ffUseCustom ? 'border-orange-400 bg-orange-50 text-orange-600' : 'border-dashed border-gray-200 text-gray-400 hover:border-gray-300'}`}
                >
                  ✏️ Montant personnalisé
                </button>
              </div>
            )}

            {/* Custom amount (for remove, always show; for add, show when custom selected) */}
            {(ffCreditOp === 'remove' || ffUseCustom) && (
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Nombre de diamants</Label>
                <Input
                  type="number"
                  min="1"
                  value={ffCustomAmount}
                  onChange={e => setFFCustomAmount(e.target.value)}
                  placeholder="Ex : 5000"
                  className="h-12 rounded-2xl bg-gray-50 border-0 font-black text-lg"
                  autoFocus={ffCreditOp === 'remove'}
                />
              </div>
            )}

            {/* Note */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Note (optionnel)</Label>
              <Input
                value={ffCreditNote}
                onChange={e => setFFCreditNote(e.target.value)}
                placeholder="Ex : Paiement MonCash reçu"
                className="h-11 rounded-2xl bg-gray-50 border-0 font-medium"
              />
            </div>

            {/* Preview */}
            {(() => {
              const amt = ffUseCustom ? parseInt(ffCustomAmount) : (ffCreditOp === 'remove' ? parseInt(ffCustomAmount) : ffSelectedPack?.diamonds);
              if (!amt || isNaN(amt) || amt <= 0) return null;
              const cur = ffCreditAgent?.diamondBalance || 0;
              const next = ffCreditOp === 'add' ? cur + amt : Math.max(0, cur - amt);
              return (
                <div className={`p-4 rounded-2xl ${ffCreditOp === 'add' ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${ffCreditOp === 'add' ? 'text-emerald-600' : 'text-red-500'}`}>Aperçu</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600 font-medium">Solde actuel</span>
                    <span className="font-black text-sm">{cur.toLocaleString()} 💎</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm text-gray-600 font-medium">{ffCreditOp === 'add' ? 'Ajout' : 'Retrait'}</span>
                    <span className={`font-black text-sm ${ffCreditOp === 'add' ? 'text-emerald-600' : 'text-red-500'}`}>
                      {ffCreditOp === 'add' ? '+' : '−'}{amt.toLocaleString()} 💎
                    </span>
                  </div>
                  <div className="h-px bg-gray-200 my-2" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-gray-800">Nouveau solde</span>
                    <span className="font-black text-base text-orange-600">{next.toLocaleString()} 💎</span>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="px-6 pb-6">
            <Button
              onClick={handleFFCreditAdjust}
              disabled={ffCreditLoading || (() => {
                const amt = ffUseCustom ? parseInt(ffCustomAmount) : (ffCreditOp === 'remove' ? parseInt(ffCustomAmount) : ffSelectedPack?.diamonds);
                return !amt || isNaN(amt) || amt <= 0;
              })()}
              className={`w-full h-12 rounded-2xl font-black text-white border-0 uppercase tracking-widest text-[11px] shadow-lg disabled:opacity-40 ${ffCreditOp === 'add' ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {ffCreditLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : ffCreditOp === 'add'
                  ? `Ajouter ${(ffUseCustom ? parseInt(ffCustomAmount) : ffSelectedPack?.diamonds || 0).toLocaleString()} 💎`
                  : `Retirer ${(parseInt(ffCustomAmount) || 0).toLocaleString()} 💎`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Free Fire Packs Configuration Dialog ── */}
      <Dialog open={ffPacksDialogOpen} onOpenChange={setFFPacksDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl border-0 p-0 overflow-hidden shadow-2xl bg-white">
          <div className="bg-gradient-to-br from-orange-500 to-amber-400 px-6 pt-6 pb-5">
            <DialogTitle className="text-white font-black text-lg flex items-center gap-2">
              <LucideIcons.Settings className="h-5 w-5 opacity-80" />
              Configurer les Packs Diamants
            </DialogTitle>
            <DialogDescription className="text-white/60 text-sm mt-1">
              Ces packs sont proposés aux admins lors de l'ajout de crédit aux agents.
            </DialogDescription>
          </div>

          <div className="px-6 py-5 space-y-3 max-h-[60vh] overflow-y-auto">
            {ffEditingPacks.map((pack, idx) => (
              <div key={pack.id} className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Pack {idx + 1}</p>
                  {ffEditingPacks.length > 1 && (
                    <button
                      onClick={() => setFFEditingPacks(prev => prev.filter((_, i) => i !== idx))}
                      className="text-red-400 hover:text-red-600 text-xs font-black"
                    >✕ Supprimer</button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Diamants</Label>
                    <Input
                      type="number"
                      value={pack.diamonds}
                      onChange={e => setFFEditingPacks(prev => prev.map((p, i) => i === idx ? { ...p, diamonds: parseInt(e.target.value) || 0 } : p))}
                      className="h-10 rounded-xl bg-white border-gray-200 font-black"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Prix (USD)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={pack.priceUSD}
                      onChange={e => setFFEditingPacks(prev => prev.map((p, i) => i === idx ? { ...p, priceUSD: parseFloat(e.target.value) || 0 } : p))}
                      className="h-10 rounded-xl bg-white border-gray-200 font-black"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-gray-400">Label</Label>
                  <Input
                    value={pack.label}
                    onChange={e => setFFEditingPacks(prev => prev.map((p, i) => i === idx ? { ...p, label: e.target.value } : p))}
                    className="h-10 rounded-xl bg-white border-gray-200 font-medium"
                    placeholder={`Pack ${pack.diamonds?.toLocaleString() || '?'}`}
                  />
                </div>
              </div>
            ))}
            <button
              onClick={() => setFFEditingPacks(prev => [...prev, { id: `pack_${Date.now()}`, label: '', diamonds: 0, priceUSD: 0 }])}
              className="w-full py-3 border-2 border-dashed border-orange-200 rounded-2xl text-orange-500 text-[10px] font-black uppercase tracking-widest hover:bg-orange-50 transition-colors"
            >
              + Ajouter un pack
            </button>
          </div>

          <div className="px-6 pb-6 border-t border-gray-50 pt-4">
            <Button
              onClick={handleFFPacksSave}
              disabled={ffPacksSaving}
              className="w-full h-12 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-black border-0 shadow-lg uppercase tracking-widest text-[11px]"
            >
              {ffPacksSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : '✓ Enregistrer les packs'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Credentials Approval Modal ─────────────────────────────────────── */}
      <Dialog open={credentialsModalOpen} onOpenChange={v => { if (!credentialLoading) setCredentialsModalOpen(v); }}>
        <DialogContent className="max-w-md rounded-3xl p-0 overflow-hidden border-0 shadow-2xl">
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white">
            <div className="flex items-center gap-3 mb-1">
              <div className="h-10 w-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-white text-lg font-black">Approuver le service</DialogTitle>
                <DialogDescription className="text-white/70 text-xs mt-0.5">
                  {credentialNotif?.productName || 'Service'} — {credentialNotif?.clientName}
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Vous pouvez fournir les identifiants du compte <strong>{credentialNotif?.productName || 'service'}</strong> au client. Ces informations seront envoyées par email et notification.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500 uppercase tracking-widest">Email / Identifiant du compte</Label>
                <Input
                  placeholder="ex: client@netflix.com"
                  value={credentialEmail}
                  onChange={e => setCredentialEmail(e.target.value)}
                  className="h-11 rounded-xl border-2 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mot de passe</Label>
                <Input
                  placeholder="Mot de passe du compte"
                  value={credentialPassword}
                  onChange={e => setCredentialPassword(e.target.value)}
                  className="h-11 rounded-xl border-2 font-mono text-sm"
                />
              </div>
              {(credentialEmail || credentialPassword) && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 font-semibold">
                  ✅ Ces identifiants seront envoyés au client par email et notification.
                </div>
              )}
              {!credentialEmail && !credentialPassword && (
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500">
                  Sans identifiants : le client recevra juste une notification d'activation.
                </div>
              )}
            </div>
          </div>
          <div className="px-6 pb-6 flex gap-3">
            <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setCredentialsModalOpen(false)} disabled={credentialLoading}>
              Annuler
            </Button>
            <Button
              className="flex-1 rounded-xl h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-black"
              onClick={handleApproveWithCredentials}
              disabled={credentialLoading}
            >
              {credentialLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="h-4 w-4 mr-1.5" /> Approuver</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Promo Code Dialog ───────────────────────────────────────────────── */}
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{promoEditTarget ? 'Modifier le code' : 'Nouveau code promo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Code *</Label>
              <Input placeholder="ex: NETFLIX20" value={promoCode} onChange={e => setPromoCode(e.target.value.toUpperCase())} className="font-mono font-black" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Service (laisser vide = tous)</Label>
              <Input placeholder="ex: Netflix, Amazon Prime…" value={promoServiceName} onChange={e => setPromoServiceName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Réduction % *</Label>
                <Input type="number" min="1" max="100" placeholder="20" value={promoDiscount} onChange={e => setPromoDiscount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-widest">Utilisations max (0=∞)</Label>
                <Input type="number" min="0" placeholder="0" value={promoMaxUses} onChange={e => setPromoMaxUses(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border">
              <input type="checkbox" id="promo-active" checked={promoActive} onChange={e => setPromoActive(e.target.checked)} className="h-4 w-4 accent-primary rounded" />
              <Label htmlFor="promo-active" className="font-bold text-sm cursor-pointer">Code actif</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPromoDialogOpen(false)} className="rounded-xl">Annuler</Button>
            <Button onClick={handleSavePromoCode} disabled={promoSaving} className="rounded-xl bg-primary hover:bg-[#1D4ED8] text-white font-black">
              {promoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : promoEditTarget ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Promo Code Delete Confirmation ─────────────────────────────────── */}
      <Dialog open={!!promoDeleteTarget} onOpenChange={v => { if (!v) setPromoDeleteTarget(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-red-600">Supprimer le code</DialogTitle>
            <DialogDescription>Supprimer <strong className="font-mono">{promoDeleteTarget?.code}</strong> ? Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => setPromoDeleteTarget(null)} className="rounded-xl">Annuler</Button>
            <Button variant="destructive" onClick={handleDeletePromoCode} className="rounded-xl">Supprimer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Client Confirmation */}
      <Dialog open={isClientDeleteDialogOpen} onOpenChange={setIsClientDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[425px] rounded-[3rem] p-8 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-red-600 text-2xl font-black">
              <AlertTriangle className="h-6 w-6" />
              Supprimer Client
            </DialogTitle>
            <DialogDescription className="text-gray-500 pt-2 font-medium">
              Action irréversible. Êtes-vous sûr de vouloir supprimer le client <span className="font-bold text-gray-900">{clientToDelete?.name}</span> ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 mt-6 sm:justify-end">
            <Button variant="ghost" onClick={() => setIsClientDeleteDialogOpen(false)} className="rounded-2xl h-12 font-bold px-6">Garder</Button>
            <Button variant="destructive" onClick={handleConfirmDeleteClient} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 rounded-2xl h-12 font-bold px-8 shadow-lg shadow-red-100">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Supprimer Définitivement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Back to Top Button */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: showScrollTop ? 1 : 0, scale: showScrollTop ? 1 : 0 }}
        className="fixed bottom-6 right-6 z-50 pointer-events-none"
      >
        <Button 
          onClick={scrollToTop}
          className="pointer-events-auto h-14 w-14 rounded-3xl bg-primary hover:bg-[#1D4ED8] text-white shadow-2xl flex items-center justify-center p-0 border-0 active:scale-90 transition-transform"
        >
          <ArrowUp className="h-7 w-7" />
        </Button>
      </motion.div>
    </div>
  );
}
