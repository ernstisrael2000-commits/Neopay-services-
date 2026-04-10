import React from 'react';
import { motion } from 'motion/react';
import { 
  Package, 
  CreditCard, 
  Gamepad2, 
  Truck, 
  MessageCircle, 
  ArrowRight,
  CheckCircle2,
  Info
} from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { useProducts } from '../services/parcelService';

const WHATSAPP_NUMBER = "+50944813185";

export default function HomeView({ onTrackingClick }: { onTrackingClick: () => void }) {
  const { products, loading: productsLoading } = useProducts();

  const openWhatsApp = (message: string) => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const services = [
    {
      title: "Suivi de colis",
      description: "Suivez l'état de vos colis Neopay en temps réel.",
      icon: <Package className="h-8 w-8 text-blue-600" />,
      action: onTrackingClick,
      buttonText: "Suivre un colis",
      color: "bg-blue-50 border-blue-100"
    },
    {
      title: "Recharge carte",
      description: "Rechargez vos cartes de crédit ou prépayées rapidement.",
      icon: <CreditCard className="h-8 w-8 text-emerald-600" />,
      action: () => openWhatsApp("Bonjour, je souhaite faire une recharge de carte via Neopay."),
      buttonText: "Recharger via WhatsApp",
      color: "bg-emerald-50 border-emerald-100"
    },
    {
      title: "Top-up jeux",
      description: "Créditez vos comptes de jeux préférés instantanément.",
      icon: <Gamepad2 className="h-8 w-8 text-purple-600" />,
      action: () => openWhatsApp("Bonjour, je souhaite faire un top-up de jeu via Neopay."),
      buttonText: "Top-up via WhatsApp",
      color: "bg-purple-50 border-purple-100"
    },
    {
      title: "Shipping",
      description: "Service global d'envoi et de réception de colis.",
      icon: <Truck className="h-8 w-8 text-amber-600" />,
      action: () => openWhatsApp("Bonjour, je souhaite obtenir des informations sur le shipping via Neopay."),
      buttonText: "Infos via WhatsApp",
      color: "bg-amber-50 border-amber-100"
    }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-20">
      {/* Hero Section */}
      <section className="text-center space-y-6">
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-5xl md:text-6xl font-extrabold text-gray-900 tracking-tight"
        >
          Bienvenue sur <span className="text-blue-600">Neopay</span>
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-xl text-gray-600 max-w-2xl mx-auto"
        >
          Votre plateforme complète de services digitaux, logistique et bien plus encore.
        </motion.p>
      </section>

      {/* Services Section */}
      <section className="space-y-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Nos Services</h2>
          <div className="h-1 w-20 bg-blue-600 mx-auto mt-4 rounded-full" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map((service, idx) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card className={`${service.color} border-2 hover:shadow-lg transition-all group h-full flex flex-col`}>
                <CardHeader>
                  <div className="mb-4 group-hover:scale-110 transition-transform duration-300">
                    {service.icon}
                  </div>
                  <CardTitle className="text-xl">{service.title}</CardTitle>
                  <CardDescription className="text-gray-600">
                    {service.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="mt-auto">
                  <Button 
                    onClick={service.action}
                    className="w-full bg-white text-gray-900 border-2 border-transparent hover:border-gray-900 hover:bg-gray-900 hover:text-white transition-all"
                  >
                    {service.buttonText}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Dynamic Products Section */}
      <section className="space-y-10">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">Nos Produits / Services</h2>
          <div className="h-1 w-20 bg-blue-600 mx-auto mt-4 rounded-full" />
        </div>
        
        {productsLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          </div>
        ) : products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-xl transition-shadow h-full flex flex-col">
                  <div className="aspect-video relative overflow-hidden bg-gray-50">
                    <img 
                      src={product.image} 
                      alt={product.name} 
                      className="object-contain w-full h-full hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/neopay/400/400';
                      }}
                    />
                    <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full font-bold text-blue-600 shadow-sm">
                      {product.price}
                    </div>
                  </div>
                  <CardHeader>
                    <CardTitle>{product.name}</CardTitle>
                    <CardDescription className="line-clamp-3">
                      {product.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="mt-auto">
                    <Button 
                      onClick={() => openWhatsApp(product.whatsappMessage || `Bonjour, je suis intéressé par ce service Neopay : ${product.name}. Je souhaite passer commande.`)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Commander via WhatsApp
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <Info className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Aucun produit ou service supplémentaire disponible pour le moment.</p>
          </div>
        )}
      </section>

      {/* Payment Proof Section */}
      <section className="bg-blue-600 rounded-[2rem] p-8 md:p-12 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-blue-500 rounded-full opacity-50 blur-3xl" />
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-blue-700 rounded-full opacity-50 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-4 text-center md:text-left">
            <h2 className="text-3xl font-bold">Paiement et preuve</h2>
            <p className="text-blue-100 text-lg max-w-xl">
              Après avoir effectué votre paiement, veuillez envoyer une capture d'écran via WhatsApp pour validation.
            </p>
          </div>
          <Button 
            onClick={() => openWhatsApp("Bonjour, j'ai effectué mon paiement pour un service Neopay. Voici la preuve.")}
            className="bg-white text-blue-600 hover:bg-blue-50 px-8 h-14 text-lg font-bold rounded-2xl shadow-lg flex items-center gap-3 active:scale-95 transition-all"
          >
            <CheckCircle2 className="h-6 w-6" />
            J'ai effectué mon paiement
          </Button>
        </div>
      </section>
    </div>
  );
}
