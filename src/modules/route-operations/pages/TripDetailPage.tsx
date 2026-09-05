import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase/client';
import { routeKeys, expenseKeys } from '../../../utils/queryKeys';
import { useRouteTrip, useTripExpenses, useUpdateTripStatus, useUpdateExpenseStatus } from '../hooks/useRouteOperations';
import { ordersService } from '../../orders/services/orders.service';
import { generateRouteSettlementPdf } from '../utils/generateRouteSettlementPdf';
import { storageService } from '../../../lib/supabase/storage';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import { ArrowLeft, MapPin, DollarSign, Truck, User, CalendarDays, Paperclip, Wallet, Banknote, Building2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export const TripDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: trip, isLoading } = useRouteTrip(id || null);
  const { data: expenses } = useTripExpenses(id || null);
  const updateStatus = useUpdateTripStatus();
  const updateExpenseStatus = useUpdateExpenseStatus();

  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const expenseChannel = supabase
      .channel(`trip-expenses-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'travel_expenses', filter: `route_trip_id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: expenseKeys.tripExpenses(id) });
          queryClient.invalidateQueries({ queryKey: routeKeys.trip(id) });
        }
      )
      .subscribe();

    const tripChannel = supabase
      .channel(`trip-updates-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'route_trips', filter: `id=eq.${id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: routeKeys.trip(id) });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(expenseChannel);
      supabase.removeChannel(tripChannel);
    };
  }, [id, queryClient]);

  useEffect(() => {
    if (trip?.route_id && trip?.week_start_date && trip?.week_end_date) {
      setIsLoadingPayments(true);
      ordersService
        .getRoutePayments(trip.route_id, trip.week_start_date, trip.week_end_date)
        .then((data) => setPayments(data || []))
        .catch((err) => console.error('Error fetching route payments:', err))
        .finally(() => setIsLoadingPayments(false));
    }
  }, [trip?.route_id, trip?.week_start_date, trip?.week_end_date]);

  if (isLoading) return <LoadingState message="Cargando viaje..." />;
  if (!trip) return <div className="text-center py-12 text-[#86868B]">Viaje no encontrado</div>;

  const cashPayments = payments.filter((p) => p.payment_method === 'CASH');
  const transferPayments = payments.filter((p) => p.payment_method === 'TRANSFER');

  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) || 0;
  const totalCashCollected = cashPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalTransferCollected = transferPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalCollected = totalCashCollected + totalTransferCollected;

  const budget = Number(trip.budget_amount || 0);
  const balance = budget - totalExpenses;
  const netCashToDeliver = totalCashCollected + balance;

  const startDate = new Date(trip.week_start_date + 'T12:00:00');
  const endDate = new Date(trip.week_end_date + 'T12:00:00');

  const handleOpenPdfReport = () => {
    generateRouteSettlementPdf({
      routeCode: trip.routes?.code || 'RUTA',
      routeName: trip.routes?.name || 'Ruta',
      agentName: trip.agent ? `${trip.agent.first_name || ''} ${trip.agent.last_name || ''}`.trim() : 'Agente',
      vehicleInfo: trip.vehicle ? `${trip.vehicle.internal_code} (${trip.vehicle.brand} ${trip.vehicle.model})` : 'Sin Vehículo',
      weekStartDate: trip.week_start_date,
      weekEndDate: trip.week_end_date,
      budgetAmount: budget,
      totalExpenses: totalExpenses,
      totalCashCollected: totalCashCollected,
      totalTransferCollected: totalTransferCollected,
      totalCollected: totalCollected,
      netCashToDeliver: netCashToDeliver,
      payments: payments.map((p) => ({
        date: new Date(p.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
        orderId: p.sales_orders?.id || p.sales_order_id || '',
        customerName: p.sales_orders?.customers?.name || 'Cliente',
        branchName: p.sales_orders?.customer_branches?.name || 'Principal',
        method: p.payment_method,
        amount: Number(p.amount),
        status: p.status,
      })),
      expenses: (expenses || []).map((e: any) => ({
        date: e.expense_date,
        category: e.expense_categories?.name || 'Gasto',
        place: e.place_name || e.merchant_name || 'N/D',
        description: e.description || '—',
        amount: Number(e.amount),
        status: e.status,
      })),
    });
  };

  const handleViewEvidence = async (path: string) => {
    try {
      const url = await storageService.createSignedUrl('expense-evidence', path);
      setEvidenceUrl(url);
    } catch (error) {
      console.error('Error fetching evidence url:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/route-operations/trips" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-[#86868B]" />
          </Link>
          <div>
            <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">
              {trip.routes?.code} — {trip.routes?.name}
            </h2>
            <p className="text-[15px] text-[#86868B]">
              {startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} – {endDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenPdfReport}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0066CC] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#0055AA] shadow-sm"
          >
            <FileText className="w-4 h-4" />
            Ver / Imprimir PDF
          </button>
          <StatusBadge status={trip.status} />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#86868B] mb-2">
            <User className="w-4 h-4" /> <span className="text-[12px] font-medium uppercase tracking-wide">Agente</span>
          </div>
          <p className="text-[17px] font-semibold text-[#1D1D1F]">{trip.agent?.first_name} {trip.agent?.last_name}</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#86868B] mb-2">
            <Truck className="w-4 h-4" /> <span className="text-[12px] font-medium uppercase tracking-wide">Unidad</span>
          </div>
          <p className="text-[17px] font-semibold text-[#1D1D1F]">{trip.vehicle?.internal_code || '—'}</p>
          <p className="text-[13px] text-[#86868B]">{trip.vehicle?.brand} {trip.vehicle?.model}</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#86868B] mb-2">
            <DollarSign className="w-4 h-4" /> <span className="text-[12px] font-medium uppercase tracking-wide">Presupuesto</span>
          </div>
          <p className="text-[17px] font-semibold text-[#1D1D1F]">{formatCurrency(budget)}</p>
          <p className="text-[13px] text-[#86868B]">Gastado: {formatCurrency(totalExpenses)}</p>
        </div>
        <div className="bg-white border border-gray-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[#86868B] mb-2">
            <CalendarDays className="w-4 h-4" /> <span className="text-[12px] font-medium uppercase tracking-wide">Saldo Viáticos</span>
          </div>
          <p className={`text-[17px] font-semibold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{formatCurrency(balance)}
          </p>
          <p className="text-[13px] text-[#86868B]">{balance > 0 ? 'Agente devuelve' : balance < 0 ? 'Empresa reembolsa' : 'Balanceado'}</p>
        </div>
      </div>

      {/* Resumen de Cierre de Semana & Efectivo a Entregar */}
      <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-[17px] font-bold text-[#1D1D1F] flex items-center gap-2">
              <Banknote className="w-5 h-5 text-[#0066CC]" /> Liquidación y Efectivo en Mano
            </h3>
            <p className="text-[13px] text-[#86868B] mt-0.5">
              Cálculo de cobros en ruta, gastos de viáticos y efectivo a entregar en caja.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Efectivo Cobrado
            </span>
            <p className="mt-1 text-xl font-bold text-[#1D1D1F]">
              {formatCurrency(totalCashCollected)}
            </p>
            <span className="text-[11px] text-[#86868B]">
              {cashPayments.length} cobro(s) en efectivo
            </span>
          </div>

          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Gastos de Ruta
            </span>
            <p className="mt-1 text-xl font-bold text-[#1D1D1F]">
              {formatCurrency(totalExpenses)}
            </p>
            <span className="text-[11px] text-[#86868B]">
              Viáticos rest.: {formatCurrency(balance)}
            </span>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0066CC]">
              Efectivo a Entregar en Caja
            </span>
            <p className="mt-1 text-2xl font-bold text-[#0066CC]">
              {formatCurrency(netCashToDeliver)}
            </p>
            <span className="text-[11px] text-blue-800">
              Efectivo neto en mano
            </span>
          </div>
        </div>
      </div>

      {/* Status actions */}
      {trip.status === 'COMPLETED' && (
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus.mutate({ id: trip.id, status: 'UNDER_REVIEW' })}
            disabled={updateStatus.isPending}
            className="rounded-xl bg-purple-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-purple-700 transition-colors"
          >
            Enviar a revisión
          </button>
        </div>
      )}

      {/* Stops / Itinerary */}
      {trip.stops && trip.stops.length > 0 && (
        <div className="bg-white border border-gray-200/60 rounded-2xl p-6">
          <h3 className="text-[17px] font-semibold text-[#1D1D1F] mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#0066CC]" /> Itinerario
          </h3>
          <div className="space-y-3">
            {trip.stops.map((stop: any, idx: number) => (
              <div key={stop.id} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-full bg-[#0066CC]/10 text-[#0066CC] text-[12px] font-bold shrink-0">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-[14px] font-medium text-[#1D1D1F]">{stop.client_branches?.name || 'Parada'}</p>
                  <p className="text-[12px] text-[#86868B]">{stop.client_branches?.city}, {stop.client_branches?.state}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cobros / Pagos registrados en Ruta (Accordion) */}
      <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsPaymentsOpen(!isPaymentsOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-[#0066CC]" />
            <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Cobros de la Ruta</h3>
            <span className="text-xs bg-blue-50 text-[#0066CC] font-semibold px-2.5 py-0.5 rounded-full ml-1">
              {payments.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-[#86868B] block">Total cobrado</span>
              <span className="text-[14px] font-bold text-[#1D1D1F]">{formatCurrency(totalCollected)}</span>
            </div>
            {isPaymentsOpen ? (
              <ChevronUp className="w-5 h-5 text-[#86868B]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#86868B]" />
            )}
          </div>
        </button>

        {isPaymentsOpen && (
          <div className="border-t border-gray-100">
            {isLoadingPayments ? (
              <div className="px-6 py-8 text-center text-[#86868B]">Cargando cobros del viaje...</div>
            ) : payments && payments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {payments.map((pmt: any) => (
                  <div key={pmt.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] flex items-center justify-center text-[#86868B] shrink-0">
                        {pmt.payment_method === 'CASH' ? (
                          <Banknote className="w-5 h-5 text-[#1D1D1F]" />
                        ) : (
                          <Building2 className="w-5 h-5 text-[#0066CC]" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-semibold text-[#1D1D1F]">
                            {pmt.sales_orders?.customers?.name || 'Cliente'}
                          </p>
                          <span className="text-[12px] text-[#86868B]">
                            ({pmt.sales_orders?.customer_branches?.name || 'Sucursal Principal'})
                          </span>
                        </div>
                        <p className="text-[12px] text-[#86868B] mt-0.5">
                          Pedido #{pmt.sales_orders?.id?.slice(0, 8) || pmt.sales_order_id?.slice(0, 8)} · {pmt.payment_method === 'CASH' ? 'Efectivo' : 'Transferencia'} · {new Date(pmt.created_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {pmt.evidence_path && (
                          <a
                            href={supabase.storage.from('payment-evidence').getPublicUrl(pmt.evidence_path).data.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] text-[#0066CC] hover:underline inline-block mt-0.5"
                          >
                            Ver comprobante
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-[#1D1D1F]">
                          {formatCurrency(Number(pmt.amount))}
                        </p>
                        <StatusBadge status={pmt.status} className="text-[10px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-[#86868B]">
                No hay cobros registrados en esta semana de ruta.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expenses (Accordion) */}
      <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsExpensesOpen(!isExpensesOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#0066CC]" />
            <h3 className="text-[17px] font-semibold text-[#1D1D1F]">Gastos registrados</h3>
            <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2.5 py-0.5 rounded-full ml-1">
              {expenses?.length || 0}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-[#86868B] block">Total gastado</span>
              <span className="text-[14px] font-bold text-[#1D1D1F]">{formatCurrency(totalExpenses)}</span>
            </div>
            {isExpensesOpen ? (
              <ChevronUp className="w-5 h-5 text-[#86868B]" />
            ) : (
              <ChevronDown className="w-5 h-5 text-[#86868B]" />
            )}
          </div>
        </button>

        {isExpensesOpen && (
          <div className="border-t border-gray-100">
            {expenses && expenses.length > 0 ? (
              <table className="w-full text-[13px] text-left">
                <thead className="bg-white border-b border-gray-200/60 text-[#86868B] font-semibold">
                  <tr>
                    <th className="px-5 py-3.5">Fecha</th>
                    <th className="px-5 py-3.5">Categoría</th>
                    <th className="px-5 py-3.5">Lugar</th>
                    <th className="px-5 py-3.5">Descripción</th>
                    <th className="px-5 py-3.5 text-right">Monto</th>
                    <th className="px-5 py-3.5 text-center">Factura</th>
                    <th className="px-5 py-3.5 text-center">Evidencias</th>
                    <th className="px-5 py-3.5">Estado</th>
                    <th className="px-5 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.map((exp: any) => (
                    <tr key={exp.id} className="hover:bg-[#F5F5F7]/50 transition-colors">
                      <td className="px-5 py-3.5">{new Date(exp.expense_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-5 py-3.5 font-medium">{exp.expense_categories?.name}</td>
                      <td className="px-5 py-3.5">{exp.place_name || exp.city || '—'}</td>
                      <td className="px-5 py-3.5 max-w-[200px] truncate">{exp.description || '—'}</td>
                      <td className="px-5 py-3.5 text-right font-medium">{formatCurrency(Number(exp.amount))}</td>
                      <td className="px-5 py-3.5 text-center">{exp.invoice_available ? '✓' : '—'}</td>
                      <td className="px-5 py-3.5 text-center">
                        {exp.expense_attachments?.length > 0 && (
                          <button 
                            onClick={() => handleViewEvidence(exp.expense_attachments[0].storage_path)}
                            className="inline-flex items-center gap-1 text-[#0066CC] hover:underline"
                          >
                            <Paperclip className="w-3.5 h-3.5" /> {exp.expense_attachments.length}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-3.5"><StatusBadge status={exp.status} /></td>
                      <td className="px-5 py-3.5">
                        {trip.status === 'UNDER_REVIEW' && exp.status === 'SUBMITTED' && (
                          <div className="flex gap-2">
                            <button onClick={() => updateExpenseStatus.mutate({ id: exp.id, status: 'APPROVED' })} className="text-green-600 text-[12px] font-medium hover:underline">Aprobar</button>
                            <button onClick={() => updateExpenseStatus.mutate({ id: exp.id, status: 'REJECTED' })} className="text-red-600 text-[12px] font-medium hover:underline">Rechazar</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-8 text-center text-[#86868B]">No hay gastos registrados para este viaje.</div>
            )}
          </div>
        )}
      </div>

      <Modal isOpen={!!evidenceUrl} onClose={() => setEvidenceUrl(null)} title="Evidencia del gasto" maxWidth="max-w-3xl">
        {evidenceUrl && (
          <div className="flex justify-center bg-gray-50 rounded-lg p-2 min-h-[300px]">
            {evidenceUrl.includes('.pdf') ? (
               <iframe src={evidenceUrl} className="w-full h-[600px] rounded-lg" title="PDF Evidencia" />
            ) : (
               <img src={evidenceUrl} alt="Evidencia" className="max-h-[600px] object-contain rounded-lg shadow-sm" />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

