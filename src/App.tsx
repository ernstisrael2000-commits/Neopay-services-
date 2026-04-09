import { useState } from 'react';
import Navbar from './components/Navbar';
import TrackingView from './components/TrackingView';
import AdminDashboard from './components/AdminDashboard';
import { Toaster } from './components/ui/sonner';
import { useAuth } from './hooks/useAuth';
import { Loader2, ShieldAlert, Package } from 'lucide-react';

export default function App() {
  const [view, setView] = useState<'client' | 'admin'>('client');
  const { isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">Initialisation de Neopay...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-blue-100 selection:text-blue-900">
      <Navbar 
        onAdminClick={() => setView('admin')} 
        onHomeClick={() => setView('client')} 
      />
      
      <main className="animate-in fade-in duration-500">
        {view === 'client' ? (
          <TrackingView />
        ) : (
          isAdmin ? (
            <AdminDashboard />
          ) : (
            <div className="max-w-md mx-auto mt-20 p-8 text-center bg-white rounded-2xl shadow-sm border">
              <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="h-8 w-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Accès restreint</h2>
              <p className="text-gray-600 mb-6">
                Vous devez être administrateur pour accéder à cette section.
              </p>
              <button 
                onClick={() => setView('client')}
                className="text-blue-600 font-semibold hover:underline"
              >
                Retour au suivi
              </button>
            </div>
          )
        )}
      </main>

      <footer className="py-12 border-t mt-auto bg-white">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-gray-200 p-1.5 rounded-md">
              <Package className="h-5 w-5 text-gray-600" />
            </div>
            <span className="text-xl font-bold text-gray-900">Neopay</span>
          </div>
          <p className="text-gray-500 text-sm">
            © {new Date().getFullYear()} Neopay Logistics. Tous droits réservés.
          </p>
          <div className="flex justify-center gap-6 mt-6 text-sm text-gray-400">
            <a href="#" className="hover:text-gray-600 transition-colors">Confidentialité</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Conditions d'utilisation</a>
            <a href="#" className="hover:text-gray-600 transition-colors">Support</a>
          </div>
        </div>
      </footer>

      <Toaster position="top-right" />
    </div>
  );
}

