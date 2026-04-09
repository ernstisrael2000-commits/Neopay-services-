import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Package, 
  MoreVertical, 
  CheckCircle2, 
  Truck, 
  Clock, 
  AlertCircle,
  Loader2,
  Upload,
  Trash
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from './ui/dialog';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useParcels, saveParcel, uploadProof, deleteParcel } from '../services/parcelService';
import { Parcel, ParcelStatus, PaymentStatus } from '../types';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

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
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
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

export default function AdminDashboard() {
  const { parcels, loading } = useParcels();
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelToDelete, setParcelToDelete] = useState<Parcel | null>(null);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form State
  const [formData, setFormData] = useState<Partial<Parcel>>({
    trackingNumber: '',
    status: 'En route',
    currentLocation: '',
    estimatedArrival: '',
    paymentStatus: 'Non payé',
    proofOfDelivery: ''
  });

  const filteredParcels = parcels.filter(p => 
    p.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.currentLocation.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleSave = async () => {
    if (!formData.trackingNumber || !formData.currentLocation) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }

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
    try {
      // Compress image before upload
      const compressedBlob = await compressImage(file);
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });
      
      const url = await uploadProof(compressedFile, formData.trackingNumber!);
      setFormData(prev => ({ ...prev, proofOfDelivery: url }));
      toast.success("Image téléchargée et optimisée !");
    } catch (error) {
      console.error(error);
      toast.error("Échec du téléchargement de l'image.");
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Livré': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'Arrivé': return <Package className="h-4 w-4 text-blue-500" />;
      case 'En transit': return <Truck className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gestion des Colis</h1>
          <p className="text-gray-500">Gérez, suivez et mettez à jour les expéditions Neopay.</p>
        </div>
        <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nouveau Colis
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 uppercase">Total Colis</p>
                <p className="text-3xl font-bold text-blue-900">{parcels.length}</p>
              </div>
              <Package className="h-8 w-8 text-blue-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 border-amber-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-600 uppercase">En Transit</p>
                <p className="text-3xl font-bold text-amber-900">
                  {parcels.filter(p => p.status === 'En transit' || p.status === 'En route').length}
                </p>
              </div>
              <Truck className="h-8 w-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-100">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 uppercase">Livrés</p>
                <p className="text-3xl font-bold text-green-900">
                  {parcels.filter(p => p.status === 'Livré').length}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-gray-200">
        <CardHeader className="border-b bg-gray-50/50 flex flex-row items-center justify-between space-y-0 py-4">
          <CardTitle className="text-lg font-semibold">Liste des expéditions</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input 
              placeholder="Rechercher..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
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
                      <TableCell className="font-mono font-medium text-blue-600">
                        {parcel.trackingNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tracking" className="text-right">N° Suivi</Label>
              <Input 
                id="tracking" 
                value={formData.trackingNumber} 
                onChange={(e) => setFormData({...formData, trackingNumber: e.target.value})}
                className="col-span-3 font-mono" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="status" className="text-right">Statut</Label>
              <div className="col-span-3">
                <Select 
                  value={formData.status} 
                  onValueChange={(v: ParcelStatus) => setFormData({...formData, status: v})}
                >
                  <SelectTrigger>
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
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="location" className="text-right">Lieu</Label>
              <Input 
                id="location" 
                value={formData.currentLocation} 
                onChange={(e) => setFormData({...formData, currentLocation: e.target.value})}
                className="col-span-3" 
                placeholder="Ex: Miami, USA"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="arrival" className="text-right">Arrivée Est.</Label>
              <Input 
                id="arrival" 
                type="date"
                value={formData.estimatedArrival} 
                onChange={(e) => setFormData({...formData, estimatedArrival: e.target.value})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="payment" className="text-right">Paiement</Label>
              <div className="col-span-3">
                <Select 
                  value={formData.paymentStatus} 
                  onValueChange={(v: PaymentStatus) => setFormData({...formData, paymentStatus: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Statut paiement" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Payé">Payé</SelectItem>
                    <SelectItem value="Non payé">Non payé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Preuve</Label>
              <div className="col-span-3 space-y-2">
                {formData.proofOfDelivery && (
                  <div className="relative group rounded-lg overflow-hidden border h-24">
                    <img src={formData.proofOfDelivery} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Button variant="destructive" size="sm" onClick={() => setFormData({...formData, proofOfDelivery: ''})}>Supprimer</Button>
                    </div>
                  </div>
                )}
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
                    <label htmlFor="file-upload">
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                      {formData.proofOfDelivery ? 'Changer l\'image' : 'Télécharger une preuve'}
                    </label>
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
