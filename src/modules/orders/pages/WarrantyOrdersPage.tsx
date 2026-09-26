import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  PackageCheck,
  RotateCcw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase/client';
import { returnsService } from '../services/returns.service';
import { statusConfig } from './OrdersPage';

type WarrantyStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

const warrantyStatusConfig = {
  PENDING: { label: 'Pendiente de aprobación', color: 'bg-amber-100 text-amber-800', icon: Clock },
  APPROVED: { label: 'Aprobada', color: 'bg-emerald-100 text-emerald-800', icon: CheckCircle2 },
  REJECTED: { label: 'Rechazada', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const firstRelation = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value || undefined;

export const WarrantyOrdersPage = () => {
  const [warranties, setWarranties] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | WarrantyStatus>('ALL');

  const fetchWarranties = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) setIsLoading(true);
      setErrorMessage('');
      setWarranties(await returnsService.getAll());
    } catch (error) {
      console.error('Error fetching warranty orders:', error);
      setErrorMessage((error as Error).message || 'No se pudieron cargar los pedidos en garantía.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWarranties(true);
    const channel = supabase.channel('warranty_orders_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_returns' }, () => fetchWarranties())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => fetchWarranties())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchWarranties]);

  const counts = useMemo(() => ({
    total: warranties.length,
    pending: warranties.filter(warranty => warranty.status === 'PENDING').length,
    approved: warranties.filter(warranty => warranty.status === 'APPROVED').length,
    withoutReplacement: warranties.filter(warranty => {
      const replacements = Array.isArray(warranty.replacement_orders)
        ? warranty.replacement_orders
        : warranty.replacement_orders ? [warranty.replacement_orders] : [];
      return warranty.status === 'APPROVED' && !replacements.some((order:any) => order.status !== 'CANCELLED');
    }).length,
  }), [warranties]);

  const filteredWarranties = useMemo(() => warranties.filter(warranty => {
    const order = firstRelation<any>(warranty.source_order);
    const item = firstRelation<any>(warranty.item);
    const product = firstRelation<any>(item?.products);
    const customer = firstRelation<any>(order?.customers);
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [warranty.id, order?.id, product?.code, product?.name, customer?.name, customer?.email]
      .some(value => String(value || '').toLowerCase().includes(term));
    return matchesSearch && (statusFilter === 'ALL' || warranty.status === statusFilter);
  }), [search, statusFilter, warranties]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Ventas / Pedidos en garantía</h2>
        <p className="text-[15px] text-[#86868B] mt-1">Solicitudes de garantía y pedidos de reposición</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Garantías', value: counts.total, icon: ShieldCheck, color: 'text-gray-600', background: 'bg-gray-100' },
          { label: 'Por aprobar', value: counts.pending, icon: Clock, color: 'text-gray-600', background: 'bg-gray-100' },
          { label: 'Aprobadas', value: counts.approved, icon: CheckCircle2, color: 'text-gray-600', background: 'bg-gray-100' },
          { label: 'Sin reposición', value: counts.withoutReplacement, icon: RotateCcw, color: 'text-gray-600', background: 'bg-gray-100' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-gray-200/60 rounded-2xl p-4 shadow-sm">
            <div className={`w-9 h-9 rounded-xl ${card.background} ${card.color} flex items-center justify-center mb-3`}><card.icon className="w-4 h-4" /></div>
            <p className="text-[24px] font-bold text-[#1D1D1F]">{card.value}</p>
            <p className="text-[12px] text-[#86868B]">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar cliente, producto o folio..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] shadow-sm" />
        </div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as 'ALL' | WarrantyStatus)} className="px-4 py-2.5 bg-white border border-gray-200/60 rounded-xl text-[14px] font-medium text-[#1D1D1F] shadow-sm">
          <option value="ALL">Todos los estados</option>
          <option value="PENDING">Pendientes</option>
          <option value="APPROVED">Aprobadas</option>
          <option value="REJECTED">Rechazadas</option>
        </select>
      </div>

      {isLoading ? (
        <div className="bg-white border border-gray-200/60 rounded-2xl py-16 shadow-sm"><Loader2 className="w-8 h-8 animate-spin text-[#0066CC] mx-auto" /></div>
      ) : errorMessage ? (
        <div className="bg-white border border-red-200 rounded-2xl py-12 px-6 text-center shadow-sm">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-[14px] text-red-700">{errorMessage}</p>
          <button type="button" onClick={() => fetchWarranties(true)} className="mt-4 px-4 py-2 rounded-lg bg-[#0066CC] text-white text-[13px] font-semibold">Reintentar</button>
        </div>
      ) : filteredWarranties.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-2xl py-16 text-center shadow-sm">
          <PackageCheck className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-[14px] text-gray-500">No se encontraron pedidos en garantía</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {filteredWarranties.map(warranty => {
            const order = firstRelation<any>(warranty.source_order);
            const item = firstRelation<any>(warranty.item);
            const product = firstRelation<any>(item?.products);
            const customer = firstRelation<any>(order?.customers);
            const replacements = Array.isArray(warranty.replacement_orders)
              ? warranty.replacement_orders
              : warranty.replacement_orders ? [warranty.replacement_orders] : [];
            const replacement = replacements.find((candidate:any) => candidate.status !== 'CANCELLED');
            const warrantyConfig = warrantyStatusConfig[warranty.status as WarrantyStatus] || warrantyStatusConfig.PENDING;
            const WarrantyIcon = warrantyConfig.icon;
            const replacementConfig = replacement ? statusConfig[replacement.status as keyof typeof statusConfig] : null;
            const ReplacementIcon = replacementConfig?.icon;
            return (
              <article key={warranty.id} className="bg-white border border-gray-200/60 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[12px] font-medium text-[#0066CC]">GAR-{warranty.id.split('-')[0].toUpperCase()}</p>
                    <h3 className="text-[16px] font-semibold text-[#1D1D1F] mt-1">{product?.code || 'Sin código'} · {product?.name || 'Producto'}</h3>
                    <p className="text-[13px] text-[#86868B] mt-1">{warranty.quantity} pieza(s) · {customer?.name || 'Cliente'}</p>
                  </div>
                  <span className={`inline-flex shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${warrantyConfig.color}`}><WarrantyIcon className="w-3 h-3" />{warrantyConfig.label}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[12px]">
                  <div className="rounded-xl bg-[#F5F5F7] p-3"><p className="text-[#86868B]">Solicitada</p><p className="font-medium text-[#1D1D1F] mt-1">{format(new Date(warranty.created_at), 'dd/MM/yyyy HH:mm')}</p></div>
                  <div className="rounded-xl bg-[#F5F5F7] p-3"><p className="text-[#86868B]">Pedido original</p><p className="font-mono font-medium text-[#1D1D1F] mt-1">{order?.id?.split('-')[0]?.toUpperCase() || '—'}</p></div>
                </div>

                <p className="text-[13px] text-[#424245] line-clamp-2">{warranty.reason}</p>

                <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
                  <Link to={`/orders/${order?.id}?return=${warranty.id}`} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#0066CC] hover:underline">Ver solicitud <ExternalLink className="w-3.5 h-3.5" /></Link>
                  {replacement && replacementConfig && ReplacementIcon ? (
                    <Link to={`/orders/${replacement.id}`} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${replacementConfig.color}`}><ReplacementIcon className="w-3 h-3" />Reposición: {replacementConfig.label}</Link>
                  ) : warranty.status === 'APPROVED' ? (
                    <Link to="/catalog/products" onClick={() => sessionStorage.setItem('warranty-return-id', warranty.id)} className="ml-auto inline-flex items-center gap-2 bg-[#0066CC] hover:bg-[#005bb5] text-white px-3 py-2 rounded-lg text-[12px] font-semibold"><RotateCcw className="w-3.5 h-3.5" />Crear reposición</Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
