// ─── Catalogue & Commissions — Onglet Admin ───────────────────────────────────
// Vue unifiée de tous les services avec leurs prix et taux de commission affilié.

import React, { useEffect, useState, useCallback } from 'react';
import {
  collection, getDocs, doc, updateDoc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Loader2, Pencil, Check, X, Percent, DollarSign, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface ServiceRow {
  id: string;
  collection: string;
  name: string;
  price: number;         // USD
  commissionRate: number; // % du prix → direct affilié
  extra?: string;        // info complémentaire (ex: plage de prix)
}

interface EditState {
  price: string;
  commissionRate: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function commissionAmount(price: number, rate: number) {
  return price * rate / 100;
}

function CategoryBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${color}`}>
      {label}
    </span>
  );
}

// ── Ligne de tableau éditable ─────────────────────────────────────────────────
function ServiceRowComp({
  row,
  onSave,
}: {
  row: ServiceRow;
  onSave: (id: string, col: string, price: number, rate: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<EditState>({ price: String(row.price), commissionRate: String(row.commissionRate) });

  const handleSave = async () => {
    const price = parseFloat(edit.price.replace(',', '.'));
    const rate  = parseFloat(edit.commissionRate.replace(',', '.'));
    if (isNaN(price) || price < 0)  { toast.error('Prix invalide'); return; }
    if (isNaN(rate)  || rate < 0 || rate > 100) { toast.error('Taux invalide (0-100%)'); return; }
    setSaving(true);
    try {
      await onSave(row.id, row.collection, price, rate);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEdit({ price: String(row.price), commissionRate: String(row.commissionRate) });
    setEditing(false);
  };

  const commission = commissionAmount(row.price, row.commissionRate);

  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors group">
      {/* Nom */}
      <td className="px-4 py-3">
        <div>
          <p className="font-semibold text-sm text-gray-900 leading-tight">{row.name}</p>
          {row.extra && <p className="text-[11px] text-gray-400 mt-0.5">{row.extra}</p>}
        </div>
      </td>

      {/* Prix */}
      <td className="px-4 py-3 w-36">
        {editing ? (
          <div className="flex items-center gap-1">
            <DollarSign className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <Input
              type="number"
              min={0}
              step={0.01}
              value={edit.price}
              onChange={e => setEdit(s => ({ ...s, price: e.target.value }))}
              className="h-8 text-sm w-24"
              autoFocus
            />
          </div>
        ) : (
          <span className="font-bold text-gray-800 text-sm">${fmt(row.price)}</span>
        )}
      </td>

      {/* Taux commission */}
      <td className="px-4 py-3 w-36">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={edit.commissionRate}
              onChange={e => setEdit(s => ({ ...s, commissionRate: e.target.value }))}
              className="h-8 text-sm w-20"
            />
            <Percent className="h-3.5 w-3.5 text-gray-400 shrink-0" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-primary text-sm">{row.commissionRate}%</span>
            {row.commissionRate === 0 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-gray-400 border-gray-200">
                Aucune
              </Badge>
            )}
          </div>
        )}
      </td>

      {/* Commission calculée */}
      <td className="px-4 py-3 w-36">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          <span className={`font-bold text-sm ${commission > 0 ? 'text-emerald-600' : 'text-gray-300'}`}>
            ${fmt(commissionAmount(
              editing ? parseFloat(edit.price.replace(',', '.')) || 0 : row.price,
              editing ? parseFloat(edit.commissionRate.replace(',', '.')) || 0 : row.commissionRate,
            ))}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-3 w-28 text-right">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              className="h-7 px-2 text-gray-500"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEdit({ price: String(row.price), commissionRate: String(row.commissionRate) });
              setEditing(true);
            }}
            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-primary"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}

// ── Tableau par catégorie ─────────────────────────────────────────────────────
function ServiceTable({
  rows,
  loading,
  onSave,
  emptyLabel,
}: {
  rows: ServiceRow[];
  loading: boolean;
  onSave: (id: string, col: string, price: number, rate: number) => Promise<void>;
  emptyLabel: string;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span>Chargement…</span>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">{emptyLabel}</p>
      </div>
    );
  }

  const totalCommission = rows.reduce((acc, r) => acc + commissionAmount(r.price, r.commissionRate), 0);

  return (
    <div>
      {/* Résumé */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Services</p>
          <p className="text-xl font-black text-gray-800 mt-0.5">{rows.length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Avec commission</p>
          <p className="text-xl font-black text-primary mt-0.5">{rows.filter(r => r.commissionRate > 0).length}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Commission moy.</p>
          <p className="text-xl font-black text-emerald-600 mt-0.5">
            ${fmt(totalCommission / Math.max(rows.length, 1))}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Service / Produit</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Prix</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Taux affilié</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-bold text-gray-500 uppercase tracking-wider">Commission directe</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <ServiceRowComp key={`${row.collection}-${row.id}`} row={row} onSave={onSave} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AdminCatalogCommissions() {
  const [products,  setProducts]  = useState<ServiceRow[]>([]);
  const [subs,      setSubs]      = useState<ServiceRow[]>([]);
  const [formations,setFormations]= useState<ServiceRow[]>([]);
  const [cards,     setCards]     = useState<ServiceRow[]>([]);
  const [games,     setGames]     = useState<ServiceRow[]>([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodSnap, subsSnap, formSnap, cardSnap, gameSnap] = await Promise.all([
        getDocs(query(collection(db, 'products'),          orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'online_sub_services'))),
        getDocs(query(collection(db, 'formations'),        orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'card_topups'),       orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'games'),             orderBy('createdAt', 'desc'))),
      ]);

      setProducts(prodSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, collection: 'products',
          name: data.name || 'Sans nom',
          price: data.price || 0,
          commissionRate: data.commissionRate || 0,
          extra: data.plans?.length ? `${data.plans.length} plan(s)` : undefined,
        };
      }));

      setSubs(subsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, collection: 'online_sub_services',
          name: data.label || data.name || 'Sans nom',
          price: data.price || 0,
          commissionRate: data.commissionRate || 0,
          extra: data.target ? `Cible: ${data.target}` : undefined,
        };
      }));

      setFormations(formSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, collection: 'formations',
          name: data.title || 'Sans titre',
          price: data.price || 0,
          commissionRate: data.commissionRate || 0,
          extra: data.level ? `Niveau: ${data.level}` : undefined,
        };
      }));

      setCards(cardSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, collection: 'card_topups',
          name: data.name || 'Sans nom',
          price: data.price || 0,
          commissionRate: data.commissionRate || 0,
          extra: data.presets?.length ? `${data.presets.length} preset(s)` : undefined,
        };
      }));

      setGames(gameSnap.docs.map(d => {
        const data = d.data();
        const catalogCount = data.catalog?.length || 0;
        return {
          id: d.id, collection: 'games',
          name: data.name || 'Sans nom',
          price: data.price || 0,
          commissionRate: data.commissionRate || 0,
          extra: catalogCount ? `${catalogCount} option(s) — ${data.priceRange || ''}` : data.priceRange || undefined,
        };
      }));
    } catch (e) {
      toast.error('Erreur de chargement des services');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (id: string, col: string, price: number, rate: number) => {
    await updateDoc(doc(db, col, id), { price, commissionRate: rate });
    // Mettre à jour localement
    const update = (rows: ServiceRow[], setter: React.Dispatch<React.SetStateAction<ServiceRow[]>>) => {
      setter(rows.map(r => r.id === id && r.collection === col ? { ...r, price, commissionRate: rate } : r));
    };
    if (col === 'products')           update(products,   setProducts);
    else if (col === 'online_sub_services') update(subs, setSubs);
    else if (col === 'formations')    update(formations, setFormations);
    else if (col === 'card_topups')   update(cards,      setCards);
    else if (col === 'games')         update(games,      setGames);
    toast.success('Enregistré ✓');
  };

  const tabs = [
    { value: 'products',   label: 'Produits',      count: products.length,   color: 'bg-blue-100 text-blue-700',    rows: products,   empty: 'Aucun produit trouvé.' },
    { value: 'subs',       label: 'Abonnements',   count: subs.length,       color: 'bg-purple-100 text-purple-700',rows: subs,       empty: 'Aucun service en ligne trouvé.' },
    { value: 'formations', label: 'Formations',    count: formations.length, color: 'bg-amber-100 text-amber-700',  rows: formations, empty: 'Aucune formation trouvée.' },
    { value: 'cards',      label: 'Recharges',     count: cards.length,      color: 'bg-emerald-100 text-emerald-700', rows: cards,   empty: 'Aucune recharge trouvée.' },
    { value: 'games',      label: 'Gaming',        count: games.length,      color: 'bg-rose-100 text-rose-700',    rows: games,      empty: 'Aucun jeu trouvé.' },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Catalogue & Commissions Affiliés</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Définissez le prix et le taux de commission pour chaque service. Le montant est attribué à l'affilié direct lors d'un achat par son filleul.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="border-gray-200 text-gray-600 hover:text-primary hover:border-primary"
        >
          Actualiser
        </Button>
      </div>

      {/* Bandeau explicatif */}
      <div className="bg-gradient-to-r from-primary/5 to-emerald-50 border border-primary/10 rounded-xl p-4 flex gap-3 items-start">
        <Percent className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <div className="text-sm text-gray-700">
          <strong className="text-primary">Comment ça fonctionne :</strong>{' '}
          Pour chaque service, définissez un <strong>taux de commission (%)</strong>. Quand un filleul achète ce service,
          l'affilié direct reçoit automatiquement ce pourcentage du prix. Les niveaux 2 et 3 (parrain, grand-parrain)
          continuent à recevoir leurs parts telles que configurées dans les <em>Paramètres Généraux</em>.
        </div>
      </div>

      {/* Onglets par catégorie */}
      <Card className="shadow-sm border-gray-200">
        <Tabs defaultValue="products">
          <div className="px-4 pt-4 border-b border-gray-100">
            <TabsList className="bg-transparent h-auto p-0 gap-2 flex-wrap">
              {tabs.map(tab => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="h-9 rounded-lg border border-transparent data-[state=active]:border-primary/20 data-[state=active]:bg-primary/5 data-[state=active]:text-primary text-gray-500 px-3 gap-2 text-sm font-medium"
                >
                  {tab.label}
                  <CategoryBadge label={String(tab.count)} color={tab.color} />
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <CardContent className="p-0">
            {tabs.map(tab => (
              <TabsContent key={tab.value} value={tab.value} className="mt-0">
                <ServiceTable
                  rows={tab.rows}
                  loading={loading}
                  onSave={handleSave}
                  emptyLabel={tab.empty}
                />
              </TabsContent>
            ))}
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
