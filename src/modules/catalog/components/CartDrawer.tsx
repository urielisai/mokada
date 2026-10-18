import { X, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { useCartStore } from '../store/useCartStore';
import { useNavigate } from 'react-router-dom';
import { usePresence } from '../../../hooks/usePresence';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CartDrawer = ({ isOpen, onClose }: CartDrawerProps) => {
  const { items, removeItem, updateQuantity, getTotal } = useCartStore();
  const navigate = useNavigate();
  const { isMounted, state } = usePresence(isOpen, 420);

  if (!isMounted) return null;

  const handleCheckout = () => {
    onClose();
    navigate('/orders/checkout');
  };

  return (
    <>
      <div 
        data-state={state}
        className={`overlay-scrim fixed inset-0 z-50 bg-black/25 backdrop-blur-[6px] ${isOpen ? '' : 'pointer-events-none'}`}
        onClick={onClose}
      />
      
      <div
        data-state={state}
        role="dialog"
        aria-modal="true"
        aria-label="Carrito"
        className={`overlay-sheet-right fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl sm:inset-y-2 sm:right-2 sm:rounded-3xl sm:overflow-hidden ${isOpen ? '' : 'pointer-events-none'}`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-accent" />
            </div>
            <h2 className="text-[22px] font-semibold text-ink">Carrito</h2>
          </div>
          <button 
            onClick={onClose}
            aria-label="Cerrar carrito"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 text-gray-500">
              <ShoppingCart className="w-16 h-16 text-gray-200 stroke-[1]" />
              <p>Tu carrito está vacío</p>
            </div>
          ) : (
            <div className="space-y-3 stagger">
              {items.map((item) => (
                <div key={item.product_id} className="flex gap-4 rounded-2xl bg-gray-50 p-3.5 ring-1 ring-black/[0.03]">
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
                        <p className="text-[12px] text-accent font-medium">{item.code}</p>
                        <h4 className="text-[14px] font-semibold text-ink line-clamp-2 leading-tight mt-0.5">{item.name}</h4>
                      </div>
                      <button 
                        onClick={() => removeItem(item.product_id)}
                        className="text-gray-400 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    
                    <div className="mt-auto flex items-center justify-between pt-3">
                      <div className="flex items-center gap-2 rounded-full bg-white p-0.5 shadow-xs ring-1 ring-black/[0.06]">
                        <button 
                          onClick={() => updateQuantity(item.product_id, Math.max(1, item.quantity - 1))}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-5 text-center text-[13px] font-semibold tabular-nums">{item.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="font-semibold text-ink">
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
          <div className="material-chrome border-t border-black/[0.06] p-6">
            <div className="flex justify-between items-center mb-6">
              <span className="text-gray-500 font-medium">Total Estimado</span>
              <span className="text-[26px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
                {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(getTotal())}
              </span>
            </div>
            <button 
              onClick={handleCheckout}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-medium text-white hover:bg-accent-hover"
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
