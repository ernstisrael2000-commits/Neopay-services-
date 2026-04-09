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
