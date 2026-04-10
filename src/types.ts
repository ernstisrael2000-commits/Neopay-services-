export type ParcelStatus = 'En route' | 'En transit' | 'Arrivé' | 'Livré';
export type PaymentStatus = 'Payé' | 'Non payé';

export interface Parcel {
  id?: string;
  trackingNumber: string;
  status: ParcelStatus;
  currentLocation: string;
  estimatedArrival?: string;
  proofOfDelivery?: string;
  paymentStatus: PaymentStatus;
  createdAt: any;
  updatedAt: any;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin';
}

export interface Product {
  id?: string;
  name: string;
  image: string;
  description: string;
  price: string;
  whatsappMessage?: string;
  createdAt: any;
}

export interface Affiliate {
  id?: string;
  username: string;
  password: string; // Manually provided by admin
  name: string;
  balance: number;
  referredClients: number;
  code: string;
  createdAt: any;
}

export interface WithdrawalRequest {
  id?: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amount: number;
  method: 'MonCash' | 'Natcash';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AppSettings {
  logoUrl?: string;
  whatsappAdminNumber?: string;
}
