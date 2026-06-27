
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
    <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,0.02)] border border-gray-100 overflow-hidden hover:shadow-xs transition-all duration-200 group flex flex-col h-full">
      <div className="relative aspect-video overflow-hidden bg-gray-50">
        <img 
          src={product.image} 
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
        />
        <div className="absolute top-1 right-1 flex flex-col gap-0.5 z-10">
          <div className="bg-white/95 backdrop-blur px-1 py-0.5 rounded text-[7px] font-extrabold text-gray-700 flex items-center gap-0.5 shadow-xs">
            <Star className="w-2 h-2 text-yellow-500 fill-yellow-500" />
            {product.rating}
          </div>
          <div className={`px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-tight shadow-xs flex items-center justify-center ${product.stock > 0 ? 'bg-indigo-600/95 text-white' : 'bg-red-500/95 text-white'}`}>
            {product.stock > 0 ? `STOK: ${product.stock}` : 'HABIS'}
          </div>
        </div>
      </div>
      <div className="p-1.5 sm:p-2 flex flex-col flex-1 min-h-0">
        <span className="text-[7px] font-black text-indigo-600 bg-indigo-50/70 px-1 py-0.5 rounded mb-0.5 self-start uppercase tracking-wider">
          {product.category}
        </span>
        <h3 className="font-extrabold text-[10px] sm:text-[11px] text-gray-900 group-hover:text-indigo-600 transition-colors leading-tight tracking-tight mb-0.5 line-clamp-1" title={product.name}>
          {product.name}
        </h3>
        <p className="text-[8px] sm:text-[9px] text-gray-400 font-semibold leading-normal mb-1.5 line-clamp-1">
          {product.description}
        </p>
        
        <div className="flex flex-col gap-1.5 pt-1.5 border-t border-gray-100 mt-auto">
          {/* Price Component */}
          <div className="flex items-center justify-between">
            <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider font-sans">Harga</span>
            <div className="text-right">
              {product.discount && product.discount > 0 ? (
                <div className="flex flex-col items-end">
                  <span className="text-[6.5px] text-red-500 bg-red-50 border border-red-100 px-0.5 py-0 rounded font-black uppercase tracking-tight mb-0.5">
                    Hemat {formatIDR(product.discount)}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[7.5px] text-gray-400 line-through font-semibold leading-none">
                      {formatIDR(product.price + product.discount)}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-black text-indigo-600 font-mono leading-none">
                      {formatIDR(product.price)}
                    </span>
                  </div>
                </div>
              ) : (
                <span className="text-[10px] sm:text-[11px] font-black text-gray-950 font-mono leading-none">
                  {formatIDR(product.price)}
                </span>
              )}
            </div>
          </div>
          
          {/* Quantity Selector Component */}
          <div className="flex items-center justify-between">
            <span className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">Jumlah</span>
            <div className="flex items-center bg-gray-50 rounded-md p-0.5 border border-gray-200/50 h-4.5">
              <button 
                onClick={decrement}
                className="p-0.5 hover:bg-white hover:shadow-xs rounded transition-all text-gray-400 hover:text-indigo-600 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                disabled={quantity <= 1}
              >
                <Minus className="w-2 h-2" />
              </button>
              <span className="w-4 text-center text-[8px] font-bold text-gray-800 select-none font-mono leading-none">
                {quantity}
              </span>
              <button 
                onClick={increment}
                className="p-0.5 hover:bg-white hover:shadow-xs rounded transition-all text-gray-400 hover:text-indigo-600 active:scale-90 disabled:opacity-30 disabled:pointer-events-none"
                disabled={quantity >= product.stock}
              >
                <Plus className="w-2 h-2" />
              </button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-row gap-0.5 sm:gap-1 mt-0.5">
            <button 
              onClick={() => product.stock > 0 && onAddToCart(product, true, quantity)}
              disabled={product.stock <= 0}
              className={`flex-1 py-1 rounded transition-all flex items-center justify-center gap-0.5 text-[8px] sm:text-[8.5px] font-extrabold uppercase tracking-wider ${
                product.stock > 0 
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95 shadow-xs' 
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <CreditCard className="w-2.5 h-2.5" />
              BELI
            </button>
            <button 
              onClick={() => product.stock > 0 && onAddToCart(product, false, quantity)}
              disabled={product.stock <= 0}
              className={`flex-1 py-1 rounded transition-all flex items-center justify-center gap-0.5 text-[8px] sm:text-[8.5px] font-extrabold uppercase tracking-wider border ${
                product.stock > 0 
                ? 'bg-white border-indigo-100 text-indigo-600 hover:bg-indigo-100 active:scale-95' 
                : 'bg-gray-50 border-gray-100 text-gray-400 cursor-not-allowed'
              }`}
              title="Tambah ke Keranjang"
            >
              <ShoppingCart className="w-2.5 h-2.5" />
              TROLI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
