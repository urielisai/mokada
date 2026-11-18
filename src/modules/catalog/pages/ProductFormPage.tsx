import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useProductFull, useSaveProductFull, useUploadProductImage } from '../hooks/useCatalog';
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
  const [searchParams] = useSearchParams();
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
  const { data: units } = useUnits();
  const { data: priceLists } = usePriceLists();
  const { data: warehouses } = useWarehouses();

  // Load product if editing
  const { data: fullProduct, isLoading: isLoadingProduct } = useProductFull(isEditing ? id! : null);
  const { mutateAsync: saveProduct, isPending: isSaving } = useSaveProductFull();
  const { mutateAsync: uploadImage } = useUploadProductImage();

  const methods = useForm<{
    id: string | null;
    sale_product_id: string | null;
    purchase_product_id: string | null;
    sale_code: string;
    purchase_code: string;
    barcode: string;
    name: string;
    description: string;
    brand_id: string;
    category_id: string;
    unit_of_measure_id: string;
    status: string;
    item_type: 'SALE' | 'PURCHASE';
    sale_links: { sale_product_id: string; code: string; name: string; is_default: boolean }[];
    prices: { price_list_id: string; amount: number | null }[];
    inventory: { warehouse_id: string; minimum_stock: number; maximum_stock: number | null }[];
    fitments: { vehicle_model_id: string; year_from: number | null; year_to: number | null; engine: string; notes: string }[];
  }>({
    defaultValues: {
      id: null,
      sale_product_id: null,
      purchase_product_id: null,
      sale_code: '',
      purchase_code: '',
      barcode: '',
      name: '',
      description: '',
      brand_id: '',
      category_id: '',
      unit_of_measure_id: '',
      status: 'ACTIVE',
      item_type: searchParams.get('type') === 'PURCHASE' ? 'PURCHASE' : 'SALE',
      sale_links: [],
      prices: [],
      inventory: [],
      fitments: []
    }
  });

  // Effect to populate form when data loads
  const initializedNewFormRef = useRef(false);

  useEffect(() => {
    if (fullProduct) {
      const p: any = fullProduct.product;
      const resolvedPurchaseId = fullProduct.purchaseProductId || (p.item_type === 'PURCHASE' ? p.id : null);
      const resolvedSaleId = fullProduct.saleProductId || (p.item_type !== 'PURCHASE' ? p.id : null);

      const mergedInventory = warehouses
        ? warehouses.map((wh: any) => {
            const existingInv = (fullProduct.inventory || []).find((inv: any) => inv.warehouse_id === wh.id);
            return {
              warehouse_id: wh.id,
              minimum_stock: existingInv?.minimum_stock ?? 0,
              maximum_stock: existingInv?.maximum_stock ?? null,
            };
          })
        : (fullProduct.inventory as any) || [];

      methods.reset({
        id: p.id,
        sale_product_id: resolvedSaleId,
        purchase_product_id: resolvedPurchaseId,
        sale_code: fullProduct.saleCode || '',
        purchase_code: fullProduct.purchaseCode || '',
        barcode: p.barcode || '',
        name: p.name || '',
        description: p.description || '',
        brand_id: p.brand_id || '',
        category_id: p.category_id || '',
        unit_of_measure_id: p.unit_of_measure_id || '',
        status: p.status || 'ACTIVE',
        item_type: p.item_type === 'PURCHASE' ? 'PURCHASE' : 'SALE',
        sale_links: (fullProduct.links || [])
          .filter((l: any) => resolvedPurchaseId && l.purchase_product_id === resolvedPurchaseId)
          .map((l: any) => ({
            sale_product_id: l.sale_product_id,
            code: l.sale?.code || '',
            name: l.sale?.name || '',
            is_default: l.is_default,
          })),
        prices: priceLists
          ? priceLists
              .filter(pl => pl.is_active || fullProduct.prices.some((price: any) => price.price_list_id === pl.id))
              .map(pl => ({
                price_list_id: pl.id,
                amount: fullProduct.prices.find((price: any) => price.price_list_id === pl.id)?.amount ?? null
              }))
          : (fullProduct.prices as any) || [],
        inventory: mergedInventory,
        fitments: (fullProduct.fitments as any) || []
      });
      if (p.image_url) {
        import('../services/catalog.service').then(m => {
          setCurrentImageUrl(m.catalogService.getProductImageUrl(p.image_url));
        });
      }
    } else if (!isEditing && priceLists && warehouses && !initializedNewFormRef.current) {
      initializedNewFormRef.current = true;
      const currentValues = methods.getValues();
      methods.reset({
        ...currentValues,
        prices:
          currentValues.prices?.length > 0
            ? currentValues.prices
            : priceLists.filter(pl => pl.is_active).map(pl => ({ price_list_id: pl.id, amount: null })),
        inventory:
          currentValues.inventory?.length > 0
            ? currentValues.inventory
            : warehouses.map((wh: any) => ({ warehouse_id: wh.id, minimum_stock: 0, maximum_stock: null })),
        fitments: currentValues.fitments?.length > 0 ? currentValues.fitments : []
      });
    }
  }, [fullProduct, priceLists, warehouses, isEditing]);

  // Soporte para Escáner de Código de Barras
  useBarcodeScanner({
    onScan: (barcode) => {
      methods.setValue('barcode', barcode, { shouldValidate: true, shouldDirty: true });
      setActiveTab('general');
    }
  });

  const itemType = methods.watch('item_type');
  const saleCodeValue = (methods.watch('sale_code') || '').trim();
  const purchaseCodeValue = (methods.watch('purchase_code') || '').trim();

  const normalizeFitmentYear = (rawYear: any): number | null => {
    if (rawYear === '' || rawYear == null) return null;
    const parsed = Number(rawYear);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    const yearInt = Math.trunc(parsed);
    // Support 2-digit years (e.g., 11 -> 2011, 16 -> 2016, 98 -> 1998)
    if (yearInt >= 0 && yearInt <= 49) return 2000 + yearInt;
    if (yearInt >= 50 && yearInt <= 99) return 1900 + yearInt;
    return yearInt;
  };

  const onInvalid = (formErrors: any) => {
    if (formErrors?.sale_code || formErrors?.purchase_code || formErrors?.name) {
      setActiveTab('general');
      toast.error(
        formErrors?.sale_code?.message?.toString() ||
          formErrors?.name?.message?.toString() ||
          'Completa los campos obligatorios en la pestaña General.'
      );
      return;
    }
    if (formErrors?.prices) {
      setActiveTab('prices');
      toast.error('Revisa los precios capturados en la pestaña Precios.');
      return;
    }
    toast.error('Revisa los campos del formulario antes de guardar.');
  };

  const onSubmit = async (data: any) => {
    try {
      setIsUploading(true);
      const rawInventory =
        Array.isArray(data.inventory) && data.inventory.length > 0
          ? data.inventory
          : (warehouses || []).map((wh: any) => ({ warehouse_id: wh.id, minimum_stock: 0, maximum_stock: null }));

      const cleanData = {
        ...data,
        sale_code: (data.sale_code || '').trim(),
        purchase_code: (data.purchase_code || '').trim(),
        barcode: (data.barcode || '').trim(),
        name: (data.name || '').trim(),
        existing_links_count: fullProduct?.links?.length || 0,
        sale_links: (data.sale_links || [])
          .filter((l: any) => Boolean(l?.sale_product_id))
          .map((l: any) => ({ sale_product_id: l.sale_product_id, is_default: Boolean(l.is_default) })),
        prices: (data.prices || [])
          .filter((price: {price_list_id: string}) =>
            Boolean(price?.price_list_id) &&
            (priceLists?.find(pl => pl.id === price.price_list_id) as {pricing_mode?: string} | undefined)?.pricing_mode !== 'PUBLIC_DISCOUNT')
          .map((price: {price_list_id: string; amount: any}) => {
            const parsedAmount = Number(price.amount);
            return {
              price_list_id: price.price_list_id,
              amount: (price.amount === '' || price.amount == null || Number.isNaN(parsedAmount)) ? null : parsedAmount
            };
          }),
        inventory: rawInventory
          .filter((inv: any) => Boolean(inv?.warehouse_id))
          .map((inv: any) => ({
            warehouse_id: inv.warehouse_id,
            minimum_stock: (inv.minimum_stock === '' || inv.minimum_stock == null || Number.isNaN(Number(inv.minimum_stock))) ? 0 : Number(inv.minimum_stock),
            maximum_stock: (inv.maximum_stock === '' || inv.maximum_stock == null || Number.isNaN(Number(inv.maximum_stock))) ? null : Number(inv.maximum_stock)
          })),
        fitments: (data.fitments || [])
          .filter((f: any) => Boolean(f?.vehicle_model_id))
          .map((f: any) => {
            const yFrom = normalizeFitmentYear(f.year_from);
            const yTo = normalizeFitmentYear(f.year_to);
            const [year_from, year_to] =
              yFrom != null && yTo != null && yFrom > yTo ? [yTo, yFrom] : [yFrom, yTo];
            return {
              ...f,
              year_from,
              year_to,
            };
          })
      };

      const productId = await saveProduct(cleanData);

      if (imageFile && productId) {
        const imagePath = await uploadImage({ productId, file: imageFile });
        await saveProduct({ ...cleanData, id: productId, image_url: imagePath });
      }

      toast.success('Producto guardado correctamente');
      if (!isEditing && productId) {
        navigate(`/catalog/products/${productId}`, { replace: true });
      }
    } catch (error) {
      console.error('Error saving product', error);
      const errMsg = (error as { message?: string })?.message || 'Hubo un error al guardar el producto';
      toast.error(errMsg);
    } finally {
      setIsUploading(false);
    }
  };

  if (isEditing && isLoadingProduct) {
    return (
      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-theme(spacing.16))] -m-4 md:-m-6 lg:-m-8">
        {/* Left Column Skeleton */}
        <div className="w-full lg:w-[45%] bg-canvas flex flex-col p-6 md:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-200/60 lg:sticky lg:top-0 lg:h-[calc(100vh-theme(spacing.16))]">
          <div className="mb-8 h-4 w-32 bg-gray-200 rounded skeleton" />
          <div className="flex-1 flex items-center justify-center relative">
            <div className="w-full max-w-[420px] aspect-square bg-gray-200 rounded-2xl skeleton" />
          </div>
        </div>
        {/* Right Column Skeleton */}
        <div className="flex-1 flex flex-col bg-white">
          <div className="flex-1 p-6 md:p-8 lg:p-12 overflow-y-auto">
            <div className="mb-8">
              <div className="h-8 w-64 bg-gray-200 rounded skeleton mb-3" />
              <div className="h-4 w-96 bg-gray-200 rounded skeleton" />
            </div>
            <div className="flex space-x-2 mb-8">
              <div className="h-10 flex-1 bg-gray-200 rounded-lg skeleton max-w-2xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-x-8 md:gap-y-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className={i === 2 || i === 5 ? "md:col-span-2" : ""}>
                  <div className="h-4 w-24 bg-gray-200 rounded skeleton mb-2" />
                  <div className={`w-full bg-gray-200 rounded-lg skeleton ${i === 5 ? "h-24" : "h-10"}`} />
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
  ];

  const backUrl =
    !saleCodeValue && purchaseCodeValue
      ? '/catalog/products?type=PURCHASE'
      : searchParams.get('type') === 'PURCHASE' && itemType === 'PURCHASE' && !saleCodeValue
      ? '/catalog/products?type=PURCHASE'
      : '/catalog/products';

  return (
    <FormProvider {...methods}>
      <form onSubmit={methods.handleSubmit(onSubmit, onInvalid)} className="flex flex-col lg:flex-row min-h-[calc(100vh-theme(spacing.16))] -m-4 md:-m-6 lg:-m-8">
        
        {/* Left Column (Image Hero) */}
        <div className="w-full lg:w-[45%] bg-canvas flex flex-col p-6 md:p-8 lg:p-12 border-b lg:border-b-0 lg:border-r border-gray-200/60 lg:sticky lg:top-0 lg:h-[calc(100vh-theme(spacing.16))] overflow-hidden">
          <div className="mb-8">
            <button 
              type="button" 
              onClick={() => navigate(backUrl)}
              className="flex items-center gap-2 text-[14px] font-medium text-muted hover:text-ink transition-colors"
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
              <h2 className="text-[32px] font-bold tracking-tight text-ink leading-tight mb-2">
                {isEditing ? 'Editar Producto' : 'Nuevo Producto'}
              </h2>
              <p className="text-[15px] text-muted">
                {isEditing
                  ? 'Modifica la clave de venta, el código de compra, precios e inventario en un solo lugar.'
                  : 'Indica la clave de venta y el código de compra del producto para registrarlo y vincularlo en un solo paso.'}
              </p>
            </div>

            {/* Tab Navigation */}
            <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl max-w-2xl mb-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex-1 py-2 text-[13px] font-semibold rounded-lg transition ${
                    activeTab === tab.id
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="pb-8">
              <div className={activeTab === 'general' ? 'block' : 'hidden'}>
                <ProductGeneralTab 
                  units={units || []} 
                  initialBrand={fullProduct?.product?.brand ? { value: fullProduct.product.brand_id, label: fullProduct.product.brand.name } : undefined}
                  initialCategory={fullProduct?.product?.category ? { value: fullProduct.product.category_id, label: fullProduct.product.category.name } : undefined}
                />
              </div>
              <div className={activeTab === 'prices' ? 'block' : 'hidden'}>
                <ProductPricesTab priceLists={priceLists || []} costs={(fullProduct?.costs as any) || []} />
              </div>
              <div className={activeTab === 'inventory' ? 'block' : 'hidden'}>
                <ProductInventoryTab warehouses={warehouses || []} />
              </div>
              <div className={activeTab === 'fitments' ? 'block' : 'hidden'}>
                <ProductFitmentsTab />
              </div>
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="sticky bottom-0 border-t border-gray-200/60 bg-white/80 backdrop-blur-md p-4 md:p-6 lg:px-12 flex justify-end items-center shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.05)] z-10">
            <button 
              type="submit" 
              disabled={isSaving || isUploading}
              className="flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-8 py-3 rounded-xl text-[15px] font-semibold transition-colors shadow-sm disabled:opacity-50 min-w-[200px]"
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
