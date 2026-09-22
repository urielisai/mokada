import { useNavigate } from 'react-router-dom';
import { useTransfers } from '../hooks/useInventory';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatDate } from '../../../utils/formatters';
import { Plus, Eye } from 'lucide-react';

export const TransfersPage = () => {
  const navigate = useNavigate();
  const { data, isLoading, error } = useTransfers();

  const columns: Column<any>[] = [
    { header: 'No. Traspaso', accessorKey: 'transfer_number', className: 'font-medium text-slate-900' },
    { 
      header: 'Fecha', 
      cell: (item) => <span className="text-xs text-slate-500">{formatDate(item.created_at)}</span> 
    },
    { header: 'Origen', cell: (item) => item.source?.name },
    { header: 'Destino', cell: (item) => item.destination?.name },
    { 
      header: 'Partidas', 
      cell: (item) => <span className="text-slate-600">{item.items?.[0]?.count || 0} artículos</span> 
    },
    { 
      header: 'Estado', 
      cell: (item) => <StatusBadge status={item.status} />
    },
    {
      header: '',
      cell: (item) => (
        <div className="flex justify-end items-center">
          <button
            onClick={() => navigate(`/inventory/transfers/${item.id}`)}
            className="p-1.5 text-gray-400 hover:text-[#0066CC] hover:bg-blue-50 rounded-lg transition-colors"
            title="Ver detalles"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Traspasos</h2>
          <p className="text-[15px] text-[#86868B]">Movimiento de inventario entre almacenes</p>
        </div>

        <button
          onClick={() => navigate('/inventory/transfers/new')}
          className="flex items-center gap-2 px-4 py-2 bg-[#0066CC] text-white rounded-lg hover:bg-[#0055FF] transition-colors text-[14px] font-medium"
        >
          <Plus className="w-4 h-4" />
          Nuevo Traspaso
        </button>
      </div>

      {error && <p className="text-[13px] text-red-600 bg-red-50 border border-red-200 rounded-xl p-4">No se pudieron consultar los traspasos: {(error as Error).message}</p>}
      <Table 
        data={data || []} 
        columns={columns}
        isLoading={isLoading}
        isEmpty={!data?.length}
        emptyTitle="No hay traspasos"
        emptyMessage="Aún no se han registrado traspasos entre almacenes."
      />
    </div>
  );
};
