export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      attribute_definitions: {
        Row: {
          code: string
          created_at: string
          data_type: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          data_type: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          data_type?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_import_items: {
        Row: {
          catalog_import_id: string
          created_at: string
          error_message: string | null
          id: string
          normalized_data: Json | null
          product_id: string | null
          row_number: number | null
          source_data: Json | null
          status: Database["public"]["Enums"]["catalog_import_item_status"]
        }
        Insert: {
          catalog_import_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          normalized_data?: Json | null
          product_id?: string | null
          row_number?: number | null
          source_data?: Json | null
          status?: Database["public"]["Enums"]["catalog_import_item_status"]
        }
        Update: {
          catalog_import_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          normalized_data?: Json | null
          product_id?: string | null
          row_number?: number | null
          source_data?: Json | null
          status?: Database["public"]["Enums"]["catalog_import_item_status"]
        }
        Relationships: [
          {
            foreignKeyName: "catalog_import_items_catalog_import_id_fkey"
            columns: ["catalog_import_id"]
            isOneToOne: false
            referencedRelation: "catalog_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "catalog_import_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_imports: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_records: number
          file_name: string | null
          id: string
          processed_records: number
          source: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["catalog_import_status"]
          success_records: number
          total_records: number
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_records?: number
          file_name?: string | null
          id?: string
          processed_records?: number
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["catalog_import_status"]
          success_records?: number
          total_records?: number
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_records?: number
          file_name?: string | null
          id?: string
          processed_records?: number
          source?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["catalog_import_status"]
          success_records?: number
          total_records?: number
          updated_at?: string
        }
        Relationships: []
      }
      catalog_staging: {
        Row: {
          confidence: string | null
          created_at: string | null
          detected_is_new: boolean | null
          detected_is_out_of_stock: boolean | null
          error_message: string | null
          id: string
          import_id: string | null
          normalized_brand: string | null
          normalized_category: string | null
          normalized_code: string | null
          normalized_data: Json | null
          raw_brand: string | null
          raw_category: string | null
          raw_code: string | null
          raw_description: string | null
          raw_price_discount_10: number | null
          raw_price_discount_20: number | null
          raw_price_public: number | null
          source_page: number | null
          status: string | null
        }
        Insert: {
          confidence?: string | null
          created_at?: string | null
          detected_is_new?: boolean | null
          detected_is_out_of_stock?: boolean | null
          error_message?: string | null
          id?: string
          import_id?: string | null
          normalized_brand?: string | null
          normalized_category?: string | null
          normalized_code?: string | null
          normalized_data?: Json | null
          raw_brand?: string | null
          raw_category?: string | null
          raw_code?: string | null
          raw_description?: string | null
          raw_price_discount_10?: number | null
          raw_price_discount_20?: number | null
          raw_price_public?: number | null
          source_page?: number | null
          status?: string | null
        }
        Update: {
          confidence?: string | null
          created_at?: string | null
          detected_is_new?: boolean | null
          detected_is_out_of_stock?: boolean | null
          error_message?: string | null
          id?: string
          import_id?: string | null
          normalized_brand?: string | null
          normalized_category?: string | null
          normalized_code?: string | null
          normalized_data?: Json | null
          raw_brand?: string | null
          raw_category?: string | null
          raw_code?: string | null
          raw_description?: string | null
          raw_price_discount_10?: number | null
          raw_price_discount_20?: number | null
          raw_price_public?: number | null
          source_page?: number | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "catalog_staging_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "catalog_imports"
            referencedColumns: ["id"]
          },
        ]
      }
      client_branches: {
        Row: {
          address: string | null
          city: string | null
          client_id: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          client_id: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          client_id?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_branches_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["expense_attachment_type"]
          created_at: string
          expense_id: string
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type?: Database["public"]["Enums"]["expense_attachment_type"]
          created_at?: string
          expense_id: string
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["expense_attachment_type"]
          created_at?: string
          expense_id?: string
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "travel_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          requires_invoice: boolean
          requires_receipt: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          requires_invoice?: boolean
          requires_receipt?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          requires_invoice?: boolean
          requires_receipt?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      fleet_vehicles: {
        Row: {
          brand: string | null
          color: string | null
          created_at: string
          engine: string | null
          fuel_type: string | null
          id: string
          image_url: string | null
          internal_code: string
          mileage: number | null
          model: string | null
          notes: string | null
          plate_number: string | null
          status: Database["public"]["Enums"]["vehicle_status_type"]
          transmission: string | null
          updated_at: string
          vehicle_type: string | null
          vin: string | null
          year: number | null
        }
        Insert: {
          brand?: string | null
          color?: string | null
          created_at?: string
          engine?: string | null
          fuel_type?: string | null
          id?: string
          image_url?: string | null
          internal_code: string
          mileage?: number | null
          model?: string | null
          notes?: string | null
          plate_number?: string | null
          status?: Database["public"]["Enums"]["vehicle_status_type"]
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Update: {
          brand?: string | null
          color?: string | null
          created_at?: string
          engine?: string | null
          fuel_type?: string | null
          id?: string
          image_url?: string | null
          internal_code?: string
          mileage?: number | null
          model?: string | null
          notes?: string | null
          plate_number?: string | null
          status?: Database["public"]["Enums"]["vehicle_status_type"]
          transmission?: string | null
          updated_at?: string
          vehicle_type?: string | null
          vin?: string | null
          year?: number | null
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string | null
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_number: string | null
          reference_type: string | null
          total_cost: number | null
          unit_cost: number | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string | null
          movement_type?: Database["public"]["Enums"]["inventory_movement_type"]
          notes?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_number?: string | null
          reference_type?: string | null
          total_cost?: number | null
          unit_cost?: number | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_reservations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          location_id: string | null
          product_id: string
          quantity: number
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["reservation_status"]
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          location_id?: string | null
          product_id: string
          quantity: number
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          location_id?: string | null
          product_id?: string
          quantity?: number
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["reservation_status"]
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_reservations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_reservations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfer_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity: number
          transfer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          transfer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfer_items_transfer_id_fkey"
            columns: ["transfer_id"]
            isOneToOne: false
            referencedRelation: "inventory_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transfers: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          destination_warehouse_id: string
          id: string
          notes: string | null
          source_warehouse_id: string
          status: string
          transfer_number: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_warehouse_id: string
          id?: string
          notes?: string | null
          source_warehouse_id: string
          status?: string
          transfer_number: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          destination_warehouse_id?: string
          id?: string
          notes?: string | null
          source_warehouse_id?: string
          status?: string
          transfer_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transfers_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transfers_source_warehouse_id_fkey"
            columns: ["source_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      price_lists: {
        Row: {
          code: string
          created_at: string
          currency: string
          discount_percentage: number
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          currency?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          currency?: string
          discount_percentage?: number
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_attributes: {
        Row: {
          attribute_id: string
          created_at: string
          id: string
          product_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          attribute_id: string
          created_at?: string
          id?: string
          product_id: string
          updated_at?: string
          value: Json
        }
        Update: {
          attribute_id?: string
          created_at?: string
          id?: string
          product_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "product_attributes_attribute_id_fkey"
            columns: ["attribute_id"]
            isOneToOne: false
            referencedRelation: "attribute_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_attributes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_brands: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fitments: {
        Row: {
          created_at: string
          engine: string | null
          has_abs: boolean | null
          id: string
          notes: string | null
          position: string | null
          product_id: string
          side: string | null
          transmission: string | null
          updated_at: string
          vehicle_model_id: string
          year_from: number | null
          year_to: number | null
        }
        Insert: {
          created_at?: string
          engine?: string | null
          has_abs?: boolean | null
          id?: string
          notes?: string | null
          position?: string | null
          product_id: string
          side?: string | null
          transmission?: string | null
          updated_at?: string
          vehicle_model_id: string
          year_from?: number | null
          year_to?: number | null
        }
        Update: {
          created_at?: string
          engine?: string | null
          has_abs?: boolean | null
          id?: string
          notes?: string | null
          position?: string | null
          product_id?: string
          side?: string | null
          transmission?: string | null
          updated_at?: string
          vehicle_model_id?: string
          year_from?: number | null
          year_to?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_fitments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fitments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_fitments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_fitments_vehicle_model_id_fkey"
            columns: ["vehicle_model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory: {
        Row: {
          id: string
          location_id: string | null
          maximum_stock: number | null
          minimum_stock: number
          product_id: string
          quantity: number
          reorder_point: number | null
          reserved_quantity: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          product_id: string
          quantity?: number
          reorder_point?: number | null
          reserved_quantity?: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          location_id?: string | null
          maximum_stock?: number | null
          minimum_stock?: number
          product_id?: string
          quantity?: number
          reorder_point?: number | null
          reserved_quantity?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          amount: number
          created_at: string
          id: string
          price_list_id: string
          product_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          price_list_id: string
          product_id: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          price_list_id?: string
          product_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_references: {
        Row: {
          brand_id: string | null
          created_at: string
          id: string
          notes: string | null
          product_id: string
          reference: string
          reference_type: string
        }
        Insert: {
          brand_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id: string
          reference: string
          reference_type?: string
        }
        Update: {
          brand_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_id?: string
          reference?: string
          reference_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_references_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_references_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_suppliers: {
        Row: {
          created_at: string
          id: string
          is_preferred: boolean
          last_cost: number | null
          lead_time_days: number | null
          minimum_order_quantity: number | null
          product_id: string
          supplier_code: string | null
          supplier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_cost?: number | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          product_id: string
          supplier_code?: string | null
          supplier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_preferred?: boolean
          last_cost?: number | null
          lead_time_days?: number | null
          minimum_order_quantity?: number | null
          product_id?: string
          supplier_code?: string | null
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_suppliers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category_id: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean
          is_new: boolean
          name: string | null
          raw_description: string | null
          status: Database["public"]["Enums"]["product_status"]
          unit_of_measure_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_new?: boolean
          name?: string | null
          raw_description?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          unit_of_measure_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category_id?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_new?: boolean
          name?: string | null
          raw_description?: string | null
          status?: Database["public"]["Enums"]["product_status"]
          unit_of_measure_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_unit_of_measure_id_fkey"
            columns: ["unit_of_measure_id"]
            isOneToOne: false
            referencedRelation: "units_of_measure"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          received_quantity?: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          received_quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          expected_at: string | null
          id: string
          notes: string | null
          order_number: string
          ordered_at: string | null
          received_at: string | null
          status: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number: string
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          ordered_at?: string | null
          received_at?: string | null
          status?: Database["public"]["Enums"]["purchase_order_status"]
          supplier_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      route_states: {
        Row: {
          created_at: string
          id: string
          route_id: string
          sequence: number
          state_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          route_id: string
          sequence: number
          state_code: string
        }
        Update: {
          created_at?: string
          id?: string
          route_id?: string
          sequence?: number
          state_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_states_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_stops: {
        Row: {
          branch_id: string
          created_at: string
          estimated_arrival_time: string | null
          estimated_duration_minutes: number | null
          id: string
          notes: string | null
          route_id: string
          sequence: number
          updated_at: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          estimated_arrival_time?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          route_id: string
          sequence: number
          updated_at?: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          estimated_arrival_time?: string | null
          estimated_duration_minutes?: number | null
          id?: string
          notes?: string | null
          route_id?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "client_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      route_trip_settlements: {
        Row: {
          approved_expenses: number
          balance: number
          budget_amount: number
          created_at: string
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          route_trip_id: string
          settled_at: string | null
          settled_by: string | null
          settlement_amount: number
          settlement_type: Database["public"]["Enums"]["settlement_type_enum"]
          status: Database["public"]["Enums"]["settlement_status_type"]
          updated_at: string
        }
        Insert: {
          approved_expenses: number
          balance: number
          budget_amount: number
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_trip_id: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_amount: number
          settlement_type: Database["public"]["Enums"]["settlement_type_enum"]
          status?: Database["public"]["Enums"]["settlement_status_type"]
          updated_at?: string
        }
        Update: {
          approved_expenses?: number
          balance?: number
          budget_amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          route_trip_id?: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_amount?: number
          settlement_type?: Database["public"]["Enums"]["settlement_type_enum"]
          status?: Database["public"]["Enums"]["settlement_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_trip_settlements_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trip_settlements_route_trip_id_fkey"
            columns: ["route_trip_id"]
            isOneToOne: true
            referencedRelation: "route_trip_financial_summary"
            referencedColumns: ["route_trip_id"]
          },
          {
            foreignKeyName: "route_trip_settlements_route_trip_id_fkey"
            columns: ["route_trip_id"]
            isOneToOne: true
            referencedRelation: "route_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trip_settlements_settled_by_fkey"
            columns: ["settled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      route_trips: {
        Row: {
          agent_id: string
          budget_amount: number
          completed_at: string | null
          created_at: string
          created_by: string | null
          ending_mileage: number | null
          id: string
          notes: string | null
          route_id: string
          started_at: string | null
          starting_mileage: number | null
          status: Database["public"]["Enums"]["route_trip_status_type"]
          updated_at: string
          vehicle_id: string | null
          week_end_date: string
          week_start_date: string
        }
        Insert: {
          agent_id: string
          budget_amount?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          ending_mileage?: number | null
          id?: string
          notes?: string | null
          route_id: string
          started_at?: string | null
          starting_mileage?: number | null
          status?: Database["public"]["Enums"]["route_trip_status_type"]
          updated_at?: string
          vehicle_id?: string | null
          week_end_date: string
          week_start_date: string
        }
        Update: {
          agent_id?: string
          budget_amount?: number
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          ending_mileage?: number | null
          id?: string
          notes?: string | null
          route_id?: string
          started_at?: string | null
          starting_mileage?: number | null
          status?: Database["public"]["Enums"]["route_trip_status_type"]
          updated_at?: string
          vehicle_id?: string | null
          week_end_date?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_trips_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          code: string
          created_at: string
          default_weekly_budget: number
          description: string | null
          estimated_days: number | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
          working_days: string[] | null
        }
        Insert: {
          code: string
          created_at?: string
          default_weekly_budget?: number
          description?: string | null
          estimated_days?: number | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          working_days?: string[] | null
        }
        Update: {
          code?: string
          created_at?: string
          default_weekly_budget?: number
          description?: string | null
          estimated_days?: number | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          working_days?: string[] | null
        }
        Relationships: []
      }
      settlement_transactions: {
        Row: {
          amount: number
          attachment_path: string | null
          created_at: string
          created_by: string | null
          id: string
          reference: string | null
          settlement_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["settlement_transaction_type"]
        }
        Insert: {
          amount: number
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          reference?: string | null
          settlement_id: string
          transaction_date: string
          transaction_type: Database["public"]["Enums"]["settlement_transaction_type"]
        }
        Update: {
          amount?: number
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          reference?: string | null
          settlement_id?: string
          transaction_date?: string
          transaction_type?: Database["public"]["Enums"]["settlement_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "settlement_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_transactions_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "route_trip_settlements"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          notes: string | null
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      travel_expenses: {
        Row: {
          agent_id: string
          amount: number
          city: string | null
          created_at: string
          created_by: string | null
          description: string | null
          expense_category_id: string
          expense_date: string
          id: string
          invoice_available: boolean
          latitude: number | null
          longitude: number | null
          merchant_name: string | null
          notes: string | null
          payment_method: string | null
          place_name: string | null
          route_trip_id: string
          state: string | null
          status: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id: string
          expense_date: string
          id?: string
          invoice_available?: boolean
          latitude?: number | null
          longitude?: number | null
          merchant_name?: string | null
          notes?: string | null
          payment_method?: string | null
          place_name?: string | null
          route_trip_id: string
          state?: string | null
          status?: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount?: number
          city?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string
          expense_date?: string
          id?: string
          invoice_available?: boolean
          latitude?: number | null
          longitude?: number | null
          merchant_name?: string | null
          notes?: string | null
          payment_method?: string | null
          place_name?: string | null
          route_trip_id?: string
          state?: string | null
          status?: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_expenses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expenses_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "travel_expenses_route_trip_id_fkey"
            columns: ["route_trip_id"]
            isOneToOne: false
            referencedRelation: "route_trip_financial_summary"
            referencedColumns: ["route_trip_id"]
          },
          {
            foreignKeyName: "travel_expenses_route_trip_id_fkey"
            columns: ["route_trip_id"]
            isOneToOne: false
            referencedRelation: "route_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      units_of_measure: {
        Row: {
          allows_decimals: boolean
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          allows_decimals?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          allows_decimals?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          agent_functions: Database["public"]["Enums"]["agent_function_type"][]
          auth_user_id: string
          avatar_path: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          identity_document_path: string | null
          is_active: boolean
          last_name: string
          phone: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_profile_type"]
        }
        Insert: {
          agent_functions?: Database["public"]["Enums"]["agent_function_type"][]
          auth_user_id: string
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          first_name: string
          id?: string
          identity_document_path?: string | null
          is_active?: boolean
          last_name: string
          phone?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_profile_type"]
        }
        Update: {
          agent_functions?: Database["public"]["Enums"]["agent_function_type"][]
          auth_user_id?: string
          avatar_path?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          first_name?: string
          id?: string
          identity_document_path?: string | null
          is_active?: boolean
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_type?: Database["public"]["Enums"]["user_profile_type"]
        }
        Relationships: []
      }
      vehicle_expense_attachments: {
        Row: {
          attachment_type: Database["public"]["Enums"]["expense_attachment_type"]
          created_at: string
          expense_id: string
          file_name: string
          id: string
          mime_type: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          attachment_type: Database["public"]["Enums"]["expense_attachment_type"]
          created_at?: string
          expense_id: string
          file_name: string
          id?: string
          mime_type: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          attachment_type?: Database["public"]["Enums"]["expense_attachment_type"]
          created_at?: string
          expense_id?: string
          file_name?: string
          id?: string
          mime_type?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expense_attachments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "vehicle_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expense_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_expenses: {
        Row: {
          agent_id: string
          amount: number
          created_at: string
          created_by: string | null
          description: string | null
          expense_category_id: string
          expense_date: string
          id: string
          invoice_available: boolean
          merchant_name: string | null
          notes: string | null
          status: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          agent_id: string
          amount: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id: string
          expense_date: string
          id?: string
          invoice_available?: boolean
          merchant_name?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          agent_id?: string
          amount?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          expense_category_id?: string
          expense_date?: string
          id?: string
          invoice_available?: boolean
          merchant_name?: string | null
          notes?: string | null
          status?: Database["public"]["Enums"]["travel_expense_status_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_expenses_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_expense_category_id_fkey"
            columns: ["expense_category_id"]
            isOneToOne: false
            referencedRelation: "expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_expenses_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_makes: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      vehicle_models: {
        Row: {
          created_at: string
          generation: string | null
          id: string
          is_active: boolean
          make_id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          generation?: string | null
          id?: string
          is_active?: boolean
          make_id: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          generation?: string | null
          id?: string
          is_active?: boolean
          make_id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_locations: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_id: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      current_product_prices: {
        Row: {
          amount: number | null
          currency: string | null
          discount_percentage: number | null
          id: string | null
          price_list_code: string | null
          price_list_id: string | null
          price_list_name: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          valid_from: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_available: {
        Row: {
          availability_status: string | null
          available_quantity: number | null
          id: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          product_brand: string | null
          product_category: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reorder_point: number | null
          reserved_quantity: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      low_stock_products: {
        Row: {
          availability_status: string | null
          available_quantity: number | null
          id: string | null
          location_code: string | null
          location_id: string | null
          location_name: string | null
          maximum_stock: number | null
          minimum_stock: number | null
          product_brand: string | null
          product_category: string | null
          product_code: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          reorder_point: number | null
          reserved_quantity: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "warehouse_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_search"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_stock_summary"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_search: {
        Row: {
          barcode: string | null
          brand: string | null
          category: string | null
          code: string | null
          description: string | null
          id: string | null
          image_url: string | null
          is_new: boolean | null
          name: string | null
          references: string[] | null
          status: Database["public"]["Enums"]["product_status"] | null
        }
        Relationships: []
      }
      product_stock_summary: {
        Row: {
          brand: string | null
          code: string | null
          name: string | null
          product_id: string | null
          total_available: number | null
          total_quantity: number | null
          total_reserved: number | null
        }
        Relationships: []
      }
      route_trip_financial_summary: {
        Row: {
          agent_id: string | null
          approved_expenses: number | null
          balance: number | null
          budget_amount: number | null
          pending_expenses: number | null
          rejected_expenses: number | null
          route_code: string | null
          route_name: string | null
          route_trip_id: string | null
          route_trip_status:
            | Database["public"]["Enums"]["route_trip_status_type"]
            | null
          settlement_type:
            | Database["public"]["Enums"]["settlement_type_enum"]
            | null
          total_expenses: number | null
          vehicle_id: string | null
          week_end_date: string | null
          week_start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "route_trips_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "fleet_vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_or_update_product_full:
        | {
            Args: {
              p_barcode: string
              p_brand_id: string
              p_category_id: string
              p_code: string
              p_description: string
              p_inventory: Json
              p_name: string
              p_prices: Json
              p_product_id: string
              p_status: string
              p_unit_of_measure_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_barcode: string
              p_brand_id: string
              p_category_id: string
              p_code: string
              p_description: string
              p_fitments?: Json
              p_inventory: Json
              p_name: string
              p_prices: Json
              p_product_id: string
              p_status: string
              p_unit_of_measure_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_barcode: string
              p_brand_id: string
              p_category_id: string
              p_code: string
              p_description: string
              p_fitments?: Json
              p_image_url?: string
              p_inventory: Json
              p_name: string
              p_prices: Json
              p_product_id: string
              p_status: string
              p_unit_of_measure_id: string
            }
            Returns: string
          }
      current_user_is_active: { Args: never; Returns: boolean }
      current_user_is_admin: { Args: never; Returns: boolean }
      current_user_profile_id: { Args: never; Returns: string }
      process_inventory_movement: {
        Args: {
          p_created_by?: string
          p_movement_type: Database["public"]["Enums"]["inventory_movement_type"]
          p_notes?: string
          p_product_id: string
          p_quantity: number
          p_reference_id?: string
          p_reference_type?: string
          p_warehouse_id: string
        }
        Returns: string
      }
      process_inventory_transfer: {
        Args: { p_created_by?: string; p_transfer_id: string }
        Returns: boolean
      }
      update_current_user_avatar: {
        Args: { next_avatar_path: string }
        Returns: {
          agent_functions: Database["public"]["Enums"]["agent_function_type"][]
          auth_user_id: string
          avatar_path: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          identity_document_path: string | null
          is_active: boolean
          last_name: string
          phone: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_profile_type"]
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      update_current_user_profile: {
        Args: {
          next_avatar_path: string
          next_first_name: string
          next_identity_document_path: string
          next_last_name: string
          next_phone: string
        }
        Returns: {
          agent_functions: Database["public"]["Enums"]["agent_function_type"][]
          auth_user_id: string
          avatar_path: string | null
          created_at: string
          created_by: string | null
          email: string
          first_name: string
          id: string
          identity_document_path: string | null
          is_active: boolean
          last_name: string
          phone: string | null
          updated_at: string
          user_type: Database["public"]["Enums"]["user_profile_type"]
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      agent_function_type: "DRIVER" | "SALESPERSON" | "WAREHOUSE"
      catalog_import_item_status: "PENDING" | "PROCESSED" | "SKIPPED" | "ERROR"
      catalog_import_status:
        | "PENDING"
        | "PROCESSING"
        | "COMPLETED"
        | "COMPLETED_WITH_ERRORS"
        | "FAILED"
      expense_attachment_type: "RECEIPT" | "INVOICE" | "PHOTO" | "OTHER"
      inventory_movement_type:
        | "PURCHASE"
        | "SALE"
        | "RETURN_IN"
        | "RETURN_OUT"
        | "TRANSFER_IN"
        | "TRANSFER_OUT"
        | "ADJUSTMENT_IN"
        | "ADJUSTMENT_OUT"
        | "INITIAL_STOCK"
      product_status: "ACTIVE" | "INACTIVE" | "DISCONTINUED"
      purchase_order_status:
        | "DRAFT"
        | "ORDERED"
        | "PARTIALLY_RECEIVED"
        | "RECEIVED"
        | "CANCELLED"
      reservation_status: "ACTIVE" | "CONSUMED" | "RELEASED" | "EXPIRED"
      route_trip_status_type:
        | "PLANNED"
        | "ASSIGNED"
        | "IN_PROGRESS"
        | "COMPLETED"
        | "UNDER_REVIEW"
        | "SETTLED"
        | "CANCELLED"
      settlement_status_type: "PENDING" | "APPROVED" | "SETTLED" | "CANCELLED"
      settlement_transaction_type: "CASH_RETURN" | "REIMBURSEMENT"
      settlement_type_enum:
        | "BALANCED"
        | "AGENT_RETURNS_CASH"
        | "COMPANY_REIMBURSES"
      travel_expense_status_type:
        | "DRAFT"
        | "SUBMITTED"
        | "APPROVED"
        | "REJECTED"
        | "REQUIRES_INFORMATION"
      user_profile_type: "CUSTOMER" | "AGENT" | "ADMIN"
      vehicle_status_type:
        | "AVAILABLE"
        | "ASSIGNED"
        | "MAINTENANCE"
        | "OUT_OF_SERVICE"
        | "INACTIVE"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      agent_function_type: ["DRIVER", "SALESPERSON", "WAREHOUSE"],
      catalog_import_item_status: ["PENDING", "PROCESSED", "SKIPPED", "ERROR"],
      catalog_import_status: [
        "PENDING",
        "PROCESSING",
        "COMPLETED",
        "COMPLETED_WITH_ERRORS",
        "FAILED",
      ],
      expense_attachment_type: ["RECEIPT", "INVOICE", "PHOTO", "OTHER"],
      inventory_movement_type: [
        "PURCHASE",
        "SALE",
        "RETURN_IN",
        "RETURN_OUT",
        "TRANSFER_IN",
        "TRANSFER_OUT",
        "ADJUSTMENT_IN",
        "ADJUSTMENT_OUT",
        "INITIAL_STOCK",
      ],
      product_status: ["ACTIVE", "INACTIVE", "DISCONTINUED"],
      purchase_order_status: [
        "DRAFT",
        "ORDERED",
        "PARTIALLY_RECEIVED",
        "RECEIVED",
        "CANCELLED",
      ],
      reservation_status: ["ACTIVE", "CONSUMED", "RELEASED", "EXPIRED"],
      route_trip_status_type: [
        "PLANNED",
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "UNDER_REVIEW",
        "SETTLED",
        "CANCELLED",
      ],
      settlement_status_type: ["PENDING", "APPROVED", "SETTLED", "CANCELLED"],
      settlement_transaction_type: ["CASH_RETURN", "REIMBURSEMENT"],
      settlement_type_enum: [
        "BALANCED",
        "AGENT_RETURNS_CASH",
        "COMPANY_REIMBURSES",
      ],
      travel_expense_status_type: [
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
        "REQUIRES_INFORMATION",
      ],
      user_profile_type: ["CUSTOMER", "AGENT", "ADMIN"],
      vehicle_status_type: [
        "AVAILABLE",
        "ASSIGNED",
        "MAINTENANCE",
        "OUT_OF_SERVICE",
        "INACTIVE",
      ],
    },
  },
} as const
