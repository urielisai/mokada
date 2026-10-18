import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteProducts } from '../hooks/useCatalog';
import { catalogService } from '../services/catalog.service';
import { StatusBadge } from '../../../components/ui/StatusBadge';
import { Search, Plus, PackageSearch, ShoppingCart, Loader2 } from 'lucide-react';
import { useAuth } from '../../auth/context/useAuth';
import { useCartStore } from '../store/useCartStore';
import { CartDrawer } from '../components/CartDrawer';
import { useDebounce } from '../../../hooks/useDebounce';
import { useIntersectionObserver } from '../../../hooks/useIntersectionObserver';
import { AsyncSelect } from '../../../components/ui/AsyncSelect';

export const ProductsPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { addItem, getItemCount } = useCartStore();
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  // Agents and customers only ever get sale keys; admins can switch to purchase codes.
  const [itemType, setItemType] = useState<'SALE' | 'PURCHASE'>('SALE');
  const isPurchaseView = isAdmin && itemType === 'PURCHASE';
  const currency = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' });

  const { 

    data, 
    isLoading, 
    isError,
    isFetchNextPageError,
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteProducts({ 
    pageSize: 25, 
    search: debouncedSearch,
    brand: selectedBrand,
    category: selectedCategory,
    itemType: isAdmin ? itemType : 'SALE',
    withCosts: isAdmin
  });

  const products = data?.pages.flatMap((page) => page.data) || [];

  const [bottomRef, isIntersecting] = useIntersectionObserver({ threshold: 0.1, rootMargin: '200px' });

  useEffect(() => {
    if (isIntersecting && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      fetchNextPage();
    }
  }, [isIntersecting, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="shrink-0">
          <h2 className="text-[28px] font-bold tracking-tight text-ink">Productos</h2>
          <p className="text-[15px] text-muted mt-1">Catálogo de refacciones</p>
          {isAdmin && (
            <div className="mt-3 grid grid-cols-2 w-[19rem] max-w-full p-1 bg-gray-100/80 rounded-xl" role="tablist" aria-label="Tipo de catálogo">
              {([['SALE', 'Claves de venta'], ['PURCHASE', 'Códigos de compra']] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={itemType === value}
                  onClick={() => setItemType(value)}
                  className={`h-8 px-3 whitespace-nowrap text-center text-[13px] font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                    itemType === value ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder={isAdmin ? 'Buscar por clave, código o nombre...' : 'Buscar por clave o nombre...'}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-4 focus:ring-accent/15 focus:border-accent text-[14px] transition shadow-sm"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) {
                  setSelectedBrand('');
                  setSelectedCategory('');
                }
              }}
            />
          </div>
          
          <div className="w-[calc(50%-0.375rem)] min-w-0 sm:w-48">
            <AsyncSelect
              loadOptions={async (query) => {
                const data = await catalogService.searchBrands(query);
                return data.map(b => ({ value: b.name, label: b.name }));
              }}
              value={selectedBrand}
              defaultOption={selectedBrand ? { value: selectedBrand, label: selectedBrand } : undefined}
              onChange={(value) => {
                setSelectedBrand(value || '');
                if (value) setSearch('');
              }}
              onClear={() => setSelectedBrand('')}
              placeholder="Todas las marcas"
            />
          </div>

          <div className="w-[calc(50%-0.375rem)] min-w-0 sm:w-48">
            <AsyncSelect
              loadOptions={async (query) => {
                const data = await catalogService.searchCategories(query);
                return data.map(c => ({ value: c.name, label: c.name }));
              }}
              value={selectedCategory}
              defaultOption={selectedCategory ? { value: selectedCategory, label: selectedCategory } : undefined}
              onChange={(value) => {
                setSelectedCategory(value || '');
                if (value) setSearch('');
              }}
              onClear={() => setSelectedCategory('')}
              placeholder="Todas las categorías"
            />
          </div>

          {isAdmin && (
            <button 
              onClick={() => navigate(isPurchaseView ? '/catalog/products/new?type=PURCHASE' : '/catalog/products/new')}
              className="flex flex-1 sm:flex-none items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2 rounded-xl text-[14px] font-medium transition-colors whitespace-nowrap shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Nuevo producto
            </button>
          )}
            <button 
              type="button"
              aria-label="Abrir carrito"
              onClick={() => setIsCartOpen(true)}
              className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-xl transition-colors"
            >
              <ShoppingCart className="w-6 h-6" />
              {getItemCount() > 0 && (
                <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-canvas">
                  {getItemCount()}
                </span>
              )}
            </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm flex flex-col">
              <div className="relative aspect-[4/3] bg-gray-100 border-b border-gray-50 skeleton" />
              <div className="p-4 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-gray-200 rounded skeleton" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full skeleton" />
                </div>
                <div className="h-4 w-full bg-gray-200 rounded skeleton" />
                <div className="h-4 w-2/3 bg-gray-200 rounded skeleton mb-auto" />
                <div className="flex gap-2 pt-2">
                  <div className="h-5 w-16 bg-gray-200 rounded-md skeleton" />
                  <div className="h-5 w-20 bg-gray-200 rounded-md skeleton" />
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
                  <div className="h-3 w-20 bg-gray-200 rounded skeleton" />
                  <div className="h-5 w-24 bg-gray-200 rounded skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : isError && products.length === 0 ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
          No se pudieron cargar los productos. Recarga la página para intentarlo de nuevo.
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white border border-gray-200/60 rounded-2xl p-12 text-center flex flex-col items-center shadow-sm">
          <PackageSearch className="w-12 h-12 text-gray-300 mb-4 stroke-[1.5]" />
          <h3 className="text-[16px] font-semibold text-ink mb-1">No hay productos</h3>
          <p className="text-[14px] text-muted">No se encontraron productos con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((item: any) => {
            const imageUrl = catalogService.getProductImageUrl(item.image_url);

            return (
              <div 
                key={item.id}
                onClick={() => isAdmin ? navigate(`/catalog/products/${item.id}`) : undefined}
                className={`group bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm flex flex-col ${isAdmin ? 'hover-lift cursor-pointer' : ''}`}
              >
                {/* Image Section */}
                <div className="relative aspect-[4/3] bg-white border-b border-gray-100 flex items-center justify-center overflow-hidden p-3">
                  {item.is_new && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className="text-[10px] bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full uppercase backdrop-blur-md">
                        Nuevo
                      </span>
                    </div>
                  )}
                  
                  {imageUrl ? (
                    <img 
                      src={imageUrl} 
                      alt={item.name} 
                      loading="lazy"
                      className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <PackageSearch className="w-16 h-16 text-gray-200 stroke-[1] group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>

                {/* Info Section */}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[11px] font-medium text-accent truncate">
                      {isAdmin && (item.item_type === 'PURCHASE' ? 'Código ' : 'Clave ')}{item.code}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  {isAdmin && item.linked_codes?.length > 0 && (
                    <p className="text-[11px] text-muted truncate -mt-1 mb-1.5" title={item.linked_codes.join(', ')}>
                      {item.item_type === 'PURCHASE' ? 'Claves: ' : 'Código: '}{item.linked_codes.join(', ')}
                    </p>
                  )}
                  
                  <h3 className="text-[14px] font-semibold text-ink leading-snug mb-2 line-clamp-2">
                    {item.name}
                  </h3>
                  
                  <div className="mt-auto pt-2">
                    <div className="flex flex-wrap gap-1.5 text-[11px] text-muted mb-3">
                      {item.brand && (
                        <span className="truncate bg-gray-100 px-2 py-0.5 rounded-md">{item.brand}</span>
                      )}
                      {item.category && (
                        <span className="truncate bg-gray-100 px-2 py-0.5 rounded-md">{item.category}</span>
                      )}
                    </div>
                    
                    {item.public_price != null && (
                      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <span className="text-[12px] font-medium text-muted">Precio Público</span>
                        <span className="text-[16px] font-bold text-ink">
                          {currency.format(item.public_price)}
                        </span>
                      </div>
                    )}
                    {isAdmin && (
                      <div className={`flex items-center justify-between ${item.public_price != null ? 'pt-1' : 'border-t border-gray-100 pt-3'}`}>
                        <span className="text-[12px] font-medium text-muted">Costo</span>
                        <span className="text-[13px] font-semibold text-muted">
                          {item.cost != null ? currency.format(item.cost) : 'Sin costo'}
                        </span>
                      </div>
                    )}
                  </div>

                  {item.item_type !== 'PURCHASE' && (
                    <button 
                      type="button"
                      disabled={item.status !== 'ACTIVE' || !(Number(item.public_price) > 0)}
                      onClick={(e) => {
                        e.stopPropagation();
                        addItem({
                          product_id: item.id,
                          name: item.name,
                          code: item.code,
                          price: item.public_price,
                          quantity: 1,
                          image_url: imageUrl ?? undefined
                        });
                        setIsCartOpen(true);
                      }}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-accent/10 text-accent hover:bg-accent hover:text-white px-4 py-2 rounded-xl text-[13px] font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {Number(item.public_price) > 0 ? 'Agregar al carrito' : 'Sin precio público'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Infinite Scroll trigger */}
      {!isLoading && products.length > 0 && (
        <div ref={bottomRef} className="py-6 flex justify-center">
          {isFetchingNextPage ? (
            <Loader2 className="w-6 h-6 text-accent animate-spin" />
          ) : hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-accent shadow-sm hover:bg-gray-50"
            >
              {isFetchNextPageError ? 'Reintentar carga' : 'Cargar más productos'}
            </button>
          ) : (
            <span className="text-[13px] text-muted">No hay más productos</span>
          )}
        </div>
      )}
      
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
