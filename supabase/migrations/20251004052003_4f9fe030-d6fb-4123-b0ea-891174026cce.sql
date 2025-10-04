-- Create tables for Route & Scheduling
CREATE TABLE public.routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.route_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL,
  location_id UUID NOT NULL,
  employee_id UUID,
  scheduled_date DATE NOT NULL,
  completed BOOLEAN DEFAULT false,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables for Maintenance & Service
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT,
  assigned_to UUID,
  status TEXT DEFAULT 'pending',
  cost NUMERIC,
  resolved_at TIMESTAMP WITH TIME ZONE,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables for Machines & Setups
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  serial_number TEXT NOT NULL,
  purchase_date DATE,
  purchase_cost NUMERIC,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.setups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  location_id UUID,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.setup_machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setup_id UUID NOT NULL,
  machine_id UUID NOT NULL,
  company_id UUID NOT NULL
);

-- Create tables for Warehouse Inventory
CREATE TABLE public.warehouse_components (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  landed_unit_cost NUMERIC NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.warehouse_finished_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  final_cogs NUMERIC NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables for Suppliers & Purchases
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL,
  purchase_type TEXT NOT NULL,
  destination TEXT NOT NULL,
  total_cost NUMERIC NOT NULL,
  shipping_cost NUMERIC DEFAULT 0,
  duties_taxes NUMERIC DEFAULT 0,
  purchase_date DATE NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC NOT NULL,
  company_id UUID NOT NULL
);

-- Create tables for Certifications & Compliance
CREATE TABLE public.certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cert_type TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  location_id UUID,
  machine_id UUID,
  expiration_date DATE NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables for Customer Feedback
CREATE TABLE public.customer_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location_id UUID NOT NULL,
  rating INTEGER,
  feedback_text TEXT,
  feedback_date DATE NOT NULL,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tables for Marketing & Promotions
CREATE TABLE public.marketing_promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  discount_amount NUMERIC,
  sales_lift NUMERIC,
  company_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setup_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_finished_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Routes
CREATE POLICY "Users can view routes in their company" ON public.routes FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage routes" ON public.routes FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Route Assignments
CREATE POLICY "Users can view assignments in their company" ON public.route_assignments FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage assignments" ON public.route_assignments FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Work Orders
CREATE POLICY "Users can view work orders in their company" ON public.work_orders FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage work orders" ON public.work_orders FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));
CREATE POLICY "Employees can update assigned work orders" ON public.work_orders FOR UPDATE USING (assigned_to = auth.uid());

-- RLS Policies for Machines
CREATE POLICY "Users can view machines in their company" ON public.machines FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage machines" ON public.machines FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Setups
CREATE POLICY "Users can view setups in their company" ON public.setups FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage setups" ON public.setups FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Setup Machines
CREATE POLICY "Users can view setup machines in their company" ON public.setup_machines FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage setup machines" ON public.setup_machines FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Warehouse Components
CREATE POLICY "Users can view components in their company" ON public.warehouse_components FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage components" ON public.warehouse_components FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Warehouse Finished Products
CREATE POLICY "Users can view finished products in their company" ON public.warehouse_finished_products FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage finished products" ON public.warehouse_finished_products FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Suppliers
CREATE POLICY "Users can view suppliers in their company" ON public.suppliers FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage suppliers" ON public.suppliers FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Purchases
CREATE POLICY "Users can view purchases in their company" ON public.purchases FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage purchases" ON public.purchases FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Purchase Items
CREATE POLICY "Users can view purchase items in their company" ON public.purchase_items FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage purchase items" ON public.purchase_items FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Certifications
CREATE POLICY "Users can view certifications in their company" ON public.certifications FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage certifications" ON public.certifications FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- RLS Policies for Customer Feedback
CREATE POLICY "Users can view feedback in their company" ON public.customer_feedback FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Users can create feedback" ON public.customer_feedback FOR INSERT WITH CHECK (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- RLS Policies for Marketing Promotions
CREATE POLICY "Users can view promotions in their company" ON public.marketing_promotions FOR SELECT USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY "Admins can manage promotions" ON public.marketing_promotions FOR ALL USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Add updated_at triggers
CREATE TRIGGER update_routes_updated_at BEFORE UPDATE ON public.routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouse_components_updated_at BEFORE UPDATE ON public.warehouse_components FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_warehouse_finished_products_updated_at BEFORE UPDATE ON public.warehouse_finished_products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();