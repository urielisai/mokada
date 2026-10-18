import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveCategory, useCategories } from '../hooks/useCatalog';
import { useEffect } from 'react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  category?: any;
}

export const CategoryFormModal = ({ isOpen, onClose, category }: Props) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const { mutateAsync: saveCategory, isPending } = useSaveCategory();
  const { data: categories } = useCategories();

  // Remove the current category and its children from the potential parents list to prevent cycles
  const availableParents = categories?.filter((c: any) => c.id !== category?.id) || [];

  useEffect(() => {
    if (isOpen) {
      if (category) {
        reset({
          id: category.id,
          code: category.code || '',
          name: category.name || '',
          description: category.description || '',
          parent_id: category.parent_id || '',
          is_active: category.is_active
        });
      } else {
        reset({
          id: null,
          code: '',
          name: '',
          description: '',
          parent_id: '',
          is_active: true
        });
      }
    }
  }, [isOpen, category, reset]);

  const onSubmit = async (data: any) => {
    try {
      const payload = {
        ...data,
        parent_id: data.parent_id || null // Ensure empty string is sent as null
      };
      await saveCategory(payload);
      onClose();
    } catch (error) {
      console.error('Error guardando categoría:', error);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={category ? 'Editar Categoría' : 'Nueva Categoría'}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Código</label>
          <input
            type="text"
            {...register('code')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre *</label>
          <input
            type="text"
            {...register('name', { required: 'El nombre es obligatorio' })}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px]"
            placeholder="Ej: Suspensión"
          />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Categoría Padre</label>
          <select
            {...register('parent_id')}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] text-ink"
          >
            <option value="">Ninguna (Categoría Principal)</option>
            {availableParents.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Descripción</label>
          <textarea
            {...register('description')}
            rows={3}
            className="w-full px-3 py-2 bg-white border border-gray-200/60 rounded-lg focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] resize-y"
            placeholder="Opcional"
          />
        </div>

        <div className="flex items-center gap-2 mt-4">
          <input
            type="checkbox"
            id="is_active_cat"
            {...register('is_active')}
            className="rounded border-gray-300 text-accent focus:ring-accent"
          />
          <label htmlFor="is_active_cat" className="text-[14px] text-ink">
            Categoría Activa
          </label>
        </div>

        <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-2 text-[14px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50"
          >
            {isPending ? 'Guardando...' : 'Guardar Categoría'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
