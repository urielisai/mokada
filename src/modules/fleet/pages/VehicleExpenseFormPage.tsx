import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Car, Receipt, Calendar, DollarSign, PenTool, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { vehicleExpenseService } from '../services/vehicle-expense.service';
import { fleetService } from '../services/fleet.service';
import { useAuth } from '../../auth/context/useAuth';

export const VehicleExpenseFormPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      vehicle_id: '',
      expense_category_id: '',
      amount: '',
      expense_date: new Date().toISOString().split('T')[0],
      description: '',
      merchant_name: '',
    }
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['fleet-vehicles'],
    queryFn: fleetService.getVehicles,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: vehicleExpenseService.getCategories,
  });

  const saveMutation = useMutation({
    mutationFn: vehicleExpenseService.saveExpense,
    onSuccess: async (data) => {
      if (files.length > 0 && user) {
        // Upload attachments sequentially
        for (const file of files) {
          const type = file.type.startsWith('image/') ? 'PHOTO' : 'RECEIPT';
          await vehicleExpenseService.uploadAttachment(data, file, type, user.id);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['vehicle-expenses'] });
      navigate('/fleet/expenses');
    },
    onSettled: () => setIsSubmitting(false)
  });

  const onSubmit = (data: any) => {
    setIsSubmitting(true);
    saveMutation.mutate({
      ...data,
      amount: Number(data.amount),
      agent_id: user?.id,
      status: 'SUBMITTED'
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/fleet/expenses')}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-gray-500 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Registrar Gasto de Vehículo</h2>
            <p className="text-sm text-gray-500">Mantenimiento, combustible, reparaciones, etc.</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Car className="h-4 w-4 text-gray-400" /> Vehículo
            </label>
            <select
              {...register('vehicle_id', { required: 'El vehículo es requerido' })}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 outline-none transition-colors focus:ring-2 focus:ring-[#0066CC]/20 ${errors.vehicle_id ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0066CC]'}`}
            >
              <option value="">Selecciona un vehículo...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.internal_code} - {v.plate_number}</option>
              ))}
            </select>
            {errors.vehicle_id && <p className="text-xs text-red-500">{errors.vehicle_id.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Receipt className="h-4 w-4 text-gray-400" /> Categoría
            </label>
            <select
              {...register('expense_category_id', { required: 'La categoría es requerida' })}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 outline-none transition-colors focus:ring-2 focus:ring-[#0066CC]/20 ${errors.expense_category_id ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0066CC]'}`}
            >
              <option value="">Selecciona una categoría...</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {errors.expense_category_id && <p className="text-xs text-red-500">{errors.expense_category_id.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" /> Monto (MXN)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('amount', { required: 'El monto es requerido', min: { value: 0.1, message: 'El monto debe ser mayor a 0' } })}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 outline-none transition-colors focus:ring-2 focus:ring-[#0066CC]/20 ${errors.amount ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0066CC]'}`}
            />
            {errors.amount && <p className="text-xs text-red-500">{errors.amount.message as string}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" /> Fecha del gasto
            </label>
            <input
              type="date"
              {...register('expense_date', { required: 'La fecha es requerida' })}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 outline-none transition-colors focus:ring-2 focus:ring-[#0066CC]/20 ${errors.expense_date ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0066CC]'}`}
            />
            {errors.expense_date && <p className="text-xs text-red-500">{errors.expense_date.message as string}</p>}
          </div>
          
          <div className="sm:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <PenTool className="h-4 w-4 text-gray-400" /> Taller o Proveedor (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Taller Mecánico Los Hermanos"
              {...register('merchant_name')}
              className={`w-full rounded-lg border bg-white px-4 py-2.5 outline-none transition-colors focus:ring-2 focus:ring-[#0066CC]/20 ${errors.merchant_name ? 'border-red-500 focus:border-red-500' : 'border-gray-300 focus:border-[#0066CC]'}`}
            />
            {errors.merchant_name && <p className="text-xs text-red-500">{errors.merchant_name.message as string}</p>}
          </div>

          <div className="sm:col-span-2 space-y-2">
            <label className="text-sm font-medium text-gray-700">Descripción detallada</label>
            <textarea
              {...register('description')}
              rows={3}
              placeholder="Describe el trabajo realizado o las piezas compradas..."
              className="w-full rounded-lg border border-gray-300 bg-white p-4 outline-none transition-colors focus:border-[#0066CC] focus:ring-2 focus:ring-[#0066CC]/20 resize-none"
            />
          </div>
        </div>

        {/* Evidence Upload */}
        <div className="space-y-3 pt-4 border-t border-gray-100">
          <label className="text-sm font-medium text-gray-700">Evidencias y Comprobantes</label>
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center transition-colors hover:border-[#0066CC]/50 hover:bg-[#0066CC]/5">
            <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <div className="text-sm text-gray-600">
              <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-[#0066CC] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#0066CC] focus-within:ring-offset-2 hover:text-[#0057AD]">
                <span>Sube archivos</span>
                <input id="file-upload" type="file" multiple className="sr-only" onChange={handleFileChange} accept="image/*,.pdf" />
              </label>
              <p className="pl-1">o arrastra y suelta aquí</p>
            </div>
            <p className="text-xs text-gray-500 mt-1">PNG, JPG, PDF hasta 10MB</p>
          </div>
          
          {files.length > 0 && (
            <ul className="mt-4 space-y-2">
              {files.map((file, idx) => (
                <li key={idx} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="rounded-full bg-blue-50 p-2 text-blue-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <XCircle className="h-5 w-5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/fleet/expenses')}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-[#0066CC] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0057AD] disabled:opacity-70"
          >
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Guardar Gasto
          </button>
        </div>
      </form>
    </div>
  );
};
