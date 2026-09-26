import { supabase } from '../../../lib/supabase/client';
import type { Database } from '../../../types/database.types';
import { createClientUuid } from '../../../utils/createClientUuid';
import { getRoutePaymentDay } from '../../../utils/routePaymentDate';

export type SalesOrderStatus = Database['public']['Enums']['sales_order_status'];
export type PaymentMethod = Database['public']['Enums']['payment_method'];
export type PaymentStatus = Database['public']['Enums']['payment_status'];

export interface CreateOrderParams {
  customer_id: string;
  total_amount: number;
  warehouse_id?: string;
  price_list_id?: string;
  shipping_address?: string;
  branch_id?: string;
  payment_type?: 'CONTADO' | 'CREDITO';
  credit_term_days?: 8 | 15 | 21;
  warranty_return_id?: string;
  requires_invoice?: boolean;
  fiscal_profile_id?: string;
  invoice_payment_form?: string;
  items: {
    product_id: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    discount_percent?: number;
    discount_reason?: string;
  }[];
}

export const ordersService = {
  async markPaidManually(orderId:string) {
    const {error}=await supabase.rpc('mark_order_paid_manually',{p_order_id:orderId});
    if(error)throw error;
  },
  async setItemDiscount(itemId: string, percent: number, reason: string) {
    const {data, error} = await supabase.rpc('set_order_item_discount', {p_item_id:itemId,p_discount_percent:percent,p_reason:reason});
    if (error) throw error;
    return data;
  },
  async createOrder(params: CreateOrderParams) {
    const { data, error } = await (supabase.rpc as any)('create_priced_order', { p_payload: params });
    if (error) throw error;
    return data;
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
      .is('warranty_return_id', null)
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
    if (updates.status && ['CONFIRMED', 'SHIPPED', 'DELIVERED'].includes(updates.status)) {
      const { data: existing } = await supabase
        .from('sales_orders')
        .select('payment_type, credit_approval_status')
        .eq('id', id)
        .single();

      if (existing?.payment_type === 'CREDITO') {
        if (existing.credit_approval_status === 'PENDING') {
          throw new Error('Debes autorizar la solicitud de crédito antes de confirmar, enviar o entregar este pedido.');
        }
        if (existing.credit_approval_status === 'REJECTED') {
          throw new Error('No se puede confirmar ni enviar un pedido con solicitud de crédito rechazada.');
        }
      }
    }

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

  async markOrderAsDelivered(id: string, signedByName: string, signature: Blob) {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) throw userError || new Error('Inicia sesión para confirmar la entrega');
    const path = `${user.id}/${id}/${createClientUuid()}.png`;
    const bucket = supabase.storage.from('delivery-signatures');
    const { error: uploadError } = await bucket.upload(path, signature, { contentType: 'image/png', upsert: false });
    if (uploadError) throw uploadError;
    try {
      const { data, error } = await supabase.rpc('confirm_order_delivery', {
        p_order_id: id, p_signed_by_name: signedByName, p_signature_path: path,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      await bucket.remove([path]);
      throw error;
    }
  },

  async getDeliveryReceipt(id: string) {
    const { data, error } = await supabase.from('order_delivery_receipts').select('signed_by_name,signature_path,received_at').eq('order_id', id).maybeSingle();
    if (error) throw error;
    return data;
  },

  async getDeliverySignatureUrl(path: string) {
    const { data, error } = await supabase.storage.from('delivery-signatures').createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
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
    
    let status: PaymentStatus = 'PENDING';
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
  },

  async approveCreditRequest(orderId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: order } = await supabase
      .from('sales_orders')
      .select('credit_term_days')
      .eq('id', orderId)
      .single();

    const creditApprovedAt = new Date();
    let dueDate: string | null = null;
    if (order?.credit_term_days) {
      const d = new Date(creditApprovedAt);
      d.setDate(d.getDate() + order.credit_term_days);
      dueDate = d.toISOString().split('T')[0];
    }

    const { data, error } = await supabase
      .from('sales_orders')
      .update({
        credit_approval_status: 'APPROVED',
        credit_approved_at: creditApprovedAt.toISOString(),
        credit_approved_by: user.id,
        due_date: dueDate
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async rejectCreditRequest(orderId: string, comments?: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('sales_orders')
      .update({
        credit_approval_status: 'REJECTED',
        admin_comments: comments || 'Solicitud de crédito rechazada'
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAllDebts() {
    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (name, email, phone),
        customer_branches (name, street, municipality, state, route_id),
        sales_order_payments (*)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getMyDebts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!customer) return [];

    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customer_branches (name, street, municipality, state),
        sales_order_payments (*)
      `)
      .eq('customer_id', customer.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRouteDebts(routeId: string) {
    const { data: branches } = await supabase
      .from('customer_branches')
      .select('id')
      .eq('route_id', routeId);

    if (!branches || branches.length === 0) return [];

    const branchIds = branches.map(b => b.id);

    const { data, error } = await supabase
      .from('sales_orders')
      .select(`
        *,
        customers (name, email, phone),
        customer_branches (name, street, municipality, state),
        sales_order_payments (*)
      `)
      .in('branch_id', branchIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  async getRoutePayments(routeId: string, weekStartDate: string, weekEndDate: string, agentAuthUserId: string) {
    const { data: branches } = await supabase
      .from('customer_branches')
      .select('id')
      .eq('route_id', routeId);

    const branchIds = branches?.map(b => b.id) || [];
    if (!branchIds.length) return [];

    // Query a slightly wider UTC window, then apply the route's Mexico City
    // calendar dates precisely. Supabase stores created_at in UTC.
    const startIso = `${weekStartDate}T00:00:00Z`;
    const endExclusive = new Date(`${weekEndDate}T00:00:00Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 2);

    const { data, error } = await supabase
      .from('sales_order_payments')
      .select(`
        *,
        sales_orders!inner (
          id,
          customer_id,
          branch_id,
          total_amount,
          amount_paid,
          customers ( name ),
          customer_branches ( name, route_id )
        )
      `)
      .gte('created_at', startIso)
      .lt('created_at', endExclusive.toISOString())
      .eq('created_by', agentAuthUserId)
      .eq('is_manual_settlement', false)
      .eq('status', 'APPROVED')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching route payments:', error);
      return [];
    }

    if (!data) return [];

    return data.filter((p: any) =>
      p.sales_orders &&
      branchIds.includes(p.sales_orders.branch_id) &&
      getRoutePaymentDay(p.created_at) >= weekStartDate &&
      getRoutePaymentDay(p.created_at) <= weekEndDate
    );
  }
};
