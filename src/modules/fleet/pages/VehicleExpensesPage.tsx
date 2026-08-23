import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Search, 
  Car, 
  Receipt,
  FileImage,
  FileText,
  Paperclip,
  CheckCircle2,
  XCircle,
  Clock,
  Filter
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { vehicleExpenseService } from '../services/vehicle-expense.service';
import { fleetService } from '../services/fleet.service';
import { useAuth } from '../../auth/context/useAuth';
import { supabase } from '../../../lib/supabase/client';
import { LoadingState } from '../../../components/ui/LoadingState';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';

export const VehicleExpensesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [vehicleFilter, setVehicleFilter] = useState<string>('ALL');

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: fleetService.getVehicles,
  });

  const { data: expenses = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['vehicle-expenses', { status: statusFilter, vehicleId: vehicleFilter, agentId: isAdmin ? undefined : user?.id }],
    queryFn: () => vehicleExpenseService.getExpenses({ 
      status: statusFilter, 
      vehicleId: vehicleFilter === 'ALL' ? undefined : vehicleFilter,
      agentId: isAdmin ? undefined : user?.id 
    }),
  });

  useEffect(() => {
    const channel = supabase
      .channel('vehicle_expenses_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vehicle_expenses'
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['vehicleExpenses'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filteredExpenses = expenses.filter(exp => {
    const search = searchTerm.toLowerCase();
    return (
      exp.description?.toLowerCase().includes(search) ||
      exp.merchant_name?.toLowerCase().includes(search) ||
      exp.expense_categories?.name.toLowerCase().includes(search) ||
      exp.fleet_vehicles?.internal_code?.toLowerCase().includes(search) ||
      exp.fleet_vehicles?.plate_number?.toLowerCase().includes(search)
    );
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Aprobado
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20">
            <XCircle className="h-3.5 w-3.5" />
            Rechazado
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
            <Clock className="h-3.5 w-3.5" />
            Pendiente
          </span>
        );
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 animate-pulse rounded-lg bg-gray-200" />
            <div className="h-4 w-96 animate-pulse rounded-lg bg-gray-200" />
          </div>
          <div className="h-10 w-48 animate-pulse rounded-lg bg-gray-200" />
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="p-10 flex justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-[#0066CC]"></div></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return <ErrorState message="No se pudieron cargar los gastos." onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">Gastos de Vehículos</h2>
          <p className="text-[14px] text-[#86868B] sm:text-[15px]">Mantenimientos, reparaciones y gastos generales operativos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/fleet/expenses/new')}
            className="flex items-center gap-2 rounded-lg bg-[#0066CC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0057AD]"
          >
            <Plus className="h-4 w-4" />
            Registrar Gasto
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15">
          <Search className="h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar por concepto o proveedor..."
          />
        </label>
        
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
        >
          <option value="ALL">Todos los vehículos</option>
          {vehicles.map(v => (
            <option key={v.id} value={v.id}>{v.internal_code} - {v.plate_number}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/15"
        >
          <option value="ALL">Todos los estados</option>
          <option value="SUBMITTED">Pendientes</option>
          <option value="APPROVED">Aprobados</option>
          <option value="REJECTED">Rechazados</option>
        </select>
      </div>

      {!filteredExpenses.length ? (
        <EmptyState
          title="No hay gastos registrados"
          description="No se encontraron gastos que coincidan con los filtros."
          icon={<Receipt className="h-6 w-6 text-gray-400" />}
          action={
            <button
              onClick={() => navigate('/fleet/expenses/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0066CC] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0057AD]"
            >
              <Plus className="h-4 w-4" />
              Registrar Gasto
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredExpenses.map((expense) => (
            <Link
              key={expense.id}
              to={`/fleet/expenses/${expense.id}`}
              className="group relative flex flex-col justify-between rounded-2xl border border-gray-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl"
            >
              <div>
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 transition-colors group-hover:bg-[#0066CC]/10 group-hover:text-[#0066CC]">
                      <Car className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{expense.fleet_vehicles?.internal_code} - {expense.fleet_vehicles?.plate_number}</p>
                      <p className="text-xs text-gray-500">{formatDate(expense.expense_date)}</p>
                    </div>
                  </div>
                  {getStatusBadge(expense.status)}
                </div>

                <h3 className="mb-1 font-medium text-gray-900 line-clamp-1">{expense.expense_categories?.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2 min-h-[40px] mb-4">
                  {expense.description || expense.merchant_name || 'Sin detalles adicionales'}
                </p>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                  <div className="flex -space-x-2">
                    {expense.vehicle_expense_attachments?.slice(0,3).map((att: any, i: number) => (
                      <div key={i} className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-100 ring-1 ring-gray-200" title={att.file_name}>
                        {att.attachment_type === 'PHOTO' ? <FileImage className="h-4 w-4 text-gray-500" /> : <FileText className="h-4 w-4 text-gray-500" />}
                      </div>
                    ))}
                    {(expense.vehicle_expense_attachments?.length || 0) > 3 && (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gray-50 text-xs font-medium text-gray-500 ring-1 ring-gray-200">
                        +{(expense.vehicle_expense_attachments?.length || 0) - 3}
                      </div>
                    )}
                  </div>
                  <span className="text-lg font-bold text-gray-900">{formatCurrency(expense.amount)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};
