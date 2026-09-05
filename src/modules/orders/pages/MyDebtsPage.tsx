import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ordersService } from '../services/orders.service';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { LoadingState } from '../../../components/ui/LoadingState';
import { formatCurrency } from '../../../utils/formatters';
import { Wallet, ExternalLink, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export const MyDebtsPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMyDebts = async () => {
    try {
      setIsLoading(true);
      const data = await ordersService.getMyDebts();
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching my debts:', error);
      toast.error('Error al cargar tus adeudos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDebts();
  }, []);

  const todayStr = new Date().toISOString().split('T')[0];

  const processedOrders = useMemo(() => {
    return orders.map((order) => {
      const totalCost = Number(order.total_amount || 0) + Number(order.shipping_cost || 0);
      const amountPaid = Number(order.amount_paid || 0);
      const remainingBalance = Math.max(totalCost - amountPaid, 0);

      const isCredit = order.payment_type === 'CREDITO';
      const isApproved = order.credit_approval_status === 'APPROVED';
      const isPendingApproval = order.credit_approval_status === 'PENDING';
      const isPaid = remainingBalance <= 0.01;
      const isOverdue =
        isCredit &&
        isApproved &&
        !isPaid &&
        order.due_date &&
        order.due_date < todayStr;

      let computedStatus: string = 'PENDING';
      if (isPendingApproval) {
        computedStatus = 'PENDING_APPROVAL';
      } else if (isPaid) {
        computedStatus = 'PAID';
      } else if (isOverdue) {
        computedStatus = 'OVERDUE';
      } else {
        computedStatus = 'PENDING';
      }

      return {
        ...order,
        totalCost,
        amountPaid,
        remainingBalance,
        computedStatus,
        isOverdue,
        isPaid,
        isPendingApproval,
      };
    });
  }, [orders, todayStr]);

  const metrics = useMemo(() => {
    let totalPending = 0;
    let overdueCount = 0;

    processedOrders.forEach((o) => {
      if (!o.isPaid) {
        totalPending += o.remainingBalance;
      }
      if (o.isOverdue) {
        overdueCount += 1;
      }
    });

    return { totalPending, overdueCount };
  }, [processedOrders]);

  const columns: Column<any>[] = [
    {
      header: 'Pedido / Sucursal',
      cell: (item) => (
        <div>
          <Link
            to={`/my-orders`}
            className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0066CC] hover:underline"
          >
            #{item.id.slice(0, 8)}
            <ExternalLink className="h-3 w-3" />
          </Link>
          <p className="text-[12px] text-[#86868B]">
            {item.customer_branches?.name || 'Sucursal Principal'}
          </p>
        </div>
      ),
    },
    {
      header: 'Modalidad / Plazo',
      cell: (item) => (
        <div>
          <span className="text-xs font-semibold text-[#1D1D1F]">
            {item.payment_type === 'CREDITO' ? `Crédito (${item.credit_term_days || 15}d)` : 'Contado'}
          </span>
          {item.due_date && <p className="text-[11px] text-[#86868B]">Límite: {item.due_date}</p>}
        </div>
      ),
    },
    {
      header: 'Monto Total',
      cell: (item) => <span className="font-medium text-[#1D1D1F]">{formatCurrency(item.totalCost)}</span>,
      className: 'text-right',
    },
    {
      header: 'Abonado',
      cell: (item) => <span className="font-medium text-[#1D1D1F]">{formatCurrency(item.amountPaid)}</span>,
      className: 'text-right',
    },
    {
      header: 'Saldo Pendiente',
      cell: (item) => (
        <span className="font-semibold text-[#1D1D1F]">
          {formatCurrency(item.remainingBalance)}
        </span>
      ),
      className: 'text-right',
    },
    {
      header: 'Estado de Pago',
      cell: (item) => <StatusBadge status={item.computedStatus} />,
    },
  ];

  if (isLoading && !orders.length) return <LoadingState message="Cargando tus adeudos..." />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">
          Mis Adeudos y Créditos
        </h2>
        <p className="text-[14px] text-[#86868B] sm:text-[15px]">
          Consulta el estado de tus compras a crédito, plazos y fechas límite.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Saldo Total Pendiente
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-[#0066CC]">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {formatCurrency(metrics.totalPending)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Pedidos Vencidos
            </span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-red-600">
            {metrics.overdueCount} Pedidos
          </p>
        </div>
      </div>

      <Table
        data={processedOrders}
        columns={columns}
        isLoading={isLoading}
        isEmpty={processedOrders.length === 0}
        emptyTitle="Sin adeudos pendientes"
        emptyMessage="Tus compras están al día y no tienes saldos pendientes."
      />
    </div>
  );
};
