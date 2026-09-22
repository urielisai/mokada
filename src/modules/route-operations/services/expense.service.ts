import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';
import type { Database } from '../../../types/database.types';

type ExpenseAttachmentType = Database['public']['Enums']['expense_attachment_type'];
type TravelExpenseStatus = Database['public']['Enums']['travel_expense_status_type'];

export const expenseService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  async getTripExpenses(tripId: string) {
    const { data, error } = await supabase
      .from('travel_expenses')
      .select('*, expense_categories(code, name), expense_attachments(id, storage_path, file_name, mime_type, attachment_type)')
      .eq('route_trip_id', tripId)
      .order('expense_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  async saveExpense(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = supabase.from('travel_expenses').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      request = supabase.from('travel_expenses').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async updateExpenseStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('travel_expenses')
      .update({ status: status as TravelExpenseStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase.from('travel_expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async uploadAttachment(expense: { id: string; route_trip_id: string }, file: File, attachmentType: string, uploadedBy: string) {
    const path = await storageService.uploadFile({
      bucket: 'expense-evidence',
      file,
      ownerId: `${expense.route_trip_id}/${expense.id}`,
      folder: attachmentType.toLowerCase(),
    });

    const { data, error } = await supabase
      .from('expense_attachments')
      .insert([{
        expense_id: expense.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
        attachment_type: attachmentType as ExpenseAttachmentType,
        uploaded_by: uploadedBy,
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getAttachmentUrl(path: string) {
    return storageService.createSignedUrl('expense-evidence', path, 600);
  },

  // Financial summary
  async getFinancialSummary(filters?: any) {
    let query = supabase.from('route_trip_financial_summary').select('*');

    if (filters?.statuses && Array.isArray(filters.statuses)) {
      query = query.in('route_trip_status', filters.statuses);
    } else if (filters?.status) {
      query = query.eq('route_trip_status', filters.status);
    }

    const { data, error } = await query.order('week_start_date', { ascending: false });
    if (error) throw error;
    return data;
  },

  // Settlements
  async getSettlements() {
    const { data, error } = await supabase
      .from('route_trip_settlements')
      .select('*, route_trips(routes(code, name), agent:user_profiles!route_trips_agent_id_fkey(first_name, last_name), week_start_date, week_end_date)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },

  async createSettlement(payload: any) {
    const { data, error } = await supabase
      .from('route_trip_settlements')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;

    // Mark the route trip as SETTLED
    await supabase.from('route_trips').update({ status: 'SETTLED', updated_at: new Date().toISOString() }).eq('id', payload.route_trip_id);
    
    return data;
  },

  async updateSettlementStatus(id: string, status: string, userId: string) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'APPROVED') {
      updates.reviewed_by = userId;
      updates.reviewed_at = new Date().toISOString();
    }
    if (status === 'SETTLED') {
      updates.settled_by = userId;
      updates.settled_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('route_trip_settlements')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Dashboard stats
  async getDashboardStats() {
    const today = new Date().toISOString().split('T')[0];

    // Active trips this week
    const { data: activeTrips } = await supabase
      .from('route_trips')
      .select('id, status, budget_amount')
      .lte('week_start_date', today)
      .gte('week_end_date', today)
      .not('status', 'in', '("CANCELLED","SETTLED")');

    // Pending review
    const { count: pendingReview } = await supabase
      .from('route_trips')
      .select('*', { count: 'exact', head: true })
      .in('status', ['COMPLETED', 'UNDER_REVIEW']);

    // Pending settlements
    const { count: pendingSettlements } = await supabase
      .from('route_trip_settlements')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    // Financial summary for active week
    const { data: financialData } = await supabase
      .from('route_trip_financial_summary')
      .select('*')
      .lte('week_start_date', today)
      .gte('week_end_date', today);

    const totalBudget = financialData?.reduce((sum, r) => sum + Number(r.budget_amount || 0), 0) || 0;
    const totalExpenses = financialData?.reduce((sum, r) => sum + Number(r.total_expenses || 0), 0) || 0;
    const pendingExpenses = financialData?.reduce((sum, r) => sum + Number(r.pending_expenses || 0), 0) || 0;

    return {
      activeTrips: activeTrips?.length || 0,
      agentsOnRoute: activeTrips?.filter(t => t.status === 'IN_PROGRESS').length || 0,
      pendingReview: pendingReview || 0,
      pendingSettlements: pendingSettlements || 0,
      totalBudget,
      totalExpenses,
      pendingExpenses,
    };
  },
};
