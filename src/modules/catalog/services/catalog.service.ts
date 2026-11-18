import { supabase } from '../../../lib/supabase/client';
import { storageService } from '../../../lib/supabase/storage';

export const catalogService = {
  // itemType: SALE = sale keys (ALM-02), PURCHASE = purchase codes (ALM-01, admin only via RLS).
  async getProducts({ page = 1, pageSize = 25, search = '', brand = '', category = '', itemType = 'SALE', withCosts = false }) {
    let query = supabase.from('product_search').select('*', { count: 'exact' }).eq('item_type', itemType);
    
    if (search) {
      // linked_codes lets admins find a sale key by its purchase code (and vice versa); it is empty for other roles.
      const term = search.replace(/[,(){}"]/g, ' ').trim();
      const tokens = term.split(/\s+/).filter(Boolean);
      if (tokens.length <= 1) {
        query = query.or(`code.ilike.%${term}%,name.ilike.%${term}%,barcode.ilike.%${term}%,linked_codes.cs.{"${term}"}`);
      } else {
        for (const token of tokens) {
          query = query.or(`code.ilike.%${token}%,name.ilike.%${token}%,barcode.ilike.%${token}%,linked_codes.cs.{"${token}"}`);
        }
      }
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

      const [pricesResult, costsResult] = await Promise.all([
        supabase
          .from('current_product_prices')
          .select('product_id, amount, price_list_code, price_list_name')
          .in('product_id', productIds),
        withCosts
          ? (supabase as any)
              .from('inventory_valuation')
              .select('product_id, average_cost')
              .in('product_id', productIds)
          : Promise.resolve({ data: null }),
      ]);

      const prices = pricesResult.data;
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
        const costs = costsResult.data;
        const costByProduct = new Map<string, number>();
        (costs || []).forEach((c: any) => {
          if (c.average_cost != null && !costByProduct.has(c.product_id)) costByProduct.set(c.product_id, Number(c.average_cost));
        });
        data.forEach((d: any) => { d.cost = costByProduct.get(d.id) ?? null; });
      }

      if (search.trim()) {
        const lowerSearch = search.trim().toLowerCase();
        data.sort((a: any, b: any) => {
          const aCode = (a.code || '').toLowerCase();
          const bCode = (b.code || '').toLowerCase();
          const aExact = aCode === lowerSearch ? 0 : aCode.startsWith(lowerSearch) ? 1 : 2;
          const bExact = bCode === lowerSearch ? 0 : bCode.startsWith(lowerSearch) ? 1 : 2;
          if (aExact !== bExact) return aExact - bExact;
          return (a.name || '').localeCompare(b.name || '');
        });
      }
    }

    return { data, count, nextPage };
  },

  // Sale keys to link from a purchase code.
  async searchSaleProducts(query: string) {
    let q = supabase.from('products').select('id, code, name').eq('item_type', 'SALE');
    if (query) {
      const term = query.replace(/[,()]/g, ' ').trim();
      const tokens = term.split(/\s+/).filter(Boolean);
      for (const token of tokens) {
        q = q.or(`code.ilike.%${token}%,name.ilike.%${token}%`);
      }
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
    // Basic product details, fitments, and links in parallel
    const [productResult, fitmentsResult, linksResult] = await Promise.all([
      (supabase as any)
        .from('products')
        .select('*, brand:product_brands(name), category:product_categories(name)')
        .eq('id', productId)
        .single(),
      (supabase as any)
        .from('product_fitments')
        .select('*, vehicle_models(name, make_id, vehicle_makes(name))')
        .eq('product_id', productId),
      (supabase as any)
        .from('product_sale_links')
        .select('id, is_default, purchase_product_id, sale_product_id, purchase:products!product_sale_links_purchase_product_id_fkey(id, code, name), sale:products!product_sale_links_sale_product_id_fkey(id, code, name)')
        .or(`purchase_product_id.eq.${productId},sale_product_id.eq.${productId}`),
    ]);

    if (productResult.error) throw productResult.error;
    if (fitmentsResult.error) throw fitmentsResult.error;
    if (linksResult.error) throw linksResult.error;

    const product = productResult.data;
    const fitments = fitmentsResult.data || [];
    let links = linksResult.data || [];

    // Resolve both the SALE record (Clave de venta) and PURCHASE record (Código de compra)
    let saleProductId: string | null = null;
    let saleCode = '';
    let purchaseProductId: string | null = null;
    let purchaseCode = '';

    if (product.item_type === 'PURCHASE') {
      purchaseProductId = product.id;
      purchaseCode = product.code || '';
      const defaultSaleLink =
        links.find((l: any) => l.purchase_product_id === product.id && l.is_default) ||
        links.find((l: any) => l.purchase_product_id === product.id);
      if (defaultSaleLink) {
        saleProductId = defaultSaleLink.sale_product_id;
        saleCode = defaultSaleLink.sale?.code || '';
      }
    } else {
      saleProductId = product.id;
      saleCode = product.code || '';
      const defaultPurchaseLink =
        links.find((l: any) => l.sale_product_id === product.id && l.is_default) ||
        links.find((l: any) => l.sale_product_id === product.id);
      if (defaultPurchaseLink) {
        purchaseProductId = defaultPurchaseLink.purchase_product_id;
        purchaseCode = defaultPurchaseLink.purchase?.code || '';
      }
    }

    const relatedProductIds = Array.from(
      new Set([productId, saleProductId, purchaseProductId].filter(Boolean))
    ) as string[];

    // Load prices (from the SALE product if linked), inventory (from both SALE and PURCHASE warehouses),
    // costs (from both warehouses), and full links for the purchase product if we opened from SALE
    const [pricesResult, inventoryResult, costsResult, extraPurchaseLinksResult] = await Promise.all([
      (supabase as any)
        .from('product_prices')
        .select('*')
        .eq('product_id', saleProductId || productId)
        .is('valid_to', null),
      (supabase as any)
        .from('product_inventory')
        .select('*')
        .in('product_id', relatedProductIds)
        .is('location_id', null),
      (supabase as any)
        .from('inventory_valuation')
        .select('warehouse_id, warehouse_name, average_cost, original_average_cost')
        .in('product_id', relatedProductIds),
      purchaseProductId && purchaseProductId !== productId
        ? (supabase as any)
            .from('product_sale_links')
            .select('id, is_default, purchase_product_id, sale_product_id, purchase:products!product_sale_links_purchase_product_id_fkey(id, code, name), sale:products!product_sale_links_sale_product_id_fkey(id, code, name)')
            .eq('purchase_product_id', purchaseProductId)
        : Promise.resolve({ data: null }),
    ]);

    if (pricesResult.error) throw pricesResult.error;
    if (inventoryResult.error) throw inventoryResult.error;

    if (extraPurchaseLinksResult.data) {
      const seenIds = new Set(links.map((l: any) => l.id));
      for (const extraLink of extraPurchaseLinksResult.data) {
        if (!seenIds.has(extraLink.id)) {
          links = [...links, extraLink];
          seenIds.add(extraLink.id);
        }
      }
    }

    // Consolidate costs by warehouse_id so each warehouse appears once (preferring non-null average_cost)
    const consolidatedCostsMap = new Map<string, any>();
    for (const costRow of costsResult.data || []) {
      const existing = consolidatedCostsMap.get(costRow.warehouse_id);
      if (!existing || (existing.average_cost == null && costRow.average_cost != null)) {
        consolidatedCostsMap.set(costRow.warehouse_id, costRow);
      }
    }

    return {
      product,
      saleProductId,
      saleCode,
      purchaseProductId,
      purchaseCode,
      prices: pricesResult.data || [],
      inventory: inventoryResult.data || [],
      fitments,
      links,
      costs: Array.from(consolidatedCostsMap.values()),
    };
  },

  async saveProductFull(payload: any) {
    const saleCode = (payload.sale_code ?? (payload.item_type !== 'PURCHASE' ? payload.code : '') ?? '').trim();
    const purchaseCode = (payload.purchase_code ?? (payload.item_type === 'PURCHASE' ? payload.code : '') ?? '').trim();

    if (!saleCode && !purchaseCode) {
      throw new Error('Debes capturar al menos la Clave de venta o el Código de compra.');
    }

    let saleProductId: string | null = payload.sale_product_id || (payload.item_type === 'SALE' ? payload.id : null) || null;
    let purchaseProductId: string | null = payload.purchase_product_id || (payload.item_type === 'PURCHASE' ? payload.id : null) || null;

    // If an unlinked product switched from PURCHASE -> SALE or SALE -> PURCHASE in place
    if (saleCode && !purchaseCode && !saleProductId && purchaseProductId && (payload.existing_links_count || 0) === 0) {
      saleProductId = purchaseProductId;
      purchaseProductId = null;
    } else if (purchaseCode && !saleCode && !purchaseProductId && saleProductId && (payload.existing_links_count || 0) === 0) {
      purchaseProductId = saleProductId;
      saleProductId = null;
    }

    let savedSaleId: string | null = saleProductId;
    let savedPurchaseId: string | null = purchaseProductId;

    // 1. Save or update the SALE product (Clave de venta) if provided
    if (saleCode) {
      if (!saleProductId) {
        const { data: existingSale } = await (supabase as any)
          .from('products')
          .select('id')
          .eq('item_type', 'SALE')
          .eq('code', saleCode)
          .maybeSingle();
        if (existingSale?.id) {
          saleProductId = existingSale.id;
        }
      }

      const { data: saleId, error: saleError } = await (supabase.rpc as any)('create_or_update_product_full', {
        p_product_id: saleProductId || null,
        p_code: saleCode,
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
        p_item_type: 'SALE',
        p_sale_links: null,
      });
      if (saleError) throw saleError;
      savedSaleId = saleId;
    }

    // 2. Save or update the PURCHASE product (Código de compra) if provided, and link it to the SALE product
    if (purchaseCode) {
      let existingPurchaseLinks: { sale_product_id: string; is_default: boolean }[] = [];
      if (!purchaseProductId) {
        const { data: existingPurchase } = await (supabase as any)
          .from('products')
          .select('id, product_sale_links!product_sale_links_purchase_product_id_fkey(sale_product_id, is_default)')
          .eq('item_type', 'PURCHASE')
          .eq('code', purchaseCode)
          .maybeSingle();
        if (existingPurchase?.id) {
          purchaseProductId = existingPurchase.id;
          existingPurchaseLinks = existingPurchase.product_sale_links || [];
        }
      }

      const rawLinks: { sale_product_id: string; is_default: boolean }[] = [
        ...existingPurchaseLinks,
        ...((payload.sale_links || []).filter((l: any) => Boolean(l?.sale_product_id))),
      ];

      // Deduplicate links by sale_product_id
      const linksBySaleId = new Map<string, { sale_product_id: string; is_default: boolean }>();
      for (const link of rawLinks) {
        linksBySaleId.set(link.sale_product_id, {
          sale_product_id: link.sale_product_id,
          is_default: Boolean(link.is_default),
        });
      }

      if (savedSaleId) {
        const alreadyHasDefault = Array.from(linksBySaleId.values()).some(
          (l) => l.is_default && l.sale_product_id !== savedSaleId
        );
        linksBySaleId.set(savedSaleId, {
          sale_product_id: savedSaleId,
          is_default: !alreadyHasDefault,
        });
      }

      const finalSaleLinks = Array.from(linksBySaleId.values());

      const { data: purchaseId, error: purchaseError } = await (supabase.rpc as any)('create_or_update_product_full', {
        p_product_id: purchaseProductId || null,
        p_code: purchaseCode,
        p_barcode: payload.barcode || null,
        p_name: payload.name,
        p_description: payload.description || null,
        p_brand_id: payload.brand_id || null,
        p_category_id: payload.category_id || null,
        p_unit_of_measure_id: payload.unit_of_measure_id || null,
        p_status: payload.status || 'ACTIVE',
        p_prices: null,
        p_inventory: payload.inventory || null,
        p_fitments: payload.fitments || null,
        p_image_url: payload.image_url || null,
        p_item_type: 'PURCHASE',
        p_sale_links: finalSaleLinks.length > 0 ? finalSaleLinks : null,
      });
      if (purchaseError) throw purchaseError;
      savedPurchaseId = purchaseId;
    }

    const primaryId =
      payload.item_type === 'PURCHASE'
        ? savedPurchaseId || savedSaleId
        : savedSaleId || savedPurchaseId;

    return primaryId;
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
