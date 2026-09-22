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

export const ProductsPage = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const { addItem, getItemCount } = useCartStore();

  const { 
    data, 
    isLoading, 
    isError,
    isFetchNextPageError,
    fetchNextPage, 
    hasNextPage, 
    isFetchingNextPage 
  } = useInfiniteProducts({ pageSize: 25, search: debouncedSearch });

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
        <div>
          <h2 className="text-[28px] font-bold tracking-tight text-[#1D1D1F]">Productos</h2>
          <p className="text-[15px] text-[#86868B] mt-1">Catálogo general de refacciones</p>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              type="text" 
              placeholder="Buscar por código o nombre..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] text-[14px] transition-all shadow-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {isAdmin && (
            <button 
              onClick={() => navigate('/catalog/products/new')}
              className="flex items-center justify-center gap-2 bg-[#0066CC] hover:bg-[#005bb5] text-white px-4 py-2 rounded-xl text-[14px] font-medium transition-colors whitespace-nowrap shadow-sm"
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
                <span className="absolute top-0 right-0 -mt-1 -mr-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#F5F5F7]">
                  {getItemCount()}
                </span>
              )}
            </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm flex flex-col h-[380px]">
              <div className="relative aspect-square bg-gray-100 border-b border-gray-50 animate-pulse" />
              <div className="p-5 flex-1 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-16 bg-gray-200 rounded-full animate-pulse" />
                </div>
                <div className="h-5 w-full bg-gray-200 rounded animate-pulse" />
                <div className="h-5 w-2/3 bg-gray-200 rounded animate-pulse mb-auto" />
                <div className="flex flex-col gap-2 pt-3">
                  <div className="h-3 w-1/2 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                </div>
                <div className="flex items-center justify-between border-t border-gray-100 pt-3 mt-1">
                  <div className="h-3 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-24 bg-gray-200 rounded animate-pulse" />
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
          <h3 className="text-[16px] font-semibold text-[#1D1D1F] mb-1">No hay productos</h3>
          <p className="text-[14px] text-[#86868B]">No se encontraron productos con los filtros actuales.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map((item: any) => {
            const imageUrl = catalogService.getProductImageUrl(item.image_url);

            return (
              <div 
                key={item.id}
                onClick={() => isAdmin ? navigate(`/catalog/products/${item.id}`) : undefined}
                className={`group bg-white border border-gray-200/60 rounded-[24px] overflow-hidden shadow-sm flex flex-col ${isAdmin ? 'hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer' : ''}`}
              >
                {/* Image Section */}
                <div className="relative aspect-square bg-white border-b border-gray-50 p-6 flex items-center justify-center overflow-hidden">
                  {item.is_new && (
                    <div className="absolute top-4 left-4 z-10">
                      <span className="text-[11px] bg-[#0066CC]/10 text-[#0066CC] font-semibold px-2.5 py-1 rounded-full uppercase backdrop-blur-md">
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
                    <PackageSearch className="w-20 h-20 text-gray-200 stroke-[1] group-hover:scale-105 transition-transform duration-500" />
                  )}
                </div>

                {/* Info Section */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-[12px] font-medium text-[#0066CC] truncate">
                      {item.code}
                    </span>
                    <StatusBadge status={item.status} />
                  </div>
                  
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F] leading-tight mb-2 line-clamp-2">
                    {item.name}
                  </h3>
                  
                  <div className="mt-auto pt-3">
                    <div className="flex flex-col gap-1 text-[13px] text-[#86868B] mb-3">
                      {item.brand && (
                        <span className="truncate">Marca: <span className="font-medium text-[#1D1D1F]">{item.brand}</span></span>
                      )}
                      {item.category && (
                        <span className="truncate">Categoría: <span className="font-medium text-[#1D1D1F]">{item.category}</span></span>
                      )}
                    </div>
                    
                    {item.public_price != null && (
                      <div className="flex items-center justify-between border-t border-gray-100 pt-3">
                        <span className="text-[12px] font-medium text-[#86868B]">Precio Público</span>
                        <span className="text-[16px] font-bold text-[#1D1D1F]">
                          {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(item.public_price)}
                        </span>
                      </div>
                    )}
                  </div>

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
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-[#0066CC]/10 text-[#0066CC] hover:bg-[#0066CC] hover:text-white px-4 py-2 rounded-xl text-[13px] font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {Number(item.public_price) > 0 ? 'Agregar al carrito' : 'Sin precio público'}
                    </button>
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
            <Loader2 className="w-6 h-6 text-[#0066CC] animate-spin" />
          ) : hasNextPage ? (
            <button
              type="button"
              onClick={() => fetchNextPage()}
              className="rounded-xl border border-gray-200 bg-white px-5 py-2 text-sm font-medium text-[#0066CC] shadow-sm hover:bg-gray-50"
            >
              {isFetchNextPageError ? 'Reintentar carga' : 'Cargar más productos'}
            </button>
          ) : (
            <span className="text-[13px] text-[#86868B]">No hay más productos</span>
          )}
        </div>
      )}
      
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};
