import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database.types';

export type SalesOrderStatus = Database['public']['Enums']['sales_order_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface CreateOrderParams {
  customer_id: string;
  total_amount: number;
  shipping_address?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
}

export const ordersService = {
  async createOrder(params: CreateOrderParams) {
    // 1. Get current auth user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 2. Insert order
    const { data: order, error: orderError } = await supabase
      .from('sales_orders')
      .insert({
        customer_id: params.customer_id,
        created_by: user.id,
        total_amount: params.total_amount,
        shipping_address: params.shipping_address,
        status: 'PENDING'
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // 3. Insert items
    const itemsToInsert = params.items.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal
    }));

    const { error: itemsError } = await supabase
      .from('sales_order_items')
      .insert(itemsToInsert);

    if (itemsError) throw itemsError;

    return order;
  },

  async getMyOrders() {
    // To get customer id from auth user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .single();

    if (!customer) throw new Error('Customer profile not found');

    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        sales_order_items (
          *,
          products (name, code)
        ),
        sales_order_payments (*)
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getAllOrders() {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (name, email),
        sales_order_items (
          *,
          products (name, code)
        ),
        sales_order_payments (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getOrderById(id: string) {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (name, email, phone),
        sales_order_items (
          *,
          products (name, code)
        ),
        sales_order_payments (*)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrder(id: string, updates: any) {
    const { data, error } = await supabase
      .from('sales_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async addOrderItem(orderId: string, productId: string, quantity: number, unitPrice: number) {
    const { data, error } = await supabase
      .from('sales_order_items')
      .insert({
        order_id: orderId,
        product_id: productId,
        quantity,
        unit_price: unitPrice,
        subtotal: quantity * unitPrice
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateOrderItemQuantity(itemId: string, quantity: number) {
    // The database trigger 'calculate_order_item_subtotal' will automatically
    // update the subtotal when we change the quantity.
    const { data, error } = await supabase
      .from('sales_order_items')
      .update({ quantity })
      .eq('id', itemId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeOrderItem(itemId: string) {
    const { error } = await supabase
      .from('sales_order_items')
      .delete()
      .eq('id', itemId);

    if (error) throw error;
  },

  async markOrderAsDelivered(id: string) {
    return this.updateOrder(id, { status: 'DELIVERED' });
  },

  async registerPayment(orderId: string, amount: number, method: 'CASH' | 'TRANSFER' | 'CARD', evidenceFile?: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    let evidence_path = null;
    if (evidenceFile) {
      const fileExt = evidenceFile.name.split('.').pop();
      const fileName = `${orderId}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('payment-evidence')
        .upload(fileName, evidenceFile);
      if (uploadError) throw uploadError;
      evidence_path = fileName;
    }

    // For CASH, we might auto-approve if it's the agent. But the trigger will handle the amount_paid update.
    // Let's set it as PENDING by default if it's transfer, and APPROVED if it's cash.
    // Wait, let's keep it PENDING if the user is a CUSTOMER, and APPROVED if the user is an AGENT and method is CASH.
    // To do this simply, we will pass status explicitly or determine it here.
    const { data: profile } = await supabase.from('user_profiles').select('user_type').eq('auth_user_id', user.id).single();
    
    let status = 'PENDING';
    if (method === 'CASH' && (profile?.user_type === 'AGENT' || profile?.user_type === 'ADMIN')) {
      status = 'APPROVED';
    }

    const { data, error } = await supabase
      .from('sales_order_payments')
      .insert({
        order_id: orderId,
        amount,
        payment_method: method,
        evidence_path,
        status,
        created_by: user.id,
        approved_by: status === 'APPROVED' ? user.id : null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async approvePayment(paymentId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('sales_order_payments')
      .update({
        status: 'APPROVED',
        approved_by: user.id
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectPayment(paymentId: string, comments: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('sales_order_payments')
      .update({
        status: 'REJECTED',
        comments,
        approved_by: user.id // using approved_by for rejected_by as well to track who processed it
      })
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
