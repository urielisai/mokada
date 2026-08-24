import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../catalog/store/useCartStore';
import { useAuth } from '../../auth/context/useAuth';
import { ordersService } from '../services/orders.service';
import { customersService, type CustomerSummary, type CustomerBranch } from '../../customers/services/customers.service';
import { ShoppingCart, CheckCircle2, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { AsyncSearchSelect } from '../../../components/ui/AsyncSearchSelect';

export const CheckoutPage = () => {
  const { items, getTotal, clearCart } = useCartStore();
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<{value: string, label: string, description: string}[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  
  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Initialize customers for agents
  useEffect(() => {
    if (isAdmin || profile?.user_type === 'AGENT') {
      // Just fetch an initial batch (empty search)
      handleSearchCustomers('');
    } else {
      const fetchMyCustomerId = async () => {
        try {
          const data = await customersService.getCustomers({ search: '' }); 
          if (data && data.length > 0) {
            setSelectedCustomerId(data[0].id);
          }
        } catch (error) {
          console.error(error);
        }
      };
      fetchMyCustomerId();
    }
  }, [isAdmin, profile]);

  const handleSearchCustomers = async (query: string) => {
    setIsSearchingCustomers(true);
    try {
      const data = await customersService.getCustomers({ search: query });
      setCustomerOptions(data.map(c => ({
        value: c.id,
        label: c.name,
        description: c.email || ''
      })));
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setIsSearchingCustomers(false);
    }
  };

  useEffect(() => {
    if (selectedCustomerId) {
      const loadBranches = async () => {
        try {
          const data = await customersService.getBranches(selectedCustomerId);
          setBranches(data);
          if (data.length === 1) {
            setSelectedBranchId(data[0].id);
          } else {
            setSelectedBranchId('');
          }
        } catch (error) {
          console.error('Error loading branches:', error);
          toast.error('Error al cargar sucursales');
        }
      };
      loadBranches();
    } else {
      setBranches([]);
      setSelectedBranchId('');
    }
  }, [selectedCustomerId]);

  if (items.length === 0 && !isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center space-y-4">
        <ShoppingCart className="w-16 h-16 text-gray-200 stroke-[1]" />
        <h2 className="text-xl font-bold text-[#1D1D1F]">Tu carrito está vacío</h2>
        <button 
          onClick={() => navigate('/catalog/products')}
          className="text-[#0066CC] font-medium hover:underline"
        >
          Volver al catálogo
        </button>
      </div>
    );
  }

  const handleConfirmOrder = async () => {
    if (!selectedCustomerId) {
      toast.error('Por favor selecciona un cliente (o asegúrate de estar registrado como cliente).');
      return;
    }
    
    if (!selectedBranchId) {
      toast.error('Por favor selecciona una sucursal para el envío.');
      return;
    }

    const selectedBranch = branches.find(b => b.id === selectedBranchId);
    const branchAddress = selectedBranch 
      ? `${selectedBranch.name} - ${selectedBranch.street || ''} ${selectedBranch.exterior_number || ''}, ${selectedBranch.municipality || ''}`
      : '';

    setIsLoading(true);
    try {
      await ordersService.createOrder({
        customer_id: selectedCustomerId,
        total_amount: getTotal(),
        shipping_address: branchAddress,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.price,
          subtotal: i.price * i.quantity
        }))
      });
      
      clearCart();
      setIsSuccess(true);
    } catch (error) {
      console.error('Error creating order', error);
      toast.error('Ocurrió un error al crear el pedido.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">¡Pedido Confirmado!</h2>
        <p className="text-[15px] text-[#86868B] max-w-md">
          Tu pedido ha sido registrado exitosamente y está siendo validado por nuestro equipo.
        </p>
        <div className="flex gap-4 pt-4">
          <button 
            onClick={() => navigate('/catalog/products')}
            className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-[#1D1D1F] rounded-xl font-medium transition-colors"
          >
            Seguir Comprando
          </button>
          <button 
            onClick={() => navigate(isAdmin || profile?.user_type === 'AGENT' ? '/orders' : '/my-orders')}
            className="px-6 py-2.5 bg-[#0066CC] hover:bg-[#005bb5] text-white rounded-xl font-medium transition-colors"
          >
            Ver mis Pedidos
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Checkout</h2>
          <p className="text-[15px] text-[#86868B] mt-1">Revisa y confirma tu pedido</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-6">Detalles del Pedido</h3>
            
            <div className="space-y-4">
              {(isAdmin || profile?.user_type === 'AGENT') && (
                <div className="z-10 relative">
                  <AsyncSearchSelect
                    label="Seleccionar Cliente"
                    value={selectedCustomerId}
                    onChange={setSelectedCustomerId}
                    onSearch={handleSearchCustomers}
                    options={customerOptions}
                    isLoading={isSearchingCustomers}
                    placeholder="Buscar cliente..."
                    emptyMessage="No se encontraron clientes"
                    onClear={() => setSelectedCustomerId('')}
                  />
                </div>
              )}

              <div>
                <label className="block text-[13px] font-medium text-gray-700 mb-1">
                  Sucursal de Envío
                </label>
                <select
                  value={selectedBranchId}
                  onChange={(e) => setSelectedBranchId(e.target.value)}
                  disabled={!selectedCustomerId || branches.length === 0}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all disabled:opacity-50"
                >
                  <option value="">
                    {!selectedCustomerId 
                      ? 'Primero selecciona un cliente' 
                      : branches.length === 0 
                        ? 'El cliente no tiene sucursales' 
                        : 'Selecciona una sucursal...'
                    }
                  </option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.street ? `- ${b.street}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">Productos</h3>
            <div className="space-y-4">
              {items.map(item => (
                <div key={item.product_id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <div className="flex gap-4 items-center">
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                      {item.quantity}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{item.name}</p>
                      <p className="text-[12px] text-[#86868B]">{item.code}</p>
                    </div>
                  </div>
                  <span className="font-medium text-[#1D1D1F]">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm sticky top-6">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-6">Resumen</h3>
            
            <div className="space-y-3 pb-6 border-b border-gray-100">
              <div className="flex justify-between items-center text-[14px] text-gray-600">
                <span>Subtotal ({items.length} prod.)</span>
                <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(getTotal())}</span>
              </div>
              <div className="flex justify-between items-center text-[14px] text-gray-600">
                <span>Costo de Envío</span>
                <span className="text-[#86868B] italic">Por definir</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 text-lg font-bold text-[#1D1D1F]">
              <span>Total Estimado</span>
              <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(getTotal())}</span>
            </div>

            <button
              onClick={handleConfirmOrder}
              disabled={isLoading || !selectedCustomerId}
              className="w-full bg-[#0066CC] hover:bg-[#005bb5] disabled:bg-gray-300 disabled:cursor-not-allowed text-white py-3.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Procesando...
                </>
              ) : (
                <>
                  Confirmar Pedido
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
            {(!selectedCustomerId && !isAdmin && profile?.user_type !== 'AGENT') && (
               <p className="text-xs text-center text-red-500 mt-2">No se encontró tu perfil de cliente. Contacta a soporte.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
