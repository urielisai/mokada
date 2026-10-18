import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';

export const catalogService = {
  // itemType: SALE = sale keys (ALM-02), PURCHASE = purchase codes (ALM-01, admin only via RLS).
  async getProducts({ page = 1, pageSize = 25, search = '', brand = '', category = '', itemType = 'SALE', withCosts = false }) {
    let query = supabase.from('product_search').select('*', { count: 'exact' }).eq('item_type', itemType);
    
    if (search) {
      // linked_codes lets admins find a sale key by its purchase code (and vice versa); it is empty for other roles.
      const term = search.replace(/[,(){}"]/g, ' ').trim();
      query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%,barcode.ilike.%${term}%,linked_codes.cs.{"${term}"}`);
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

      if (withCosts) {
        // inventory_valuation only returns rows to admins.
        const { data: costs } = await (supabase as any).from('inventory_valuation')
          .select('product_id, average_cost')
          .in('product_id', productIds);
        const costByProduct = new Map<string, number>();
        (costs || []).forEach((c: any) => {
          if (c.average_cost != null && !costByProduct.has(c.product_id)) costByProduct.set(c.product_id, Number(c.average_cost));
        });
        data.forEach((d: any) => { d.cost = costByProduct.get(d.id) ?? null; });
      }
    }

    return { data, count, nextPage };
  },

  // Sale keys to link from a purchase code.
  async searchSaleProducts(query: string) {
    let q = supabase.from('products').select('id, code, name').eq('item_type', 'SALE');
    if (query) {
      const term = query.replace(/[,()]/g, ' ').trim();
      q = q.or(`code.ilike.%${term}%,name.ilike.%${term}%`);
    }
    const { data, error } = await q.order('code').limit(30);
    if (error) throw error;
    return data;
  },

  async getBrands() {
    const { data, error } = await supabase.from('product_brands').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async searchBrands(query: string) {
    let q = supabase.from('product_brands').select('id, name');
    if (query) {
      q = q.ilike('name', `%${query}%`);
    }
    const { data, error } = await q.order('name').limit(30);
    if (error) throw error;
    return data;
  },

  async getCategories() {
    const { data, error } = await supabase.from('product_categories').select('*').order('name');
    if (error) throw error;
    return data;
  },

  async searchCategories(query: string) {
    let q = supabase.from('product_categories').select('id, name');
    if (query) {
      q = q.ilike('name', `%${query}%`);
    }
    const { data, error } = await q.order('name').limit(30);
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
      .select('*, brand:product_brands(name), category:product_categories(name)')
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

    // Code <-> key links and costs are admin-only (RLS returns nothing to other roles).
    const { data: links, error: linksError } = await (supabase as any)
      .from('product_sale_links')
      .select('id, is_default, purchase_product_id, sale_product_id, purchase:products!product_sale_links_purchase_product_id_fkey(id, code, name), sale:products!product_sale_links_sale_product_id_fkey(id, code, name)')
      .or(`purchase_product_id.eq.${productId},sale_product_id.eq.${productId}`);
    if (linksError) throw linksError;

    const { data: costs } = await (supabase as any)
      .from('inventory_valuation')
      .select('warehouse_id, warehouse_name, average_cost, original_average_cost')
      .eq('product_id', productId);

    return { product, prices, inventory, fitments, links: links || [], costs: costs || [] };
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
      p_image_url: payload.image_url || null,
      p_item_type: payload.item_type || null,
      p_sale_links: payload.sale_links ?? null
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
