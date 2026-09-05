import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ordersService } from '../../../orders/services/orders.service';
import { supabase } from '../../../../lib/supabase/client';
import { Table, type Column } from '../../../../components/ui/Table';
import { StatusBadge } from '../../../../components/ui/StatusBadge';
import { ConfirmModal } from '../../../../components/ui/ConfirmModal';
import { LoadingState } from '../../../../components/ui/LoadingState';
import { formatCurrency } from '../../../../utils/formatters';
import {
  Wallet,
  AlertTriangle,
  Clock,
  CheckCircle,
  Search,
  ExternalLink,
  ShieldCheck,
  ShieldX,
} from 'lucide-react';
import toast from 'react-hot-toast';

export type DebtFilterTab = 'ALL' | 'PENDING' | 'OVERDUE' | 'PENDING_APPROVAL' | 'PAID';

export const AdminDebtsPage = () => {
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DebtFilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedOrderForAction, setSelectedOrderForAction] = useState<any>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchDebts = async () => {
    try {
      setIsLoading(true);
      const data = await ordersService.getAllDebts();
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching debts:', error);
      toast.error('Error al cargar los adeudos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDebts();

    const channel = supabase
      .channel('admin_debts_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_orders' }, () => {
        fetchDebts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_order_payments' }, () => {
        fetchDebts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const filteredOrders = useMemo(() => {
    return processedOrders.filter((order) => {
      if (activeTab === 'PENDING' && (order.isPaid || order.isOverdue || order.isPendingApproval)) {
        return false;
      }
      if (activeTab === 'OVERDUE' && !order.isOverdue) {
        return false;
      }
      if (activeTab === 'PENDING_APPROVAL' && !order.isPendingApproval) {
        return false;
      }
      if (activeTab === 'PAID' && !order.isPaid) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const customerName = order.customers?.name?.toLowerCase() || '';
        const branchName = order.customer_branches?.name?.toLowerCase() || '';
        const orderId = order.id.toLowerCase();
        return customerName.includes(q) || branchName.includes(q) || orderId.includes(q);
      }

      return true;
    });
  }, [processedOrders, activeTab, searchQuery]);

  const metrics = useMemo(() => {
    let totalToCollect = 0;
    let totalOverdue = 0;
    let totalPendingApprovalCount = 0;
    let totalCollected = 0;

    processedOrders.forEach((o) => {
      totalCollected += o.amountPaid;
      if (!o.isPaid) {
        totalToCollect += o.remainingBalance;
      }
      if (o.isOverdue) {
        totalOverdue += o.remainingBalance;
      }
      if (o.isPendingApproval) {
        totalPendingApprovalCount += 1;
      }
    });

    return { totalToCollect, totalOverdue, totalPendingApprovalCount, totalCollected };
  }, [processedOrders]);

  const handleApproveCredit = async () => {
    if (!selectedOrderForAction) return;
    try {
      setIsProcessing(true);
      await ordersService.approveCreditRequest(selectedOrderForAction.id);
      toast.success('Solicitud de crédito autorizada.');
      setSelectedOrderForAction(null);
      setActionType(null);
      fetchDebts();
    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al autorizar el crédito.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRejectCredit = async () => {
    if (!selectedOrderForAction) return;
    try {
      setIsProcessing(true);
      await ordersService.rejectCreditRequest(selectedOrderForAction.id);
      toast.success('Solicitud de crédito rechazada.');
      setSelectedOrderForAction(null);
      setActionType(null);
      fetchDebts();
    } catch (error) {
      console.error(error);
      toast.error('Ocurrió un error al rechazar la solicitud.');
    } finally {
      setIsProcessing(false);
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Cliente / Sucursal',
      cell: (item) => (
        <div>
          <p className="font-semibold text-[#1D1D1F] text-sm">{item.customers?.name || 'Cliente'}</p>
          <p className="text-[12px] text-[#86868B]">
            {item.customer_branches?.name ? `Sucursal: ${item.customer_branches.name}` : 'Sucursal Principal'}
          </p>
        </div>
      ),
    },
    {
      header: 'Pedido',
      cell: (item) => (
        <Link
          to={`/orders/${item.id}`}
          className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#0066CC] hover:underline"
        >
          #{item.id.slice(0, 8)}
          <ExternalLink className="h-3 w-3" />
        </Link>
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
      header: 'Estado',
      cell: (item) => <StatusBadge status={item.computedStatus} />,
    },
    {
      header: 'Acciones',
      cell: (item) => {
        if (item.isPendingApproval) {
          return (
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForAction(item);
                  setActionType('APPROVE');
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Aprobar
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForAction(item);
                  setActionType('REJECT');
                }}
                className="inline-flex h-8 items-center gap-1 rounded-lg bg-red-50 px-2.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
              >
                <ShieldX className="h-3.5 w-3.5" />
                Rechazar
              </button>
            </div>
          );
        }
        return (
          <Link
            to={`/orders/${item.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-[#1D1D1F] transition-colors hover:bg-gray-50"
          >
            Ver Detalle
          </Link>
        );
      },
      className: 'text-right',
    },
  ];

  if (isLoading && !orders.length) return <LoadingState message="Cargando adeudos..." />;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">
          Adeudos y Crédito
        </h2>
        <p className="text-[14px] text-[#86868B] sm:text-[15px]">
          Gestión de cuentas por cobrar, solicitudes de crédito y saldos.
        </p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Total por Cobrar
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-[#0066CC]">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {formatCurrency(metrics.totalToCollect)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Adeudos Vencidos
            </span>
            <div className="rounded-lg bg-red-50 p-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {formatCurrency(metrics.totalOverdue)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Por Autorizar
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <Clock className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {metrics.totalPendingApprovalCount} Solicitudes
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
              Total Cobrado
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CheckCircle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-[#1D1D1F]">
            {formatCurrency(metrics.totalCollected)}
          </p>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'ALL' ? 'bg-[#0066CC] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Todos ({processedOrders.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'PENDING' ? 'bg-[#0066CC] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Pendientes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('OVERDUE')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'OVERDUE' ? 'bg-[#0066CC] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Retrasados
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PENDING_APPROVAL')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'PENDING_APPROVAL' ? 'bg-[#0066CC] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Por Aprobar ({metrics.totalPendingApprovalCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PAID')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'PAID' ? 'bg-[#0066CC] text-white shadow-sm' : 'text-[#86868B] hover:text-[#1D1D1F]'
            }`}
          >
            Pagados
          </button>
        </div>

        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15 sm:w-72">
          <Search className="h-4 w-4 text-[#86868B]" />
          <input
            type="text"
            placeholder="Buscar por cliente, sucursal o pedido..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      {/* Table */}
      <Table
        data={filteredOrders}
        columns={columns}
        isLoading={isLoading}
        isEmpty={filteredOrders.length === 0}
        emptyTitle="Sin registros de adeudos"
        emptyMessage="No se encontraron registros que coincidan con los filtros seleccionados."
      />

      <ConfirmModal
        isOpen={!!selectedOrderForAction}
        onClose={() => {
          setSelectedOrderForAction(null);
          setActionType(null);
        }}
        onConfirm={actionType === 'APPROVE' ? handleApproveCredit : handleRejectCredit}
        title={actionType === 'APPROVE' ? 'Autorizar Crédito' : 'Rechazar Crédito'}
        message={
          selectedOrderForAction
            ? `¿Deseas ${actionType === 'APPROVE' ? 'autorizar' : 'rechazar'} la solicitud de crédito a ${
                selectedOrderForAction.credit_term_days || 15
              } días para el pedido #${selectedOrderForAction.id.slice(0, 8)} de ${
                selectedOrderForAction.customers?.name || 'Cliente'
              }?`
            : ''
        }
        isPending={isProcessing}
      />
    </div>
  );
};
