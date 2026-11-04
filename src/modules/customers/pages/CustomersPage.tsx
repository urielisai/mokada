import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Download, Pencil, Phone, Plus, ReceiptText, Search, ToggleLeft, ToggleRight, Trash2, Users } from 'lucide-react';
import { AlertModal } from '../../../components/ui/AlertModal';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { EmptyState } from '../../../components/ui/EmptyState';
import { ErrorState } from '../../../components/ui/ErrorState';
import { LoadingState } from '../../../components/ui/LoadingState';
import { Modal } from '../../../components/ui/Modal';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { IconButton } from '../../../components/ui/IconButton';
import {
  useCustomers,
  useCustomersWithoutBranches,
  useDeleteCustomersWithoutBranches,
  useSaveCustomer,
} from '../hooks/useCustomers';
import {
  customersService,
  type CustomerSummary,
  type CustomerWithoutBranchesRecord,
} from '../services/customers.service';
import { useRouteScope } from '../../route-operations/hooks/useRouteScope';

export const CustomersPage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const { isAdmin, matchesRoute } = useRouteScope();
  const [customerToToggle, setCustomerToToggle] = useState<CustomerSummary | null>(null);
  const [isCleanupModalOpen, setIsCleanupModalOpen] = useState(false);
  const [hasBackedUpCsv, setHasBackedUpCsv] = useState(false);
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string; type: 'error' | 'success' | 'info' }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'error',
  });
  const { data: customers = [], isLoading, isError, error, refetch } = useCustomers({ search });
  const {
    data: customersWithoutBranches = [],
    isLoading: isLoadingWithoutBranches,
    refetch: refetchWithoutBranches,
  } = useCustomersWithoutBranches(isAdmin);
  const deleteWithoutBranches = useDeleteCustomersWithoutBranches();
  const saveCustomer = useSaveCustomer();

  const filteredCustomers = customers.filter((customer) => matchesRoute(customer.main_branch_route_id));

  const handleOpenCleanupModal = () => {
    setHasBackedUpCsv(false);
    setIsCleanupModalOpen(true);
    void refetchWithoutBranches();
  };

  const handleDownloadBackupCsv = () => {
    if (!customersWithoutBranches.length) return;
    customersService.exportCustomersWithoutBranchesCsv(customersWithoutBranches);
    setHasBackedUpCsv(true);
  };

  const handleConfirmCleanup = async () => {
    if (!customersWithoutBranches.length) return;

    // Resguardar automáticamente el CSV antes de eliminar si aún no se ha descargado
    if (!hasBackedUpCsv) {
      customersService.exportCustomersWithoutBranchesCsv(customersWithoutBranches);
      setHasBackedUpCsv(true);
    }

    try {
      const result = await deleteWithoutBranches.mutateAsync();
      setIsCleanupModalOpen(false);
      void refetch();
      void refetchWithoutBranches();

      const skippedNotice =
        result.skippedWithOrdersCount > 0
          ? ` Se conservaron ${result.skippedWithOrdersCount} cliente(s) porque tienen pedidos históricos ligados.`
          : '';

      setAlertModal({
        isOpen: true,
        title: 'Limpieza completada',
        message: `Se respaldó la información en CSV y se eliminaron ${result.deletedCount} cliente(s) sin sucursal de la base de datos.${skippedNotice}`,
        type: 'success',
      });
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error
          ? cleanupError.message
          : 'No se pudieron eliminar los clientes sin sucursal.';
      setAlertModal({
        isOpen: true,
        title: 'Error al limpiar clientes',
        message,
        type: 'error',
      });
    }
  };

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
          <h2 className="text-[26px] font-bold tracking-tight text-ink sm:text-[28px]">Clientes</h2>
          <p className="text-[14px] text-muted sm:text-[15px]">
            Cuentas de cliente, información fiscal y sucursales.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={handleOpenCleanupModal}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 text-sm font-semibold text-amber-900 transition-colors hover:bg-amber-100"
            >
              <Trash2 className="h-4 w-4 text-amber-700" />
              Limpiar sin sucursal ({customersWithoutBranches.length})
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/customers/new')}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex h-11 flex-1 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
          <Search className="h-4 w-4 text-muted" />
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
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
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
              <thead className="border-b border-gray-200/70 text-muted">
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
                    className="cursor-pointer transition-colors hover:bg-canvas/50"
                    onClick={() => navigate(`/customers/${customer.id}`)}
                  >
                    <td className="px-4 py-3.5">
                      <p className="max-w-[240px] truncate font-semibold text-ink">{customer.name}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {customer.requires_invoice ? 'Requiere factura' : 'Sin facturación marcada'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      <p className="max-w-[220px] truncate">{customer.email}</p>
                      <p className="mt-0.5 text-[12px] text-muted">{customer.phone}</p>
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      <p>{customer.active_fiscal_profile_count} activos</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-muted">
                        {customer.default_fiscal_rfc || '-'}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-ink-2">
                      <p>{customer.active_branch_count} activas</p>
                      <p className="mt-0.5 max-w-[180px] truncate text-[12px] text-muted">
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

      {isCleanupModalOpen && (
        <CleanupWithoutBranchesModal
          customers={customersWithoutBranches}
          isLoading={isLoadingWithoutBranches}
          isDeleting={deleteWithoutBranches.isPending}
          hasBackedUpCsv={hasBackedUpCsv}
          onClose={() => setIsCleanupModalOpen(false)}
          onDownloadCsv={handleDownloadBackupCsv}
          onConfirmDelete={() => void handleConfirmCleanup()}
        />
      )}
    </div>
  );
};

const CleanupWithoutBranchesModal = ({
  customers,
  isLoading,
  isDeleting,
  hasBackedUpCsv,
  onClose,
  onDownloadCsv,
  onConfirmDelete,
}: {
  customers: CustomerWithoutBranchesRecord[];
  isLoading: boolean;
  isDeleting: boolean;
  hasBackedUpCsv: boolean;
  onClose: () => void;
  onDownloadCsv: () => void;
  onConfirmDelete: () => void;
}) => {
  const deletableCount = customers.filter((c) => c.orders_count === 0).length;
  const withOrdersCount = customers.filter((c) => c.orders_count > 0).length;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Resguardar y limpiar clientes sin sucursal"
      size="xl"
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-[13px] text-amber-900">
          <p className="font-semibold">
            Se encontraron {customers.length} cliente(s) registrados sin ninguna sucursal en la base de datos.
          </p>
          <p className="mt-1 text-amber-800">
            Antes de eliminarlos de la base de datos, descarga el archivo CSV de respaldo con toda su información general y fiscal. Al confirmar la limpieza, si aún no has descargado el CSV, se descargará automáticamente antes de borrar.
          </p>
          {withOrdersCount > 0 && (
            <p className="mt-1.5 font-medium text-amber-900">
              Nota: {withOrdersCount} cliente(s) tienen pedidos históricos asociados; se incluirán en el CSV pero se conservarán en la BD para no afectar el historial de pedidos.
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted">
            Consultando clientes sin sucursal...
          </div>
        ) : !customers.length ? (
          <div className="rounded-xl border border-gray-200 bg-canvas py-8 text-center text-sm text-muted">
            No hay clientes sin sucursales en la base de datos.
          </div>
        ) : (
          <div className="max-h-72 overflow-y-auto rounded-xl border border-gray-200">
            <table className="w-full text-left text-[12px]">
              <thead className="sticky top-0 bg-gray-50 text-muted border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Correo / Teléfono</th>
                  <th className="px-3 py-2 font-semibold">Fiscal</th>
                  <th className="px-3 py-2 font-semibold">Pedidos</th>
                  <th className="px-3 py-2 font-semibold">Fecha registro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 font-medium text-ink">{c.name}</td>
                    <td className="px-3 py-2 text-ink-2">
                      <div>{c.email}</div>
                      <div className="text-muted">{c.phone}</div>
                    </td>
                    <td className="px-3 py-2 text-ink-2">
                      {c.default_fiscal_rfc || (c.fiscal_profile_count > 0 ? `${c.fiscal_profile_count} perfil(es)` : 'Sin datos')}
                    </td>
                    <td className="px-3 py-2">
                      {c.orders_count > 0 ? (
                        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                          {c.orders_count} pedido(s)
                        </span>
                      ) : (
                        <span className="text-muted">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {new Date(c.created_at).toLocaleDateString('es-MX')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancelar
          </button>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onDownloadCsv}
              disabled={!customers.length || isLoading || isDeleting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-accent bg-white px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent/5 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              {hasBackedUpCsv ? 'Volver a descargar CSV' : '1. Descargar respaldo CSV'}
            </button>

            <button
              type="button"
              onClick={onConfirmDelete}
              disabled={!deletableCount || isLoading || isDeleting}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" />
              {isDeleting
                ? 'Eliminando...'
                : hasBackedUpCsv
                  ? `2. Eliminar ${deletableCount} cliente(s) de la BD`
                  : `Resguardar CSV y eliminar (${deletableCount})`}
            </button>
          </div>
        </div>
      </div>
    </Modal>
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
          <h3 className="truncate text-sm font-semibold text-ink">{customer.name}</h3>
          <p className="mt-0.5 truncate text-[12px] text-muted">{customer.email}</p>
        </div>
        <StatusBadge status={customer.is_active ? 'ACTIVE' : 'INACTIVE'} />
      </div>
      <div className="mt-3 grid gap-1 text-[12px] text-ink-2">
        <span className="inline-flex min-w-0 items-center gap-2">
          <Phone className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span className="truncate">{customer.phone}</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <ReceiptText className="h-3.5 w-3.5 shrink-0 text-muted" />
          <span>{customer.active_fiscal_profile_count} fiscales activos</span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-2">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted" />
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
