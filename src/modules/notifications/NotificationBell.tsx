import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase/client';
import { useAuth } from '../auth/context/useAuth';
import { usePresence } from '../../hooks/usePresence';

type Notification = {id:string;title:string;body:string;target_path:string;created_at:string;read_at:string|null};
export const NotificationBell = () => {
  const {profile} = useAuth();
  const uid = profile?.auth_user_id;
  const client = useQueryClient();
  const navigate = useNavigate();
  const [open,setOpen] = useState(false);
  const presence = usePresence(open, 180);
  const ref = useRef<HTMLDivElement>(null);
  const key = ['notifications',uid];
  const query = useQuery({queryKey:key,enabled:!!uid,queryFn:async()=>{
    const {data,error} = await supabase.from('notifications').select('*').eq('recipient_id',uid!).order('created_at',{ascending:false}).limit(50);
    if(error) throw error;
    return data as Notification[];
  }});
  const unread = useQuery({queryKey:['notification-count',uid],enabled:!!uid,queryFn:async()=>{
    const {count,error}=await supabase.from('notifications').select('id',{count:'exact',head:true}).eq('recipient_id',uid!).is('read_at',null);
    if(error)throw error;
    return count as number;
  }});
  const refresh=()=>Promise.all([client.invalidateQueries({queryKey:['notifications',uid]}),client.invalidateQueries({queryKey:['notification-count',uid]})]);
  useEffect(()=>{
    if(!uid)return;
    const channel=supabase.channel(`notifications-${uid}`).on('postgres_changes',{event:'*',schema:'public',table:'notifications',filter:`recipient_id=eq.${uid}`},()=>{client.invalidateQueries({queryKey:['notifications',uid]});client.invalidateQueries({queryKey:['notification-count',uid]});}).subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[uid,client]);
  useEffect(()=>{
    const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape')setOpen(false);};
    document.addEventListener('pointerdown',close);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',escape);};
  },[]);
  const mark=async(id?:string)=>{
    const {error}=await supabase.rpc('mark_notifications_read',id?{p_id:id}:{});
    if(error){toast.error(error.message);return;}
    await refresh();
  };
  return <div ref={ref} className="relative">
    <button type="button" aria-label={`Notificaciones, ${unread.data || 0} sin leer`} aria-expanded={open} onClick={()=>setOpen(!open)} className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-black/5 hover:text-ink">
      <Bell className="w-[18px] h-[18px]" />{!!unread.data && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white ring-2 ring-white animate-pop-in">{unread.data>99?'99+':unread.data}</span>}
    </button>
    {presence.isMounted && <div data-state={presence.state} className={`overlay-popover material-popover fixed inset-x-3 top-[3.5rem] origin-top md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-3 md:w-96 md:origin-top-right rounded-2xl ring-1 ring-black/[0.06] shadow-xl overflow-hidden text-ink ${open?'':'pointer-events-none'}`}>
      <div className="px-4 py-3.5 border-b border-black/[0.06] flex items-center justify-between gap-3"><h3 className="font-semibold text-[15px]">Notificaciones</h3><button type="button" className="rounded-full px-2 py-1 text-[12px] font-medium text-accent hover:bg-accent/10" onClick={()=>mark()}>Marcar todas leídas</button></div>
      <div className="max-h-96 overflow-y-auto">
        {query.isLoading?<p className="p-4 text-sm text-muted">Cargando…</p>:query.error?<button className="p-4 text-sm text-red-600" onClick={()=>query.refetch()}>No se pudieron cargar. Reintentar</button>:!query.data?.length?<p className="p-6 text-sm text-muted">No tienes notificaciones.</p>:query.data.map(n=><button key={n.id} type="button" className={`relative w-full px-4 py-3.5 text-left border-b border-black/[0.05] last:border-b-0 hover:bg-black/[0.03] ${n.read_at?'':'bg-accent/[0.04] before:absolute before:left-1.5 before:top-5 before:h-1.5 before:w-1.5 before:rounded-full before:bg-accent'}`} onClick={async()=>{
          // Only internal paths are valid, regardless of the notification source.
          if(!n.target_path.startsWith('/') || n.target_path.startsWith('//') || n.target_path.includes('\\'))return;
          await mark(n.id);setOpen(false);navigate(n.target_path);
        }}><p className="text-[13px] font-semibold">{n.title}</p><p className="text-[12px] text-muted mt-1 whitespace-pre-wrap">{n.body}</p><p className="text-[11px] text-muted mt-2">{new Date(n.created_at).toLocaleString('es-MX')}</p></button>)}
      </div>
    </div>}
  </div>;
};
