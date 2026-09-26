import { supabase } from '../../../lib/supabase/client';
import { createClientUuid } from '../../../utils/createClientUuid';
import type { Database } from '../../../types/database.types';
export type OrderReturn = Database['public']['Tables']['sales_order_returns']['Row'];
export const returnsService = {
  async getAll() {
    const rows:any[]=[];
    for(let from=0;;from+=500){
      const {data,error}=await (supabase as any)
        .from('sales_order_returns')
        .select(`
          *,
          source_order:sales_orders!sales_order_returns_order_id_fkey(
            id, created_at, status, customer_id,
            customers(name, email)
          ),
          item:sales_order_items!sales_order_returns_item_id_fkey(
            id, product_id,
            products(name, code)
          ),
          replacement_orders:sales_orders!sales_orders_warranty_return_id_fkey(
            id, created_at, status
          )
        `)
        .order('created_at',{ascending:false})
        .order('id')
        .range(from,from+499);
      if(error)throw error;
      rows.push(...(data || []));
      if((data || []).length<500)return rows;
    }
  },
  async review(returnId:string,approve:boolean,comment:string) {
    const {data,error}=await supabase.rpc('review_order_return',{p_return_id:returnId,p_approve:approve,p_comment:comment});
    if(error)throw error;return data as OrderReturn;
  },
  async getForOrder(orderId:string):Promise<OrderReturn[]> {
    const rows:OrderReturn[]=[];
    for(let from=0;;from+=500){
      const {data,error}=await supabase.from('sales_order_returns').select('*').eq('order_id',orderId).order('created_at',{ascending:false}).order('id').range(from,from+499);
      if(error)throw error;rows.push(...data);if(data.length<500)return rows;
    }
  },
  async request(orderId:string,itemId:string,quantity:number,reason:string,files:File[]) {
    if(files.length<1 || files.length>5)throw Error('Adjunta entre una y cinco evidencias.');
    if(files.some(f=>f.size>10*1024*1024 || !['image/jpeg','image/png','image/webp','application/pdf'].includes(f.type)))throw Error('Usa imágenes JPG, PNG, WEBP o PDF de máximo 10 MB.');
    const {data:{user}}=await supabase.auth.getUser();
    if(!user)throw Error('Inicia sesión.');
    const id=createClientUuid();
    const paths:string[]=[];
    try{
      for(const [index,file] of files.entries()){
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'}[file.type];
        const path=`${user.id}/${orderId}/${id}/${index}.${ext}`;
        const {error}=await supabase.storage.from('return-evidence').upload(path,file,{upsert:false,contentType:file.type});
        if(error)throw error;
        paths.push(path);
      }
      const {data,error}=await supabase.rpc('request_order_return',{p_id:id,p_item_id:itemId,p_quantity:quantity,p_reason:reason,p_evidence_paths:paths});
      if(error)throw error;
      return data as OrderReturn;
    }catch(error){
      // A lost response may follow a committed transaction. Do not create the
      // same claim twice or delete evidence already attached to a claim.
      const {data:existing}=await supabase.from('sales_order_returns').select('*').eq('id',id).maybeSingle();
      if(existing)return existing as OrderReturn;
      if(paths.length)await supabase.storage.from('return-evidence').remove(paths);
      throw error;
    }
  },
  async evidenceUrl(path:string){
    const {data,error}=await supabase.storage.from('return-evidence').createSignedUrl(path,300);
    if(error)throw error;
    return data.signedUrl;
  }
};
