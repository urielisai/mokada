import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';

export const catalogService = {
  async getProducts({ page = 1, pageSize = 25, search = '', brand = '', category = '' }) {
    let query = supabase.from('product_search').select('*', { count: 'exact' });
    
    if (search) {
      query = query.or(`code.ilike.%${search}%,name.ilike.%${search}%,barcode.ilike.%${search}%`);
    } else {
      if (brand) {
        query = query.eq('brand', brand);
      }
      if (category) {
        query = query.eq('category', category);
      }
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await query.order('name').order('id').range(from, to);
    if (error) throw error;
    
    const hasNextPage = count !== null && to + 1 < count;
    const nextPage = hasNextPage ? page + 1 : undefined;
    
    if (data && data.length > 0) {
      const productIds = data.map((d: any) => d.id);
      
      const { data: prices } = await supabase.from('current_product_prices')
        .select('product_id, amount, price_list_code, price_list_name')
        .in('product_id', productIds);
        
      if (prices) {
        const pricesByProduct = new Map();
        prices.forEach((p: any) => {
          if (!pricesByProduct.has(p.product_id)) {
            pricesByProduct.set(p.product_id, []);
          }
          pricesByProduct.get(p.product_id).push(p);
        });

        data.forEach((d: any) => {
          const productPrices = pricesByProduct.get(d.id) || [];
          const publicPrice = productPrices.find((p: any) => 
            p.price_list_code?.toUpperCase().includes('PUBLIC') || 
            p.price_list_name?.toUpperCase().includes('PÚBLICO') ||
            p.price_list_name?.toUpperCase().includes('PUBLICO') ||
            p.price_list_name?.toUpperCase() === 'GENERAL'
          );
          
          if (publicPrice) {
            d.public_price = publicPrice.amount;
          }
        });
      }
    }

    return { data, count, nextPage };
  },

  async getBrands() {
    const { data, error } = await supabase.from('product_brands').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async getCategories() {
    const { data, error } = await supabase.from('product_categories').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async getVehicles() {
    const { data, error } = await supabase.from('vehicle_models').select('*, vehicle_makes(name)').order('name');
    if (error) throw error;
    return data;
  },

  async getProductFull(productId: string) {
    // Basic product details
    const { data: product, error: productError } = await (supabase as any)
      .from('products')
      .select('*')
      .eq('id', productId)
      .single();
    if (productError) throw productError;

    // Prices
    const { data: prices, error: pricesError } = await (supabase as any)
      .from('product_prices')
      .select('*')
      .eq('product_id', productId)
      .is('valid_to', null);
    if (pricesError) throw pricesError;

    // Inventory settings
    const { data: inventory, error: invError } = await (supabase as any)
      .from('product_inventory')
      .select('*')
      .eq('product_id', productId)
      .is('location_id', null);
    if (invError) throw invError;

    // Fitments
    const { data: fitments, error: fitError } = await (supabase as any)
      .from('product_fitments')
      .select('*, vehicle_models(name, make_id, vehicle_makes(name))')
      .eq('product_id', productId);
    if (fitError) throw fitError;

    return { product, prices, inventory, fitments };
  },

  async saveProductFull(payload: any) {
    const { data, error } = await (supabase.rpc as any)('create_or_update_product_full', {
      p_product_id: payload.id || null,
      p_code: payload.code,
      p_barcode: payload.barcode || null,
      p_name: payload.name,
      p_description: payload.description || null,
      p_brand_id: payload.brand_id || null,
      p_category_id: payload.category_id || null,
      p_unit_of_measure_id: payload.unit_of_measure_id || null,
      p_status: payload.status || 'ACTIVE',
      p_prices: payload.prices || null,
      p_inventory: payload.inventory || null,
      p_fitments: payload.fitments || null,
      p_image_url: payload.image_url || null
    });
    if (error) throw error;
    return data;
  },

  async saveBrand(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = (supabase as any).from('product_brands').update(dataToSave).eq('id', id);
    } else {
      request = (supabase as any).from('product_brands').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async saveCategory(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = (supabase as any).from('product_categories').update(dataToSave).eq('id', id);
    } else {
      request = (supabase as any).from('product_categories').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async getVehicleMakes() {
    const { data, error } = await (supabase as any).from('vehicle_makes').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async saveVehicleMake(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = (supabase as any).from('vehicle_makes').update(dataToSave).eq('id', id);
    } else {
      request = (supabase as any).from('vehicle_makes').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async saveVehicleModel(payload: any) {
    const { id, ...dataToSave } = payload;
    let request;
    if (id) {
      request = (supabase as any).from('vehicle_models').update(dataToSave).eq('id', id);
    } else {
      request = (supabase as any).from('vehicle_models').insert([dataToSave]);
    }
    const { data, error } = await request.select().single();
    if (error) throw error;
    return data;
  },

  async uploadProductImage(productId: string, file: File) {
    return storageService.uploadFile({
      bucket: 'products',
      file,
      ownerId: productId,
      folder: 'images',
      upsert: true,
    });
  },

  getProductImageUrl(path: string | null) {
    if (!path) return null;
    return storageService.getPublicUrl('products', path);
  }
};
