export interface Account {
  id: string
  account_name: string
  account_type?: 'on_premise' | 'off_premise' | 'chain' | 'other' | null
  chain_name?: string | null
  address?: string | null
  street?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  latitude?: number | null
  longitude?: number | null
  region?: string | null
  distributor_rep?: string | null
  tier?: 'a' | 'b' | 'c' | null
  status: 'active' | 'prospect' | 'inactive' | 'lost'
  date_opened?: string | null
  notes?: string | null
  tags?: string[] | null
  vip_outlet_id?: string | null
  price?: number | null
  grocery_adjacency?: string | null
  placement_locations?: string[] | null
  pos_materials?: string[] | null
  red_inventory?: number | null
  white_inventory?: number | null
  rose_inventory?: number | null
  sku_count?: number | null
  is_multi_location?: boolean | null
  best_times_to_visit?: string | null
  is_top_100?: boolean | null
  tasting_needed?: boolean | null
  good_for_tastings?: string | null
  number_of_tastings?: number | null
  instagram?: string | null
  last_check_in?: string | null
  monday_item_id?: string | null
  monday_photo_floor_display?: string | null
  monday_photo_shelf?: string | null
  photo_floor_display?: string[] | null
  photo_shelf?: string[] | null
  pole_floor_install_date?: string | null
  assigned_to?: string | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  account_id: string
  first_name?: string | null
  last_name?: string | null
  title?: string | null
  email?: string | null
  phone?: string | null
  preferred_contact?: 'email' | 'phone' | 'text' | 'in_person' | null
  is_primary?: boolean
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  sku?: string | null
  product_name: string
  varietal?: string | null
  format?: string | null
  wholesale_price?: number | null
  suggested_retail?: number | null
  status: 'active' | 'seasonal' | 'discontinued'
  description?: string | null
  created_at: string
  updated_at: string
}

export interface AccountProduct {
  id: string
  account_id: string
  product_id: string
  status: 'active' | 'pending' | 'discontinued'
  date_placed?: string | null
  date_removed?: string | null
  notes?: string | null
  product?: Product
}

export interface Order {
  id: string
  account_id?: string | null
  vip_outlet_id?: string | null
  product_id?: string | null
  order_date: string
  nine_liter_equivs: number
  import_id?: string | null
  created_at: string
  product?: Product
}

export interface Visit {
  id: string
  account_id: string
  visited_by?: string | null
  visit_date: string
  visit_type?: 'merchandising' | 'sales_call' | 'check_in' | 'delivery' | null
  display_status?: string | null
  shelf_placement?: string | null
  competitor_notes?: string | null
  photos?: string[] | null
  notes?: string | null
  created_at: string
}

export interface ActivityLog {
  id: string
  account_id: string
  user_id?: string | null
  activity_type: 'note' | 'call' | 'email' | 'order' | 'visit' | 'status_change' | 'import'
  summary?: string | null
  details?: Record<string, unknown> | null
  created_at: string
}

export interface User {
  id: string
  full_name?: string | null
  email: string
  role: 'admin' | 'manager' | 'rep'
  assigned_states?: string[] | null
  created_at: string
}

export interface ImportRecord {
  id: string
  file_name?: string | null
  file_url?: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  total_rows?: number | null
  imported_rows: number
  error_rows: number
  error_log?: Record<string, unknown> | null
  imported_by?: string | null
  created_at: string
  completed_at?: string | null
}

export interface AuthUser {
  id: string
  email: string
  user_metadata?: Record<string, unknown>
}
