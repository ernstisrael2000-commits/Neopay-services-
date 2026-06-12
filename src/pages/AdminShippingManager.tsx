import { useState } from 'react';
import { useShippingConfigs, saveShippingConfig } from '../services/parcelService';
import { ShippingConfig } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Plus, Trash2, ExternalLink, Video, MapPin, MessageCircle, Save } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'sonner';

const generateId = () => Math.random().toString(36).substr(2, 9);

export default function AdminShippingManager() {
  const { user } = useAuth();
  const { configs, loading } = useShippingConfigs();
  const [saving, setSaving] = useState(false);

  const getConfigByType = (type: 'online_purchase' | 'dropshipping') => {
    return configs.find(c => c.type === type) || {
      type,
      addresses: [],
      websites: [],
      videos: [],
      whatsappNumber: '+50944813185',
      whatsappMessage: type === 'online_purchase' ? 'Bonjour, je suis intéressé par l\'achat en ligne, pouvez-vous m\'assister ?' : 'Bonjour, je suis intéressé par le drop shipping.',
    };
  };

  const [editOnline, setEditOnline] = useState<Partial<ShippingConfig> | null>(null);
  const [editDrop, setEditDrop] = useState<Partial<ShippingConfig> | null>(null);

  const startEditing = (type: 'online_purchase' | 'dropshipping') => {
    const config = getConfigByType(type);
    if (type === 'online_purchase') setEditOnline(config);
    else setEditDrop(config);
  };

  const handleSave = async (type: 'online_purchase' | 'dropshipping') => {
    const data = type === 'online_purchase' ? editOnline : editDrop;
    if (!data) return;

    setSaving(true);
    try {
      await saveShippingConfig(data);
      toast.success('Configuration sauvegardée avec succès');
      if (type === 'online_purchase') setEditOnline(null);
      else setEditDrop(null);
    } catch (error: any) {
      console.error('Erreur sauvegarde shipping:', error);
      toast.error(`Erreur lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  const addItem = (type: 'online_purchase' | 'dropshipping', field: 'addresses' | 'websites' | 'videos') => {
    const setter = type === 'online_purchase' ? setEditOnline : setEditDrop;
    const current = type === 'online_purchase' ? editOnline : editDrop;
    if (!current) return;

    const newItem = field === 'addresses' 
      ? { id: generateId(), city: '', text: '' }
      : field === 'websites'
      ? { id: generateId(), name: '', url: '' }
      : { id: generateId(), title: '', url: '' };

    setter({
      ...current,
      [field]: [...(current[field] as any[] || []), newItem]
    });
  };

  const removeItem = (type: 'online_purchase' | 'dropshipping', field: 'addresses' | 'websites' | 'videos', id: string) => {
    const setter = type === 'online_purchase' ? setEditOnline : setEditDrop;
    const current = type === 'online_purchase' ? editOnline : editDrop;
    if (!current) return;

    setter({
      ...current,
      [field]: (current[field] as any[]).filter(item => item.id !== id)
    });
  };

  const updateItem = (type: 'online_purchase' | 'dropshipping', field: 'addresses' | 'websites' | 'videos', id: string, updates: any) => {
    const setter = type === 'online_purchase' ? setEditOnline : setEditDrop;
    const current = type === 'online_purchase' ? editOnline : editDrop;
    if (!current) return;

    setter({
      ...current,
      [field]: (current[field] as any[]).map(item => item.id === id ? { ...item, ...updates } : item)
    });
  };

  const ADMIN_EMAILS = ['ernstisrael2000@gmail.com', 'ernstisrael508@gmail.com'];

  if (loading) return <div className="p-8 text-center text-gray-500">Chargement des configurations...</div>;

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion du Shipping</h1>
          <p className="text-gray-500">Configurez les options Achat en ligne et Drop shipping.</p>
          {user && !ADMIN_EMAILS.includes(user.email || '') && (
            <p className="text-red-500 text-sm mt-2 font-medium">
              Note: Connecté en tant que {user.email}. Seuls les administrateurs autorisés peuvent modifier ces réglages.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ONLINE PURCHASE */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="bg-accent-light/50">
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Achat en ligne
            </CardTitle>
            <CardDescription>Gérez les adresses, sites et vidéos pour les achats en ligne.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {!editOnline ? (
              <Button onClick={() => startEditing('online_purchase')} className="w-full">Modifier Achat en ligne</Button>
            ) : (
              <div className="space-y-6">
                {/* WHATSAPP */}
                <div className="space-y-3">
                  <Label>WhatsApp Contact</Label>
                  <Input 
                    value={editOnline.whatsappNumber} 
                    onChange={e => setEditOnline({...editOnline, whatsappNumber: e.target.value})}
                    placeholder="Numéro WhatsApp"
                  />
                  <Input 
                    value={editOnline.whatsappMessage} 
                    onChange={e => setEditOnline({...editOnline, whatsappMessage: e.target.value})}
                    placeholder="Message WhatsApp"
                  />
                </div>

                {/* ADDRESSES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Adresses</Label>
                    <Button variant="ghost" size="sm" onClick={() => addItem('online_purchase', 'addresses')}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {editOnline.addresses?.map(addr => (
                    <div key={addr.id} className="space-y-2 p-3 bg-accent-light/30 rounded-lg border border-primary/20">
                      <div className="flex gap-2">
                        <Input 
                          value={addr.city || ''} 
                          onChange={e => updateItem('online_purchase', 'addresses', addr.id, { city: e.target.value })} 
                          placeholder="Ville (ex: Miami, Florida)" 
                          className="font-bold"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeItem('online_purchase', 'addresses', addr.id)} className="text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input 
                        value={addr.text} 
                        onChange={e => updateItem('online_purchase', 'addresses', addr.id, { text: e.target.value })} 
                        placeholder="Adresse complète" 
                      />
                    </div>
                  ))}
                </div>

                {/* WEBSITES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Sites Web partenaires</Label>
                    <Button variant="ghost" size="sm" onClick={() => addItem('online_purchase', 'websites')}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {editOnline.websites?.map(site => (
                    <div key={site.id} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                      <Input value={site.name} onChange={e => updateItem('online_purchase', 'websites', site.id, { name: e.target.value })} placeholder="Nom du site" />
                      <div className="flex gap-2">
                        <Input value={site.url} onChange={e => updateItem('online_purchase', 'websites', site.id, { url: e.target.value })} placeholder="URL du site" />
                        <Button variant="ghost" size="icon" onClick={() => removeItem('online_purchase', 'websites', site.id)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* VIDEOS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Vidéos d'instruction</Label>
                    <Button variant="ghost" size="sm" onClick={() => addItem('online_purchase', 'videos')}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {editOnline.videos?.map(video => (
                    <div key={video.id} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                      <Input value={video.title} onChange={e => updateItem('online_purchase', 'videos', video.id, { title: e.target.value })} placeholder="Titre de la vidéo" />
                      <div className="flex gap-2">
                        <Input value={video.url} onChange={e => updateItem('online_purchase', 'videos', video.id, { url: e.target.value })} placeholder="URL (YouTube/Vimeo)" />
                        <Button variant="ghost" size="icon" onClick={() => removeItem('online_purchase', 'videos', video.id)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setEditOnline(null)}>Annuler</Button>
                  <Button className="flex-1" onClick={() => handleSave('online_purchase')} disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                    <Save className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* DROP SHIPPING */}
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="bg-accent-light/50">
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-primary" />
              Drop Shipping
            </CardTitle>
            <CardDescription>Gérez les informations spécifiques au dropshipping.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {!editDrop ? (
              <Button onClick={() => startEditing('dropshipping')} className="w-full">Modifier Drop Shipping</Button>
            ) : (
              <div className="space-y-6">
                {/* WHATSAPP */}
                <div className="space-y-3">
                  <Label>WhatsApp Contact</Label>
                  <Input 
                    value={editDrop.whatsappNumber} 
                    onChange={e => setEditDrop({...editDrop, whatsappNumber: e.target.value})}
                    placeholder="Numéro WhatsApp"
                  />
                  <Input 
                    value={editDrop.whatsappMessage} 
                    onChange={e => setEditDrop({...editDrop, whatsappMessage: e.target.value})}
                    placeholder="Message WhatsApp"
                  />
                </div>

                {/* ADDRESSES */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Adresses Drop Shipping</Label>
                    <Button variant="ghost" size="sm" onClick={() => addItem('dropshipping', 'addresses')}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {editDrop.addresses?.map(addr => (
                    <div key={addr.id} className="space-y-2 p-3 bg-accent-light/30 rounded-lg border border-primary/20">
                      <div className="flex gap-2">
                        <Input 
                          value={addr.city || ''} 
                          onChange={e => updateItem('dropshipping', 'addresses', addr.id, { city: e.target.value })} 
                          placeholder="Ville" 
                          className="font-bold"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeItem('dropshipping', 'addresses', addr.id)} className="text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <Input 
                        value={addr.text} 
                        onChange={e => updateItem('dropshipping', 'addresses', addr.id, { text: e.target.value })} 
                        placeholder="Adresse complète" 
                      />
                    </div>
                  ))}
                </div>

                {/* VIDEOS */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Vidéos Drop Shipping</Label>
                    <Button variant="ghost" size="sm" onClick={() => addItem('dropshipping', 'videos')}>
                      <Plus className="h-4 w-4 mr-1" /> Ajouter
                    </Button>
                  </div>
                  {editDrop.videos?.map(video => (
                    <div key={video.id} className="space-y-2 p-3 bg-gray-50 rounded-lg">
                      <Input value={video.title} onChange={e => updateItem('dropshipping', 'videos', video.id, { title: e.target.value })} placeholder="Titre de la vidéo" />
                      <div className="flex gap-2">
                        <Input value={video.url} onChange={e => updateItem('dropshipping', 'videos', video.id, { url: e.target.value })} placeholder="URL" />
                        <Button variant="ghost" size="icon" onClick={() => removeItem('dropshipping', 'videos', video.id)} className="text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button variant="outline" className="flex-1" onClick={() => setEditDrop(null)}>Annuler</Button>
                  <Button className="flex-1" onClick={() => handleSave('dropshipping')} disabled={saving}>
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                    <Save className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
