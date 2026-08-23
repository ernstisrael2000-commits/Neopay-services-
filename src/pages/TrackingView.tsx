import React, { useState, useEffect } from 'react';
import { Search, Loader2, Package, MapPin, Calendar, CreditCard, Image as ImageIcon, CheckCircle2, Clock } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
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
      case 'Arrivé': return 'bg-accent-light text-primary border-accent-light/50';
      case 'En transit': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-muted text-subtext border-muted-foreground/20';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Search Section with Background Image */}
      <div className="relative py-20 px-4 overflow-hidden">
        {/* Background Image Layer with Animation */}
        <motion.div 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 20, repeat: Infinity, repeatType: "reverse", ease: "linear" }}
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: 'url("https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop")',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Blur and Dark Overlay */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-[3px]" />
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <motion.h1 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-5xl font-extrabold text-white mb-4 leading-tight drop-shadow-lg"
            >
              Suivez votre colis en temps réel
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-base sm:text-xl text-accent-light font-medium drop-shadow-md"
            >
              Entrez votre numéro de suivi Solutionpam pour voir l'état actuel de votre livraison.
            </motion.p>
          </div>

          <Card className="shadow-2xl border-0 bg-white/90 backdrop-blur-md mb-0 rounded-2xl overflow-hidden">
            <CardContent className="pt-8 pb-8 px-6 sm:px-10">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-6 w-6 text-subtext" />
                  <Input
                    placeholder="Enter your tracking number"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="pl-12 h-14 text-lg border-muted focus:ring-primary focus:border-primary rounded-2xl bg-white shadow-xl transition-all focus:shadow-2xl"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="h-14 px-10 bg-primary hover:bg-[#1D4ED8] text-white font-bold text-lg rounded-2xl transition-all hover:shadow-xl hover:shadow-primary/20 active:scale-95 shadow-lg shadow-primary/30 border-0"
                >
                  {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : 'Rechercher'}
                </Button>
              </form>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 text-red-600 text-sm font-bold flex items-center gap-2"
                >
                  <Clock className="h-4 w-4" />
                  {error}
                </motion.p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Results Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <AnimatePresence>
          {parcel && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-6"
            >
              <Card className="overflow-hidden border-0 shadow-xl rounded-2xl bg-white">
                <CardHeader className="bg-muted/30 border-b px-6 py-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-2xl font-bold text-dark">Détails de l'expédition</CardTitle>
                      <CardDescription className="font-mono text-primary font-bold mt-1 text-lg">#{parcel.trackingNumber}</CardDescription>
                    </div>
                    <Badge className={`px-4 py-1.5 text-sm font-bold rounded-full border shadow-sm ${getStatusColor(parcel.status)}`}>
                      {parcel.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x border-b">
                    <div className="p-8 space-y-8">
                      <div className="flex items-start gap-5">
                        <div className="bg-accent-light p-3 rounded-2xl shadow-sm">
                          <MapPin className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-subtext uppercase tracking-widest mb-1">Localisation actuelle</p>
                          <p className="text-xl font-bold text-dark">{parcel.currentLocation}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-5">
                        <div className="bg-purple-100 p-3 rounded-2xl shadow-sm">
                          <Calendar className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-subtext uppercase tracking-widest mb-1">Date estimée d'arrivée</p>
                          <p className="text-xl font-bold text-dark">
                            {parcel.estimatedArrival ? format(new Date(parcel.estimatedArrival), 'PPP', { locale: fr }) : 'Non spécifiée'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-start gap-5">
                        <div className="bg-emerald-100 p-3 rounded-2xl shadow-sm">
                          <CreditCard className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-subtext uppercase tracking-widest mb-1">Statut du paiement</p>
                          <Badge variant={parcel.paymentStatus === 'Payé' ? 'default' : 'destructive'} className="mt-1 font-bold px-3 py-1">
                            {parcel.paymentStatus}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="p-8 bg-muted/20">
                      <p className="text-xs font-bold text-subtext uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Preuve de livraison
                      </p>
                      {parcel.status === 'Livré' && parcel.proofOfDelivery ? (
                        <div className="rounded-2xl overflow-hidden border-2 border-white shadow-2xl group relative bg-white aspect-video flex items-center justify-center">
                          <img 
                            src={parcel.proofOfDelivery} 
                            alt="Preuve de livraison" 
                            className="max-w-full max-h-full object-contain transition-transform duration-500 group-hover:scale-110"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-primary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <Button variant="secondary" className="font-bold shadow-lg" onClick={() => window.open(parcel.proofOfDelivery, '_blank')}>
                              Agrandir l'image
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video rounded-2xl border-2 border-dashed border-muted flex flex-col items-center justify-center text-subtext/40 bg-white shadow-inner">
                          {parcel.status === 'Livré' ? (
                            <>
                              <Loader2 className="h-10 w-10 mb-3 animate-spin text-primary/40 opacity-50" />
                              <p className="text-sm font-medium">Image en cours de traitement...</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-12 w-12 mb-3 opacity-10" />
                              <p className="text-sm font-medium">Disponible après livraison</p>
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
    </div>
  );
}
