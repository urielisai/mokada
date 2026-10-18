import { useState, useEffect, useMemo, useCallback } from 'react';
import { ordersService } from '../../orders/services/orders.service';
import { useMyCurrentTrip } from '../hooks/useRouteOperations';
import { useAuth } from '../../auth/context/useAuth';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Modal } from '../../../components/ui/Modal';
import { LoadingState } from '../../../components/ui/LoadingState';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { formatCurrency } from '../../../utils/formatters';
import { MapPin, DollarSign, Wallet, Search, CheckCircle2, AlertTriangle, Route, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export const RouteDebtsPage = () => {
  const { profile } = useAuth();
  const { data: assignedTrip, isLoading: isLoadingTrip, error: tripError } = useMyCurrentTrip(profile?.id || null);
  const selectedRouteId = assignedTrip?.route_id || '';
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'PENDING' | 'OVERDUE' | 'PAID'>('PENDING');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedOrderForPayment, setSelectedOrderForPayment] = useState<any>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  const fetchDebts = useCallback(async () => {
    if (!selectedRouteId) {
      setOrders([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const data = await ordersService.getRouteDebts(selectedRouteId);
      setOrders(data || []);
    } catch (error) {
      console.error('Error fetching route debts:', error);
      toast.error('Error al cargar la cobranza de la ruta.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRouteId]);

  useEffect(() => {
    fetchDebts();
  }, [fetchDebts]);

  const todayStr = new Date().toISOString().split('T')[0];

  const processedOrders = useMemo(() => {
    return orders.map((order) => {
      const totalCost = Number(order.total_amount || 0);
      const amountPaid = Number(order.amount_paid || 0);
      const remainingBalance = Math.max(totalCost - amountPaid, 0);

      const isCredit = order.payment_type === 'CREDITO';
      const isApproved = order.credit_approval_status === 'APPROVED';
      const isPaid = remainingBalance <= 0.01;
      const isOverdue =
        isCredit &&
        isApproved &&
        !isPaid &&
        order.due_date &&
        order.due_date < todayStr;

      let computedStatus: string = 'PENDING';
      if (isPaid) {
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
      };
    });
  }, [orders, todayStr]);

  const filteredOrders = useMemo(() => {
    return processedOrders.filter((order) => {
      if (activeTab === 'PENDING' && (order.isPaid || order.isOverdue)) return false;
      if (activeTab === 'OVERDUE' && !order.isOverdue) return false;
      if (activeTab === 'PAID' && !order.isPaid) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const customerName = order.customers?.name?.toLowerCase() || '';
        const branchName = order.customer_branches?.name?.toLowerCase() || '';
        return customerName.includes(q) || branchName.includes(q) || order.id.includes(q);
      }

      return true;
    });
  }, [processedOrders, activeTab, searchQuery]);

  const metrics = useMemo(() => {
    let totalToCollect = 0;
    let overdueToCollect = 0;
    let totalCollected = 0;

    processedOrders.forEach((o) => {
      totalCollected += o.amountPaid;
      if (!o.isPaid) {
        totalToCollect += o.remainingBalance;
      }
      if (o.isOverdue) {
        overdueToCollect += o.remainingBalance;
      }
    });

    return { totalToCollect, overdueToCollect, totalCollected };
  }, [processedOrders]);

  const handleOpenPaymentModal = (order: any) => {
    setSelectedOrderForPayment(order);
    setPaymentAmount(order.remainingBalance.toString());
    setPaymentMethod('CASH');
    setEvidenceFile(null);
  };

  const handleCollectPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderForPayment) return;

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('Ingresa un monto válido.');
      return;
    }

    if (amount > selectedOrderForPayment.remainingBalance + 0.01) {
      toast.error('El monto no puede ser mayor al saldo pendiente.');
      return;
    }

    if (paymentMethod === 'TRANSFER' && !evidenceFile) {
      toast.error('Debes adjuntar un comprobante para pagos por transferencia.');
      return;
    }

    try {
      setIsSubmittingPayment(true);
      await ordersService.registerPayment(
        selectedOrderForPayment.id,
        amount,
        paymentMethod,
        evidenceFile || undefined
      );
      toast.success(
        paymentMethod === 'CASH'
          ? `Cobro en efectivo de ${formatCurrency(amount)} registrado y aprobado automáticamente.`
          : `Pago por transferencia registrado exitosamente. Queda pendiente de aprobación.`
      );
      setSelectedOrderForPayment(null);
      setEvidenceFile(null);
      fetchDebts();
    } catch (error) {
      console.error(error);
      toast.error('Error al registrar el cobro.');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const columns: Column<any>[] = [
    {
      header: 'Cliente / Sucursal',
      cell: (item) => (
        <div>
          <p className="font-semibold text-ink text-sm">{item.customers?.name || 'Cliente'}</p>
          <div className="flex items-center gap-1 text-[12px] text-muted mt-0.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400" />
            <span>{item.customer_branches?.name || 'Sucursal Principal'}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Pedido / Plazo',
      cell: (item) => (
        <div>
          <span className="font-mono text-xs font-semibold text-gray-800">#{item.id.slice(0, 8)}</span>
          <p className="text-[11px] text-muted">
            {item.payment_type === 'CREDITO' ? `Crédito ${item.credit_term_days || 15}d (Límite: ${item.due_date || 'N/D'})` : 'Contado'}
          </p>
        </div>
      ),
    },
    {
      header: 'Total',
      cell: (item) => <span className="font-medium text-ink">{formatCurrency(item.totalCost)}</span>,
      className: 'text-right',
    },
    {
      header: 'Cobrado',
      cell: (item) => <span className="font-medium text-ink">{formatCurrency(item.amountPaid)}</span>,
      className: 'text-right',
    },
    {
      header: 'Saldo Pendiente',
      cell: (item) => (
        <span className="font-semibold text-ink">
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
      header: 'Acción de Ruta',
      cell: (item) => {
        if (!item.isPaid) {
          return (
            <button
              type="button"
              onClick={() => handleOpenPaymentModal(item)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              <DollarSign className="h-3.5 w-3.5" />
              Cobrar en Ruta
            </button>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Liquidado
          </span>
        );
      },
      className: 'text-right',
    },
  ];

  if (isLoading && !orders.length) return <LoadingState message="Cargando cobranza de la ruta..." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-ink sm:text-[28px]">
            Cobranza de Ruta
          </h2>
          <p className="text-[14px] text-muted sm:text-[15px]">
            Gestión de adeudos y cobros de sucursales en la ruta asignada.
          </p>
        </div>

        <div className="flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-sm">
          <Route className="h-4 w-4 text-accent" />
          <div className="min-w-0">
            <p className="text-[11px] text-muted">Ruta asignada de la semana</p>
            <p className="text-sm font-semibold text-ink">{isLoadingTrip ? 'Cargando...' : assignedTrip ? `${assignedTrip.routes?.code} - ${assignedTrip.routes?.name} · ${assignedTrip.week_start_date} al ${assignedTrip.week_end_date}` : tripError ? 'No se pudo consultar la ruta' : 'Sin ruta asignada esta semana'}</p>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Adeudo en Ruta
            </span>
            <div className="p-2 text-ink">
              <Wallet className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(metrics.totalToCollect)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Vencido en Ruta
            </span>
            <div className="p-2 text-ink">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(metrics.overdueToCollect)}
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Total Cobrado
            </span>
            <div className="p-2 text-ink">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-ink">
            {formatCurrency(metrics.totalCollected)}
          </p>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveTab('PENDING')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'PENDING' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Pendientes
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('OVERDUE')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'OVERDUE' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Retrasados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('PAID')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'PAID' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Pagados
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'ALL' ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            Todos
          </button>
        </div>

        <label className="flex h-11 w-full items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15 sm:w-72">
          <Search className="h-4 w-4 text-muted" />
          <input
            type="text"
            placeholder="Buscar por cliente o sucursal..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
      </div>

      <Table
        data={filteredOrders}
        columns={columns}
        isLoading={isLoading}
        isEmpty={filteredOrders.length === 0}
        emptyTitle="Sin adeudos en esta ruta"
        emptyMessage="No hay pedidos con saldos pendientes para las sucursales de la ruta seleccionada."
      />

      {/* Payment Modal */}
      {selectedOrderForPayment && (
        <Modal
          isOpen={!!selectedOrderForPayment}
          onClose={() => {
            setSelectedOrderForPayment(null);
            setEvidenceFile(null);
          }}
          title="Registrar Pago"
        >
          <form onSubmit={handleCollectPayment} className="space-y-4">
            <div className="rounded-lg border border-gray-200/60 bg-gray-50 p-3 text-xs space-y-1">
              <p className="font-semibold text-ink">
                Cliente: {selectedOrderForPayment.customers?.name || 'Cliente'}
              </p>
              <p className="text-muted">
                Sucursal: {selectedOrderForPayment.customer_branches?.name || 'Principal'}
              </p>
              <p className="text-muted">
                Pedido: #{selectedOrderForPayment.id.slice(0, 8)}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pago</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CASH"
                    checked={paymentMethod === 'CASH'}
                    onChange={() => setPaymentMethod('CASH')}
                    className="text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-gray-700">Efectivo (Automático)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="TRANSFER"
                    checked={paymentMethod === 'TRANSFER'}
                    onChange={() => setPaymentMethod('TRANSFER')}
                    className="text-accent focus:ring-accent"
                  />
                  <span className="text-sm text-gray-700">Transferencia</span>
                </label>
              </div>
            </div>

            {paymentMethod === 'CASH' && (
              <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
                Al registrar un pago en efectivo, este quedará <strong>aprobado automáticamente</strong> y se descontará del saldo del pedido de forma inmediata.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monto Cobrado *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={selectedOrderForPayment.remainingBalance}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="pl-8 w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-sm font-semibold text-ink"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Saldo pendiente: ${selectedOrderForPayment.remainingBalance.toFixed(2)}
              </p>
            </div>

            {paymentMethod === 'TRANSFER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comprobante (Transferencia) *
                </label>
                <ImageUpload
                  onChange={setEvidenceFile}
                  value={evidenceFile}
                  onClear={() => setEvidenceFile(null)}
                />
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForPayment(null);
                  setEvidenceFile(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmittingPayment}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50 transition-colors"
              >
                {isSubmittingPayment ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  'Registrar Pago'
                )}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
