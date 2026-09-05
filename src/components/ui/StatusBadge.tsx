import { cn } from '../../utils/cn';

interface Props {
  status: string;
  className?: string;
  text?: string;
}

export const StatusBadge = ({ status, className, text }: Props) => {
  let label = text || status;
  let colorClass = 'text-gray-600';

  switch (status) {
    case 'ACTIVE':
    case 'AVAILABLE':
      label = text || (status === 'ACTIVE' ? 'Activo' : 'Disponible');
      colorClass = 'text-emerald-600';
      break;
    case 'INACTIVE':
      label = text || 'Inactivo';
      colorClass = 'text-gray-500';
      break;
    case 'DISCONTINUED':
      label = text || 'Descontinuado';
      colorClass = 'text-red-600';
      break;
    case 'LOW_STOCK':
      label = text || 'Stock Bajo';
      colorClass = 'text-orange-600';
      break;
    case 'OUT_OF_STOCK':
      label = text || 'Agotado';
      colorClass = 'text-red-600';
      break;
    // Fleet vehicle statuses
    case 'ASSIGNED':
      label = 'Asignado';
      colorClass = 'text-blue-600';
      break;
    case 'MAINTENANCE':
      label = 'Mantenimiento';
      colorClass = 'text-amber-600';
      break;
    case 'OUT_OF_SERVICE':
      label = 'Fuera de servicio';
      colorClass = 'text-red-600';
      break;
    // Route trip statuses
    case 'PLANNED':
      label = 'Planeado';
      colorClass = 'text-slate-600';
      break;
    case 'IN_PROGRESS':
      label = 'En progreso';
      colorClass = 'text-blue-600';
      break;
    case 'COMPLETED':
      label = 'Completado';
      colorClass = 'text-emerald-600';
      break;
    case 'UNDER_REVIEW':
      label = 'En revisión';
      colorClass = 'text-purple-600';
      break;
    case 'SETTLED':
      label = 'Liquidado';
      colorClass = 'text-teal-600';
      break;
    case 'CANCELLED':
      label = 'Cancelado';
      colorClass = 'text-red-600';
      break;
    // Expense statuses
    case 'DRAFT':
      label = 'Borrador';
      colorClass = 'text-gray-500';
      break;
    case 'SUBMITTED':
      label = 'Enviado';
      colorClass = 'text-blue-600';
      break;
    case 'APPROVED':
    case 'CREDIT_APPROVED':
      label = text || 'Aprobado';
      colorClass = 'text-emerald-600';
      break;
    case 'REJECTED':
    case 'CREDIT_REJECTED':
      label = text || 'Rechazado';
      colorClass = 'text-red-600';
      break;
    case 'REQUIRES_INFORMATION':
      label = 'Requiere info';
      colorClass = 'text-amber-600';
      break;
    case 'PENDING':
      label = text || 'Pendiente';
      colorClass = 'text-yellow-600';
      break;
    case 'PENDING_APPROVAL':
      label = text || 'Por Aprobar';
      colorClass = 'text-purple-600';
      break;
    case 'OVERDUE':
      label = text || 'Retrasado';
      colorClass = 'text-red-600';
      break;
    case 'PAID':
      label = text || 'Pagado';
      colorClass = 'text-emerald-600';
      break;
    case 'CONTADO':
      label = text || 'Contado';
      colorClass = 'text-blue-600';
      break;
    case 'CREDITO':
      label = text || 'Crédito';
      colorClass = 'text-amber-600';
      break;
    // Settlement types
    case 'BALANCED':
      label = 'Balanceado';
      colorClass = 'text-emerald-600';
      break;
    case 'AGENT_RETURNS_CASH':
      label = 'Agente devuelve';
      colorClass = 'text-amber-600';
      break;
    case 'COMPANY_REIMBURSES':
      label = 'Empresa reembolsa';
      colorClass = 'text-blue-600';
      break;
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[12px] font-medium tracking-wide', colorClass, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
      {label}
    </span>
  );
};
