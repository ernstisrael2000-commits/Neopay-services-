import { Package, ShieldCheck, LogIn, LogOut, Search } from 'lucide-react';
import { Button } from './ui/button';
import { auth } from '@/lib/firebase';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { useAuth } from '../hooks/useAuth';

export default function Navbar({ onAdminClick, onHomeClick }: { onAdminClick: () => void, onHomeClick: () => void }) {
  const { user, isAdmin } = useAuth();

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      onHomeClick();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer group"
            onClick={onHomeClick}
          >
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-700 transition-colors">
              <Package className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-gray-900">Neopay</span>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onHomeClick} className="hidden sm:flex items-center gap-2">
              <Search className="h-4 w-4" />
              Suivi
            </Button>
            
            {isAdmin && (
              <Button variant="outline" onClick={onAdminClick} className="flex items-center gap-2 border-blue-200 hover:bg-blue-50 text-blue-700">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Button>
            )}

            {user ? (
              <div className="flex items-center gap-3">
                <img 
                  src={user.photoURL || ''} 
                  alt={user.displayName || ''} 
                  className="h-8 w-8 rounded-full border"
                  referrerPolicy="no-referrer"
                />
                <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-red-600">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button onClick={handleLogin} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Connexion
              </Button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
