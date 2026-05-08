
import React from 'react';
import { Product } from '../types';
import { formatIDR } from '../constants';
import { Star, ShoppingCart, CreditCard } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, redirect?: boolean) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 group">
      <div className="relative aspect-video overflow-hidden">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute top-3 right-3 flex flex-col gap-2">
          <div className="bg-white/90 backdrop-blur px-2 py-1 rounded-full text-xs font-bold text-gray-700 flex items-center gap-1 shadow-sm">
            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            {product.rating}
          </div>
          <div className={`px-2 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm flex items-center justify-center ${product.stock > 0 ? 'bg-blue-600/90 text-white' : 'bg-red-500/90 text-white'}`}>
            {product.stock > 0 ? `Stok: ${product.stock}` : 'Habis'}
          </div>
        </div>
      </div>
      <div className="p-4">
        <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-md mb-2 inline-block">
          {product.category}
        </span>
        <h3 className="font-bold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
          {product.description}
        </p>
        <div className="flex flex-col gap-2 mt-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              {product.discount && product.discount > 0 ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                      Hemat {formatIDR(product.discount)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 line-through font-bold">
                      {formatIDR(product.price + product.discount)}
                    </span>
                    <span className="text-lg font-black text-blue-600 leading-tight">
                      {formatIDR(product.price)}
                    </span>
                  </div>
                </>
              ) : (
                <span className="text-xl font-black text-gray-900">
                  {formatIDR(product.price)}
                </span>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => product.stock > 0 && onAddToCart(product, false)}
              disabled={product.stock <= 0}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest border-2 ${
                product.stock > 0 
                ? 'bg-white border-blue-100 text-blue-600 hover:bg-blue-50' 
                : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Tambah ke Keranjang"
            >
              <ShoppingCart className="w-4 h-4" />
              Keranjang
            </button>
            <button 
              onClick={() => product.stock > 0 && onAddToCart(product, true)}
              disabled={product.stock <= 0}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg ${
                product.stock > 0 
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-100 active:scale-95' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Beli
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
