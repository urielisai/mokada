import { useForm } from 'react-hook-form';
import { Modal } from '../../../components/ui/Modal';
import { useSaveAttribute } from '../hooks/useConfig';
import { useEffect } from 'react';
import toast from 'react-hot-toast';

interface AttributeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  attribute?: any;
}

export const AttributeFormModal = ({ isOpen, onClose, attribute }: AttributeFormModalProps) => {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    defaultValues: {
      code: '',
      name: '',
      data_type: 'TEXT',
      unit: '',
      description: '',
      is_active: true
    }
  });

  const { mutateAsync: saveAttribute, isPending } = useSaveAttribute();

  useEffect(() => {
    if (isOpen) {
      if (attribute) {
        reset({
          code: attribute.code,
          name: attribute.name,
          data_type: attribute.data_type,
          unit: attribute.unit || '',
          description: attribute.description || '',
          is_active: attribute.is_active
        });
      } else {
        reset({
          code: '',
          name: '',
          data_type: 'TEXT',
          unit: '',
          description: '',
          is_active: true
        });
      }
    }
  }, [isOpen, attribute, reset]);

  const onSubmit = async (data: any) => {
    try {
      await saveAttribute({
        id: attribute?.id,
        ...data,
        unit: data.unit || null,
        description: data.description || null
      });
      toast.success(attribute ? 'Atributo actualizado' : 'Atributo creado exitosamente');
      onClose();
    } catch (error: any) {
      console.error('Error saving attribute:', error);
      toast.error(error.message || 'Error al guardar el atributo');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={attribute ? 'Editar Atributo' : 'Nuevo Atributo'}
      size="md"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Código *</label>
            <input
              type="text"
              {...register('code', { required: 'El código es obligatorio' })}
              placeholder="Ej: COLOR, VOLTAJE"
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition uppercase"
              disabled={isPending}
            />
            {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message?.toString()}</p>}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Nombre *</label>
            <input
              type="text"
              {...register('name', { required: 'El nombre es obligatorio' })}
              placeholder="Ej: Color, Voltaje"
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
              disabled={isPending}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message?.toString()}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Tipo de Dato *</label>
            <select
              {...register('data_type')}
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
              disabled={isPending}
            >
              <option value="TEXT">Texto (Text)</option>
              <option value="NUMBER">Número (Number)</option>
              <option value="BOOLEAN">Si/No (Boolean)</option>
            </select>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Unidad (Opcional)</label>
            <input
              type="text"
              {...register('unit')}
              placeholder="Ej: V, W, cm"
              className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition"
              disabled={isPending}
            />
          </div>
        </div>

        <div>
          <label className="block text-[13px] font-medium text-ink mb-1.5">Descripción (Opcional)</label>
          <textarea
            {...register('description')}
            rows={2}
            className="w-full px-3 py-2 bg-gray-50 border border-transparent rounded-lg focus:bg-white focus:border-accent focus:ring-4 focus:ring-accent/15 text-[14px] transition resize-none"
            disabled={isPending}
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_active"
            {...register('is_active')}
            className="w-4 h-4 text-accent border-gray-300 rounded focus:ring-accent"
            disabled={isPending}
          />
          <label htmlFor="is_active" className="text-[13px] font-medium text-ink">
            Atributo activo
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-[14px] font-medium text-ink bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            disabled={isPending}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-[14px] font-medium text-white bg-accent rounded-lg hover:bg-accent-hover disabled:opacity-50"
            disabled={isPending}
          >
            {isPending ? 'Guardando...' : 'Guardar Atributo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
