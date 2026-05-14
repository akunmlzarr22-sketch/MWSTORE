
import React, { useState } from 'react';
import { Product } from '@/types';
import { formatIDR } from '@/constants';
import { Star, ShoppingCart, CreditCard, Minus, Plus } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, redirect?: boolean, quantity?: number) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);

  const increment = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity < product.stock) setQuantity(prev => prev + 1);
  };

  const decrement = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (quantity > 1) setQuantity(prev => prev - 1);
  };
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
      <div className="p-3">
        <span className="text-[8px] font-medium text-blue-600 bg-blue-50 px-1 py-0.5 rounded-md mb-1 inline-block">
          {product.category}
        </span>
        <h3 className="font-bold text-[11px] text-gray-900 mb-0.5 group-hover:text-blue-600 transition-colors">
          {product.name}
        </h3>
        <p className="text-[9px] text-gray-500 line-clamp-2 mb-1.5 h-6">
          {product.description}
        </p>
          <div className="flex flex-col gap-1 mt-auto">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex flex-col">
                {product.discount && product.discount > 0 ? (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-black bg-red-100 text-red-600 px-1 py-0 rounded uppercase tracking-tighter">
                        Hemat {formatIDR(product.discount)}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[8px] text-gray-400 line-through font-bold">
                        {formatIDR(product.price + product.discount)}
                      </span>
                      <span className="text-xs font-black text-blue-600 leading-tight">
                        {formatIDR(product.price)}
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="text-xs font-black text-gray-900">
                    {formatIDR(product.price)}
                  </span>
                )}
              </div>
              
              {/* Quantity Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Jumlah</span>
                <div className="flex items-center bg-gray-50 rounded-lg p-0.5 border border-gray-100 h-7">
                  <button 
                    onClick={decrement}
                    className="p-1 hover:bg-white rounded-md transition-colors text-gray-400 hover:text-blue-600 active:scale-90"
                    disabled={quantity <= 1}
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-6 text-center text-[10px] font-black text-gray-700 select-none">
                    {quantity}
                  </span>
                  <button 
                    onClick={increment}
                    className="p-1 hover:bg-white rounded-md transition-colors text-gray-400 hover:text-blue-600 active:scale-90"
                    disabled={quantity >= product.stock}
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-row gap-1.5 mt-2">
              <button 
                onClick={() => product.stock > 0 && onAddToCart(product, true, quantity)}
                disabled={product.stock <= 0}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide shadow-sm ${
                  product.stock > 0 
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-blue-200 active:scale-95' 
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none'
                }`}
              >
                <CreditCard className="w-3 h-3" />
                BELI
              </button>
              <button 
                onClick={() => product.stock > 0 && onAddToCart(product, false, quantity)}
                disabled={product.stock <= 0}
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide border ${
                  product.stock > 0 
                  ? 'bg-white border-blue-600 text-blue-600 hover:bg-blue-50' 
                  : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Tambah ke Keranjang"
              >
                <ShoppingCart className="w-3 h-3" />
                KERANJANG
              </button>
            </div>
          </div>
      </div>
    </div>
  );
};

export default ProductCard;
