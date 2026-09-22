import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCartStore } from '../../catalog/store/useCartStore';
import { useAuth } from '../../auth/context/useAuth';
import { ordersService } from '../services/orders.service';
import { customersService, type CustomerBranch } from '../../customers/services/customers.service';
import { ShoppingCart, CheckCircle2, ChevronRight, Loader2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { AsyncSearchSelect } from '../../../components/ui/AsyncSearchSelect';

import { useQuery } from '@tanstack/react-query';
import { useWarehouses } from '../../inventory/hooks/useInventory';
import { configService } from '../../configuration/services/config.service';
import { supabase } from '../../../lib/supabase/client';
import { CreditSelector } from '../components/CreditSelector';
import { useCustomerFiscalProfiles } from '../../customers/hooks/useCustomers';
import { invoicePaymentForms } from '../utils/orderInvoice';

export const CheckoutPage = () => {
  const { items, clearCart } = useCartStore();
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isStaff = isAdmin || profile?.user_type === 'AGENT';
  const { data: warehouses } = useWarehouses();
  const { data: priceLists } = useQuery({ queryKey: ['price-lists'], queryFn: configService.getPriceLists, enabled: isStaff });
  const [warehouseId, setWarehouseId] = useState('');
  const [priceListId, setPriceListId] = useState('');
  const [warrantyId,setWarrantyId]=useState(()=>isAdmin ? sessionStorage.getItem('warranty-return-id') || '' : '');
  const warranties=useQuery({queryKey:['available-warranties'],enabled:isAdmin,queryFn:async()=>{
    const rows:any[]=[];
    for(let from=0;;from+=500){
      const {data,error}=await (supabase as any).from('sales_order_returns').select('*, source_order:sales_orders!sales_order_returns_order_id_fkey(customer_id,branch_id,warehouse_id), replacements:sales_orders!sales_orders_warranty_return_id_fkey(id,status), item:sales_order_items!sales_order_returns_item_id_fkey(product_id,products(name,code))').eq('status','APPROVED').order('created_at',{ascending:false}).order('id').range(from,from+499);
      if(error)throw error;rows.push(...data);if(data.length<500)break;
    }
    return rows.filter(r=>!(Array.isArray(r.replacements)?r.replacements:(r.replacements?[r.replacements]:[])).some((o:any)=>o.status!=='CANCELLED'));
  }});
  const warranty=warranties.data?.find(r=>r.id===warrantyId);
  const { data: listPrices, isFetching: loadingPrices, error: priceError } = useQuery({
    queryKey: ['checkout-prices', priceListId, items.map(i => i.product_id)],
    enabled: isStaff && !!priceListId && items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('product_prices').select('product_id, amount')
        .eq('price_list_id', priceListId).is('valid_to', null).lte('valid_from', new Date().toISOString()).in('product_id', items.map(i => i.product_id));
      if (error) throw error;
      return data;
    }
  });
  const [discounts, setDiscounts] = useState<Record<string, {percent: string; reason: string}>>({});
  const pricedItems = items.map(i => {
    const listPrice = isStaff ? listPrices?.find(p => p.product_id === i.product_id)?.amount ?? null : i.price;
    const percent = isStaff ? Number(discounts[i.product_id]?.percent || 0) : 0;
    return {...i, listPrice, discount_percent: percent, discount_reason: discounts[i.product_id]?.reason || '', price: listPrice == null ? null : Math.round(listPrice*(1-percent/100)*100)/100};
  });
  const missingPrices = pricedItems.some(i => i.price == null);
  const orderTotal = pricedItems.reduce((sum, i) => sum + (i.price ?? 0) * i.quantity, 0);

  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);
  const [customerOptions, setCustomerOptions] = useState<{value: string, label: string, description: string}[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [requiresInvoice, setRequiresInvoice] = useState(false);
  const [fiscalProfileId, setFiscalProfileId] = useState('');
  const [invoicePaymentForm, setInvoicePaymentForm] = useState('UNDEFINED');
  const fiscalProfiles = useCustomerFiscalProfiles(selectedCustomerId || null);
  const activeFiscalProfiles = fiscalProfiles.data?.filter(p => p.is_active) || [];
  const selectedFiscalProfile = activeFiscalProfiles.find(p => p.id === fiscalProfileId);
  useEffect(() => { setFiscalProfileId(''); setRequiresInvoice(false); setInvoicePaymentForm('UNDEFINED'); }, [selectedCustomerId]);
  useEffect(() => {
    if (fiscalProfiles.data && !fiscalProfileId) {
      const preferred = fiscalProfiles.data.find(p => p.is_active && p.is_default) || fiscalProfiles.data.find(p => p.is_active);
      if (preferred) setFiscalProfileId(preferred.id);
    }
  }, [fiscalProfiles.data, fiscalProfileId]);
  
  const [branches, setBranches] = useState<CustomerBranch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  useEffect(()=>{
    if(warranty){setSelectedCustomerId(warranty.source_order.customer_id);setWarehouseId(warranty.source_order.warehouse_id || '');}
  },[warranty]);
  useEffect(()=>{
    if(warranty && branches.some(b=>b.id===warranty.source_order.branch_id))setSelectedBranchId(warranty.source_order.branch_id);
  },[branches,warranty]);
  
  const [paymentType, setPaymentType] = useState<'CONTADO' | 'CREDITO'>('CONTADO');
  const [creditTerm, setCreditTerm] = useState<8 | 15 | 21>(15);

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
    if (requiresInvoice && (!selectedFiscalProfile || fiscalProfiles.isFetching || fiscalProfiles.error)) {
      toast.error('Selecciona un perfil fiscal activo del cliente para solicitar la factura.'); return;
    }
    if(warrantyId && (!isAdmin || !warranty || items.some(i=>i.product_id!==warranty.item.product_id) || items.reduce((sum,i)=>sum+i.quantity,0)>warranty.quantity)) {
      toast.error('La reposición debe usar el producto y hasta la cantidad registrada en la garantía.');return;
    }
    if (pricedItems.some(i => !Number.isFinite(i.discount_percent) || i.discount_percent<0 || i.discount_percent>100 || (i.discount_percent>0 && !i.discount_reason.trim()))) {
      toast.error('Captura un descuento entre 0 y 100% y su motivo para cada producto.');
      return;
    }
    if (!selectedCustomerId) {
      toast.error('Por favor selecciona un cliente (o asegúrate de estar registrado como cliente).');
      return;
    }
    
    if (!selectedBranchId) {
      toast.error('Por favor selecciona una sucursal para el envío.');
      return;
    }

    if (isStaff && (!warehouseId || !priceListId || loadingPrices || priceError || missingPrices)) {
      toast.error('Selecciona almacén y lista con precio para todos los productos.');
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
        requires_invoice: requiresInvoice,
        fiscal_profile_id: requiresInvoice ? fiscalProfileId : undefined,
        invoice_payment_form: requiresInvoice ? invoicePaymentForm : undefined,
        warranty_return_id: isAdmin ? warrantyId || undefined : undefined,
        warehouse_id: warehouseId || undefined,
        price_list_id: priceListId || undefined,
        branch_id: selectedBranchId,
        payment_type: paymentType,
        credit_term_days: paymentType === 'CREDITO' ? creditTerm : undefined,
        total_amount: orderTotal,
        shipping_address: branchAddress,
        items: pricedItems.map(i => ({
          product_id: i.product_id,
          quantity: i.quantity,
          unit_price: i.price!,
          subtotal: i.price! * i.quantity,
          discount_percent: i.discount_percent, discount_reason: i.discount_reason
        }))
      });
      
      clearCart();
      sessionStorage.removeItem('warranty-return-id');
      setIsSuccess(true);
    } catch (error) {
      console.error('Error creating order', error);
      toast.error((error as {message?: string})?.message || 'Ocurrió un error al crear el pedido.');
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
              {isStaff && <div className="space-y-4">
                <label className="block text-[13px] font-medium text-[#1D1D1F]">Almacén de salida *</label>
                <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all disabled:opacity-50 text-[14px] text-[#1D1D1F]" value={warehouseId} onChange={e => {
                  setWarehouseId(e.target.value);
                  const warehouse = warehouses?.find(w => w.id === e.target.value);
                  setPriceListId((warehouse as { price_list_id?: string })?.price_list_id || '');
                }}>
                  <option value="">Selecciona el almacén</option>
                  {warehouses?.filter(w => w.is_active && w.warehouse_role === 'SALES').map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
                <p className="text-xs text-gray-500">Los pedidos salen del almacén de ventas. El principal se usa para compras y traspasos.</p>
                <label className="block text-[13px] font-medium text-[#1D1D1F]">Lista de venta (público / mayoreo) *</label>
                <select className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all disabled:opacity-50 text-[14px] text-[#1D1D1F]" value={priceListId} onChange={e => setPriceListId(e.target.value)}>
                  <option value="">Selecciona una lista</option>
                  {priceLists?.filter(p => p.is_active).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {loadingPrices && <p className="text-sm">Consultando precios...</p>}
                {(priceError || (priceListId && !loadingPrices && missingPrices)) && <p className="text-sm text-red-600">Hay productos sin precio en esta lista o no se pudo consultar.</p>}
                <p className="text-xs text-gray-500">Las existencias se descuentan al enviar o entregar el pedido.</p>
              </div>}
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

              <CreditSelector
                paymentType={paymentType}
                onPaymentTypeChange={setPaymentType}
                creditTerm={creditTerm}
                onCreditTermChange={setCreditTerm}
                isStaff={isAdmin || profile?.user_type === 'AGENT'}
              />
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <label className="flex items-center gap-3 text-[14px] font-medium text-[#1D1D1F] cursor-pointer">
                  <input type="checkbox" checked={requiresInvoice} disabled={!selectedCustomerId} onChange={e => setRequiresInvoice(e.target.checked)} className="w-4 h-4 rounded border-gray-300 accent-[#0066CC]" />
                  Requiere factura
                </label>
                {requiresInvoice && <div className="space-y-3 bg-gray-50 rounded-xl border border-gray-100 p-4">
                  {fiscalProfiles.isFetching ? <p className="text-[13px] text-[#86868B]">Cargando datos fiscales…</p> : fiscalProfiles.error ? <p className="text-[13px] text-red-600">No se pudieron cargar los perfiles fiscales. <button type="button" onClick={() => fiscalProfiles.refetch()} className="underline">Reintentar</button></p> : activeFiscalProfiles.length === 0 ? <p className="text-[13px] text-[#86868B]">Este cliente no tiene perfiles fiscales activos. Registra sus datos fiscales en Clientes antes de solicitar la factura.</p> : <>
                    <label className="block text-[13px] font-medium">Información de facturación
                      <select value={fiscalProfileId} onChange={e => setFiscalProfileId(e.target.value)} className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-2">
                        <option value="">Seleccionar perfil fiscal</option>
                        {activeFiscalProfiles.map(p => <option key={p.id} value={p.id}>{p.legal_name} · {p.rfc}{p.is_default ? ' · Predeterminado' : ''}</option>)}
                      </select>
                    </label>
                    {selectedFiscalProfile && <p className="text-[12px] text-[#86868B] break-words">RFC: {selectedFiscalProfile.rfc} · CP: {selectedFiscalProfile.fiscal_zip_code} · {selectedFiscalProfile.billing_email}</p>}
                  </>}
                  <label className="block text-[13px] font-medium">Forma de pago para facturación
                    <select value={invoicePaymentForm} onChange={e => setInvoicePaymentForm(e.target.value)} className="mt-1 w-full bg-white border border-gray-200 rounded-lg px-3 py-2">
                      {invoicePaymentForms.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </label>
                </div>}
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1D1D1F] mb-4">Productos</h3>
            {isAdmin && <label className="block text-[13px] mb-5">Reposición por garantía (opcional)<select value={warrantyId} disabled={warranties.isLoading || !!warranties.error} onChange={e=>{setWarrantyId(e.target.value);sessionStorage.removeItem('warranty-return-id');}} className="block w-full border border-gray-200 rounded-lg p-2 mt-1"><option value="">Venta normal</option>{warranties.data?.map(r=><option value={r.id} key={r.id}>{r.item.products?.code} · {r.quantity} pieza(s) · {r.id.slice(0,8)}</option>)}</select>{warranties.error && <span className="text-red-600">No se pudieron consultar las garantías.</span>}{warrantyId && <p className="text-[#86868B] mt-2">La reposición consume inventario. Su importe marcado pagado no se cuenta como una nueva venta en el reporte de ganancias.</p>}</label>}
            <div className="space-y-4">
              {pricedItems.map(item => (
                <div key={item.product_id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                  <div className="flex gap-4 items-center">
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-lg text-sm font-medium text-gray-600">
                      {item.quantity}
                    </span>
                    <div>
                      <p className="text-[14px] font-medium text-[#1D1D1F]">{item.name}</p>
                      <p className="text-[12px] text-[#86868B]">{item.code}</p>
                      {isStaff && <div className="flex flex-wrap gap-3 mt-3 text-[12px]">
                        <p className="w-full text-[#86868B]">Precio de lista: {item.listPrice == null ? 'Sin precio' : new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(item.listPrice)}</p>
                        <label>Descuento (%)<input aria-label={`Descuento ${item.code}`} type="number" min="0" max="100" step="any" value={discounts[item.product_id]?.percent || ''} onChange={e=>setDiscounts(old=>({...old,[item.product_id]:{reason:old[item.product_id]?.reason || '',percent:e.target.value}}))} className="block w-24 mt-1 px-3 py-2 border border-gray-200 rounded-lg" /></label>
                        <label>Precio final por unidad ($)<input aria-label={`Precio final ${item.code}`} disabled={item.listPrice==null || item.listPrice===0} type="number" min="0" max={item.listPrice ?? 0} step="0.01" value={item.price ?? ''} onChange={e=>{if(item.listPrice && e.target.value!=='')setDiscounts(old=>({...old,[item.product_id]:{reason:old[item.product_id]?.reason || '',percent:String(100*(1-Number(e.target.value)/item.listPrice!))}}));}} className="block w-36 mt-1 px-3 py-2 border border-gray-200 rounded-lg" /></label>
                        <label>Motivo<input value={discounts[item.product_id]?.reason || ''} onChange={e=>setDiscounts(old=>({...old,[item.product_id]:{percent:old[item.product_id]?.percent || '',reason:e.target.value}}))} className="block mt-1 px-3 py-2 border border-gray-200 rounded-lg" /></label>
                        <p className="w-full text-[#1D1D1F]">Precio final por unidad: {item.price == null ? 'Sin precio' : new Intl.NumberFormat('es-MX', {style:'currency',currency:'MXN'}).format(item.price)}</p>
                      </div>}
                    </div>
                  </div>
                  <span className="font-medium text-[#1D1D1F]">
                    {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format((item.price ?? 0) * item.quantity)}
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
                <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(orderTotal)}</span>
              </div>
              <div className="flex justify-between items-center text-[14px] text-gray-600">
                <span>Costo de Envío</span>
                <span className="text-[#86868B] italic">Por definir</span>
              </div>
            </div>

            <div className="flex justify-between items-center py-4 text-lg font-bold text-[#1D1D1F]">
              <span>Total Estimado</span>
              <span>{new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(orderTotal)}</span>
            </div>

            <button
              onClick={handleConfirmOrder}
              disabled={isLoading || !selectedCustomerId || (isStaff && (!warehouseId || !priceListId || loadingPrices || !!priceError || missingPrices))}
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
