export interface OnlineSubService {
  id?: string;
  label: string;
  description: string;
  icon: string;
  target: 'tracking' | 'shipping' | 'url';
  url?: string;
  order: number;
  active: boolean;
  createdAt?: any;
  updatedAt?: any;
}

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
  role: 'admin' | 'agent';
}

export interface Product {
  id?: string;
  name: string;
  image: string;
  description: string;
  price: string;
  stock?: number;
  whatsappMessage?: string;
  plans?: { id: string; name: string; price: string }[];
  allowCustomAmount?: boolean;
  customExchangeRate?: number;
  createdAt: any;
}

export interface CardFeeRule {
  min: number;
  max: number;
  fee: number;
}

export interface CardTopup {
  id?: string;
  name: string;
  image: string;
  description: string;
  price: string;
  stock?: number;
  whatsappMessage?: string;
  goldRate?: number;
  presets?: number[];
  feeRules?: CardFeeRule[];
  createdAt: any;
  updatedAt?: any;
}

export type AffiliateLevel = 'Bronze' | 'Silver' | 'Gold' | 'Elite' | 'VIP';

export type SponsorType = 'direct' | 'indirect';

export interface AdditionalSponsor {
  id: string;
  type: SponsorType;
}

export interface Affiliate {
  id?: string;
  uid?: string;
  email?: string;
  username: string;
  password: string; 
  name: string;
  balance: number;
  referredClients: number;
  monthlyReferredClients: number;
  monthlySales: number;
  points: number;
  isMonthlyWinner?: boolean;
  code: string;
  level: AffiliateLevel;
  parentAffiliateId?: string;
  grandparentAffiliateId?: string;
  additionalSponsors?: AdditionalSponsor[];
  directRevenue: number;
  indirectRevenue: number;
  totalEarnings: number;
  totalWithdrawn?: number;
  commissionBalance?: number;
  walletId?: string;
  commissionWalletId?: string;
  info?: any;
  createdAt: any;
  updatedAt: any;
}

export interface WithdrawalRequest {
  id?: string;
  affiliateId: string;
  affiliateName: string;
  affiliateCode: string;
  amount: number;
  method: 'MonCash' | 'NatCash' | 'Physical';
  accountNumber: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export type TransactionType = 'deposit' | 'withdrawal' | 'transfer_sent' | 'transfer_received' | 'agent_deposit' | 'transfer';
export type TransactionStatus = 'pending' | 'completed' | 'approved' | 'rejected' | 'pending_agent';

export interface Agent {
  id?: string;
  uid?: string;
  email?: string;
  agentCode: string;
  name: string;
  phone: string;
  balance: number;
  commissionBalance?: number;
  walletLocked?: boolean;
  status: 'active' | 'inactive';
  walletId: string;
  createdAt: any;
  updatedAt: any;
}

export interface WalletTransaction {
  id?: string;
  affiliateId: string;
  agentId?: string;
  agentCode?: string;
  type: TransactionType;
  amount: number;
  status: TransactionStatus;
  description?: string;
  relatedAffiliateId?: string;
  relatedAffiliateName?: string;
  recipientWalletId?: string;
  method?: string;
  accountNumber?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AffiliateNotification {
  id?: string;
  affiliateId: string;
  title: string;
  message: string;
  type: 'level_up' | 'bonus' | 'referral' | 'purchase' | 'revenue' | 'prize' | 'system';
  read: boolean;
  createdAt: any;
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

export type PaymentMethodType = 'mobile_money' | 'bank_transfer' | 'crypto' | 'payment_app' | 'card' | 'cash';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;
  icon: string;
  enabled: boolean;
  forDeposit: boolean;
  forWithdrawal: boolean;
  number?: string;
  accountName?: string;
  qrUrl?: string;
  address?: string;
  instructions?: string;
  minAmountUSD?: number;
  maxAmountUSD?: number;
}

export const DEFAULT_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'moncash', name: 'MonCash', type: 'mobile_money', icon: '📱', enabled: true, forDeposit: true, forWithdrawal: true },
  { id: 'natcash', name: 'NatCash', type: 'mobile_money', icon: '💳', enabled: true, forDeposit: true, forWithdrawal: true },
  { id: 'admi', name: 'Admi', type: 'mobile_money', icon: '🏦', enabled: true, forDeposit: true, forWithdrawal: false },
  { id: 'wave', name: 'Wave', type: 'mobile_money', icon: '🌊', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'orange_money', name: 'Orange Money', type: 'mobile_money', icon: '🟠', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'zelle', name: 'Zelle', type: 'payment_app', icon: '💜', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'paypal', name: 'PayPal', type: 'payment_app', icon: '🅿️', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'cashapp', name: 'Cash App', type: 'payment_app', icon: '💚', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'binance', name: 'Binance Pay', type: 'crypto', icon: '🟡', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'usdt_trc20', name: 'USDT TRC20', type: 'crypto', icon: '🔶', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'usdt_bep20', name: 'USDT BEP20', type: 'crypto', icon: '🔷', enabled: false, forDeposit: true, forWithdrawal: true },
  { id: 'carte', name: 'Carte Bancaire', type: 'card', icon: '💳', enabled: false, forDeposit: true, forWithdrawal: false },
  { id: 'virement', name: 'Virement Bancaire', type: 'bank_transfer', icon: '🏛️', enabled: false, forDeposit: true, forWithdrawal: true },
];

// ─── App Settings ─────────────────────────────────────────────────────────────

export interface AppSettings {
  logoUrl?: string;
  moncashLogoUrl?: string;
  natcashLogoUrl?: string;
  adminLogoUrl?: string;
  exchangeRate?: number;
  whatsappAdminNumber?: string;
  lockAffiliateEdits?: boolean;
  lockAffiliateEditsCode?: string;
  withdrawalsEnabled?: boolean;
  moncashNumber?: string;
  moncashQR?: string;
  natcashNumber?: string;
  natcashQR?: string;
  admiNumber?: string;
  admiQR?: string;
  globalAnnouncement?: string;
  showGlobalAnnouncement?: boolean;
  officialWinners?: {
    id: string;
    name: string;
    points: number;
    prize: number;
    monthlySales: number;
    monthlyReferredClients: number;
  }[];
  // Wallet system
  paymentMethods?: PaymentMethod[];
  minDepositUSD?: number;
  maxDepositUSD?: number;
  minWithdrawalUSD?: number;
  maxWithdrawalUSD?: number;
  // Fees
  depositFeePercent?: number;
  withdrawalFeePercent?: number;
  transferFeePercent?: number;
  feesBalance?: number;
  // Affiliate fee sharing (% of the fee that goes to the referring affiliate)
  affiliateDepositFeeSharePercent?: number;
  affiliateWithdrawalFeeSharePercent?: number;
  // Agent fee engine
  agentDepositCommissionPercent?: number;
  agentWithdrawPercent?: number;
  agentWithdrawAgentSharePercent?: number;
  // Custom exchange rates per payment method (methodId → HTG/USD rate)
  cardRates?: Record<string, number>;
}

export interface Game {
  id?: string;
  name: string;
  image: string;
  description: string;
  priceRange: string;
  whatsappMessage?: string;
  catalog?: { id: string; name: string; price: string; whatsappMessage?: string }[];
  createdAt: any;
  updatedAt?: any;
}

export interface ShippingConfig {
  id?: string;
  type: 'online_purchase' | 'dropshipping';
  addresses: { text: string; id: string; city?: string }[];
  websites: { url: string; name: string; id: string }[];
  videos: { url: string; title: string; id: string }[];
  whatsappNumber?: string;
  whatsappMessage?: string;
  updatedAt: any;
}

export interface AffiliateRequest {
  id?: string;
  uid?: string;
  name: string;
  email: string;
  phone: string;
  message?: string;
  referralCode?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  updatedAt: any;
}

export interface ClientNotification {
  id?: string;
  clientId: string;
  title: string;
  message: string;
  type: 'deposit_approved' | 'deposit_rejected' | 'withdrawal_approved' | 'withdrawal_rejected' | 'purchase' | 'system';
  read: boolean;
  amount?: number;
  createdAt: any;
}

export interface Client {
  id?: string;
  uid?: string;
  email?: string;
  name: string;
  phone: string;
  password?: string;
  balance: number;
  walletId: string;
  status: 'pending' | 'active' | 'blocked';
  directSponsorId?: string;
  indirectSponsorId?: string;
  photoUrl?: string;
  createdAt: any;
  updatedAt: any;
}

export interface NavButton {
  id?: string;
  label: string;
  iconName: string;
  targetUrl: string;
  redirectionInstruction?: string;
  color: string;
  order: number;
  createdAt: any;
  updatedAt?: any;
}

export interface AdminAccount {
  id?: string;
  uid?: string;
  email?: string;
  fullName: string;
  password: string;
  photoUrl?: string;
  loginCode?: string;
  isSuperAdmin: boolean;
  permissions: string[];
  failedAttempts: number;
  lockUntil?: any;
  createdAt: any;
  updatedAt: any;
}

export interface AdminLog {
  id?: string;
  adminName: string;
  success: boolean;
  timestamp: any;
  ip?: string;
  userAgent?: string;
}

export interface Sale {
  id?: string;
  itemId: string;
  itemName: string;
  itemType: 'product' | 'game' | 'card';
  price: number;
  affiliateId?: string;
  affiliateName?: string;
  createdAt: any;
}

// ─── Formations ──────────────────────────────────────────────────────────────

export type FormationLevel = 'debutant' | 'intermediaire' | 'avance';
export type FormationStatus = 'pending' | 'active' | 'revoked';
export type ModuleStatus = 'not_started' | 'in_progress' | 'completed';

export interface FormationModule {
  id: string;
  title: string;
  videoUrl: string;
  duration: string;
  order: number;
  description?: string;
  pdfUrl?: string;
  chapterId?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ChapterQuiz {
  questions: QuizQuestion[];
  passPercent: number;
}

export interface FormationChapter {
  id: string;
  title: string;
  order: number;
  description?: string;
  quiz?: ChapterQuiz;
}

export interface QuizResult {
  id?: string;
  userId: string;
  formationId: string;
  chapterId: string;
  score: number;
  passed: boolean;
  attempts: number;
  completedAt: any;
}

export interface StudentCertificate {
  id?: string;
  userId: string;
  userName: string;
  userEmail?: string;
  formationId: string;
  formationTitle: string;
  issuedBy: string;
  certificateCode: string;
  pdfUrl?: string;
  issuedAt: any;
}

export interface FormationResource {
  id: string;
  name: string;
  url: string;
  type: 'pdf' | 'link' | 'file';
}

export interface Formation {
  id?: string;
  title: string;
  description: string;
  shortDescription: string;
  coverImage: string;
  previewVideoUrl?: string;
  price: number;
  originalPrice?: number;
  level: FormationLevel;
  rating: number;
  studentsCount: number;
  modules: FormationModule[];
  chapters?: FormationChapter[];
  pdfUrl?: string;
  resources?: FormationResource[];
  published: boolean;
  comingSoon?: boolean;
  instructor?: string;
  instructorBio?: string;
  instructorAvatar?: string;
  language?: string;
  totalDuration?: string;
  hasCertificate?: boolean;
  category?: string;
  tags?: string[];
  prerequisites?: string;
  enrollmentLimit?: number;
  createdAt: any;
  updatedAt: any;
}

export interface FormationProgress {
  id?: string;
  userId: string;
  userEmail: string;
  formationId: string;
  completedModules: string[];
  percentage: number;
  startedAt: any;
  lastAccessedAt: any;
  completedAt?: any;
}

export interface FormationPurchase {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  formationId: string;
  formationTitle: string;
  amount: number;
  method: string;
  status: FormationStatus;
  purchasedAt: any;
  updatedAt?: any;
}

export interface FormationUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: any;
}

export interface FormationPaymentRequest {
  id?: string;
  userId: string;
  userEmail?: string;
  userName: string;
  formationId: string;
  formationTitle: string;
  amount: number;
  method: 'MonCash' | 'NatCash';
  transactionCode: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  updatedAt?: any;
}

// ─────────────────────────────────────────────────────────────────────────────

export type ClientTransactionType = 'deposit' | 'withdrawal' | 'purchase' | 'transfer_received' | 'refund';
export type ClientTransactionStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface ClientTransaction {
  id?: string;
  clientId: string;
  clientName?: string;
  type: ClientTransactionType;
  amount: number;
  htgAmount?: number;
  htgEquivalent?: number;
  usdAmount?: number;
  exchangeRate?: number;
  status: ClientTransactionStatus;
  description?: string;
  method?: string;
  accountNumber?: string;
  accountName?: string;
  txId?: string;
  productName?: string;
  productPrice?: string;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export type AdminClientNotifType = 'client_deposit' | 'client_withdrawal' | 'client_purchase';

export interface AdminClientNotification {
  id?: string;
  type: AdminClientNotifType;
  clientId: string;
  clientName: string;
  clientPhone?: string;
  clientWalletId?: string;
  transactionId: string;
  amount: number;
  htgAmount?: number;
  exchangeRate?: number;
  method?: string;
  accountNumber?: string;
  accountName?: string;
  txId?: string;
  productName?: string;
  productPrice?: string;
  directSponsorId?: string | null;
  status?: 'pending' | 'approved' | 'declined';
  servicesRendus?: boolean;
  read: boolean;
  createdAt: any;
  resolvedAt?: any;
}

export interface Teacher {
  id?: string;
  name: string;
  email?: string;
  password: string;
  balance: number;
  status: 'active' | 'inactive';
  createdAt: any;
  updatedAt: any;
}

export interface TeacherTransaction {
  id?: string;
  teacherId: string;
  teacherName: string;
  type: 'sale_credit' | 'withdrawal';
  amount: number;
  fee?: number;
  netAmount?: number;
  formationId?: string;
  formationTitle?: string;
  clientName?: string;
  method?: string;
  accountNumber?: string;
  status: 'completed' | 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  note?: string;
  createdAt: any;
  updatedAt: any;
}
