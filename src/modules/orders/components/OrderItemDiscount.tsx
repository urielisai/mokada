import { useState } from 'react';
import { ordersService } from '../services/orders.service';
import toast from 'react-hot-toast';
export const OrderItemDiscount = ({item,onSaved}:{item:{id:string;discount_percent?:number;discount_reason?:string|null;list_unit_price?:number|null};onSaved:()=>void}) => {
  const [percent,setPercent]=useState(String(item.discount_percent || 0));
  const [reason,setReason]=useState(item.discount_reason || '');
  const [saving,setSaving]=useState(false);
  return <form className="flex flex-wrap gap-2 mt-2 text-[12px]" onSubmit={async e=>{
    e.preventDefault();setSaving(true);
    try{await ordersService.setItemDiscount(item.id,Number(percent),reason);toast.success('Descuento actualizado');onSaved();}
    catch(error){toast.error((error as Error).message);}finally{setSaving(false);}
  }}>
    {item.list_unit_price!=null && <p className="w-full text-[#86868B]">Lista: {new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN'}).format(item.list_unit_price)}</p>}
    <label>Descuento %<input aria-label="Descuento del producto" disabled={saving} required type="number" min="0" max="100" step="any" value={percent} onChange={e=>setPercent(e.target.value)} className="block w-24 p-2 mt-1 border border-gray-200 rounded-lg" /></label>
    {item.list_unit_price!=null && item.list_unit_price>0 && <label>Precio final ($)<input aria-label="Precio final del producto" disabled={saving} type="number" min="0" max={item.list_unit_price} step="0.01" value={Math.round(item.list_unit_price*(1-Number(percent)/100)*100)/100} onChange={e=>{if(e.target.value!=='')setPercent(String(100*(1-Number(e.target.value)/item.list_unit_price!)));}} className="block w-32 p-2 mt-1 border border-gray-200 rounded-lg" /></label>}
    <label>Motivo<input disabled={saving} required={Number(percent)>0} value={reason} onChange={e=>setReason(e.target.value)} className="block p-2 mt-1 border border-gray-200 rounded-lg" /></label>
    <button disabled={saving} className="self-end px-3 py-2 bg-[#0066CC] text-white rounded-lg disabled:opacity-50">{saving?'Guardando…':'Aplicar'}</button>
  </form>;
};
