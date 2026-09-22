import { supabase } from '../../../lib/supabase/client';

export const dashboardService = {
  async getStats() {
    // Current month filter
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startStr = startOfMonth.toISOString();

    const [
      products, brands, categories, warehouses, lowStock, outOfStock,
      ordersResponse, paymentsResponse, usersResponse
    ] = await Promise.all([
      supabase.from('products').select('*', { count: 'exact', head: true }),
      supabase.from('product_brands').select('*', { count: 'exact', head: true }),
      supabase.from('product_categories').select('*', { count: 'exact', head: true }),
      supabase.from('warehouses').select('*', { count: 'exact', head: true }),
      supabase.from('inventory_available').select('*', { count: 'exact', head: true }).eq('availability_status', 'LOW_STOCK'),
      supabase.from('inventory_available').select('*', { count: 'exact', head: true }).eq('availability_status', 'OUT_OF_STOCK'),
      supabase.from('sales_orders').select('id, total_amount, created_by, customer_id, customers(name)').gte('created_at', startStr),
      supabase.from('sales_order_payments').select('id, amount, payment_method, created_by').gte('created_at', startStr),
      supabase.from('user_profiles').select('auth_user_id, name')
    ]);

    const orders = ordersResponse.data || [];
    const payments = paymentsResponse.data || [];
    const users = usersResponse.data || [];

    const userMap = new Map(users.map(u => [u.auth_user_id, u.name]));

    // 1. Top Clientes (monto total)
    const customerTotals: Record<string, { id: string, name: string, total: number }> = {};
    // 2. Top Agentes (cantidad de pedidos)
    const agentOrders: Record<string, { id: string, name: string, count: number }> = {};
    // 3. Top Agentes (efectivo recolectado)
    const agentCollections: Record<string, { id: string, name: string, total: number }> = {};

    orders.forEach((order: any) => {
      // Clientes
      if (order.customer_id) {
        const cName = Array.isArray(order.customers) ? order.customers[0]?.name : order.customers?.name;
        if (!customerTotals[order.customer_id]) {
          customerTotals[order.customer_id] = { id: order.customer_id, name: cName || 'Desconocido', total: 0 };
        }
        customerTotals[order.customer_id].total += Number(order.total_amount || 0);
      }

      // Agentes (Pedidos)
      if (order.created_by) {
        const aName = userMap.get(order.created_by) || 'Desconocido';
        if (!agentOrders[order.created_by]) {
          agentOrders[order.created_by] = { id: order.created_by, name: aName, count: 0 };
        }
        agentOrders[order.created_by].count += 1;
      }
    });

    payments.forEach((payment: any) => {
      if (payment.created_by) {
        const aName = userMap.get(payment.created_by) || 'Desconocido';
        if (!agentCollections[payment.created_by]) {
          agentCollections[payment.created_by] = { id: payment.created_by, name: aName, total: 0 };
        }
        agentCollections[payment.created_by].total += Number(payment.amount || 0);
      }
    });

    const topCustomers = Object.values(customerTotals).sort((a, b) => b.total - a.total).slice(0, 5);
    const topAgentsOrders = Object.values(agentOrders).sort((a, b) => b.count - a.count).slice(0, 5);
    const topAgentsCollections = Object.values(agentCollections).sort((a, b) => b.total - a.total).slice(0, 5);

    return {
      productsCount: products.count || 0,
      brandsCount: brands.count || 0,
      categoriesCount: categories.count || 0,
      warehousesCount: warehouses.count || 0,
      lowStockCount: lowStock.count || 0,
      outOfStockCount: outOfStock.count || 0,
      topCustomers,
      topAgentsOrders,
      topAgentsCollections
    };
  }
};
