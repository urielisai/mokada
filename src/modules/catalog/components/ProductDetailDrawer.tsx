import { X } from 'lucide-react';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LoadingState } from '../../../components/ui/LoadingState';

interface Props {
  productId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductDetailDrawer = ({ productId, isOpen, onClose }: Props) => {
  // En una versión completa esto usaría un hook:
  // const { data: product, isLoading } = useProduct(productId);
  
  if (!isOpen) return null;

  return (
    <>
      <div 
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl z-50 transform transition-transform duration-300 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-[22px] font-bold tracking-tight text-ink">Detalle del Producto</h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {!productId ? (
            <LoadingState message="Cargando detalles..." />
          ) : (
            <div className="space-y-8">
              {/* Información General */}
              <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Información General</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Código</p>
                    <p className="font-medium text-slate-900">PROD-123</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Estado</p>
                    <StatusBadge status="ACTIVE" />
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-slate-500 mb-1">Nombre</p>
                    <p className="font-medium text-slate-900">AMORTIGUADOR DEL NS VERSA 12-19 DER GAS</p>
                  </div>
                </div>
              </section>

              {/* Inventario */}
              <section>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Inventario</h3>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Existencia</p>
                      <p className="text-xl font-bold text-slate-900">12</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 mb-1">Reservado</p>
                      <p className="text-xl font-bold text-slate-900">2</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-600 font-medium mb-1">Disponible</p>
                      <p className="text-xl font-bold text-emerald-600">10</p>
                    </div>
                  </div>
                </div>
              </section>
              
              <div className="text-center text-sm text-slate-500 mt-8">
                Nota: Esta es una vista previa del componente. Falta conectar a useProduct.
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
