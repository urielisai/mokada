import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProductFull, useSaveProductFull, useBrands, useCategories, useUploadProductImage } from '../hooks/useCatalog';
import { useUnits, usePriceLists } from '../../configuration/hooks/useConfig';
import { useWarehouses } from '../../inventory/hooks/useInventory';
import { ProductGeneralTab } from '../components/ProductGeneralTab';
import { ProductPricesTab } from '../components/ProductPricesTab';
import { ProductInventoryTab } from '../components/ProductInventoryTab';
import { ProductFitmentsTab } from '../components/ProductFitmentsTab';
import { useBarcodeScanner } from '../../../utils/useBarcodeScanner';
import { ImageUpload } from '../../../components/ui/ImageUpload';
import { useAuth } from '../../auth/context/useAuth';

export const ProductFormPage = () => {
  const { isAdmin } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const [activeTab, setActiveTab] = useState<'general' | 'prices' | 'inventory' | 'fitments'>('general');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isAdmin) {
      navigate('/catalog/products');
    }
  }, [isAdmin, navigate]);

  // Loaders for lookups
  const { data: brands } = useBrands();
  const { data: categories } = useCategories();
  const { data: units } = useUnits();
  const { data: priceLists } = usePriceLists();
  const { data: warehouses } = useWarehouses();

  // Load product if editing
  const { data: fullProduct, isLoading: isLoadingProduct } = useProductFull(isEditing ? id! : null);
  const { mutateAsync: saveProduct, isPending: isSaving } = useSaveProductFull();
  const { mutateAsync: uploadImage } = useUploadProductImage();

  const methods = useForm<{
    id: string | null;
    code: string;
    barcode: string;
    name: string;
    description: string;
    brand_id: string;
    category_id: string;
    unit_of_measure_id: string;
    status: string;
    prices: { price_list_id: string; amount: number | null }[];
    inventory: { warehouse_id: string; minimum_stock: number; maximum_stock: number | null }[];
    fitments: { vehicle_model_id: string; year_from: number | null; year_to: number | null; engine: string; notes: string }[];
  }>({
    defaultValues: {
      id: null,
      code: '',
      barcode: '',
      name: '',
      description: '',
      brand_id: '',
      category_id: '',
      unit_of_measure_id: '',
      status: 'ACTIVE',
      prices: [],
      inventory: [],
      fitments: []
    }
  });

  // Effect to populate form when data loads
  useEffect(() => {
    if (fullProduct) {
      const p: any = fullProduct.product;
      methods.reset({
        id: p.id,
        code: p.code || '',
        barcode: p.barcode || '',
        name: p.name || '',
        description: p.description || '',
        brand_id: p.brand_id || '',
        category_id: p.category_id || '',
        unit_of_measure_id: p.unit_of_measure_id || '',
        status: p.status || 'ACTIVE',
        prices: priceLists
          ? priceLists.filter(pl => pl.is_active || fullProduct.prices.some((price: any) => price.price_list_id === pl.id))
              .map(pl => ({
                price_list_id: pl.id,
                amount: fullProduct.prices.find((price: any) => price.price_list_id === pl.id)?.amount ?? null
              }))
          : (fullProduct.prices as any) || [],
        inventory: (fullProduct.inventory as any) || [],
        fitments: (fullProduct.fitments as any) || []
      });
      if (p.image_url) {
        import('../services/catalog.service').then(m => {
          setCurrentImageUrl(m.catalogService.getProductImageUrl(p.image_url));
        });
      }
    } else if (!isEditing && priceLists && warehouses) {
      // Initialize arrays for new products based on available lists
      methods.reset({
        ...methods.getValues(),
        prices: priceLists.filter(pl => pl.is_active).map(pl => ({ price_list_id: pl.id, amount: null })),
        inventory: warehouses.map((wh: any) => ({ warehouse_id: wh.id, minimum_stock: 0, maximum_stock: null })),
        fitments: []
      });
    }
  }, [fullProduct, priceLists, warehouses, isEditing]);

  // Soporte para Escáner de Código de Barras
  useBarcodeScanner({
    onScan: (barcode) => {
      methods.setValue('barcode', barcode, { shouldValidate: true, shouldDirty: true });
      setActiveTab('general'); // Cambiar a la pestaña general para que el usuario vea que se escaneó
    }
  });

  const onSubmit = async (data: any) => {
    try {
      setIsUploading(true);
      const cleanData = {
        ...data,
        prices: data.prices
          .filter((price: {price_list_id: string}) =>
            (priceLists?.find(pl => pl.id === price.price_list_id) as {pricing_mode?: string} | undefined)?.pricing_mode !== 'PUBLIC_DISCOUNT')
          .map((price: {price_list_id: string; amount: any}) => {
            const parsedAmount = Number(price.amount);
            return {
              price_list_id: price.price_list_id,
              amount: (price.amount === '' || price.amount == null || Number.isNaN(parsedAmount)) ? null : parsedAmount
            };
          }),
        inventory: data.inventory.map((inv: any) => ({
          warehouse_id: inv.warehouse_id,
          minimum_stock: (inv.minimum_stock === '' || inv.minimum_stock == null || Number.isNaN(Number(inv.minimum_stock))) ? 0 : Number(inv.minimum_stock),
          maximum_stock: (inv.maximum_stock === '' || inv.maximum_stock == null || Number.isNaN(Number(inv.maximum_stock))) ? null : Number(inv.maximum_stock)
        })),
        fitments: data.fitments.map((f: any) => ({
          ...f,
          year_from: (f.year_from === '' || Number.isNaN(Number(f.year_from))) ? null : (f.year_from || null),
          year_to: (f.year_to === '' || Number.isNaN(Number(f.year_to))) ? null : (f.year_to || null),
        }))
      };
      const productId = await saveProduct(cleanData);

      if (imageFile && productId) {
        const imagePath = await uploadImage({ productId, file: imageFile });
        // Optionally update the product with the new image_url
        await saveProduct({ ...cleanData, id: productId, image_url: imagePath });
      }

      toast.success('Producto guardado correctamente');
      if (!isEditing) {
        navigate(`/catalog/products/${productId}`, { replace: true });
      }
    } catch (error) {
      console.error('Error saving product', error);
      toast.error('Hubo un error al guardar el producto');
    } finally {
      setIsUploading(false);
    }
  };

  if (isEditing && isLoadingProduct) {
    return (
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-theme(spacing.16))] -m-4 md:-m-6 lg:-m-8">
        {/* Left Column Skeleton */}
        <div className="w-full lg:w-[45%] bg-[#f5f5f7] flex flex-col p-6 md:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-200/60 lg:sticky lg:top-0 lg:h-[calc(100vh-theme(spacing.16))]">
          <div className="mb-8 h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-full max-w-[420px] aspect-square bg-gray-200 rounded-2xl animate-pulse" />
          </div>
        </div>
        {/* Right Column Skeleton */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
            <div className="mb-8">
              <div className="h-8 w-64 bg-gray-200 rounded animate-pulse mb-3" />
              <div className="h-4 w-96 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="flex space-x-2 mb-8">
              <div className="h-10 flex-1 bg-gray-200 rounded-lg animate-pulse max-w-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8 md:gap-y-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={i === 2 || i === 5 ? "md:col-span-2" : ""}>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className={`w-full bg-gray-200 rounded-lg animate-pulse ${i === 5 ? "h-24" : "h-10"}`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'prices', label: 'Precios' },
    { id: 'inventory', label: 'Inventario' },
    { id: 'fitments', label: 'Compatibilidad' },
  ] as const;

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit)} className="flex flex-col lg:flex-row min-h-[calc(100vh-theme(spacing.16))] -m-4 md:-m-6 lg:-m-8">
        
        {/* Left Column (Image Hero) */}
        <div className="w-full lg:w-[45%] bg-[#f5f5f7] flex flex-col p-6 md:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-200/60 lg:sticky lg:top-0 lg:h-[calc(100vh-theme(spacing.16))] overflow-hidden">
          <div className="mb-8">
            <button 
              type="button" 
              onClick={() => navigate('/catalog/products')}
              className="flex items-center gap-2 text-[14px] font-medium text-[#86868B] hover:text-[#1D1D1F] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al catálogo
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-full max-w-[420px] aspect-square">
              <ImageUpload 
                value={imageFile || currentImageUrl} 
                onChange={setImageFile} 
                onClear={() => setImageFile(null)}
              />
            </div>
          </div>
        </div>

        {/* Right Column (Form & Details) */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
            <div className="mb-8">
              <h2 className="text-[32px] font-bold tracking-tight text-[#1D1D1F] leading-tight mb-2">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-[15px] text-[#86868B]">
                {isEditing ? 'Modifica los detalles, precios e inventario de este producto.' : 'Completa la información para registrar un nuevo elemento en el catálogo.'}
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl max-w-2xl mb-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-[#1D1D1F] shadow-sm'
                      : 'text-[#86868B] hover:text-[#1D1D1F]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="pb-8">
              {activeTab === 'general' && (
                <ProductGeneralTab 
                  brands={brands || []} 
                  categories={categories || []} 
                  units={units || []} 
                />
              )}
              {activeTab === 'prices' && (
                <ProductPricesTab priceLists={priceLists || []} />
              )}
              {activeTab === 'inventory' && (
                <ProductInventoryTab warehouses={warehouses || []} />
              )}
              {activeTab === 'fitments' && (
                <ProductFitmentsTab />
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="sticky bottom-0 border-t border-gray-200/60 bg-white/80 backdrop-blur-md p-4 md:p-6 lg:px-12 flex justify-end items-center shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.05)] z-10">
            <button 
              type="submit" 
              disabled={isSaving || isUploading}
              className="flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#005bb5] text-white px-8 py-3 rounded-xl text-[15px] font-semibold transition-colors shadow-sm disabled:opacity-50 min-w-[200px]"
            >
              <Save className="w-5 h-5" />
              {(isSaving || isUploading) ? 'Guardando...' : 'Guardar Producto'}
            </button>
          </div>
        </div>

      </form>
    </FormProvider>
  );
};
