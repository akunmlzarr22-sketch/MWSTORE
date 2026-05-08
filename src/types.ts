
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
  timestamp: string;
  read: boolean;
}

export type View = 'home' | 'cart' | 'admin' | 'checkout' | 'orders' | 'topup' | 'profile' | 'customer-service';

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
}

export interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  username: string | null;
  balance: number | null;
}
