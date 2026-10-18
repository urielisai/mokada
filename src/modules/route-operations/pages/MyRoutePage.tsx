import { useState, useEffect } from 'react';
import { useAuth } from '../../auth/context/useAuth';
import { useMyCurrentTrip, useTripExpenses, useSaveExpense, useExpenseCategories, useUpdateTripStatus, useUploadExpenseAttachment } from '../hooks/useRouteOperations';
import { ordersService } from '../../orders/services/orders.service';
import { generateRouteSettlementPdf } from '../utils/generateRouteSettlementPdf';
import { supabase } from '../../../lib/supabase/client';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LoadingState } from '../../../components/ui/LoadingState';
import { toast } from 'react-hot-toast';
import { EmptyState } from '../../../components/ui/EmptyState';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import { formatRoutePaymentDate } from '../../../utils/routePaymentDate';
import { MapPin, DollarSign, Plus, Truck, Upload, Wallet, Banknote, Building2, FileText, ChevronDown, ChevronUp } from 'lucide-react';

export const MyRoutePage = () => {
  const { profile } = useAuth();
  const { data: trip, isLoading } = useMyCurrentTrip(profile?.id || null);
  const { data: expenses } = useTripExpenses(trip?.id || null);
  const { data: categories } = useExpenseCategories();
  const saveExpense = useSaveExpense();
  const updateStatus = useUpdateTripStatus();
  const uploadAttachment = useUploadExpenseAttachment();

  const [payments, setPayments] = useState<any[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [isPaymentsOpen, setIsPaymentsOpen] = useState(false);
  const [isExpensesOpen, setIsExpensesOpen] = useState(false);

  const [expenseModal, setExpenseModal] = useState(false);
  const [form, setForm] = useState({
    expense_category_id: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    description: '',
    merchant_name: '',
    place_name: '',
    city: '',
    state: '',
    invoice_available: false,
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    if (trip?.route_id && trip?.week_start_date && trip?.week_end_date && profile?.auth_user_id) {
      setIsLoadingPayments(true);
      ordersService
        .getRoutePayments(trip.route_id, trip.week_start_date, trip.week_end_date, profile.auth_user_id)
        .then((data) => setPayments(data || []))
        .catch((err) => console.error('Error fetching route payments:', err))
        .finally(() => setIsLoadingPayments(false));
    }
  }, [trip?.route_id, trip?.week_start_date, trip?.week_end_date, profile?.auth_user_id]);

  if (isLoading) return <LoadingState message="Buscando ruta asignada..." />;
  if (!trip) return <EmptyState title="Sin ruta asignada" description="No tienes una ruta asignada para esta semana." />;

  const cashPayments = payments.filter((p) => p.payment_method === 'CASH');
  const transferPayments = payments.filter((p) => p.payment_method === 'TRANSFER');

  const totalExpenses = expenses?.reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0) || 0;
  const totalCashCollected = cashPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalTransferCollected = transferPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);
  const totalCollected = totalCashCollected + totalTransferCollected;

  const budget = Number(trip.budget_amount || 0);
  const available = budget - totalExpenses;
  const netCashToDeliver = totalCashCollected; // separated from viáticos

  const startDate = new Date(trip.week_start_date + 'T12:00:00');
  const endDate = new Date(trip.week_end_date + 'T12:00:00');

  const handleDownloadPdfReport = () => {
    generateRouteSettlementPdf({
      routeCode: trip.routes?.code || 'RUTA',
      routeName: trip.routes?.name || 'Ruta Agente',
      agentName: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 'Agente de Ruta',
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
        date: formatRoutePaymentDate(p.created_at),
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

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const expense = await saveExpense.mutateAsync({
        ...form,
        route_trip_id: trip.id,
        agent_id: profile?.id,
        created_by: profile?.id,
        status: 'SUBMITTED',
      });

      if (attachmentFile && expense) {
        try {
          await uploadAttachment.mutateAsync({
            expense: { id: expense.id, route_trip_id: trip.id },
            file: attachmentFile,
            attachmentType: 'RECEIPT',
            uploadedBy: profile?.id || '',
          });
        } catch (uploadErr) {
          toast.error('El gasto se guardó, pero hubo un error al subir la evidencia.');
          console.error('Error uploading attachment', uploadErr);
        }
      }

      setExpenseModal(false);
      setForm({
        expense_category_id: '',
        amount: 0,
        expense_date: new Date().toISOString().split('T')[0],
        description: '',
        merchant_name: '',
        place_name: '',
        city: '',
        state: '',
        invoice_available: false,
      });
      setAttachmentFile(null);
      toast.success('Gasto registrado correctamente');
    } catch (err) {
      toast.error('No se pudo guardar el gasto. Intenta de nuevo.');
      console.error('Error saving expense', err);
    }
  };

  const handleStartTrip = () => {
    updateStatus.mutate({ id: trip.id, status: 'IN_PROGRESS' });
  };

  const handleCompleteTrip = () => {
    updateStatus.mutate({ id: trip.id, status: 'COMPLETED' });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-ink">Mi Ruta</h2>
        <p className="text-[15px] text-muted">
          {startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })} – {endDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* Route info */}
      <div className="bg-white border border-gray-200/60 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted">Ruta asignada</p>
            <p className="text-[20px] font-bold text-ink">{trip.routes?.code} — {trip.routes?.name}</p>
          </div>
          <StatusBadge status={trip.status} />
        </div>
        {trip.vehicle && (
          <div className="flex items-center gap-2 text-[14px] text-muted">
            <Truck className="w-4 h-4" />
            <span>{trip.vehicle.internal_code} — {trip.vehicle.brand} {trip.vehicle.model} ({trip.vehicle.plate_number})</span>
          </div>
        )}
      </div>

      {/* Resumen de Cierre & Efectivo en Mano */}
      <div className="bg-white border border-gray-200/60 rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-[17px] font-bold text-ink flex items-center gap-2">
              <Banknote className="w-5 h-5 text-accent" /> Resumen de Cierre de Semana
            </h3>
            <p className="text-[13px] text-muted mt-0.5">
              Control de efectivo en mano, cobros y viáticos para liquidar semana.
            </p>
          </div>

          <button
            type="button"
            onClick={handleDownloadPdfReport}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover shadow-sm shrink-0"
          >
            <FileText className="w-4 h-4" />
            Ver / Imprimir PDF
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Efectivo Cobrado
            </span>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatCurrency(totalCashCollected)}
            </p>
            <span className="text-[11px] text-muted">
              {cashPayments.length} cobro(s) en efectivo
            </span>
          </div>

          <div className={`rounded-xl border ${available >= 0 ? 'border-gray-100 bg-gray-50/70' : 'border-red-100 bg-red-50/70'} p-4`}>
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${available >= 0 ? 'text-muted' : 'text-red-600'}`}>
              Gastos de Ruta
            </span>
            <p className="mt-1 text-xl font-bold text-ink">
              {formatCurrency(totalExpenses)}
            </p>
            <span className={`text-[11px] ${available >= 0 ? 'text-muted' : 'text-red-600'}`}>
              {available >= 0 ? 'Viáticos rest.: ' : 'Excedente: '}{formatCurrency(Math.abs(available))}
            </span>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
              Efectivo a Entregar en Caja
            </span>
            <p className="mt-1 text-2xl font-bold text-accent">
              {formatCurrency(netCashToDeliver)}
            </p>
            <span className="text-[11px] text-blue-800">
              Efectivo íntegro cobrado en ruta
            </span>
          </div>
        </div>
      </div>

      {/* Budget bar */}
      <div className="bg-white border border-gray-200/60 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[14px] font-medium text-ink">Presupuesto de Viáticos</span>
          <span className="text-[14px] font-semibold text-ink">{formatCurrency(budget)}</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3 mb-3">
          <div
            className={`h-3 rounded-full transition ${totalExpenses > budget ? 'bg-red-500' : 'bg-accent'}`}
            style={{ width: `${Math.min((totalExpenses / budget) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[13px] text-muted">
          <span>Gastado: {formatCurrency(totalExpenses)}</span>
          <span className={available >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            {available >= 0 ? 'Disponible: ' : 'Excedido: '}{formatCurrency(Math.abs(available))}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {(trip.status === 'PLANNED' || trip.status === 'IN_PROGRESS') && (
          <button onClick={() => setExpenseModal(true)} className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-accent py-3 text-[14px] font-semibold text-white hover:bg-accent-hover transition-colors">
            <Plus className="w-4 h-4" /> Registrar gasto
          </button>
        )}
        {trip.status === 'PLANNED' && (
          <button onClick={handleStartTrip} disabled={updateStatus.isPending} className="flex-1 rounded-xl border border-accent text-accent bg-white py-3 text-[14px] font-semibold hover:bg-gray-50 transition-colors">
            Iniciar Ruta
          </button>
        )}
        {trip.status === 'IN_PROGRESS' && (
          <button onClick={handleCompleteTrip} disabled={updateStatus.isPending} className="flex-1 rounded-xl border border-gray-200 bg-white py-3 text-[14px] font-semibold text-ink hover:bg-gray-50 transition-colors">
            Finalizar Ruta
          </button>
        )}
      </div>

      {/* Mis pagos section (Accordion) */}
      <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsPaymentsOpen(!isPaymentsOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-accent" />
            <h3 className="text-[17px] font-semibold text-ink">Mis pagos / Cobros en Ruta</h3>
            <span className="text-xs bg-blue-50 text-accent font-semibold px-2.5 py-0.5 rounded-full ml-1">
              {payments.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-muted block">Total cobrado</span>
              <span className="text-[14px] font-bold text-ink">{formatCurrency(totalCollected)}</span>
            </div>
            {isPaymentsOpen ? (
              <ChevronUp className="w-5 h-5 text-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted" />
            )}
          </div>
        </button>

        {isPaymentsOpen && (
          <div className="border-t border-gray-100">
            {isLoadingPayments ? (
              <div className="px-6 py-8 text-center text-muted">Cargando pagos de la semana...</div>
            ) : payments && payments.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {payments.map((pmt: any) => (
                  <div key={pmt.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-muted shrink-0">
                        {pmt.payment_method === 'CASH' ? (
                          <Banknote className="w-5 h-5 text-ink" />
                        ) : (
                          <Building2 className="w-5 h-5 text-accent" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-[14px] font-semibold text-ink">
                            {pmt.sales_orders?.customers?.name || 'Cliente'}
                          </p>
                          <span className="text-[12px] text-muted">
                            ({pmt.sales_orders?.customer_branches?.name || 'Sucursal Principal'})
                          </span>
                        </div>
                        <p className="text-[12px] text-muted mt-0.5">
                          Pedido #{pmt.sales_orders?.id?.slice(0, 8) || pmt.sales_order_id?.slice(0, 8)} · {pmt.payment_method === 'CASH' ? 'Efectivo' : 'Transferencia'} · {formatRoutePaymentDate(pmt.created_at)}
                        </p>
                        {pmt.evidence_path && (
                          <a
                            href={supabase.storage.from('payment-evidence').getPublicUrl(pmt.evidence_path).data.publicUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[12px] text-accent hover:underline inline-block mt-0.5"
                          >
                            Ver comprobante
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4">
                      <div className="text-right">
                        <p className="text-[15px] font-bold text-ink">
                          {formatCurrency(Number(pmt.amount))}
                        </p>
                        <StatusBadge status={pmt.status} className="text-[10px]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-muted">
                Aún no registras cobros en esta semana ({startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – {endDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}).
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expenses list (Accordion) */}
      <div className="bg-white border border-gray-200/60 rounded-2xl overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsExpensesOpen(!isExpensesOpen)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent" />
            <h3 className="text-[17px] font-semibold text-ink">Mis gastos</h3>
            <span className="text-xs bg-gray-100 text-gray-700 font-semibold px-2 py-0.5 rounded-full ml-1">
              {expenses?.length || 0}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-[11px] text-muted block">Total gastado</span>
              <span className="text-[14px] font-bold text-ink">{formatCurrency(totalExpenses)}</span>
            </div>
            {isExpensesOpen ? (
              <ChevronUp className="w-5 h-5 text-muted" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted" />
            )}
          </div>
        </button>

        {isExpensesOpen && (
          <div className="border-t border-gray-100">
            {expenses && expenses.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {expenses.map((exp: any) => (
                  <div key={exp.id} className="px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-canvas flex items-center justify-center text-muted">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-[14px] font-medium text-ink">{exp.expense_categories?.name}</p>
                        <p className="text-[12px] text-muted">{exp.place_name || exp.description || '—'} · {new Date(exp.expense_date + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold text-ink">{formatCurrency(Number(exp.amount))}</p>
                      <StatusBadge status={exp.status} className="text-[10px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-6 py-8 text-center text-muted">Aún no registras gastos.</div>
            )}
          </div>
        )}
      </div>

      {/* Add expense modal */}
      <Modal isOpen={expenseModal} onClose={() => setExpenseModal(false)} title="Registrar gasto" maxWidth="max-w-lg">
        <form onSubmit={handleSaveExpense} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Categoría *</label>
            <select value={form.expense_category_id} onChange={e => setForm({ ...form, expense_category_id: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
              <option value="">Seleccionar</option>
              {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Monto (MXN) *</label>
              <input type="number" value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} min={0.01} step="0.01" required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Fecha *</label>
              <input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Lugar</label>
            <input value={form.place_name} onChange={e => setForm({ ...form, place_name: e.target.value })} placeholder="Ej. Gasolinera Pemex Querétaro" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Ciudad</label>
              <input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1">Estado</label>
              <select value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none bg-white">
                <option value="">Seleccionar</option>
                <option value="Aguascalientes">Aguascalientes</option>
                <option value="Baja California">Baja California</option>
                <option value="Baja California Sur">Baja California Sur</option>
                <option value="Campeche">Campeche</option>
                <option value="Chiapas">Chiapas</option>
                <option value="Chihuahua">Chihuahua</option>
                <option value="Ciudad de México">Ciudad de México</option>
                <option value="Coahuila">Coahuila</option>
                <option value="Colima">Colima</option>
                <option value="Durango">Durango</option>
                <option value="Estado de México">Estado de México</option>
                <option value="Guanajuato">Guanajuato</option>
                <option value="Guerrero">Guerrero</option>
                <option value="Hidalgo">Hidalgo</option>
                <option value="Jalisco">Jalisco</option>
                <option value="Michoacán">Michoacán</option>
                <option value="Morelos">Morelos</option>
                <option value="Nayarit">Nayarit</option>
                <option value="Nuevo León">Nuevo León</option>
                <option value="Oaxaca">Oaxaca</option>
                <option value="Puebla">Puebla</option>
                <option value="Querétaro">Querétaro</option>
                <option value="Quintana Roo">Quintana Roo</option>
                <option value="San Luis Potosí">San Luis Potosí</option>
                <option value="Sinaloa">Sinaloa</option>
                <option value="Sonora">Sonora</option>
                <option value="Tabasco">Tabasco</option>
                <option value="Tamaulipas">Tamaulipas</option>
                <option value="Tlaxcala">Tlaxcala</option>
                <option value="Veracruz">Veracruz</option>
                <option value="Yucatán">Yucatán</option>
                <option value="Zacatecas">Zacatecas</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none resize-none" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Comercio / Proveedor</label>
            <input value={form.merchant_name} onChange={e => setForm({ ...form, merchant_name: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-accent focus:ring-4 focus:ring-accent/15 outline-none" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1">Evidencia (recibo/foto)</label>
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-3 text-[13px] text-muted hover:border-accent hover:text-accent transition-colors">
              <Upload className="w-4 h-4" />
              {attachmentFile ? attachmentFile.name : 'Seleccionar archivo o tomar foto'}
              <input
                type="file"
                accept="image/*,application/pdf,.xml"
                capture="environment"
                onChange={e => setAttachmentFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="has_invoice" checked={form.invoice_available} onChange={e => setForm({ ...form, invoice_available: e.target.checked })} className="rounded border-gray-300 text-accent focus:ring-accent" />
            <label htmlFor="has_invoice" className="text-[13px] text-ink">¿Tiene factura?</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setExpenseModal(false)} className="px-4 py-2 text-[13px] font-medium text-muted hover:text-ink transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveExpense.isPending} className="rounded-xl bg-accent px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-accent-hover disabled:opacity-50 transition-colors">
              {saveExpense.isPending ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
