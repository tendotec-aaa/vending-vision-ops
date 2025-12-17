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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      certifications: {
        Row: {
          cert_name: string
          cert_type: string
          company_id: string
          created_at: string
          expiration_date: string
          id: string
          location_id: string | null
          machine_id: string | null
        }
        Insert: {
          cert_name: string
          cert_type: string
          company_id: string
          created_at?: string
          expiration_date: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
        }
        Update: {
          cert_name?: string
          cert_type?: string
          company_id?: string
          created_at?: string
          expiration_date?: string
          id?: string
          location_id?: string | null
          machine_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          address: string | null
          company_email: string | null
          created_at: string
          id: string
          name: string
          phone_number: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name: string
          phone_number?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_email?: string | null
          created_at?: string
          id?: string
          name?: string
          phone_number?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      customer_feedback: {
        Row: {
          company_id: string
          created_at: string
          feedback_date: string
          feedback_text: string | null
          id: string
          location_id: string
          rating: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          feedback_date: string
          feedback_text?: string | null
          id?: string
          location_id: string
          rating?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          feedback_date?: string
          feedback_text?: string | null
          id?: string
          location_id?: string
          rating?: number | null
        }
        Relationships: []
      }
      location_spots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          location_id: string
          place_name: string | null
          setup_id: string | null
          spot_last_visit_report: string | null
          spot_last_visit_report_id: string | null
          spot_number: number
          spot_open_maintenance_tickets: number | null
          spot_start_date: string | null
          spot_total_rent: number | null
          spot_total_sales: number | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          location_id: string
          place_name?: string | null
          setup_id?: string | null
          spot_last_visit_report?: string | null
          spot_last_visit_report_id?: string | null
          spot_number: number
          spot_open_maintenance_tickets?: number | null
          spot_start_date?: string | null
          spot_total_rent?: number | null
          spot_total_sales?: number | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          location_id?: string
          place_name?: string | null
          setup_id?: string | null
          spot_last_visit_report?: string | null
          spot_last_visit_report_id?: string | null
          spot_number?: number
          spot_open_maintenance_tickets?: number | null
          spot_start_date?: string | null
          spot_total_rent?: number | null
          spot_total_sales?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_spots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_spots_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_spots_spot_last_visit_report_id_fkey"
            columns: ["spot_last_visit_report_id"]
            isOneToOne: false
            referencedRelation: "visit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          address: string | null
          company_id: string
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          hours_of_access: string | null
          id: string
          is_active: boolean | null
          is_prospect: boolean | null
          location_last_visit_report: string | null
          location_last_visit_report_id: string | null
          location_open_maintenance_tickets: number | null
          location_total_cogs: number | null
          location_total_rent: number | null
          location_total_sales: number | null
          name: string
          rent_amount: number | null
          rent_due_date: string | null
          start_date: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          company_id: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hours_of_access?: string | null
          id?: string
          is_active?: boolean | null
          is_prospect?: boolean | null
          location_last_visit_report?: string | null
          location_last_visit_report_id?: string | null
          location_open_maintenance_tickets?: number | null
          location_total_cogs?: number | null
          location_total_rent?: number | null
          location_total_sales?: number | null
          name: string
          rent_amount?: number | null
          rent_due_date?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          company_id?: string
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          hours_of_access?: string | null
          id?: string
          is_active?: boolean | null
          is_prospect?: boolean | null
          location_last_visit_report?: string | null
          location_last_visit_report_id?: string | null
          location_open_maintenance_tickets?: number | null
          location_total_cogs?: number | null
          location_total_rent?: number | null
          location_total_sales?: number | null
          name?: string
          rent_amount?: number | null
          rent_due_date?: string | null
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_location_last_visit_report_id_fkey"
            columns: ["location_last_visit_report_id"]
            isOneToOne: false
            referencedRelation: "visit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      machine_toy_slots: {
        Row: {
          company_id: string
          created_at: string
          id: string
          machine_id: string
          product_id: string | null
          slot_number: number
          toy_capacity: number | null
          toy_current_stock: number | null
          toy_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          machine_id: string
          product_id?: string | null
          slot_number: number
          toy_capacity?: number | null
          toy_current_stock?: number | null
          toy_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          machine_id?: string
          product_id?: string | null
          slot_number?: number
          toy_capacity?: number | null
          toy_current_stock?: number | null
          toy_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_toy_slots_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_toy_slots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_toy_slots_toy_id_fkey"
            columns: ["toy_id"]
            isOneToOne: false
            referencedRelation: "toys"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          company_id: string
          created_at: string
          id: string
          model: string | null
          purchase_cost: number | null
          purchase_date: string | null
          serial_number: string
          slots_per_machine: number
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          model?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number: string
          slots_per_machine?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          model?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          serial_number?: string
          slots_per_machine?: number
        }
        Relationships: []
      }
      marketing_promotions: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          discount_amount: number | null
          end_date: string
          id: string
          name: string
          sales_lift: number | null
          start_date: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          end_date: string
          id?: string
          name: string
          sales_lift?: number | null
          start_date: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          end_date?: string
          id?: string
          name?: string
          sales_lift?: number | null
          start_date?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          cogs: number
          company_id: string
          created_at: string
          id: string
          last_product_purchase: string | null
          product_category_id: string | null
          product_name: string
          product_type: string
          product_type_other: string | null
          quantity_bodega: number
          quantity_in_machines: number
          quantity_purchased: number
          quantity_sold: number
          quantity_surplus_shortage: number
          total_sales_amount: number
          updated_at: string
        }
        Insert: {
          cogs?: number
          company_id: string
          created_at?: string
          id?: string
          last_product_purchase?: string | null
          product_category_id?: string | null
          product_name: string
          product_type: string
          product_type_other?: string | null
          quantity_bodega?: number
          quantity_in_machines?: number
          quantity_purchased?: number
          quantity_sold?: number
          quantity_surplus_shortage?: number
          total_sales_amount?: number
          updated_at?: string
        }
        Update: {
          cogs?: number
          company_id?: string
          created_at?: string
          id?: string
          last_product_purchase?: string | null
          product_category_id?: string | null
          product_name?: string
          product_type?: string
          product_type_other?: string | null
          quantity_bodega?: number
          quantity_in_machines?: number
          quantity_purchased?: number
          quantity_sold?: number
          quantity_surplus_shortage?: number
          total_sales_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_product_category_id_fkey"
            columns: ["product_category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          company_id: string | null
          created_at: string
          email: string
          first_name: string | null
          id: string
          last_name: string | null
          phone_number: string | null
          updated_at: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          email: string
          first_name?: string | null
          id: string
          last_name?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          email?: string
          first_name?: string | null
          id?: string
          last_name?: string | null
          phone_number?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          company_id: string
          id: string
          item_name: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          company_id: string
          id?: string
          item_name: string
          purchase_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          company_id?: string
          id?: string
          item_name?: string
          purchase_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: []
      }
      purchases: {
        Row: {
          company_id: string
          created_at: string
          destination: string
          duties_taxes: number | null
          id: string
          purchase_date: string
          purchase_type: string
          shipping_cost: number | null
          supplier_id: string
          total_cost: number
        }
        Insert: {
          company_id: string
          created_at?: string
          destination: string
          duties_taxes?: number | null
          id?: string
          purchase_date: string
          purchase_type: string
          shipping_cost?: number | null
          supplier_id: string
          total_cost: number
        }
        Update: {
          company_id?: string
          created_at?: string
          destination?: string
          duties_taxes?: number | null
          id?: string
          purchase_date?: string
          purchase_type?: string
          shipping_cost?: number | null
          supplier_id?: string
          total_cost?: number
        }
        Relationships: []
      }
      route_assignments: {
        Row: {
          company_id: string
          completed: boolean | null
          created_at: string
          employee_id: string | null
          id: string
          location_id: string
          route_id: string
          scheduled_date: string
        }
        Insert: {
          company_id: string
          completed?: boolean | null
          created_at?: string
          employee_id?: string | null
          id?: string
          location_id: string
          route_id: string
          scheduled_date: string
        }
        Update: {
          company_id?: string
          completed?: boolean | null
          created_at?: string
          employee_id?: string | null
          id?: string
          location_id?: string
          route_id?: string
          scheduled_date?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      setup_machines: {
        Row: {
          company_id: string
          id: string
          machine_id: string
          position: string | null
          setup_id: string
        }
        Insert: {
          company_id: string
          id?: string
          machine_id: string
          position?: string | null
          setup_id: string
        }
        Update: {
          company_id?: string
          id?: string
          machine_id?: string
          position?: string | null
          setup_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "setup_machines_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setup_machines_setup_id_fkey"
            columns: ["setup_id"]
            isOneToOne: false
            referencedRelation: "setups"
            referencedColumns: ["id"]
          },
        ]
      }
      setups: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          setup_type: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          setup_type?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          setup_type?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          company_id: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      toy_movements: {
        Row: {
          company_id: string
          created_at: string
          id: string
          machine_id: string | null
          movement_type: string
          notes: string | null
          product_id: string | null
          quantity: number
          slot_number: number | null
          spot_id: string | null
          visit_report_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          machine_id?: string | null
          movement_type: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          slot_number?: number | null
          spot_id?: string | null
          visit_report_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          machine_id?: string | null
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          slot_number?: number | null
          spot_id?: string | null
          visit_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toy_movements_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toy_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toy_movements_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "location_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toy_movements_visit_report_id_fkey"
            columns: ["visit_report_id"]
            isOneToOne: false
            referencedRelation: "visit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      toys: {
        Row: {
          cogs: number
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          cogs: number
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          cogs?: number
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "toys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      visit_report_stock: {
        Row: {
          audited_count: number | null
          created_at: string
          current_stock: number
          discrepancy: number | null
          has_issue: boolean | null
          id: string
          is_replacing_toy: boolean | null
          issue_description: string | null
          issue_severity: string | null
          jam_type: string | null
          last_stock: number | null
          machine_id: string | null
          product_id: string | null
          removed_for_replacement: number | null
          replacement_toy_id: string | null
          slot_number: number | null
          toy_id: string | null
          units_refilled: number | null
          units_removed: number | null
          units_sold: number | null
          variance: number | null
          visit_report_id: string
        }
        Insert: {
          audited_count?: number | null
          created_at?: string
          current_stock: number
          discrepancy?: number | null
          has_issue?: boolean | null
          id?: string
          is_replacing_toy?: boolean | null
          issue_description?: string | null
          issue_severity?: string | null
          jam_type?: string | null
          last_stock?: number | null
          machine_id?: string | null
          product_id?: string | null
          removed_for_replacement?: number | null
          replacement_toy_id?: string | null
          slot_number?: number | null
          toy_id?: string | null
          units_refilled?: number | null
          units_removed?: number | null
          units_sold?: number | null
          variance?: number | null
          visit_report_id: string
        }
        Update: {
          audited_count?: number | null
          created_at?: string
          current_stock?: number
          discrepancy?: number | null
          has_issue?: boolean | null
          id?: string
          is_replacing_toy?: boolean | null
          issue_description?: string | null
          issue_severity?: string | null
          jam_type?: string | null
          last_stock?: number | null
          machine_id?: string | null
          product_id?: string | null
          removed_for_replacement?: number | null
          replacement_toy_id?: string | null
          slot_number?: number | null
          toy_id?: string | null
          units_refilled?: number | null
          units_removed?: number | null
          units_sold?: number | null
          variance?: number | null
          visit_report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_report_stock_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_report_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_report_stock_visit_report_id_fkey"
            columns: ["visit_report_id"]
            isOneToOne: false
            referencedRelation: "visit_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      visit_reports: {
        Row: {
          access_notes: string | null
          coin_box_notes: string | null
          company_id: string
          created_at: string
          employee_id: string | null
          general_notes: string | null
          has_observation: boolean | null
          id: string
          is_jammed: boolean | null
          is_signed: boolean | null
          jam_status: string | null
          location_id: string
          observation_text: string | null
          photo_url: string | null
          rent_calculated: number | null
          slot_performance_snapshot: Json | null
          spot_id: string | null
          time_in: string | null
          time_out: string | null
          total_cash_removed: number | null
          visit_date: string
          visit_type: string | null
        }
        Insert: {
          access_notes?: string | null
          coin_box_notes?: string | null
          company_id: string
          created_at?: string
          employee_id?: string | null
          general_notes?: string | null
          has_observation?: boolean | null
          id?: string
          is_jammed?: boolean | null
          is_signed?: boolean | null
          jam_status?: string | null
          location_id: string
          observation_text?: string | null
          photo_url?: string | null
          rent_calculated?: number | null
          slot_performance_snapshot?: Json | null
          spot_id?: string | null
          time_in?: string | null
          time_out?: string | null
          total_cash_removed?: number | null
          visit_date?: string
          visit_type?: string | null
        }
        Update: {
          access_notes?: string | null
          coin_box_notes?: string | null
          company_id?: string
          created_at?: string
          employee_id?: string | null
          general_notes?: string | null
          has_observation?: boolean | null
          id?: string
          is_jammed?: boolean | null
          is_signed?: boolean | null
          jam_status?: string | null
          location_id?: string
          observation_text?: string | null
          photo_url?: string | null
          rent_calculated?: number | null
          slot_performance_snapshot?: Json | null
          spot_id?: string | null
          time_in?: string | null
          time_out?: string | null
          total_cash_removed?: number | null
          visit_date?: string
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_reports_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_reports_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_reports_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "location_spots"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_components: {
        Row: {
          company_id: string
          created_at: string
          id: string
          landed_unit_cost: number
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          landed_unit_cost: number
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          landed_unit_cost?: number
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      warehouse_finished_products: {
        Row: {
          company_id: string
          created_at: string
          final_cogs: number
          id: string
          name: string
          quantity: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          final_cogs: number
          id?: string
          name: string
          quantity?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          final_cogs?: number
          id?: string
          name?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: []
      }
      work_orders: {
        Row: {
          assigned_to: string | null
          company_id: string
          cost: number | null
          created_at: string
          description: string | null
          id: string
          issue_type: string
          location_id: string
          resolved_at: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          issue_type: string
          location_id: string
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          issue_type?: string
          location_id?: string
          resolved_at?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "employee"
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
  public: {
    Enums: {
      app_role: ["admin", "employee"],
    },
  },
} as const
