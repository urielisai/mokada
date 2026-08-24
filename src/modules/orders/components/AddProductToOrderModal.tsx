import { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { catalogService } from '../../catalog/services/catalog.service';
import { ordersService } from '../services/orders.service';
import { Search, Loader2, Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface AddProductToOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  onProductAdded: () => void;
}

export const AddProductToOrderModal = ({ isOpen, onClose, orderId, onProductAdded }: AddProductToOrderModalProps) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      searchProducts('');
    } else {
      setSearchTerm('');
      setProducts([]);
    }
  }, [isOpen]);

  const searchProducts = async (search: string) => {
    try {
      setIsLoading(true);
      const data = await catalogService.getProducts({ page: 1, pageSize: 20, search });
      setProducts(data.data || []);
    } catch (error) {
      console.error(error);
      toast.error('Error al cargar productos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (isOpen) {
        searchProducts(searchTerm);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, isOpen]);

  const handleAddProduct = async (product: any) => {
    try {
      setIsAdding(product.id);
      
      // Determine base price. In a real scenario, this depends on customer price list.
      // Here we grab the first available price or default to 0 if not found.
      const price = product.public_price || product.base_price || 0;
        
      if (price <= 0) {
        toast.error('Este producto no tiene precio asignado.');
        return;
      }

      await ordersService.addOrderItem(orderId, product.id, 1, price);
      toast.success('Producto agregado');
      onProductAdded();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error('Error al agregar el producto');
    } finally {
      setIsAdding(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Añadir Producto al Pedido" size="xl">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar por código, nombre o código de barras..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all bg-gray-50/50"
          />
        </div>

        <div className="min-h-[300px] max-h-[500px] overflow-y-auto pr-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-[#0066CC]" />
              <p>Buscando productos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[300px] text-gray-500">
              <AlertCircle className="w-12 h-12 text-gray-300 mb-4" />
              <p className="text-lg font-medium text-gray-600">No se encontraron productos</p>
              <p className="text-sm">Intenta con otros términos de búsqueda.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {products.map((product) => {
                const price = product.public_price || product.base_price || 0;

                return (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl hover:border-[#0066CC]/30 hover:shadow-sm transition-all group">
                    <div className="flex items-center gap-3">
                      {product.image_url ? (
                        <img src={catalogService.getProductImageUrl(product.image_url) || ''} alt={product.name} className="w-12 h-12 object-cover rounded-lg border border-gray-100" />
                      ) : (
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                          <Search className="w-5 h-5 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-[#1D1D1F] text-sm">{product.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {product.code}
                          </span>
                          <span className="text-xs font-semibold text-green-600">
                            {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(price)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddProduct(product)}
                      disabled={isAdding === product.id}
                      className="p-2 text-gray-400 hover:text-[#0066CC] hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {isAdding === product.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
