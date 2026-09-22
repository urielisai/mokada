import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { returnsService } from '../services/returns.service';
import { useAuth } from '../../auth/context/useAuth';
import { supabase } from '../../../lib/supabase/client';
import { formatCurrency } from '../../../utils/formatters';
import { Upload } from 'lucide-react';

type Order = {id:string;status:string;sales_order_items:{id:string;quantity:number;products?:{name:string;code:string}|null}[]};
export const OrderReturns=({order}:{order:Order})=>{
  const {isAdmin}=useAuth();
  const [params]=useSearchParams();
  const client=useQueryClient();
  const [itemId,setItemId]=useState('');
  const [quantity,setQuantity]=useState('1');
  const [reason,setReason]=useState('');
  const [files,setFiles]=useState<File[]>([]);
  const [saving,setSaving]=useState(false);
  const [fileKey,setFileKey]=useState(0);
  const [costs,setCosts]=useState<Record<string,{unit:string;original:string}>>({});
  const [reviewing,setReviewing]=useState<string|null>(null);
  const [comments,setComments]=useState<Record<string,string>>({});
  const query=useQuery({queryKey:['order-returns',order.id],queryFn:()=>returnsService.getForOrder(order.id)});
  const replacements=useQuery({queryKey:['warranty-replacements',order.id,query.data?.map(r=>r.id)],enabled:isAdmin && !!query.data?.length,queryFn:async()=>{
    const {data,error}=await supabase.from('sales_orders').select('id,status,warranty_return_id').in('warranty_return_id',query.data!.map(r=>r.id)).neq('status','CANCELLED');
    if(error)throw error;return data;
  }});
  const privateCosts=useQuery({queryKey:['return-costs',order.id,query.data?.map(r=>r.id)],enabled:isAdmin && !!query.data?.length,queryFn:async()=>{
    const {data,error}=await (supabase as any).from('sales_return_costs').select('*').in('return_id',query.data!.map(r=>r.id));
    if(error)throw error;
    return data as {return_id:string;unit_cost:number|null;original_unit_cost:number|null}[];
  }});
  useEffect(()=>{
    const channel=supabase.channel(`returns-${order.id}`).on('postgres_changes',{event:'*',schema:'public',table:'sales_order_returns',filter:`order_id=eq.${order.id}`},()=>client.invalidateQueries({queryKey:['order-returns',order.id]})).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[order.id,client]);
  useEffect(()=>{setItemId('');setQuantity('1');setReason('');setFiles([]);setFileKey(k=>k+1);},[order.id]);
  useEffect(()=>{const id=params.get('return');if(id && query.data?.some(r=>r.id===id))document.getElementById(`return-${id}`)?.scrollIntoView({block:'center',behavior:'smooth'});},[params,query.data]);
  const remaining=(id:string)=>Math.max(0,(order.sales_order_items.find(i=>i.id===id)?.quantity || 0)-(query.data || []).filter(r=>r.item_id===id && r.status!=='REJECTED').reduce((sum,r)=>sum+r.quantity,0));
  const review=async(id:string,approve:boolean)=>{
    if(!approve && !comments[id]?.trim()){toast.error('Captura el motivo del rechazo.');return;}
    setReviewing(id);
    try{await returnsService.review(id,approve,comments[id] || '');await Promise.all([client.invalidateQueries({queryKey:['order-returns',order.id]}),client.invalidateQueries({queryKey:['sales_margins']}),client.invalidateQueries({queryKey:['available-warranties']})]);toast.success(approve?'Garantía aprobada. Puedes crear la reposición.':'Garantía rechazada.');}
    catch(error){toast.error((error as Error).message);}finally{setReviewing(null);}
  };
  return <section className="bg-white border border-gray-200/60 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
    <div><h3 className="font-semibold text-[#1D1D1F]">Devoluciones y garantías</h3><p className="text-[13px] text-[#86868B] mt-1">Las solicitudes de clientes requieren aprobación del administrador. Las registradas por agentes se autorizan directamente. Las piezas defectuosas quedan fuera del inventario vendible.</p></div>
    {isAdmin && privateCosts.error && <button className="text-sm text-red-600" onClick={()=>privateCosts.refetch()}>No se pudieron consultar los costos históricos. Reintentar</button>}
    {isAdmin && replacements.error && <button className="text-sm text-red-600" onClick={()=>replacements.refetch()}>No se pudo consultar la reposición. Reintentar</button>}
    {query.error?<button className="text-sm text-red-600" onClick={()=>query.refetch()}>No se pudieron consultar las devoluciones. Reintentar</button>:query.isLoading?<p className="text-sm text-[#86868B]">Cargando…</p>:<>
      {order.status==='DELIVERED' && <form className="space-y-3" onSubmit={async e=>{
        e.preventDefault();
        if(!Number.isInteger(Number(quantity)) || Number(quantity)<1 || Number(quantity)>remaining(itemId)){toast.error('Verifica la cantidad disponible para devolución.');return;}
        setSaving(true);
        try{const claim=await returnsService.request(order.id,itemId,Number(quantity),reason,files);toast.success(claim.status==='PENDING'?'Solicitud enviada, pendiente de aprobación.':'Garantía autorizada. Los administradores fueron notificados.');setReason('');setFiles([]);setFileKey(k=>k+1);await client.invalidateQueries({queryKey:['order-returns',order.id]});await client.invalidateQueries({queryKey:['sales_margins']});}
        catch(error){toast.error((error as Error).message);}finally{setSaving(false);}
      }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-[13px]">Producto entregado<select required disabled={saving} value={itemId} onChange={e=>{setItemId(e.target.value);setQuantity('1');}} className="block w-full border border-gray-200 rounded-lg px-3 py-2 mt-1"><option value="">Seleccionar producto</option>{order.sales_order_items.filter(i=>remaining(i.id)>0).map(i=><option key={i.id} value={i.id}>{i.products?.code} · {i.products?.name} ({remaining(i.id)} disponibles)</option>)}</select></label>
          <label className="text-[13px]">Cantidad<input required disabled={saving || !itemId} type="number" min="1" step="1" max={remaining(itemId)} value={quantity} onChange={e=>setQuantity(e.target.value)} className="block w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" /></label>
        </div>
        <label className="block text-[13px]">Motivo<textarea required maxLength={2000} disabled={saving} value={reason} onChange={e=>setReason(e.target.value)} className="block w-full border border-gray-200 rounded-lg px-3 py-2 mt-1" /></label>
        <div className="text-[13px]">
          <p className="mb-2">Evidencia (1 a 5 archivos)</p>
          <label className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 bg-[#0066CC] text-white font-semibold shadow-sm cursor-pointer hover:bg-[#005bb5] ${saving ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="w-4 h-4" /> Cargar evidencia
            <input key={fileKey} required disabled={saving} multiple type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e=>setFiles(Array.from(e.target.files || []))} className="sr-only" />
          </label>
          <p className="mt-2 text-[#1D1D1F]">{files.length ? `${files.length} archivo(s): ${files.map(file => file.name).join(', ')}` : 'Ningún archivo seleccionado'}</p>
        </div>
        <p className="text-[12px] text-[#86868B]">JPG, PNG, WEBP o PDF. Máximo 10 MB por archivo.</p>
        <button disabled={saving || !itemId || remaining(itemId)<1} className="px-4 py-2 bg-[#0066CC] text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving?'Registrando…':'Solicitar devolución por garantía'}</button>
      </form>}
      {!query.data?.length && <p className="text-sm text-[#86868B]">No hay devoluciones registradas.</p>}
      {query.data?.map(r=>{
        const item=order.sales_order_items.find(i=>i.id===r.item_id);
        const cost=privateCosts.data?.find(c=>c.return_id===r.id);
        const replacement=replacements.data?.find(o=>o.warranty_return_id===r.id);
        return <article id={`return-${r.id}`} key={r.id} className={`border rounded-xl p-4 text-[13px] ${params.get('return')===r.id?'border-[#0066CC] bg-blue-50/30':'border-gray-200/60'}`}>
          <p className="font-semibold">{item?.products?.code} · {item?.products?.name} · {r.quantity} pieza(s)</p>
          <span className={`inline-block mt-2 px-2 py-1 rounded-lg text-[12px] font-medium ${r.status==='PENDING'?'bg-amber-50 text-amber-800':r.status==='REJECTED'?'bg-red-50 text-red-700':'bg-green-50 text-green-700'}`}>{r.status==='PENDING'?'Pendiente de aprobación':r.status==='REJECTED'?'Rechazada':r.auto_approved?'Aprobada automáticamente':'Aprobada por administrador'}</span>
          <p className="text-[12px] text-[#86868B] mt-2">Solicitada: {new Date(r.created_at).toLocaleString('es-MX')}</p><p className="mt-2 whitespace-pre-wrap">{r.reason}</p>
          {r.reviewed_at && <p className="mt-2 text-[12px] text-[#86868B]">Resuelta: {new Date(r.reviewed_at).toLocaleString('es-MX')}</p>}
          {r.review_comment && <p className="mt-2 text-[13px] whitespace-pre-wrap">Respuesta: {r.review_comment}</p>}
          <div className="flex flex-wrap gap-3 mt-3">{r.evidence_paths.map((path,index)=><button key={path} type="button" className="text-[#0066CC] hover:underline" onClick={async()=>{const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;try{const url=await returnsService.evidenceUrl(path);if(tab)tab.location.href=url;}catch(error){tab?.close();toast.error((error as Error).message);}}}>Evidencia {index+1}</button>)}</div>
          {isAdmin && r.status==='PENDING' && <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
            <label className="block text-[13px]">Comentario / motivo del rechazo<textarea disabled={!!reviewing} maxLength={2000} value={comments[r.id] || ''} onChange={e=>setComments(old=>({...old,[r.id]:e.target.value}))} className="block w-full mt-1 px-3 py-2 border border-gray-200/60 rounded-lg" /></label>
            <div className="flex gap-3"><button disabled={!!reviewing} type="button" onClick={()=>review(r.id,true)} className="px-4 py-2 text-white bg-[#0066CC] rounded-lg disabled:opacity-50">{reviewing===r.id?'Guardando…':'Aprobar garantía'}</button><button disabled={!!reviewing} type="button" onClick={()=>review(r.id,false)} className="px-4 py-2 text-red-600 border border-red-200 rounded-lg disabled:opacity-50">Rechazar</button></div>
          </div>}
          {isAdmin && r.status==='APPROVED' && (replacement?<Link className="inline-block text-[#0066CC] font-medium mt-3" to={`/orders/${replacement.id}`}>Ver pedido de reposición · {replacement.id.slice(0,8)}</Link>:<Link onClick={()=>sessionStorage.setItem('warranty-return-id',r.id)} className="inline-block text-[#0066CC] font-medium mt-3" to={`/catalog/products?warranty=${r.id}`}>Crear pedido de reposición desde el catálogo</Link>)}
          {r.status==='PENDING' && <p className="mt-2 text-[12px] text-[#86868B]">La solicitud aún no descuenta ganancias ni permite crear la reposición.</p>}
          {r.status==='REJECTED' && <p className="mt-2 text-[12px] text-[#86868B]">No afecta ganancias. Las piezas quedan disponibles para una nueva solicitud.</p>}
          {isAdmin && r.status==='APPROVED' && cost && <p className="mt-2 text-[#86868B]">Pérdida estimada del negocio: {cost.original_unit_cost==null?'Sin costo histórico':formatCurrency(cost.original_unit_cost*r.quantity)}. Al despachar la reposición se usan sus costos reales.</p>}
          {isAdmin && r.status==='APPROVED' && cost && (cost.unit_cost==null || cost.original_unit_cost==null) && <form className="flex flex-wrap gap-2 mt-3" onSubmit={async e=>{e.preventDefault();try{const {error}=await (supabase.rpc as any)('set_return_cost',{p_return_id:r.id,p_unit_cost:Number(costs[r.id]?.unit),p_original_unit_cost:Number(costs[r.id]?.original)});if(error)throw error;await privateCosts.refetch();await client.invalidateQueries({queryKey:['sales_margins']});}catch(error){toast.error((error as Error).message);}}}>
            <input aria-label="Costo histórico del almacén" required type="number" min="0" step="0.0001" placeholder="Costo almacén" value={costs[r.id]?.unit || ''} onChange={e=>setCosts(old=>({...old,[r.id]:{original:old[r.id]?.original || '',unit:e.target.value}}))} className="w-36 border border-gray-200 rounded-lg p-2" />
            <input aria-label="Costo original histórico" required type="number" min="0" step="0.0001" placeholder="Costo original" value={costs[r.id]?.original || ''} onChange={e=>setCosts(old=>({...old,[r.id]:{unit:old[r.id]?.unit || '',original:e.target.value}}))} className="w-36 border border-gray-200 rounded-lg p-2" /><button className="text-[#0066CC]">Registrar costos anteriores</button>
          </form>}
        </article>;
      })}
    </>}
  </section>;
};
