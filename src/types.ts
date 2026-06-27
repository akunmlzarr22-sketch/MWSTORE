
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  rating: number;
  stock: number;
  discount?: number;
  productType?: 'Duplikat' | 'Unik';
  inventory?: string[];
  additionalImages?: string[];
  isNokosApi?: boolean;
  nokosCountry?: string;
  nokosService?: string;
  nokosOperator?: string;
}

export interface CartItem extends Product {
  quantity: number;
  issuedData?: string[];
}

export interface Order {
  id: string;
  items: CartItem[];
  totalAmount: number;
  date: string;
  status: 'Pending' | 'Proses' | 'Selesai' | 'Dibatalkan';
  paymentMethod: string;
  username: string;
}

export interface Message {
  id: string;
  sender: string;
  recipient: string;
  content: string;
  imageUrl?: string;
  timestamp: string;
  read: boolean;
  senderUid?: string;
}

export type View = 'home' | 'cart' | 'admin' | 'checkout' | 'orders' | 'topup' | 'profile' | 'customer-service' | 'community-chat' | 'vouchers' | 'nokos' | 'smm';

export type UserRole = 'admin' | 'user' | null;

export interface TopUpTransaction {
  id: string;
  username: string;
  amount: number;
  date: string;
  status: 'Pending' | 'Selesai';
}

export interface UserAccount {
  username: string;
  email?: string;
  password?: string;
  phone?: string;
  role: 'user' | 'admin';
  balance: number;
  currentOtp?: string;
  otpExpiry?: string;
  uid?: string;
  createdAt?: string;
}

export interface Voucher {
  id: string;
  code: string;
  amount: number;
  type: 'fixed' | 'percentage';
  isActive: boolean;
  isUsed?: boolean;
  minPurchase?: number;
  expiryDate?: string;
  createdAt?: string;
  recipient?: string;
}

export interface PaymentGatewayConfig {
  provider: 'Pak Kasir' | 'Manual' | 'SanPay' | 'ZannPay';
  merchantCode?: string;
  apiKey: string;
  privateKey?: string;
  baseUrl?: string;
  isActive: boolean;
  mode?: 'Sandbox' | 'Production';
  slug?: string;
  webhookSecret?: string;
}

export interface PaymentSettings {
  id: string;
  gateways: PaymentGatewayConfig[];
  updatedAt: string;
  updatedBy: string;
}

export interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  username: string | null;
  balance: number | null;
}
