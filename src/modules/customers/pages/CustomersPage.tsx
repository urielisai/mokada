import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Pencil, Phone, Plus, ReceiptText, Search, ToggleLeft, ToggleRight, Users } from 'lucide-react';
import { AlertModal } from '../../../components/ui/AlertModal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { IconButton } from '../../../components/ui/IconButton';
import { useCustomers, useSaveCustomer } from '../hooks/useCustomers';
import type { CustomerSummary } from '../services/customers.service';
import { useRouteStore } from '../../../store/routeStore';

export const CustomersPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { globalSelectedRouteId } = useRouteStore();
  const [customerToToggle, setCustomerToToggle] = useState<CustomerSummary | null>(null);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });
  const { data: customers = [], isLoading, isError, error, refetch } = useCustomers({ search });
  const saveCustomer = useSaveCustomer();

  const filteredCustomers = customers.filter((customer) => !globalSelectedRouteId || customer.main_branch_route_id === globalSelectedRouteId);

  const handleToggleCustomer = (customer: CustomerSummary) => {
    setAlertModal((current) => ({ ...current, isOpen: false }));
    saveCustomer.mutate(
      {
        id: customer.id,
        payload: {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          requires_invoice: customer.requires_invoice,
          is_active: !customer.is_active,
        },
      },
      {
        onSuccess: () => setCustomerToToggle(null),
        onError: (mutationError) => {
          const message = mutationError instanceof Error ? mutationError.message : 'No se pudo actualizar el cliente.';
          setAlertModal({
            isOpen: true,
            title: 'No se pudo actualizar el cliente',
            message,
            type: 'error',
          });
        },
      },
    );
  };

  if (isLoading) return <LoadingState message="Cargando clientes..." />;

  if (isError) {
    const message = error instanceof Error ? error.message : 'No se pudieron cargar los clientes.';
    return <ErrorState message={message} onRetry={() => refetch()} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-[26px] font-bold tracking-tight text-[#1D1D1F] sm:text-[28px]">Clientes</h2>
          <p className="text-[14px] text-[#86868B] sm:text-[15px]">
            Cuentas de cliente, información fiscal y sucursales.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/customers/new')}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0066CC] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD]"
        >
          <Plus className="h-4 w-4" />
          Nuevo cliente
        </button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus-within:border-[#0066CC] focus-within:ring-2 focus-within:ring-[#0066CC]/15">
          <Search className="h-4 w-4 text-[#86868B]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Buscar por nombre, correo o teléfono"
          />
        </label>
      </div>

      {!filteredCustomers.length ? (
        <EmptyState
          title="No hay clientes"
          description="Crea tu primer cliente para generar su usuario automáticamente."
          icon={<Users className="h-6 w-6 text-gray-400" />}
          action={
            <button
              type="button"
              onClick={() => navigate('/customers/new')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#0066CC] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD]"
            >
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </button>
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-lg border border-gray-200/70 bg-white shadow-sm lg:block">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-gray-200/70 text-[#86868B]">
                <tr>
                  <th className="px-4 py-3.5 font-semibold">Cliente</th>
                  <th className="px-4 py-3.5 font-semibold">Contacto</th>
                  <th className="px-4 py-3.5 font-semibold">Fiscal</th>
                  <th className="px-4 py-3.5 font-semibold">Sucursales</th>
                  <th className="px-4 py-3.5 font-semibold">Estado</th>
                  <th className="px-4 py-3.5 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="cursor-pointer transition-colors hover:bg-[#F5F5F7]/50"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <p className="max-w-[240px] truncate font-semibold text-[#1D1D1F]">{customer.name}</p>
                      <p className="mt-0.5 text-[12px] text-[#86868B]">
                        {customer.requires_invoice ? 'Requiere factura' : 'Sin facturación marcada'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-[#424245]">
                      <p className="max-w-[220px] truncate">{customer.email}</p>
                      <p className="mt-0.5 text-[12px] text-[#86868B]">{customer.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-[#424245]">
                      <p>{customer.active_fiscal_profile_count} activos</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-[#86868B]">
                        {customer.default_fiscal_rfc || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-[#424245]">
                      <p>{customer.active_branch_count} activas</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-[#86868B]">
                        {customer.main_branch_route_name || customer.main_branch_name || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={customer.is_active ? 'ACTIVE' : 'INACTIVE'} />
                    </td>
                    <td className="px-4 py-3.5" onClick={(event) => event.stopPropagation()}>
                      <CustomerActions
                        customer={customer}
                        isPending={saveCustomer.isPending}
                        onEdit={() => navigate(`/customers/${customer.id}`)}
                        onToggle={() => setCustomerToToggle(customer)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filteredCustomers.map((customer) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                isPending={saveCustomer.isPending}
                onEdit={() => navigate(`/customers/${customer.id}`)}
                onToggle={() => setCustomerToToggle(customer)}
              />
            ))}
          </div>
        </>
      )}

      <ConfirmModal
        isOpen={Boolean(customerToToggle)}
        onClose={() => setCustomerToToggle(null)}
        onConfirm={() => {
          if (customerToToggle) handleToggleCustomer(customerToToggle);
        }}
        title={customerToToggle?.is_active ? 'Desactivar cliente' : 'Activar cliente'}
        message={
          customerToToggle?.is_active
            ? `El cliente ${customerToToggle.name} dejará de aparecer como activo.`
            : `El cliente ${customerToToggle?.name || ''} volverá a estar activo.`
        }
        confirmText={customerToToggle?.is_active ? 'Desactivar' : 'Activar'}
        isDestructive={customerToToggle?.is_active}
        isPending={saveCustomer.isPending}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal((current) => ({ ...current, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
      />
    </div>
  );
};

const CustomerCard = ({
  customer,
  isPending,
  onEdit,
  onToggle,
}: {
  customer: CustomerSummary;
  isPending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) => (
  <article className="rounded-lg border border-gray-200/70 bg-white p-3 shadow-sm">
    <button type="button" onClick={onEdit} className="block w-full text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-[#1D1D1F]">{customer.name}</h3>
          <p className="mt-0.5 truncate text-[12px] text-[#86868B]">{customer.email}</p>
        </div>
        <StatusBadge status={customer.is_active ? 'ACTIVE' : 'INACTIVE'} />
      </div>
      <div className="mt-3 grid gap-1 text-[12px] text-[#424245]">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-[#86868B]" />
          <span className="truncate">{customer.phone}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-[#86868B]" />
          <span>{customer.active_fiscal_profile_count} fiscales activos</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-[#86868B]" />
          <span className="truncate">{customer.active_branch_count} sucursales activas</span>
        </span>
      </div>
    </button>
    <div className="mt-3 flex justify-end">
      <CustomerActions customer={customer} isPending={isPending} onEdit={onEdit} onToggle={onToggle} />
    </div>
  </article>
);

const CustomerActions = ({
  customer,
  isPending,
  onEdit,
  onToggle,
}: {
  customer: CustomerSummary;
  isPending: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) => (
  <div className="flex justify-end gap-2">
    <IconButton title="Editar" onClick={onEdit}>
      <Pencil className="h-4 w-4" />
    </IconButton>
    <IconButton title={customer.is_active ? 'Desactivar' : 'Activar'} onClick={onToggle} disabled={isPending}>
      {customer.is_active ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
    </IconButton>
  </div>
);
