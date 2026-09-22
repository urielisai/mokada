import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '../../../components/ui/Modal';
import { supabase } from '../../../lib/supabase/client';
import { inventoryKeys } from '../../../utils/queryKeys';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';
import type { InventoryStock } from '../services/inventory.service';

const money = (value: number | null | undefined) => value == null ? 'Sin costo' : formatCurrency(value);
const inputStyle = 'w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] mt-1.5';

export const InventoryCostModal = ({ stock, onClose }: { stock: InventoryStock | null; onClose: () => void }) => {
  const queryClient = useQueryClient();
  const [cost, setCost] = useState('');
  const [original, setOriginal] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setCost(stock?.average_cost?.toString() ?? '');
    setOriginal(stock?.original_average_cost?.toString() ?? '');
  }, [stock]);
  return <Modal isOpen={!!stock} onClose={() => {if (!saving) onClose();}} title="Configurar costos del inventario">
    <form className="space-y-5" onSubmit={async e => {
      e.preventDefault();
      if (!stock?.id || cost === '' || original === '') return;
      setSaving(true);
      try {
        const { error } = await supabase.rpc('set_inventory_cost', {p_inventory_id: stock.id, p_unit_cost: Number(cost), p_original_unit_cost: Number(original)});
        if (error) throw error;
        await Promise.all([
          queryClient.invalidateQueries({queryKey: inventoryKeys.stock()}),
          queryClient.invalidateQueries({queryKey: ['inventory_valuation']})
        ]);
        toast.success('Costos actualizados');
        onClose();
      } catch (error) {toast.error((error as {message?: string})?.message || 'No se pudieron guardar los costos');}
      finally {setSaving(false);}
    }}>
      <div className="p-4 bg-gray-50 border border-gray-200/60 rounded-xl text-[13px] text-[#86868B]">
        <p className="font-medium text-[#1D1D1F]">{stock?.product_code} · {stock?.product_name}</p>
        <p className="mt-1">{stock?.warehouse_name} · {formatQuantity(stock?.quantity ?? 0)} unidades</p>
        <p className="mt-2">Captura los costos promedio de las existencias actuales. Las ventas anteriores conservan sus costos históricos.</p>
      </div>
      <label className="block text-[13px] font-medium text-[#1D1D1F]">Costo promedio del almacén ($)
        <input required disabled={saving} type="number" step="0.0001" min="0" className={inputStyle} value={cost} onChange={e => setCost(e.target.value)} />
      </label>
      <label className="block text-[13px] font-medium text-[#1D1D1F]">Costo original promedio de compra ($)
        <input required disabled={saving} type="number" step="0.0001" min="0" className={inputStyle} value={original} onChange={e => setOriginal(e.target.value)} />
      </label>
      <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
        <button type="button" disabled={saving} onClick={onClose} className="px-4 py-2 text-[14px] font-medium border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
        <button disabled={saving} className="flex items-center gap-2 px-4 py-2 text-[14px] font-medium text-white bg-[#0066CC] rounded-lg hover:bg-[#0055FF] disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Guardando…' : 'Guardar costos'}
        </button>
      </div>
    </form>
  </Modal>;
};

export const InventoryProductInfo = ({ source, destination, sourceName, destinationName, quantity, unitPrice, productId, stockLoaded = true, allowCostEdit = true }: {
  source?: InventoryStock; destination?: InventoryStock; sourceName?: string; destinationName?: string;
  quantity?: number; unitPrice?: number | null; productId: string; stockLoaded?: boolean; allowCostEdit?: boolean;
}) => {
  const [editing, setEditing] = useState<InventoryStock | null>(null);
  const amount = Number.isFinite(quantity) ? quantity! : 0;
  const missingCost = source?.average_cost == null || source?.original_average_cost == null;
  const available = source?.available_quantity ?? 0;
  const destinationQuantity = destination?.quantity ?? 0;
  const destinationMissingCost = destinationQuantity>0 && (destination?.average_cost == null || destination?.original_average_cost == null);
  const validPrice = unitPrice != null && Number.isFinite(unitPrice);
  const salesStock = destinationName ? destination || source : source?.warehouse_role === 'SALES' ? source : undefined;
  const projectedDestinationCost = validPrice && amount>0 && !destinationMissingCost
    ? (destinationQuantity*(destination?.average_cost ?? 0) + amount*unitPrice!)/(destinationQuantity+amount) : null;
  return <div className="space-y-3 mt-4">
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[{stock: source, name: sourceName || 'Origen', isSource: true}, ...(destinationName ? [{stock: destination, name: destinationName, isSource: false}] : [])].map(({stock, name, isSource}) => <div key={isSource ? 'source' : 'destination'} className="bg-gray-50 border border-gray-200/60 rounded-xl p-3">
        <p className="text-[12px] font-semibold text-[#1D1D1F] mb-2">{name} · existencias actuales</p>
        <div className="grid grid-cols-3 gap-2 text-[12px]">
          {[['Existencia', stock?.quantity], ['Reservado', stock?.reserved_quantity], ['Disponible', stock?.available_quantity]].map(([label, value]) => <div key={String(label)}><p className="text-[#86868B]">{label}</p><p className="font-semibold mt-1">{stockLoaded ? formatQuantity(Number(value ?? 0)) : '…'}</p></div>)}
        </div>
        {quantity != null && stockLoaded && <div className={`text-[12px] mt-3 space-y-1 ${isSource && amount > available ? 'text-red-600' : 'text-[#86868B]'}`}><p>Existencia prevista: {formatQuantity((stock?.quantity ?? 0) + (isSource ? -amount : amount))}</p><p>Disponible previsto: {formatQuantity((stock?.available_quantity ?? 0) + (isSource ? -amount : amount))}</p></div>}
      </div>)}
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12px] text-[#86868B]">
      <p>Costo del origen: <span className="font-semibold text-[#1D1D1F]">{stockLoaded ? money(source?.average_cost) : '…'}</span></p>
      <p>Costo original: <span className="font-semibold text-[#1D1D1F]">{stockLoaded ? money(source?.original_average_cost) : '…'}</span></p>
      {unitPrice != null && Number.isFinite(unitPrice) && quantity != null && <p>Total interno: <span className="font-semibold text-[#1D1D1F]">{formatCurrency(unitPrice * amount)}</span></p>}
      {destinationName && validPrice && source?.average_cost != null && <p>Margen interno por unidad: <span className="font-semibold text-[#1D1D1F]">{formatCurrency(unitPrice! - source.average_cost)}</span></p>}
      {destinationName && quantity != null && validPrice && amount>0 && <p>Costo promedio previsto del destino: <span className="font-semibold text-[#1D1D1F]">{money(projectedDestinationCost)}</span></p>}
    </div>
    {stockLoaded && quantity != null && missingCost && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">Falta el costo del producto en {sourceName || 'el origen'}. Debe configurarse antes de completar el traspaso.</div>}
    {stockLoaded && destinationName && validPrice && source?.average_cost != null && unitPrice! <= source.average_cost && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">El precio interno debe superar el costo promedio del origen para que el traspaso tenga margen.</div>}
    {stockLoaded && quantity != null && destinationMissingCost && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-800">{destinationName} ya tiene existencias anteriores sin costo. Configura sus costos actuales para que la entrada del traspaso pueda calcular el nuevo promedio y las ventas posteriores.</div>}
    {stockLoaded && quantity != null && amount > available && <p className="text-[12px] text-red-600">La cantidad supera el disponible del origen ({formatQuantity(available)}).</p>}
    <div className="flex flex-wrap gap-2">
      {salesStock?.sale_prices.map(price => <span key={price.price_list_id} className="px-2 py-1 text-[12px] bg-[#F5F5F7] border border-gray-200/60 rounded-lg text-[#1D1D1F]">{price.name}: {formatCurrency(price.amount)}</span>)}
      {stockLoaded && destinationName && salesStock && salesStock.sale_prices.length === 0 && <p className="text-[12px] text-[#86868B]">Sin precios de venta configurados para el producto.</p>}
    </div>
    {destinationName && projectedDestinationCost != null && salesStock?.sale_prices.length ? <div className="text-[12px] text-[#86868B]">Margen estimado de venta por unidad: {salesStock.sale_prices.map(price => <span key={price.price_list_id} className="inline-block mr-3 mt-1">{price.name} <strong className={price.amount < projectedDestinationCost ? 'text-red-600' : 'text-[#1D1D1F]'}>{formatCurrency(price.amount - projectedDestinationCost)}</strong></span>)}</div> : null}
    <div className="flex flex-wrap gap-4 text-[12px] font-medium text-[#0066CC]">
      {allowCostEdit && source?.id && <button type="button" className="hover:underline" onClick={() => setEditing(source)}>Configurar costo del origen</button>}
      {allowCostEdit && destination?.id && <button type="button" className="hover:underline" onClick={() => setEditing(destination)}>Configurar costo del destino</button>}
      <Link className="hover:underline" to={`/catalog/products/${productId}`}>Configurar precios de venta</Link>
    </div>
    <InventoryCostModal stock={editing} onClose={() => setEditing(null)} />
  </div>;
};
