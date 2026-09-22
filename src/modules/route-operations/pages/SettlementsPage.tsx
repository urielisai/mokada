import { useFinancialSummary, useCreateSettlement } from '../hooks/useRouteOperations';
import { useAuth } from '../../auth/context/useAuth';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatCurrency } from '../../../utils/formatters';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export const SettlementsPage = () => {
  const { profile } = useAuth();
  const { data, isLoading } = useFinancialSummary({ statuses: ['COMPLETED', 'UNDER_REVIEW'] });
  const createSettlement = useCreateSettlement();
  const [confirmTrip, setConfirmTrip] = useState<any>(null);

  const handleSettle = async () => {
    if (!confirmTrip || !profile) return;
    const balance = Number(confirmTrip.balance || 0);
    const approved = Number(confirmTrip.approved_expenses || 0);
    const budget = Number(confirmTrip.budget_amount || 0);

    await createSettlement.mutateAsync({
      route_trip_id: confirmTrip.route_trip_id,
      budget_amount: budget,
      approved_expenses: approved,
      balance,
      settlement_type: confirmTrip.settlement_type,
      settlement_amount: Math.abs(balance),
      status: 'PENDING',
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
    });
    setConfirmTrip(null);
  };

  const columns: Column<any>[] = [
    {
      header: 'Ruta',
      cell: (item) => (
        <Link to={`/route-operations/trips/${item.route_trip_id}`} className="text-[#0066CC] font-medium hover:underline">
          {item.route_code} — {item.route_name}
        </Link>
      ),
    },
    {
      header: 'Semana',
      cell: (item) => {
        const start = new Date(item.week_start_date + 'T12:00:00');
        const end = new Date(item.week_end_date + 'T12:00:00');
        return `${start.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
      },
    },
    { header: 'Presupuesto', cell: (item) => formatCurrency(Number(item.budget_amount || 0)), className: 'text-right' },
    { header: 'Aprobados', cell: (item) => formatCurrency(Number(item.approved_expenses || 0)), className: 'text-right' },
    { header: 'Pendientes', cell: (item) => formatCurrency(Number(item.pending_expenses || 0)), className: 'text-right text-amber-600' },
    {
      header: 'Saldo',
      cell: (item) => {
        const balance = Number(item.balance || 0);
        return (
          <div className={`text-right ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            <span className="font-semibold block">{balance >= 0 ? '+' : ''}{formatCurrency(Math.abs(balance))}</span>
            <span className="text-[10px] font-normal leading-none block">{balance > 0 ? 'Agente devuelve' : balance < 0 ? 'Empresa reembolsa' : ''}</span>
          </div>
        );
      },
      className: 'text-right',
    },
    { header: 'Resultado', cell: (item) => <StatusBadge status={item.settlement_type} /> },
    {
      header: '',
      cell: (item) => {
        const hasPending = Number(item.pending_expenses || 0) > 0;
        return (
          <button
            onClick={() => setConfirmTrip(item)}
            disabled={hasPending}
            title={hasPending ? 'Hay gastos pendientes de revisión' : 'Liquidar semana'}
            className="text-[#0066CC] text-[13px] font-medium hover:underline disabled:text-gray-300 disabled:no-underline disabled:cursor-not-allowed"
          >
            Liquidar
          </button>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Conciliación Semanal</h2>
        <p className="text-[15px] text-[#86868B]">Revisión y liquidación de viajes completados</p>
      </div>

      <Table
        data={data || []}
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="Sin conciliaciones pendientes"
        emptyMessage="No hay viajes en revisión para liquidar."
      />

      <ConfirmModal
        isOpen={!!confirmTrip}
        onClose={() => setConfirmTrip(null)}
        onConfirm={handleSettle}
        title="Liquidar semana"
        message={
          confirmTrip
            ? `¿Confirmar liquidación de ${confirmTrip.route_code} — ${confirmTrip.route_name}? Saldo: ${formatCurrency(Math.abs(Number(confirmTrip.balance || 0)))} (${Number(confirmTrip.balance || 0) > 0 ? 'Agente devuelve' : Number(confirmTrip.balance || 0) < 0 ? 'Empresa reembolsa' : 'Balanceado'}).`
            : ''
        }
        isPending={createSettlement.isPending}
      />
    </div>
  );
};
