import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { Table } from '../../../components/ui/Table';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { RefreshCw, Save, Loader2 } from 'lucide-react';
import { LoadingState } from '../../../components/ui/LoadingState';
import { inventoryKeys } from '../../../utils/queryKeys';
import { useWarehouses } from '../hooks/useInventory';

interface Valuation {
  inventory_id: string; product_id: string; warehouse_id: string; code: string; name: string; warehouse_name: string; quantity: number;
  average_cost: number | null; original_average_cost: number | null; inventory_value: number | null;
}
interface Margin {
  order_id: string; agent_id: string; warehouse_id: string; warehouse_name: string; sold_at: string;
  code: string; name: string; quantity: number; subtotal: number; amount_paid: number; total_amount: number;
  warehouse_margin: number | null; upstream_margin: number | null; gross_profit: number | null;
  warranty_loss:number|null;returned_quantity:number;
}
const money = (value: number | null) => value == null ? 'Sin costo' : formatCurrency(value);
// Page through reports instead of silently stopping at the API's row limit.
async function readAll<T>(view: string, order: string | string[]): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    let request = (supabase as any).from(view).select('*');
    for (const column of typeof order === 'string' ? [order] : order) request = request.order(column);
    const { data, error } = await request.range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export const MarginsPage = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'sales' | 'stock'>('sales');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [agent, setAgent] = useState('');
  const [product, setProduct] = useState('');
  const [editing, setEditing] = useState<Valuation | null>(null);
  const [cost, setCost] = useState('');
  const [originalCost, setOriginalCost] = useState('');
  const [saving, setSaving] = useState(false);
  const stock = useQuery({ queryKey: ['inventory_valuation'], queryFn: () => readAll<Valuation>('inventory_valuation', 'inventory_id') });
  const {data: warehouses} = useWarehouses();
  const sales = useQuery({ queryKey: ['sales_margins'], queryFn: () => readAll<Margin>('sales_margins', 'item_id') });
  const prices = useQuery({ queryKey: ['margin-sale-prices'], enabled: tab === 'stock', queryFn: () => readAll<{product_id: string; price_list_name: string; amount: number}>('current_product_prices', ['product_id', 'price_list_id']) });
  const users = useQuery({ queryKey: ['margin-agents'], queryFn: async () => {
    const { data, error } = await supabase.from('user_profiles').select('auth_user_id, first_name, last_name');
    if (error) throw error;
    return data;
  } });
  const agentName = (id: string) => {
    const user = users.data?.find(u => u.auth_user_id === id);
    return user ? `${user.first_name} ${user.last_name}` : id;
  };
  const search = product.trim().toLocaleLowerCase();
  const matchingProduct = (row: {code: string; name: string}) => `${row.code} ${row.name}`.toLocaleLowerCase().includes(search);
  const filtered = (sales.data || []).filter(row => {
    const date = new Date(row.sold_at).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return (!start || date >= start) && (!end || date <= end) && (!warehouse || row.warehouse_name === warehouse)
      && (!agent || row.agent_id === agent) && matchingProduct(row);
  });
  const orders = [...new Map(filtered.map(row => [row.order_id, row])).values()];
  const sum = (field: 'subtotal' | 'gross_profit' | 'warehouse_margin' | 'upstream_margin' | 'warranty_loss') => filtered.reduce((total, row) => total + (row[field] ?? 0), 0);
  const knownCosts = filtered.every(row => row.gross_profit != null);
  const warehouseNames = [...new Set([...(stock.data || []).map(r => r.warehouse_name), ...(sales.data || []).map(r => r.warehouse_name)])].sort();
  const saveCost = async () => {
    if (!editing || cost === '' || originalCost === '') return;
    setSaving(true);
    try {
      const { error } = await (supabase.rpc as any)('set_inventory_cost', {
        p_inventory_id: editing.inventory_id, p_unit_cost: Number(cost), p_original_unit_cost: Number(originalCost)
      });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['inventory_valuation'] });
      await queryClient.invalidateQueries({ queryKey: inventoryKeys.stock() });
      setEditing(null);
      toast.success('Costos actualizados');
    } catch (error) { toast.error((error as {message?: string})?.message || 'Error al guardar costos'); }
    finally { setSaving(false); }
  };
  const query = tab === 'sales' ? sales : stock;
  return <div className="space-y-6">
    <div>
      <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Costos y ganancias</h2>
      <p className="text-[15px] text-[#86868B] mt-1 max-w-3xl">Ganancia bruta antes de gastos, comisiones e impuestos, descontando garantías. Se registra al enviar o entregar el pedido; las cancelaciones se excluyen.</p>
    </div>
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div className="inline-flex self-start bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
      <button className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'sales' ? 'bg-white shadow-sm text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} onClick={() => setTab('sales')}>Ventas y márgenes</button>
      <button className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${tab === 'stock' ? 'bg-white shadow-sm text-[#1D1D1F]' : 'text-[#86868B] hover:text-[#1D1D1F]'}`} onClick={() => setTab('stock')}>Costos del inventario</button>
      </div>
      <button className="px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2 self-start sm:self-auto" onClick={() => { stock.refetch(); sales.refetch(); if (tab === 'stock') prices.refetch(); }}><RefreshCw className={`w-4 h-4 ${query.isFetching ? 'animate-spin' : ''}`} />Actualizar</button>
    </div>
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-end">
      <label className="block text-[13px] font-medium text-[#1D1D1F]">Almacén<select className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={warehouse} onChange={e => setWarehouse(e.target.value)}>
        <option value="">Todos</option>{warehouseNames.map(name => <option key={name}>{name}</option>)}
      </select></label>
      <label className="block text-[13px] font-medium text-[#1D1D1F]">Producto<input className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" placeholder="Código o nombre" value={product} onChange={e => setProduct(e.target.value)} /></label>
      {tab === 'sales' && <>
        <label className="block text-[13px] font-medium text-[#1D1D1F]">Desde<input type="date" className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={start} onChange={e => setStart(e.target.value)} /></label>
        <label className="block text-[13px] font-medium text-[#1D1D1F]">Hasta<input type="date" className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={end} onChange={e => setEnd(e.target.value)} /></label>
        <label className="block text-[13px] font-medium text-[#1D1D1F]">Vendedor<select className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={agent} onChange={e => setAgent(e.target.value)}>
          <option value="">Todos</option>{[...new Set((sales.data || []).map(r => r.agent_id))].map(id => <option key={id} value={id}>{agentName(id)}</option>)}
        </select></label>
      </>}
    </div>
    {query.error ? <p className="text-red-600">No se pudo consultar el reporte: {(query.error as Error).message}</p> : query.isLoading ? <LoadingState message="Cargando reporte…" /> : tab === 'sales' ? <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          ['Venta de productos', formatCurrency(sum('subtotal'))],
          ['Margen almacén de venta', knownCosts ? formatCurrency(sum('warehouse_margin')) : 'Costos incompletos'],
          ['Margen interno acumulado', knownCosts ? formatCurrency(sum('upstream_margin')) : 'Costos incompletos'],
          ['Ganancia bruta total', knownCosts ? formatCurrency(sum('gross_profit')) : 'Costos incompletos']
        ].map(([label, value]) => <div key={label} className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm"><p className="text-[12px] font-medium text-[#86868B]">{label}</p><p className="text-[24px] font-semibold tracking-tight text-[#1D1D1F] mt-2 break-words">{value}</p></div>)}
      </div>
      <p className="text-sm text-gray-500">Cobrado en los {orders.length} pedidos incluidos: {formatCurrency(orders.reduce((sum, row) => sum + (row.amount_paid || 0), 0))}. Pendiente: {formatCurrency(orders.reduce((sum, row) => sum + Math.max(0, row.total_amount - (row.amount_paid || 0)), 0))}. Al filtrar productos, la cobranza corresponde a los pedidos completos.</p>
      <Table data={filtered} columns={[
        {header: 'Producto', cell: r => <div><p className="text-[13px] font-medium text-[#0066CC]">{r.code}</p><p className="text-[14px] text-[#1D1D1F] mt-0.5">{r.name}</p></div>},
        {header: 'Almacén', accessorKey: 'warehouse_name'},
        {header: 'Vendedor', cell: r => agentName(r.agent_id)},
        {header: 'Cantidad', accessorKey: 'quantity', className: 'text-right font-semibold tabular-nums'},
        {header: 'Venta', className: 'text-right tabular-nums', cell: r => money(r.subtotal)},
        {header: 'Garantías',className:'text-right tabular-nums',cell:r=><div>{r.returned_quantity} pieza(s)<p className="text-xs text-[#86868B]">{money(r.warranty_loss)}</p></div>},
        {header: 'Margen venta', className: 'text-right tabular-nums', cell: r => money(r.warehouse_margin)},
        {header: 'Margen interno', className: 'text-right tabular-nums', cell: r => money(r.upstream_margin)},
        {header: 'Ganancia bruta', className: 'text-right tabular-nums', cell: r => money(r.gross_profit)}
      ]} />
      <p className="text-xs text-gray-500">Los pedidos anteriores a esta implementación no tienen costos históricos y no se incluyen automáticamente.</p>
    </> : <>
      <p className="text-sm text-gray-500">Para existencias anteriores, captura el costo promedio del almacén y el costo original de compra. En el principal normalmente son iguales; en el secundario, el primero incluye el precio interno.</p>
      {!!stock.data?.filter(r => r.quantity > 0 && (r.average_cost == null || r.original_average_cost == null)).length && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3">Hay {stock.data.filter(r => r.quantity > 0 && (r.average_cost == null || r.original_average_cost == null)).length} existencias antiguas sin costo. Captura sus costos reales para poder traspasarlas o venderlas con una ganancia confiable.</p>}
      {prices.error && <p className="text-red-600 text-sm">No se pudieron consultar los precios de venta.</p>}
      <Table data={(stock.data || []).filter(r => (!warehouse || r.warehouse_name === warehouse) && matchingProduct(r))} columns={[
        {header: 'Producto', cell: r => <div><p className="text-[13px] font-medium text-[#0066CC]">{r.code}</p><p className="text-[14px] text-[#1D1D1F] mt-0.5">{r.name}</p></div>},
        {header: 'Almacén', accessorKey: 'warehouse_name'},
        {header: 'Existencia', accessorKey: 'quantity'},
        {header: 'Costo promedio', className: 'text-right tabular-nums', cell: r => money(r.average_cost)},
        {header: 'Costo original', className: 'text-right tabular-nums', cell: r => money(r.original_average_cost)},
        {header: 'Valor inventario', className: 'text-right tabular-nums', cell: r => money(r.inventory_value)},
        {header: 'Precios de venta', cell: r => <div className="text-xs space-y-1">
          {warehouses?.find(w => w.id === r.warehouse_id)?.warehouse_role === 'PURCHASE' ? <p>No aplica · se vende desde el secundario</p> : <>
            {prices.isLoading ? 'Cargando…' : (prices.data || []).filter(p => p.product_id === r.product_id).map(p => <p key={p.price_list_name}>{p.price_list_name}: {money(p.amount)}</p>)}
            <Link className="text-[#0066CC] hover:underline font-medium" to={`/catalog/products/${r.product_id}`}>Configurar precios</Link>
          </>}
        </div>},
        {header: 'Acciones', cell: r => <button className="text-[#0066CC] hover:underline font-medium" onClick={() => {setEditing(r); setCost(r.average_cost?.toString() || ''); setOriginalCost(r.original_average_cost?.toString() || '');}}>Configurar costos</button>}
      ]} />
    </>}
    <Modal isOpen={!!editing} onClose={() => setEditing(null)} title="Configurar costos actuales">
      <form className="space-y-5" onSubmit={e => {e.preventDefault(); saveCost();}}>
        <p className="text-[14px] text-[#86868B] bg-gray-50 border border-gray-200/60 rounded-xl p-4">{editing?.code} · {editing?.warehouse_name}. Esta modificación afecta las salidas futuras y conserva los costos de ventas anteriores.</p>
        <label className="block text-[13px] font-medium text-[#1D1D1F]">Costo promedio del almacén ($)<input required type="number" min="0" step="0.0001" className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={cost} onChange={e => setCost(e.target.value)} /></label>
        <label className="block text-[13px] font-medium text-[#1D1D1F]">Costo original promedio de compra ($)<input required type="number" min="0" step="0.0001" className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all disabled:opacity-50 mt-1.5" value={originalCost} onChange={e => setOriginalCost(e.target.value)} /></label>
        <div className="pt-4 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-gray-100">
          <button type="button" disabled={saving} onClick={() => setEditing(null)} className="px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">Cancelar</button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-[14px] font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#0055FF] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Guardando…' : 'Guardar costos'}</button>
        </div>
      </form>
    </Modal>
  </div>;
};
