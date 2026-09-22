import { useState, useMemo } from 'react';
import { Search, Package, LayoutGrid, List, Warehouse } from 'lucide-react';
import { useStock } from '../hooks/useInventory';
import { Table, type Column } from '../../../components/ui/Table';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { formatQuantity } from '../../../utils/formatters';
import { catalogService } from '../../catalog/services/catalog.service';
import { InventoryCostModal } from '../components/InventoryProductInfo';
import type { InventoryStock } from '../services/inventory.service';
import { formatCurrency } from '../../../utils/formatters';

export const StockPage = () => {
  const { data, isLoading, error, refetch } = useStock();
  const [editingCost, setEditingCost] = useState<InventoryStock | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

  const warehouses = useMemo(() => {
    if (!data) return [];
    const unique = new Set(data.map((item: any) => item.warehouse_name).filter(Boolean));
    return Array.from(unique).sort();
  }, [data]);

  const filteredData = data?.filter((item: any) => {
    if (selectedWarehouse !== 'all' && item.warehouse_name !== selectedWarehouse) {
      return false;
    }
    
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      item.product_name?.toLowerCase().includes(query) ||
      item.product_code?.toLowerCase().includes(query) ||
      item.warehouse_name?.toLowerCase().includes(query)
    );
  });

  const groupedData = useMemo(() => {
    if (!filteredData) return {};
    return filteredData.reduce((acc: any, item: any) => {
      const w = item.warehouse_name || 'Sin almacén';
      if (!acc[w]) acc[w] = [];
      acc[w].push(item);
      return acc;
    }, {});
  }, [filteredData]);

  const columns: Column<any>[] = [
    { header: 'Código', accessorKey: 'product_code', className: 'font-medium text-slate-900' },
    { 
      header: 'Producto', 
      cell: (item) => {
        const imageUrl = catalogService.getProductImageUrl(item.product_image);
        return (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              {imageUrl ? (
                <img src={imageUrl} alt={item.product_name} className="w-full h-full object-cover rounded-lg border border-gray-200/60 shadow-sm" />
              ) : (
                <Package className="w-6 h-6 text-gray-300 stroke-[1.5]" />
              )}
            </div>
            <span className="font-medium text-[#1D1D1F]">{item.product_name}</span>
          </div>
        );
      }
    },
    { header: 'Almacén', accessorKey: 'warehouse_name' },
    { header: 'Ubicación', cell: item => item.location_name || 'Sin ubicación' },
    { 
      header: 'Existencia', 
      cell: (item) => formatQuantity(item.quantity || 0),
      className: 'text-right'
    },
    { 
      header: 'Reservado', 
      cell: (item) => formatQuantity(item.reserved_quantity || 0),
      className: 'text-right'
    },
    { 
      header: 'Disponible', 
      cell: (item) => <span className="font-semibold text-emerald-600">{formatQuantity(item.available_quantity || 0)}</span>,
      className: 'text-right'
    },
    { 
      header: 'Estado', 
      cell: (item) => <StatusBadge status={item.availability_status} />
    },
    {header: 'Costo del almacén', className: 'text-right', cell: item => item.average_cost == null ? 'Sin costo' : formatCurrency(item.average_cost)},
    {header: 'Compra original', className: 'text-right', cell: item => item.original_average_cost == null ? 'Sin costo' : formatCurrency(item.original_average_cost)},
    {header: 'Precios de venta', cell: item => <div className="text-[12px] space-y-1">{item.warehouse_role === 'PURCHASE' ? 'No aplica · traspasa para vender' : item.sale_prices.length ? item.sale_prices.map((price: InventoryStock['sale_prices'][number]) => <p key={price.price_list_id} className={price.price_list_id === item.default_price_list_id ? 'font-semibold' : ''}>{price.name}: {formatCurrency(price.amount)}{price.price_list_id === item.default_price_list_id ? ' · predeterminado' : ''}</p>) : 'Sin precios'}</div>},
    {header: 'Acciones', cell: item => <button className="text-[12px] text-[#0066CC] font-medium hover:underline" onClick={() => setEditingCost(item)}>Configurar costos</button>}
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Existencias</h2>
          <p className="text-[15px] text-[#86868B]">Consulta de inventario disponible por almacén</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          {/* Warehouse Filter */}
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] text-[#1D1D1F] transition-all shadow-sm appearance-none cursor-pointer pr-10"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
              backgroundPosition: `right 0.5rem center`,
              backgroundRepeat: `no-repeat`,
              backgroundSize: `1.5em 1.5em`,
            }}
          >
            <option value="all">Todos los almacenes</option>
            {warehouses.map((w: any) => (
              <option key={w} value={w}>{w}</option>
            ))}
          </select>

          <div className="relative w-full sm:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por código, producto o almacén..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all shadow-sm"
            />
          </div>
          
          <div className="flex items-center bg-gray-100/80 p-1 rounded-xl border border-gray-200/50">
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'table' 
                  ? 'bg-white shadow-sm text-[#1D1D1F]' 
                  : 'text-gray-500 hover:text-[#1D1D1F]'
              }`}
              title="Vista de Tabla"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-white shadow-sm text-[#1D1D1F]' 
                  : 'text-gray-500 hover:text-[#1D1D1F]'
              }`}
              title="Vista de Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {error && <p className="p-4 bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl">No se pudo consultar el inventario: {(error as Error).message}. <button className="underline" onClick={() => refetch()}>Reintentar</button></p>}
      {isLoading ? (
        <div className="py-12 text-center text-gray-500">Cargando existencias...</div>
      ) : Object.keys(groupedData).length > 0 ? (
        <div className="space-y-12">
          {Object.entries(groupedData).map(([warehouse, items]: [string, any]) => (
            <div key={warehouse} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2">
                <Warehouse className="w-5 h-5 text-gray-400" />
                <h3 className="text-[20px] font-semibold text-[#1D1D1F]">
                  {warehouse}
                </h3>
              </div>
              
              {viewMode === 'table' ? (
                <Table 
                  data={items} 
                  columns={columns}
                  isLoading={false}
                  isEmpty={false}
                  emptyTitle=""
                  emptyMessage=""
                />
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {items.map((item: any, index: number) => {
                    const imageUrl = catalogService.getProductImageUrl(item.product_image);

                    return (
                      <div 
                        key={`${item.product_id}-${item.warehouse_id}-${index}`}
                        className="group bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
                      >
                        {/* Image Section */}
                        <div className="relative aspect-square bg-white border-b border-gray-50 p-6 flex items-center justify-center overflow-hidden">
                          {imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={item.product_name} 
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                            />
                          ) : (
                            <Package className="w-20 h-20 text-gray-200 stroke-[1] group-hover:scale-105 transition-transform duration-500" />
                          )}
                        </div>

                        {/* Info Section */}
                        <div className="p-5 flex-1 flex flex-col">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="text-[12px] font-medium text-[#0066CC] truncate">
                              {item.product_code}
                            </span>
                            <StatusBadge status={item.availability_status} />
                          </div>

                          
                          <h3 className="text-[15px] font-semibold text-[#1D1D1F] leading-tight mb-2 line-clamp-2">
                            {item.product_name}
                          </h3>
                          
                          <div className="text-[12px] text-[#86868B] space-y-1 mt-4">
                            <p>Costo del almacén: <span className="text-[#1D1D1F] font-medium">{item.average_cost == null ? 'Sin costo' : formatCurrency(item.average_cost)}</span></p>
                            <p>Compra original: <span className="text-[#1D1D1F] font-medium">{item.original_average_cost == null ? 'Sin costo' : formatCurrency(item.original_average_cost)}</span></p>
                            {item.warehouse_role === 'SALES' ? item.sale_prices.map((price: InventoryStock['sale_prices'][number]) => <p key={price.price_list_id}>{price.name}: {formatCurrency(price.amount)}</p>) : <p>Precios de venta: no aplican aquí</p>}
                            <button className="text-[#0066CC] font-medium hover:underline pt-2" onClick={() => setEditingCost(item)}>Configurar costos</button>
                          </div>
                          <div className="mt-auto pt-4 border-t border-gray-100 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-[11px] text-[#86868B] uppercase tracking-wider mb-0.5">Disp.</p>
                              <p className="text-[14px] font-semibold text-emerald-600">
                                {formatQuantity(item.available_quantity || 0)}
                              </p>
                            </div>
                            <div className="border-x border-gray-100">
                              <p className="text-[11px] text-[#86868B] uppercase tracking-wider mb-0.5">Rsv.</p>
                              <p className="text-[14px] font-medium text-gray-500">
                                {formatQuantity(item.reserved_quantity || 0)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[11px] text-[#86868B] uppercase tracking-wider mb-0.5">Total</p>
                              <p className="text-[14px] font-semibold text-[#1D1D1F]">
                                {formatQuantity(item.quantity || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-gray-200/60 rounded-2xl p-12 text-center flex flex-col items-center shadow-sm">
          <Package className="w-12 h-12 text-gray-300 mb-4 stroke-[1.5]" />
          <h3 className="text-[16px] font-semibold text-[#1D1D1F] mb-1">No hay existencias</h3>
          <p className="text-[14px] text-[#86868B]">No se encontraron productos en el inventario.</p>
        </div>
      )}
      <InventoryCostModal stock={editingCost} onClose={() => setEditingCost(null)} />
    </div>
  );
};
