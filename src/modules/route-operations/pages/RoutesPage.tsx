import { Pencil, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Table, type Column } from '../../../components/ui/Table';
import { formatCurrency } from '../../../utils/formatters';
import { useRoutes } from '../hooks/useRouteOperations';

export const RoutesPage = () => {
  const navigate = useNavigate();
  const { data, isLoading } = useRoutes();

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'code', className: 'font-medium text-slate-900' },
    { header: 'Nombre', accessorKey: 'name' },
    {
      header: 'Vendedor',
      cell: (item) => item.agent ? `${item.agent.first_name} ${item.agent.last_name || ''}`.trim() : <span className="text-gray-400 text-[12px] italic">Sin asignar</span>,
    },
    {
      header: 'Días laborales',
      cell: (item) => (
        <div className="flex gap-1">
          {item.working_days?.map((day: string) => (
            <span
              key={day}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-accent/10 text-[10px] font-bold text-accent"
              title={day === 'X' ? 'Miércoles' : undefined}
            >
              {day === 'X' ? 'M' : day}
            </span>
          ))}
        </div>
      ),
    },
    { header: 'Presupuesto', cell: (item) => formatCurrency(Number(item.default_weekly_budget || 0)), className: 'text-right' },
    {
      header: 'Activa',
      cell: (item) => (
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.is_active ? 'bg-green-500/10 text-green-700' : 'bg-gray-500/10 text-gray-700'}`}>
          {item.is_active ? 'Sí' : 'No'}
        </span>
      ),
    },
    {
      header: '',
      cell: (item) => (
        <button
          type="button"
          onClick={() => navigate(`/route-operations/routes/${item.id}`)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-ink-2 transition-colors hover:bg-gray-50 hover:text-accent"
          title="Editar"
          aria-label="Editar ruta"
        >
          <Pencil className="h-4 w-4" />
        </button>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Rutas</h2>
          <p className="text-[15px] text-muted">Definición de rutas comerciales reutilizables</p>
        </div>
        <button
          onClick={() => navigate('/route-operations/routes/new')}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
        >
          <Plus className="h-4 w-4" />
          Nueva ruta
        </button>
      </div>

      <Table
        data={data || []}
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="Sin rutas"
        emptyMessage="No se han definido rutas comerciales aún."
      />
    </div>
  );
};
