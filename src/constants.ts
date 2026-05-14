
import { Product } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'g1',
    name: 'Mobile Legends: 86 Diamonds',
    description: 'Top up aman & legal via ID + Server. Proses 1-5 menit.',
    price: 21500,
    category: 'Top Up Game',
    image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&h=400&auto=format&fit=crop',
    rating: 4.9,
    stock: 999
  },
  {
    id: 'g2',
    name: 'Free Fire: 140 Diamonds',
    description: 'Top up FF termurah. Cukup masukkan ID pemain Anda.',
    price: 19800,
    category: 'Top Up Game',
    image: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?q=80&w=600&h=400&auto=format&fit=crop',
    rating: 4.8,
    stock: 999
  },
  {
    id: 'g3',
    name: 'PUBG Mobile: 60 UC',
    description: 'Unknown Cash resmi untuk Royale Pass dan Skin Senjata.',
    price: 14500,
    category: 'Top Up Game',
    image: 'https://images.unsplash.com/photo-1593305841991-05c297ba4575?q=80&w=600&h=400&auto=format&fit=crop',
    rating: 4.7,
    stock: 500
  },
  {
    id: 'g4',
    name: 'Genshin Impact: 60 Genesis',
    description: 'Top up via UID dan Server. Bonus kristal untuk pembelian pertama.',
    price: 16000,
    category: 'Top Up Game',
    image: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?q=80&w=600&h=400&auto=format&fit=crop',
    rating: 5.0,
    stock: 300
  },
  {
    id: '1',
    name: 'Smartphone Pro Max',
    description: 'Smartphone tercanggih dengan kamera 108MP dan layar super retina.',
    price: 15000000,
    category: 'Elektronik',
    image: 'https://picsum.photos/seed/phone/600/400',
    rating: 4.8,
    stock: 12
  },
  {
    id: '2',
    name: 'Laptop Ultra Slim',
    description: 'Ringan, tipis, dan bertenaga untuk produktivitas maksimal.',
    price: 12500000,
    category: 'Elektronik',
    image: 'https://picsum.photos/seed/laptop/600/400',
    rating: 4.5,
    stock: 5
  },
  {
    id: '3',
    name: 'Headphone Wireless ANC',
    description: 'Suara jernih dengan fitur noise cancellation aktif.',
    price: 3500000,
    category: 'Audio',
    image: 'https://picsum.photos/seed/headphone/600/400',
    rating: 4.9,
    stock: 20
  },
  {
    id: '4',
    name: 'Smart Watch Series 7',
    description: 'Pantau kesehatan dan notifikasi Anda langsung dari pergelangan tangan.',
    price: 5200000,
    category: 'Aksesoris',
    image: 'https://picsum.photos/seed/watch/600/400',
    rating: 4.7,
    stock: 15
  },
  {
    id: 'wp-1',
    name: 'Weekly Diamond Pass',
    description: 'Diamond Pass Mingguan MLBB. Dapatkan 210 Diamond total dalam 7 hari.',
    price: 30000,
    category: 'Top Up Game',
    image: 'https://i.imgur.com/vH3y1uN.png',
    rating: 4.9,
    stock: 999,
    productType: 'Duplikat',
    inventory: ['ISI_OTOMATIS_VIA_ID']
  },
  {
    id: 'dm-86',
    name: '86 Diamonds MLBB',
    description: 'Top Up 86 Diamonds Mobile Legends: Bang Bang.',
    price: 21000,
    category: 'Top Up Game',
    image: 'https://i.imgur.com/vH3y1uN.png',
    rating: 4.8,
    stock: 999,
    productType: 'Duplikat',
    inventory: ['ISI_OTOMATIS_VIA_ID']
  },
  {
    id: 'dm-172',
    name: '172 Diamonds MLBB',
    description: 'Top Up 172 Diamonds Mobile Legends: Bang Bang.',
    price: 42000,
    category: 'Top Up Game',
    image: 'https://i.imgur.com/vH3y1uN.png',
    rating: 4.8,
    stock: 999,
    productType: 'Duplikat',
    inventory: ['ISI_OTOMATIS_VIA_ID']
  },
  {
    id: 'dm-257',
    name: '257 Diamonds MLBB',
    description: 'Top Up 257 Diamonds Mobile Legends: Bang Bang.',
    price: 63000,
    category: 'Top Up Game',
    image: 'https://i.imgur.com/vH3y1uN.png',
    rating: 4.9,
    stock: 999,
    productType: 'Duplikat',
    inventory: ['ISI_OTOMATIS_VIA_ID']
  },
  {
    id: 'acc-nf-1',
    name: 'Netflix 1 Bulan Shared',
    description: 'Akun Netflix Shared 1 Bulan. Full Garansi 30 Hari.',
    price: 35000,
    category: 'Voucher App',
    image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?q=80&w=600&h=400&auto=format&fit=crop',
    rating: 4.6,
    stock: 3,
    productType: 'Unik',
    inventory: ['NF-EMAIL1:PASS1', 'NF-EMAIL2:PASS2', 'NF-EMAIL3:PASS3']
  }
];

export const formatIDR = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
};
