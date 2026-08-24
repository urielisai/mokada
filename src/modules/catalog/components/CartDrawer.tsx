import { X, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useNavigate } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const { items, removeItem, updateQuantity, getTotal } = useCartStore();
  const navigate = useNavigate();

  if (!isOpen) return null;

  const handleCheckout = () => {
    onClose();
    navigate('/orders/checkout');
  };

  return (
    <>
      <div 
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className={`fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0066CC]/10 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-[#0066CC]" />
            </div>
            <h2 className="text-xl font-bold text-[#1D1D1F]">Carrito</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
              <ShoppingCart className="w-16 h-16 text-gray-200 stroke-[1]" />
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-6">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-4 p-4 bg-gray-50 rounded-2xl">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-20 h-20 object-contain bg-white rounded-xl border border-gray-100 p-2" />
                  ) : (
                    <div className="w-20 h-20 bg-white rounded-xl border border-gray-100 flex items-center justify-center">
                      <ShoppingCart className="w-8 h-8 text-gray-200" />
                    </div>
                  )}
                  
                  <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <p className="text-[12px] text-[#0066CC] font-medium">{item.code}</p>
                        <h4 className="text-[14px] font-semibold text-[#1D1D1F] line-clamp-2 leading-tight mt-0.5">{item.name}</h4>
                      </div>
                      <button 
                        onClick={() => removeItem(item.product_id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-1">
                        <button 
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-600"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-[13px] font-medium w-4 text-center">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-gray-100 transition-colors text-gray-600"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-semibold text-[#1D1D1F]">
                        {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="p-6 border-t border-gray-100 bg-gray-50/50">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 font-medium">Total Estimado</span>
              <span className="text-2xl font-bold text-[#1D1D1F]">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(getTotal())}
              </span>
            </div>
            <button 
              onClick={handleCheckout}
              className="w-full bg-[#0066CC] hover:bg-[#005bb5] text-white py-4 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              Proceder al Pago
              <ShoppingCart className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </>
  );
};
