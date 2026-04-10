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
  Trash,
  Settings as SettingsIcon,
  LayoutGrid,
  Image as ImageIcon,
  Edit,
  PlusCircle,
  Wallet,
  Users
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useParcels, saveParcel, uploadProof, deleteParcel, useProducts, saveProduct, deleteProduct, useSettings, updateSettings, uploadLogo } from '../services/parcelService';
import { useAllAffiliates, useAllWithdrawals, saveAffiliate, updateWithdrawalStatus, deleteAffiliate, useAllAffiliateRequests, updateAffiliateRequestStatus } from '../services/affiliateService';
import { Parcel, ParcelStatus, PaymentStatus, Product, AppSettings, Affiliate, WithdrawalRequest, AffiliateRequest } from '../types';
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

export default function AdminDashboard() {
  const { parcels, loading: parcelsLoading } = useParcels();
  const { products, loading: productsLoading } = useProducts();
  const { settings, loading: settingsLoading } = useSettings();
  const { affiliates, loading: affiliatesLoading } = useAllAffiliates();
  const { withdrawals: allWithdrawals, loading: allWithdrawalsLoading } = useAllWithdrawals();
  const { requests: affiliateRequests, loading: affiliateRequestsLoading } = useAllAffiliateRequests();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [parcelToDelete, setParcelToDelete] = useState<Parcel | null>(null);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isProductDeleteDialogOpen, setIsProductDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  const [isAffiliateDialogOpen, setIsAffiliateDialogOpen] = useState(false);
  const [isAffiliateDeleteDialogOpen, setIsAffiliateDeleteDialogOpen] = useState(false);
  const [affiliateToDelete, setAffiliateToDelete] = useState<Affiliate | null>(null);
  const [editingAffiliate, setEditingAffiliate] = useState<Affiliate | null>(null);
  const [affiliateFormData, setAffiliateFormData] = useState<Partial<Affiliate>>({
    name: '',
    username: '',
    password: '',
    code: '',
    balance: 0,
    referredClients: 0,
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
    whatsappMessage: ''
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

  const handleOpenProductDialog = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setProductFormData(product);
    } else {
      setEditingProduct(null);
      setProductFormData({
        name: '',
        image: '',
        description: '',
        price: '',
        whatsappMessage: ''
      });
    }
    setIsProductDialogOpen(true);
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

  const handleSaveAffiliate = async () => {
    if (!affiliateFormData.name || !affiliateFormData.username || !affiliateFormData.password || !affiliateFormData.code) {
      toast.error("Veuillez remplir tous les champs.");
      return;
    }

    setIsSaving(true);
    try {
      await saveAffiliate(affiliateFormData, editingAffiliate?.id);
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
    setIsAffiliateDeleteDialogOpen(true);
  };

  const handleConfirmAffiliateDelete = async () => {
    if (!affiliateToDelete?.id) return;
    setIsDeleting(true);
    try {
      await deleteAffiliate(affiliateToDelete.id);
      toast.success("Affilié supprimé avec succès.");
      setIsAffiliateDeleteDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
      setAffiliateToDelete(null);
    }
  };

  const handleWithdrawalAction = async (request: WithdrawalRequest, status: 'approved' | 'rejected') => {
    let reason = '';
    if (status === 'rejected') {
      reason = window.prompt("Raison du rejet :") || '';
      if (!reason) return;
    }

    try {
      await updateWithdrawalStatus(request.id!, status, reason);
      toast.success(`Demande ${status === 'approved' ? 'approuvée' : 'rejetée'} !`);
      
      // WhatsApp notification
      const message = status === 'approved' 
        ? `Félicitations ${request.affiliateName} ! Votre demande de retrait de ${request.amount} Goud via ${request.method} a été APPROUVÉE.`
        : `Désolé ${request.affiliateName}, votre demande de retrait de ${request.amount} Goud a été REJETÉE.\n\nRaison: ${reason}`;
      
      alert(`Message à envoyer à l'affilié :\n\n${message}`);
      
    } catch (error) {
      console.error(error);
      toast.error("Erreur lors de la mise à jour du statut.");
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
          referredClients: 0
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Administration Neopay</h1>
        <p className="text-gray-500">Gérez les colis, les produits et les paramètres du site.</p>
      </div>

      <Tabs defaultValue="parcels" className="space-y-6">
        <TabsList className="bg-white border p-1 rounded-xl h-auto flex flex-wrap gap-2">
          <TabsTrigger value="parcels" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2 px-4 flex items-center gap-2">
            <Package className="h-4 w-4" />
            Colis
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2 px-4 flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" />
            Produits / Services
          </TabsTrigger>
          <TabsTrigger value="affiliates" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2 px-4 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Affiliés
          </TabsTrigger>
          <TabsTrigger value="settings" className="rounded-lg data-[state=active]:bg-blue-600 data-[state=active]:text-white py-2 px-4 flex items-center gap-2">
            <SettingsIcon className="h-4 w-4" />
            Paramètres
          </TabsTrigger>
        </TabsList>

        <TabsContent value="parcels" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Gestion des Colis</h2>
            <Button onClick={() => handleOpenDialog()} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Nouveau Colis
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        </TabsContent>

        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Gestion des Produits / Services</h2>
            <Button onClick={() => handleOpenProductDialog()} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
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
                                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/neopay/100/100';
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-semibold">{product.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                              {product.price}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                            {product.description}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button variant="ghost" size="sm" onClick={() => handleOpenProductDialog(product)}>
                                <Edit2 className="h-4 w-4 text-gray-500" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                setProductToDelete(product);
                                setIsProductDeleteDialogOpen(true);
                              }}>
                                <Trash2 className="h-4 w-4 text-red-500" />
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

        <TabsContent value="affiliates" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Gestion des Affiliés</h2>
            <Button onClick={() => {
              setEditingAffiliate(null);
              setAffiliateFormData({ 
                name: '', 
                username: '', 
                password: '', 
                code: '',
                balance: 0,
                referredClients: 0
              });
              setIsAffiliateDialogOpen(true);
            }} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
              <PlusCircle className="h-4 w-4" />
              Nouvel Affilié
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b bg-gray-50/50">
                  <CardTitle className="text-lg font-semibold">Liste des Affiliés</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {affiliatesLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                      <Loader2 className="h-8 w-8 animate-spin mb-2" />
                      <p>Chargement des affiliés...</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/50">
                            <TableHead>Nom</TableHead>
                            <TableHead>Code</TableHead>
                            <TableHead>Solde</TableHead>
                            <TableHead>Référés</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {affiliates.map((a) => (
                            <TableRow key={a.id} className="hover:bg-gray-50/50 transition-colors">
                              <TableCell className="font-medium">{a.name}</TableCell>
                              <TableCell className="font-mono text-xs">{a.code}</TableCell>
                              <TableCell>{a.balance} Goud</TableCell>
                              <TableCell>{a.referredClients}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button variant="ghost" size="sm" onClick={() => {
                                    setEditingAffiliate(a);
                                    setAffiliateFormData(a);
                                    setIsAffiliateDialogOpen(true);
                                  }}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleOpenAffiliateDeleteDialog(a)}>
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                          {affiliates.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="h-32 text-center text-gray-400">
                                Aucun affilié trouvé.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b bg-gray-50/50">
                  <CardTitle className="text-lg font-semibold">Demandes d'Inscription</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {affiliateRequestsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : affiliateRequests.filter(r => r.status === 'pending').length > 0 ? (
                    affiliateRequests.filter(r => r.status === 'pending').map((r) => (
                      <div key={r.id} className="p-4 rounded-xl border bg-blue-50/30 border-blue-100 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-blue-900">{r.name}</p>
                            <p className="text-xs text-gray-500">{r.email}</p>
                            <p className="text-xs text-gray-500">{r.phone}</p>
                          </div>
                          <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">Nouveau</Badge>
                        </div>
                        {r.message && (
                          <p className="text-xs text-gray-600 bg-white p-2 rounded border italic">
                            "{r.message}"
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 bg-blue-600 hover:bg-blue-700 h-8"
                            onClick={() => handleAffiliateRequestAction(r, 'approved')}
                          >
                            Approuver
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 h-8 border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleAffiliateRequestAction(r, 'rejected')}
                          >
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Aucune demande d'inscription.</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm border-gray-200">
                <CardHeader className="border-b bg-gray-50/50">
                  <CardTitle className="text-lg font-semibold">Demandes de Retrait</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  {allWithdrawalsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                    </div>
                  ) : allWithdrawals.filter(w => w.status === 'pending').length > 0 ? (
                    allWithdrawals.filter(w => w.status === 'pending').map((w) => (
                      <div key={w.id} className="p-4 rounded-xl border bg-gray-50 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">{w.affiliateName}</p>
                            <p className="text-xs text-gray-500">Code: {w.affiliateCode}</p>
                          </div>
                          <Badge className="bg-blue-100 text-blue-700">{w.amount} Goud</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <Wallet className="h-3 w-3" />
                          <span>{w.method}</span>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            className="flex-1 bg-green-600 hover:bg-green-700 h-8"
                            onClick={() => handleWithdrawalAction(w, 'approved')}
                          >
                            Approuver
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="flex-1 h-8"
                            onClick={() => handleWithdrawalAction(w, 'rejected')}
                          >
                            Rejeter
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">Aucune demande en attente.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <h2 className="text-xl font-bold">Paramètres du Site</h2>
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Identité Visuelle</CardTitle>
              <CardDescription>Gérez le logo de votre plateforme Neopay.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <Label>Logo du site</Label>
                <div className="flex items-center gap-6">
                  <div className="h-24 w-24 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-100 overflow-hidden">
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
                  <div className="space-y-2">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleLogoUpload}
                      className="hidden" 
                      id="logo-upload"
                    />
                    <Button asChild variant="outline" disabled={uploading}>
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Changer le logo
                      </label>
                    </Button>
                    {uploading && (
                      <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full transition-all duration-300" 
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                    <p className="text-xs text-gray-500">Format recommandé: PNG ou SVG, fond transparent.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Lien du logo (externe)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="https://..." 
                      value={tempLogoUrl} 
                      onChange={(e) => setTempLogoUrl(e.target.value)}
                    />
                    <Button 
                      onClick={() => {
                        if (tempLogoUrl) {
                          updateSettings({ logoUrl: tempLogoUrl });
                          setTempLogoUrl('');
                          toast.success("Lien du logo appliqué !");
                        }
                      }}
                      className="bg-blue-600"
                    >
                      Ajouter
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t">
                  <Label>Numéro WhatsApp Admin (pour notifications)</Label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="+509..." 
                      value={settings?.whatsappAdminNumber || ''} 
                      onChange={(e) => updateSettings({ whatsappAdminNumber: e.target.value })}
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Ce numéro recevra les demandes de retrait des affiliés.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Affiliate Edit/Add Dialog */}
      <Dialog open={isAffiliateDialogOpen} onOpenChange={setIsAffiliateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingAffiliate ? 'Modifier l\'affilié' : 'Nouvel affilié'}</DialogTitle>
            <DialogDescription>
              Gérez les identifiants et les informations de l'affilié.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nom Complet</Label>
              <Input 
                value={affiliateFormData.name} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, name: e.target.value})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Username</Label>
              <Input 
                value={affiliateFormData.username} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, username: e.target.value})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Password</Label>
              <Input 
                value={affiliateFormData.password} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, password: e.target.value})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Code</Label>
              <Input 
                value={affiliateFormData.code} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, code: e.target.value})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Solde (Goud)</Label>
              <Input 
                type="number"
                value={affiliateFormData.balance} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, balance: Number(e.target.value)})}
                className="col-span-3" 
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Clients Parrainés</Label>
              <Input 
                type="number"
                value={affiliateFormData.referredClients} 
                onChange={(e) => setAffiliateFormData({...affiliateFormData, referredClients: Number(e.target.value)})}
                className="col-span-3" 
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAffiliateDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveAffiliate} disabled={isSaving} className="bg-blue-600">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Affiliate Delete Confirmation Dialog */}
      <Dialog open={isAffiliateDeleteDialogOpen} onOpenChange={setIsAffiliateDeleteDialogOpen}>
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
            <Button variant="outline" onClick={() => setIsAffiliateDeleteDialogOpen(false)} disabled={isDeleting}>
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

      {/* Product Edit/Add Dialog */}
      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Modifier le produit' : 'Nouveau produit'}</DialogTitle>
            <DialogDescription>Ajoutez un service ou un produit dynamique à votre plateforme.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Nom</Label>
              <Input 
                value={productFormData.name} 
                onChange={(e) => setProductFormData({...productFormData, name: e.target.value})}
                className="col-span-3" 
                placeholder="Ex: Netflix Premium 1 Mois"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Prix</Label>
              <Input 
                value={productFormData.price} 
                onChange={(e) => setProductFormData({...productFormData, price: e.target.value})}
                className="col-span-3" 
                placeholder="Ex: 1500 HTG"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Description</Label>
              <textarea 
                value={productFormData.description} 
                onChange={(e) => setProductFormData({...productFormData, description: e.target.value})}
                className="col-span-3 flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Détails du service..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Msg WhatsApp</Label>
              <Input 
                value={productFormData.whatsappMessage} 
                onChange={(e) => setProductFormData({...productFormData, whatsappMessage: e.target.value})}
                className="col-span-3" 
                placeholder="Message auto personnalisé..."
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Image (Lien)</Label>
              <div className="col-span-3 flex gap-2">
                <Input 
                  value={tempProductImageUrl} 
                  onChange={(e) => setTempProductImageUrl(e.target.value)}
                  placeholder="https://exemple.com/image.jpg"
                />
                <Button 
                  onClick={() => {
                    if (tempProductImageUrl) {
                      setProductFormData({...productFormData, image: tempProductImageUrl});
                      setTempProductImageUrl('');
                      toast.success("Lien d'image appliqué !");
                    }
                  }}
                  className="bg-blue-600"
                >
                  Ajouter
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Image (Fichier)</Label>
              <div className="col-span-3 space-y-4">
                {productFormData.image && (
                  <div className="relative h-48 w-full rounded-xl overflow-hidden border bg-gray-50">
                    <img 
                      src={productFormData.image} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/neopay/400/400';
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
                      <label htmlFor="product-image-upload">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        Télécharger l'image
                      </label>
                    </Button>
                  </div>
                  {uploading && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300" 
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsProductDialogOpen(false)}>Annuler</Button>
            <Button onClick={handleSaveProduct} disabled={isSaving} className="bg-blue-600 hover:bg-blue-700">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Enregistrer
            </Button>
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
              <Label className="text-right">Preuve (Lien)</Label>
              <div className="col-span-3 flex gap-2">
                <Input 
                  value={tempProofUrl} 
                  onChange={(e) => setTempProofUrl(e.target.value)}
                  placeholder="Lien de l'image de preuve..."
                />
                <Button 
                  onClick={() => {
                    if (tempProofUrl) {
                      setFormData({...formData, proofOfDelivery: tempProofUrl});
                      setTempProofUrl('');
                      toast.success("Lien de preuve appliqué !");
                    }
                  }}
                  className="bg-blue-600"
                >
                  Ajouter
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Preuve (Fichier)</Label>
              <div className="col-span-3 space-y-2">
                {formData.proofOfDelivery && (
                  <div className="relative group rounded-lg overflow-hidden border h-48 bg-gray-50">
                    <img 
                      src={formData.proofOfDelivery} 
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/neopay/400/400';
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
                      <label htmlFor="file-upload">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                        {formData.proofOfDelivery ? 'Changer l\'image' : 'Télécharger une preuve'}
                      </label>
                    </Button>
                  </div>
                  {uploading && (
                    <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-300" 
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
