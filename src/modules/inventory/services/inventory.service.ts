import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database.types';

export type InventoryStock = Database['public']['Views']['inventory_available']['Row'] & {
  average_cost: number | null; original_average_cost: number | null;
  warehouse_role: 'PURCHASE' | 'SALES'; default_price_list_id: string | null;
  sale_prices: {price_list_id: string; name: string; amount: number}[];
};

async function readPages<T>(request: () => any): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const {data, error} = await request().range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export const inventoryService = {
  async getInventoryProducts() {
    return readPages<{id: string; code: string; name: string; image_url: string | null}>(() => supabase.from('products').select('id, code, name, image_url').eq('status', 'ACTIVE').order('id'));
  },
  async getStock() {
    const [stock, costs, prices, warehouses] = await Promise.all([
      readPages<Database['public']['Views']['inventory_available']['Row']>(() => supabase.from('inventory_available').select('*').order('id')),
      readPages<{inventory_id: string; average_cost: number | null; original_average_cost: number | null}>(() => supabase.from('inventory_costs').select('*').order('inventory_id')),
      readPages<{product_id: string; price_list_id: string; amount: number; price_lists: {name: string}}>(() => supabase.from('product_prices').select('product_id, price_list_id, amount, price_lists!inner(name, is_active)').is('valid_to', null).lte('valid_from', new Date().toISOString()).eq('price_lists.is_active', true).order('product_id').order('price_list_id')),
      readPages<{id: string; warehouse_role: 'PURCHASE' | 'SALES'; price_list_id: string | null}>(() => supabase.from('warehouses').select('id, warehouse_role, price_list_id').order('id'))
    ]);
    const costMap = new Map(costs.map(cost => [cost.inventory_id, cost]));
    const warehouseMap = new Map(warehouses.map(warehouse => [warehouse.id, warehouse]));
    const priceMap = new Map<string, InventoryStock['sale_prices']>();
    for (const price of prices) {
      const list = priceMap.get(price.product_id) || [];
      list.push({price_list_id: price.price_list_id, name: price.price_lists.name, amount: price.amount});
      priceMap.set(price.product_id, list);
    }
    return stock.map(row => ({...row, average_cost: costMap.get(row.id!)?.average_cost ?? null, original_average_cost: costMap.get(row.id!)?.original_average_cost ?? null,
      warehouse_role: warehouseMap.get(row.warehouse_id!)?.warehouse_role || 'PURCHASE',
      default_price_list_id: warehouseMap.get(row.warehouse_id!)?.price_list_id || null,
      sale_prices: priceMap.get(row.product_id!) || []} satisfies InventoryStock));
  },

  async getMovements(warehouseId?: string) {
    const data = await readPages<any>(() => {
      let query = supabase.from('inventory_movements').select('*, products(name, code), warehouses(name)').order('created_at', {ascending: false}).order('id');
      if (warehouseId) query = query.eq('warehouse_id', warehouseId);
      return query;
    });

    // Fetch users for these movements
    const userIds = [...new Set(data.filter((m: any) => m.created_by).map((m: any) => m.created_by))];
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from('user_profiles')
        .select('auth_user_id, first_name, last_name')
        .in('auth_user_id', userIds);
      const userMap = new Map(users?.map((u: any) => [u.auth_user_id, u]) || []);
      return data.map((m: any) => ({ ...m, user: userMap.get(m.created_by) }));
    }

    return data;
  },

  async getWarehouses() {
    // Incluye la price_list asociada al almacén (para saber si maneja precios de venta)
    const { data, error } = await supabase
      .from('warehouses')
      .select('*, price_lists(id, code, name)')
      .order('name');
    if (error) throw error;
    return data;
  },

  async saveWarehouse(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = (supabase as any).from('warehouses').update(dataToSave).eq('id', id);
    } else {
      request = (supabase as any).from('warehouses').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async createMovement(payload: {
    product_id: string;
    warehouse_id: string;
    movement_type: string;
    quantity: number;
    notes?: string;
    unit_cost?: number;
  }) {
    const { data: { session } } = await supabase.auth.getSession();

    const incoming = ['PURCHASE', 'INITIAL_STOCK', 'ADJUSTMENT_IN'].includes(payload.movement_type);
    const { data, error } = await (supabase.rpc as any)(incoming ? 'receive_inventory' : 'process_inventory_movement', {
      p_product_id: payload.product_id,
      p_warehouse_id: payload.warehouse_id,
      p_movement_type: payload.movement_type,
      p_quantity: payload.quantity,
      p_notes: payload.notes || null,
      ...(incoming ? { p_unit_cost: payload.unit_cost } : { p_created_by: session?.user?.id || null })
    });
    if (error) throw error;
    return data;
  },

  async getTransfers() {
    return readPages<any>(() => (supabase as any).from('inventory_transfers').select('*, source:warehouses!source_warehouse_id(name), destination:warehouses!destination_warehouse_id(name), items:inventory_transfer_items(count)').order('created_at', {ascending: false}).order('id'));
  },

  async getTransferFull(id: string) {
    const { data: transfer, error: transferError } = await (supabase as any)
      .from('inventory_transfers')
      .select(`
        *,
        source:warehouses!source_warehouse_id(name),
        destination:warehouses!destination_warehouse_id(name, price_list_id, price_lists(id, code, name))
      `)
      .eq('id', id)
      .single();
    if (transferError) throw transferError;

    const { data: items, error: itemsError } = await (supabase as any)
      .from('inventory_transfer_items')
      .select('*, products(name, code, image_url)')
      .eq('transfer_id', id);
    if (itemsError) throw itemsError;

    return { ...transfer, items };
  },

  async createTransfer(payload: {
    transfer_number: string;
    source_warehouse_id: string;
    destination_warehouse_id: string;
    notes?: string;
    items: { product_id: string; quantity: number; unit_price?: number | null }[];
  }) {
    const {data, error} = await supabase.rpc('save_inventory_transfer', {p_payload: payload});
    if (error) throw error;
    return data;
  },

  async updateTransfer(id: string, payload: {
    source_warehouse_id: string;
    destination_warehouse_id: string;
    notes?: string;
    items: { product_id: string; quantity: number; unit_price?: number | null }[];
  }) {
    const {data, error} = await supabase.rpc('save_inventory_transfer', {p_payload: payload, p_transfer_id: id});
    if (error) throw error;
    return data;
  },

  async cancelTransfer(id: string) {
    const { data, error } = await (supabase as any)
      .from('inventory_transfers')
      .update({ status: 'CANCELLED' })
      .eq('id', id)
      .eq('status', 'DRAFT')
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async completeTransfer(transferId: string) {
    const { data, error } = await (supabase.rpc as any)('process_inventory_transfer', {
      p_transfer_id: transferId
    });
    if (error?.message?.includes('Configura el costo')) {
      // Identify the exact source product rather than sending the user to
      // configure a different product or the destination warehouse.
      const transfer = await inventoryService.getTransferFull(transferId);
      const productIds = transfer.items.map((item: any) => item.product_id);
      const { data: costs, error: costsError } = await (supabase as any)
        .from('inventory_valuation')
        .select('product_id, average_cost, original_average_cost')
        .eq('warehouse_id', transfer.source_warehouse_id)
        .in('product_id', productIds);
      if (!costsError) {
        const missing = transfer.items.filter((item: any) => {
          const cost = costs?.find((row: any) => row.product_id === item.product_id);
          return cost?.average_cost == null || cost?.original_average_cost == null;
        });
        if (missing.length) {
          const products = missing.map((item: any) => `${item.products?.code || item.product_id}: ${item.products?.name || 'Producto'}`).join('; ');
          throw new Error(`Falta costo en ${transfer.source?.name || 'el almacén de origen'} para: ${products}. Configura el costo promedio y el costo original de estos productos en Costos y ganancias → Costos del inventario. Al completar el traspaso, los costos del destino se registran automáticamente.`);
        }
      }
    }
    if (error) throw error;
    return data;
  }
};
