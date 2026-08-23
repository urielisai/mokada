import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';
import type { Database } from '../../../types/database.types';

type ExpenseAttachmentType = Database['public']['Enums']['expense_attachment_type'];
type TravelExpenseStatus = Database['public']['Enums']['travel_expense_status_type'];

export const vehicleExpenseService = {
  async getCategories() {
    const { data, error } = await supabase
      .from('expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data;
  },

  async getExpenses(filters?: { vehicleId?: string; status?: string; agentId?: string }) {
    let query = supabase
      .from('vehicle_expenses')
      .select('*, expense_categories(code, name), vehicle_expense_attachments(id, storage_path, file_name, mime_type, attachment_type), fleet_vehicles(internal_code, plate_number), user_profiles!vehicle_expenses_agent_id_fkey(first_name, last_name)')
      .order('expense_date', { ascending: false });

    if (filters?.vehicleId) {
      query = query.eq('vehicle_id', filters.vehicleId);
    }
    if (filters?.status && filters.status !== 'ALL') {
      query = query.eq('status', filters.status);
    }
    if (filters?.agentId) {
      query = query.eq('agent_id', filters.agentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getExpenseById(id: string) {
    const { data, error } = await supabase
      .from('vehicle_expenses')
      .select('*, expense_categories(code, name), vehicle_expense_attachments(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async saveExpense(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = supabase.from('vehicle_expenses').update({ ...dataToSave, updated_at: new Date().toISOString() }).eq('id', id);
    } else {
      request = supabase.from('vehicle_expenses').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async updateExpenseStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from('vehicle_expenses')
      .update({ status: status as TravelExpenseStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteExpense(id: string) {
    const { error } = await supabase.from('vehicle_expenses').delete().eq('id', id);
    if (error) throw error;
  },

  async uploadAttachment(expense: { id: string; vehicle_id: string }, file: File, attachmentType: string, uploadedBy: string) {
    const path = await storageService.uploadFile({
      bucket: 'expense-evidence',
      path: `vehicles/${expense.vehicle_id}/${expense.id}`,
      file,
    });

    const { data, error } = await supabase
      .from('vehicle_expense_attachments')
      .insert({
        expense_id: expense.id,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        attachment_type: attachmentType as ExpenseAttachmentType,
        uploaded_by: uploadedBy,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAttachment(attachmentId: string, storagePath: string) {
    await storageService.deleteFile('expense-evidence', storagePath);
    const { error } = await supabase.from('vehicle_expense_attachments').delete().eq('id', attachmentId);
    if (error) throw error;
  },

  async getAttachmentUrl(storagePath: string) {
    return storageService.getSignedUrl('expense-evidence', storagePath);
  },
};
