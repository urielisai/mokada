import { useState } from 'react';
import { ArrowRight, Package } from 'lucide-react';
import { formatCurrency, formatQuantity } from '../../../utils/formatters';
import type { InventoryStock } from '../services/inventory.service';
import { InventoryCostModal } from './InventoryProductInfo';

// What a transfer line needs to say: what leaves the purchase warehouse, what arrives
// in the sales warehouse, how many and at what cost. Warnings only when something blocks it.
export const TransferFlowSummary = ({ source, destination, sourceName, destinationName, destinationCode, quantity, stockLoaded = true }: {
  source?: InventoryStock; destination?: InventoryStock; sourceName?: string; destinationName?: string;
  destinationCode?: string; quantity: number; stockLoaded?: boolean;
}) => {
  const [editing, setEditing] = useState<InventoryStock | null>(null);
  const amount = Number.isFinite(quantity) ? quantity : 0;
  const available = Number(source?.available_quantity ?? 0);
  const cost = source?.average_cost;
  const missingCost = cost == null || source?.original_average_cost == null;
  const tooMany = amount > available;
  const before = (value: number | null | undefined) => stockLoaded ? formatQuantity(Number(value ?? 0)) : '…';

  return <div className="mt-4 space-y-2">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
      <span>{sourceName || 'Origen'} <strong className={tooMany ? 'text-red-600' : 'text-ink'}>{before(source?.available_quantity)} → {stockLoaded ? formatQuantity(available - amount) : '…'}</strong></span>
      <ArrowRight className="w-3.5 h-3.5 shrink-0" aria-hidden />
      <span>{destinationName || 'Destino'}{destinationCode ? <> como <strong className="text-ink">{destinationCode}</strong></> : null} <strong className="text-ink">{before(destination?.quantity)} → {stockLoaded ? formatQuantity(Number(destination?.quantity ?? 0) + amount) : '…'}</strong></span>
    </div>
    {!missingCost && <p className="text-[13px] text-muted">
      Costo <strong className="text-ink">{formatCurrency(cost!)}</strong> c/u · Total <strong className="text-ink">{formatCurrency(cost! * amount)}</strong>
    </p>}
    {stockLoaded && missingCost && <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
      Falta el costo en {sourceName || 'el origen'}.{' '}
      {source?.id && <button type="button" className="font-medium underline" onClick={() => setEditing(source)}>Configurar costo</button>}
    </p>}
    {stockLoaded && tooMany && <p className="text-[12px] text-red-600">Solo hay {formatQuantity(available)} disponibles en {sourceName || 'el origen'}.</p>}
    <InventoryCostModal stock={editing} onClose={() => setEditing(null)} />
  </div>;
};

export const TransferLine = ({ code, destinationCode, name, imageUrl, quantity, unitPrice, available, missingCost, isDraft, onImageClick }: {
  code?: string; destinationCode?: string; name?: string; imageUrl?: string | null; quantity: number;
  unitPrice: number | null; available?: number; missingCost?: boolean; isDraft: boolean; onImageClick?: () => void;
}) => {
  const tooMany = isDraft && available != null && quantity > available;
  return <div className="flex items-center gap-4 p-4 bg-white border border-gray-200/60 rounded-2xl">
    <button type="button" onClick={onImageClick} disabled={!imageUrl}
      className="w-14 h-14 shrink-0 flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 overflow-hidden disabled:cursor-default">
      {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-gray-300 stroke-[1.5]" />}
    </button>
    <div className="min-w-0 flex-1">
      <p className="text-[12px] font-medium text-accent break-all">
        {code}{destinationCode && destinationCode !== code ? <span className="text-muted"> → {destinationCode}</span> : null}
      </p>
      <p className="text-[14px] font-semibold text-ink leading-snug line-clamp-2" title={name}>{name}</p>
      {isDraft && (tooMany || missingCost) && <p className="text-[12px] text-red-600 mt-1">
        {tooMany ? `Solo hay ${formatQuantity(available ?? 0)} disponibles en el origen.` : 'Falta el costo en el origen.'}
      </p>}
    </div>
    <div className="shrink-0 text-right">
      <p className="text-[15px] font-semibold text-ink">{formatQuantity(quantity)} pzas</p>
      <p className="text-[12px] text-muted">
        {unitPrice == null ? 'Sin costo' : <>{formatCurrency(unitPrice)} c/u · {formatCurrency(unitPrice * quantity)}</>}
      </p>
    </div>
  </div>;
};
