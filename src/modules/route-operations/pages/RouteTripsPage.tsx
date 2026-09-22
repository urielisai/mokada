import { useState } from 'react';
import { useRouteTrips, useSaveRouteTrip, useRoutes, useAgents, useAvailableVehicles } from '../hooks/useRouteOperations';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { formatCurrency } from '../../../utils/formatters';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const EMPTY_FORM = {
  route_id: '',
  agent_id: '',
  vehicle_id: '',
  week_start_date: '',
  week_end_date: '',
  budget_amount: 0,
  status: 'PLANNED' as string,
  notes: '',
};

export const RouteTripsPage = () => {
  const { data, isLoading } = useRouteTrips();
  const saveTrip = useSaveRouteTrip();
  const { data: routes } = useRoutes();
  const { data: agents } = useAgents();
  const { data: vehicles } = useAvailableVehicles();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const conflictingTrip = (agentId: string) => form.week_start_date && form.week_end_date && data?.find(trip =>
    trip.agent_id === agentId && trip.id !== editId && trip.status !== 'CANCELLED'
    && trip.week_start_date <= form.week_end_date && trip.week_end_date >= form.week_start_date
  );
  const selectedConflict = form.agent_id ? conflictingTrip(form.agent_id) : undefined;
  const invalidDates = Boolean(form.week_start_date && form.week_end_date && form.week_start_date > form.week_end_date);
  const existingOverlaps = (data || []).flatMap((first, index, trips) => trips.slice(index + 1)
    .filter(second => first.agent_id === second.agent_id && first.status !== 'CANCELLED' && second.status !== 'CANCELLED'
      && first.week_start_date <= second.week_end_date && first.week_end_date >= second.week_start_date)
    .map(second => ({ first, second })));

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setModalOpen(true);
  };

  const handleRouteChange = (routeId: string) => {
    const route = routes?.find((r: any) => r.id === routeId);
    setForm({
      ...form,
      route_id: routeId,
      budget_amount: route?.default_weekly_budget || 0,
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invalidDates) { toast.error('La fecha de inicio debe ser anterior al fin de la semana.'); return; }
    if (selectedConflict) { toast.error('Este agente ya tiene una ruta asignada en esa semana.'); return; }
    try {
      await saveTrip.mutateAsync({ id: editId, ...form, vehicle_id: form.vehicle_id || null });
      setModalOpen(false);
      toast.success('Ruta semanal asignada');
    } catch (err) {
      console.error('Error saving trip', err);
      toast.error((err as Error).message || 'No se pudo asignar la ruta.');
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Ruta',
      cell: (item) => (
        <Link to={`/route-operations/trips/${item.id}`} className="text-[#0066CC] font-medium hover:underline">
          {item.routes?.code} — {item.routes?.name}
        </Link>
      ),
    },
    {
      header: 'Agente',
      cell: (item) => item.agent ? `${item.agent.first_name} ${item.agent.last_name}` : '—',
    },
    {
      header: 'Unidad',
      cell: (item) => item.vehicle ? `${item.vehicle.internal_code}` : '—',
    },
    {
      header: 'Semana',
      cell: (item) => {
        const start = new Date(item.week_start_date + 'T12:00:00');
        const end = new Date(item.week_end_date + 'T12:00:00');
        return `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      },
    },
    {
      header: 'Presupuesto',
      cell: (item) => formatCurrency(Number(item.budget_amount || 0)),
      className: 'text-right',
    },
    { header: 'Estado', cell: (item) => <StatusBadge status={item.status} /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Viajes Semanales</h2>
          <p className="text-[15px] text-[#86868B]">Asignación de rutas, agentes y unidades por semana</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 rounded-xl bg-[#0066CC] px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0055AA] transition-colors">
          <Plus className="w-4 h-4" /> Nuevo viaje
        </button>
      </div>

      {existingOverlaps.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <p className="font-semibold">Asignaciones existentes por revisar</p>
        {existingOverlaps.map(({ first, second }) => <p key={`${first.id}-${second.id}`} className="mt-1">
          {first.agent?.first_name} {first.agent?.last_name} tiene viajes superpuestos: <Link className="font-medium underline" to={`/route-operations/trips/${first.id}`}>{first.week_start_date} al {first.week_end_date}</Link> y <Link className="font-medium underline" to={`/route-operations/trips/${second.id}`}>{second.week_start_date} al {second.week_end_date}</Link>.
        </p>)}
      </div>}
      <Table
        data={data || []}
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="Sin viajes"
        emptyMessage="No se han asignado viajes semanales aún."
      />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Editar viaje' : 'Nuevo viaje semanal'} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Ruta *</label>
            <select value={form.route_id} onChange={e => handleRouteChange(e.target.value)} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none bg-white">
              <option value="">Seleccionar ruta</option>
              {routes?.map((r: any) => (
                <option key={r.id} value={r.id}>{r.code} — {r.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Agente *</label>
            <select value={form.agent_id} onChange={e => setForm({ ...form, agent_id: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none bg-white">
              <option value="">Seleccionar agente</option>
              {agents?.map((a: any) => (
                <option key={a.id} value={a.id} disabled={Boolean(conflictingTrip(a.id))}>{a.first_name} {a.last_name}{conflictingTrip(a.id) ? ' — ya tiene ruta esa semana' : ''}</option>
              ))}
            </select>
            {selectedConflict && <p className="mt-2 text-[12px] text-amber-700">Este agente ya tiene asignada una ruta del {selectedConflict.week_start_date} al {selectedConflict.week_end_date}. Selecciona otra semana o agente.</p>}
          </div>
          {invalidDates && <p className="text-[12px] text-red-600">La fecha de fin debe ser igual o posterior al inicio.</p>}
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Unidad</label>
            <select value={form.vehicle_id} onChange={e => setForm({ ...form, vehicle_id: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none bg-white">
              <option value="">Sin asignar</option>
              {vehicles?.map((v: any) => (
                <option key={v.id} value={v.id}>{v.internal_code} — {v.plate_number} ({v.brand} {v.model})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Inicio de semana *</label>
              <input type="date" value={form.week_start_date} onChange={e => setForm({ ...form, week_start_date: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Fin de semana *</label>
              <input type="date" value={form.week_end_date} onChange={e => setForm({ ...form, week_end_date: e.target.value })} required className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Presupuesto (MXN)</label>
            <input type="number" value={form.budget_amount} onChange={e => setForm({ ...form, budget_amount: Number(e.target.value) })} min={0} step="100" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none" />
          </div>
          <div>
            <label className="block text-[13px] font-medium text-[#1D1D1F] mb-1">Notas</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-[14px] focus:border-[#0066CC] focus:ring-1 focus:ring-[#0066CC] outline-none resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-[13px] font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saveTrip.isPending || Boolean(selectedConflict) || invalidDates} className="rounded-xl bg-[#0066CC] px-5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#0055AA] disabled:opacity-50 transition-colors">
              {saveTrip.isPending ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
