import { useState } from 'react';
import { ordersService } from '../services/orders.service';
import toast from 'react-hot-toast';
export const OrderItemDiscount = ({item,onSaved}:{item:{id:string;discount_percent?:number;discount_reason?:string|null;list_unit_price?:number|null};onSaved:()=>void}) => {
  const [percent,setPercent]=useState(String(item.discount_percent || 0));
  const [reason,setReason]=useState(item.discount_reason || '');
  const [saving,setSaving]=useState(false);
  const [isEditing, setIsEditing] = useState(false);

  if (!isEditing) {
    if (Number(item.discount_percent || 0) === 0) {
      return (
        <div className="mt-1">
          {item.list_unit_price!=null && <p className="text-[11px] text-[#86868B]">Lista: {new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(item.list_unit_price)}</p>}
          <button onClick={() => setIsEditing(true)} className="text-[11px] font-medium text-[#0066CC] hover:underline mt-0.5">Añadir descuento</button>
        </div>
      );
    } else {
      return (
        <div className="mt-1 flex items-center gap-2">
          {item.list_unit_price!=null && <p className="text-[11px] text-[#86868B] line-through">Lista: {new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(item.list_unit_price)}</p>}
          <span className="px-1.5 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold rounded">-{item.discount_percent}%</span>
          <span className="text-[11px] text-gray-500 italic truncate max-w-[120px]">{item.discount_reason}</span>
          <button onClick={() => setIsEditing(true)} className="text-[11px] font-medium text-[#0066CC] hover:underline ml-1">Editar</button>
        </div>
      );
    }
  }

  return (
    <div className="mt-2 bg-gray-50 p-2.5 rounded-lg border border-gray-200/60 w-full max-w-sm">
      {item.list_unit_price!=null && <div className="flex justify-between items-center mb-2 text-[11px]"><span className="text-[#86868B]">Precio de lista</span><span className="font-medium">{new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(item.list_unit_price)}</span></div>}
      <form className="flex flex-col gap-2 text-[11px]" onSubmit={async e=>{
        e.preventDefault();setSaving(true);
        try{await ordersService.setItemDiscount(item.id,Number(percent),reason);toast.success('Descuento actualizado');setIsEditing(false);onSaved();}
        catch(error){toast.error((error as Error).message);}finally{setSaving(false);}
      }}>
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-gray-600 mb-0.5">% Desc.</span>
            <input aria-label="Descuento del producto" disabled={saving} required type="number" min="0" max="100" step="any" value={percent} onChange={e=>setPercent(e.target.value)} className="w-full p-1.5 border border-gray-200 rounded-md focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]" />
          </label>
          {item.list_unit_price!=null && item.list_unit_price>0 && (
            <label className="flex-1">
              <span className="block text-gray-600 mb-0.5">Precio Final</span>
              <input aria-label="Precio final del producto" disabled={saving} type="number" min="0" max={item.list_unit_price} step="0.01" value={Math.round(item.list_unit_price*(1-Number(percent)/100)*100)/100} onChange={e=>{if(e.target.value!=='')setPercent(String(100*(1-Number(e.target.value)/item.list_unit_price!)));}} className="w-full p-1.5 border border-gray-200 rounded-md focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]" />
            </label>
          )}
        </div>
        <label>
          <span className="block text-gray-600 mb-0.5">Motivo del descuento</span>
          <input disabled={saving} required={Number(percent)>0} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Ej. Mayoreo, Promoción..." className="w-full p-1.5 border border-gray-200 rounded-md focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC]" />
        </label>
        <div className="flex justify-end gap-2 mt-1">
          <button type="button" onClick={() => { setIsEditing(false); setPercent(String(item.discount_percent || 0)); setReason(item.discount_reason || ''); }} className="px-2 py-1 text-gray-600 hover:bg-gray-200 rounded-md">Cancelar</button>
          <button disabled={saving} className="px-3 py-1 bg-[#0066CC] text-white rounded-md font-medium disabled:opacity-50">{saving?'Guardando…':'Aplicar'}</button>
        </div>
      </form>
    </div>
  );
};
