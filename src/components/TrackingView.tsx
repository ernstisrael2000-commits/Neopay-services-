import React, { useState, useEffect } from 'react';
import { Search, Loader2, Package, MapPin, Calendar, CreditCard, Image as ImageIcon, CheckCircle2, Clock } from 'lucide-react';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Badge } from './ui/badge';
import { searchParcel } from '../services/parcelService';
import { Parcel } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function TrackingView() {
  const [trackingNumber, setTrackingNumber] = useState('');
  const [parcel, setParcel] = useState<Parcel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingNumber.trim()) return;

    setLoading(true);
    setError('');
    setParcel(null);

    try {
      const result = await searchParcel(trackingNumber.trim());
      if (result) {
        setParcel(result);
      } else {
        setError('Aucun colis trouvé avec ce numéro de suivi.');
      }
    } catch (err) {
      setError('Une erreur est survenue lors de la recherche.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Livré': return 'bg-green-100 text-green-700 border-green-200';
      case 'Arrivé': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'En transit': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-4xl font-extrabold text-gray-900 mb-4"
        >
          Suivez votre colis en temps réel
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-lg text-gray-600"
        >
          Entrez votre numéro de suivi Neopay pour voir l'état actuel de votre livraison.
        </motion.p>
      </div>

      <Card className="shadow-xl border-0 bg-white/50 backdrop-blur-sm mb-8">
        <CardContent className="pt-6">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                placeholder="Ex: NP123456789"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                className="pl-10 h-12 text-lg border-gray-200 focus:ring-blue-500 focus:border-blue-500 rounded-xl"
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading}
              className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all active:scale-95"
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Rechercher'}
            </Button>
          </form>
          {error && <p className="mt-3 text-red-500 text-sm font-medium">{error}</p>}
        </CardContent>
      </Card>

      <AnimatePresence>
        {parcel && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            <Card className="overflow-hidden border-0 shadow-lg">
              <CardHeader className="bg-gray-50/50 border-b">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl text-gray-900">Détails du colis</CardTitle>
                    <CardDescription className="font-mono mt-1">#{parcel.trackingNumber}</CardDescription>
                  </div>
                  <Badge className={`px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(parcel.status)}`}>
                    {parcel.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x">
                  <div className="p-6 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-50 p-2 rounded-lg">
                        <MapPin className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Localisation actuelle</p>
                        <p className="text-lg font-semibold text-gray-900">{parcel.currentLocation}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-purple-50 p-2 rounded-lg">
                        <Calendar className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Date estimée d'arrivée</p>
                        <p className="text-lg font-semibold text-gray-900">
                          {parcel.estimatedArrival ? format(new Date(parcel.estimatedArrival), 'PPP', { locale: fr }) : 'Non spécifiée'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-50 p-2 rounded-lg">
                        <CreditCard className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Statut du paiement</p>
                        <Badge variant={parcel.paymentStatus === 'Payé' ? 'default' : 'destructive'} className="mt-1">
                          {parcel.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-gray-50/30">
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      Preuve de livraison
                    </p>
                    {parcel.status === 'Livré' && parcel.proofOfDelivery ? (
                      <div className="rounded-xl overflow-hidden border shadow-sm group relative">
                        <img 
                          src={parcel.proofOfDelivery} 
                          alt="Preuve de livraison" 
                          className="w-full h-48 object-cover transition-transform group-hover:scale-105"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button variant="secondary" size="sm" onClick={() => window.open(parcel.proofOfDelivery, '_blank')}>
                            Voir en grand
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-48 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 bg-white">
                        {parcel.status === 'Livré' ? (
                          <>
                            <Clock className="h-8 w-8 mb-2 opacity-50" />
                            <p className="text-sm">Image en cours de traitement...</p>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-8 w-8 mb-2 opacity-20" />
                            <p className="text-sm">Disponible après livraison</p>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
