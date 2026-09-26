import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Car, DollarSign, FileImage, FileText, Receipt } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { vehicleExpenseService } from '../services/vehicle-expense.service';

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(amount);

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

const statusLabels: Record<string, string> = {
  SUBMITTED: 'Pendiente',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
};

export const VehicleExpenseDetailPage = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data: expense, isLoading, isError } = useQuery({
    queryKey: ['vehicle-expense', id],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) throw new Error('No se encontró el gasto.');
      const record = await vehicleExpenseService.getExpenseById(id);
      const attachments = await Promise.all(
        (record.vehicle_expense_attachments || []).map(async (attachment) => ({
          ...attachment,
          url: await vehicleExpenseService.getAttachmentUrl(attachment.storage_path),
        })),
      );
      return { ...record, vehicle_expense_attachments: attachments };
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-gray-500">Cargando detalle del gasto...</div>;
  }

  if (isError || !expense) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate('/fleet/expenses')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" /> Volver a gastos
        </button>
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          No se pudo cargar el detalle del gasto.
        </p>
      </div>
    );
  }

  const agent = expense.user_profiles as { first_name: string | null; last_name: string | null } | null;
  const vehicle = expense.fleet_vehicles as { internal_code: string | null; plate_number: string | null } | null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/fleet/expenses')}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm hover:bg-gray-50 hover:text-gray-900"
          aria-label="Volver a gastos vehiculares"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold text-gray-900">Detalle del Gasto Vehicular</h2>
          <p className="text-sm text-gray-500">{expense.expense_categories?.name || 'Gasto'}</p>
        </div>
        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
          {statusLabels[expense.status || ''] || expense.status}
        </span>
      </div>

      <section className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <Car className="mt-0.5 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Vehículo</p>
              <p className="mt-1 font-medium text-gray-900">{vehicle?.internal_code || 'Vehículo'}{vehicle?.plate_number ? ` - ${vehicle.plate_number}` : ''}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Receipt className="mt-0.5 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Categoría</p>
              <p className="mt-1 font-medium text-gray-900">{expense.expense_categories?.name || 'Sin categoría'}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <DollarSign className="mt-0.5 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Monto</p>
              <p className="mt-1 font-semibold text-gray-900">{formatCurrency(Number(expense.amount))}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Calendar className="mt-0.5 h-5 w-5 text-gray-400" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Fecha del gasto</p>
              <p className="mt-1 font-medium text-gray-900">{formatDate(expense.expense_date)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Taller o proveedor</p>
            <p className="mt-1 font-medium text-gray-900">{expense.merchant_name || 'No especificado'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Registrado por</p>
            <p className="mt-1 font-medium text-gray-900">
              {[agent?.first_name, agent?.last_name].filter(Boolean).join(' ') || 'No disponible'}
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <p className="text-xs font-medium uppercase text-gray-500">Descripción</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{expense.description || 'Sin detalles adicionales'}</p>
        </div>

        <div className="border-t border-gray-100 pt-5">
          <h3 className="font-semibold text-gray-900">Evidencias y comprobantes</h3>
          {expense.vehicle_expense_attachments.length ? (
            <ul className="mt-3 divide-y divide-gray-100">
              {expense.vehicle_expense_attachments.map((attachment) => {
                const isImage = attachment.mime_type.startsWith('image/');
                return (
                  <li key={attachment.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {isImage ? <FileImage className="h-5 w-5 shrink-0 text-gray-400" /> : <FileText className="h-5 w-5 shrink-0 text-gray-400" />}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{attachment.file_name}</p>
                        <p className="text-xs text-gray-500">{attachment.attachment_type === 'PHOTO' ? 'Imagen' : 'Comprobante'}</p>
                      </div>
                    </div>
                    <a href={attachment.url} target="_blank" rel="noreferrer" className="shrink-0 text-sm font-medium text-[#0066CC] hover:underline">
                      Ver archivo
                    </a>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">Este gasto no tiene evidencias adjuntas.</p>
          )}
        </div>
      </section>
    </div>
  );
};