import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Package2, 
  DollarSign, 
  TrendingUp, 
  Boxes,
  ShoppingCart,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
  Calendar,
  Pencil
} from "lucide-react";
import { format } from "date-fns";

const PRODUCT_TYPES = ["Toys", "Spare Parts", "Stickers", "Other"] as const;

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    product_name: "",
    product_type: "" as typeof PRODUCT_TYPES[number] | "",
    product_type_other: "",
    product_category_id: "",
    cogs: "",
    quantity_bodega: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user?.id)
        .single();
      return data;
    },
  });

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["product_categories", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: typeof editForm) => {
      const { error } = await supabase
        .from("products")
        .update({
          product_name: data.product_name,
          product_type: data.product_type,
          product_type_other: data.product_type === "Other" ? data.product_type_other : null,
          product_category_id: data.product_category_id && data.product_category_id !== "none" ? data.product_category_id : null,
          cogs: parseFloat(data.cogs) || 0,
          quantity_bodega: parseInt(data.quantity_bodega) || 0,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", id] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product updated successfully" });
      setIsEditOpen(false);
    },
    onError: (error) => {
      toast({ title: "Error updating product", description: error.message, variant: "destructive" });
    }
  });

  // Populate edit form when product loads
  useEffect(() => {
    if (product) {
      setEditForm({
        product_name: product.product_name,
        product_type: product.product_type as typeof PRODUCT_TYPES[number],
        product_type_other: product.product_type_other || "",
        product_category_id: product.product_category_id || "",
        cogs: String(product.cogs),
        quantity_bodega: String(product.quantity_bodega),
      });
    }
  }, [product]);

  // Fetch visit report stock history for this product (sales/inventory movements)
  const { data: stockHistory } = useQuery({
    queryKey: ["product_stock_history", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("visit_report_stock")
        .select(`
          *,
          visit_reports(visit_date, location_id, locations(name))
        `)
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch purchase history for this product
  const { data: purchaseHistory } = useQuery({
    queryKey: ["product_purchases", id, profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_items")
        .select(`
          *,
          purchases(purchase_date, supplier_id, suppliers(name))
        `)
        .eq("company_id", profile?.company_id)
        .ilike("item_name", `%${product?.product_name}%`)
        .order("id", { ascending: false })
        .limit(50);
      return data || [];
    },
    enabled: !!profile?.company_id && !!product?.product_name,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading product...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const totalValue = product.quantity_bodega * Number(product.cogs);
  const grossProfit = Number(product.total_sales_amount) - (product.quantity_sold * Number(product.cogs));
  const grossMargin = Number(product.total_sales_amount) > 0 
    ? (grossProfit / Number(product.total_sales_amount) * 100).toFixed(1) 
    : "0.0";

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/warehouse/products")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl md:text-3xl font-bold">{product.product_name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {product.product_type === "Other" ? product.product_type_other : product.product_type}
              </Badge>
              {(product.product_categories as any)?.name && (
                <Badge variant="outline">{(product.product_categories as any).name}</Badge>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => setIsEditOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">COGS</p>
                  <p className="text-xl font-bold">${Number(product.cogs).toFixed(2)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Boxes className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">In Bodega</p>
                  <p className="text-xl font-bold">{product.quantity_bodega}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Package2 className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">In Machines</p>
                  <p className="text-xl font-bold">{product.quantity_in_machines}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <ShoppingCart className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total Sold</p>
                  <p className="text-xl font-bold">{product.quantity_sold}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Total Purchased</p>
                <p className="text-lg font-semibold">{product.quantity_purchased} units</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventory Value</p>
                <p className="text-lg font-semibold">${totalValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-lg font-semibold">${Number(product.total_sales_amount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Profit</p>
                <p className={`text-lg font-semibold ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  ${grossProfit.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Gross Margin</p>
                <p className="text-lg font-semibold">{grossMargin}%</p>
              </div>
            </div>
            {product.quantity_surplus_shortage !== 0 && (
              <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <span className="text-sm">
                  Inventory discrepancy: {product.quantity_surplus_shortage > 0 ? "+" : ""}{product.quantity_surplus_shortage} units
                  ({product.quantity_surplus_shortage > 0 ? "surplus" : "shortage"})
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Tabs */}
        <Tabs defaultValue="inventory" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventory">Inventory Movements</TabsTrigger>
            <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Inventory Movements</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="text-right">Sold</TableHead>
                        <TableHead className="text-right">Refilled</TableHead>
                        <TableHead className="text-right">Removed</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                        <TableHead className="text-right">Discrepancy</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockHistory?.map((record: any) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {record.visit_reports?.visit_date 
                                ? format(new Date(record.visit_reports.visit_date), "MMM d, yyyy")
                                : "-"}
                            </div>
                          </TableCell>
                          <TableCell>{record.visit_reports?.locations?.name || "-"}</TableCell>
                          <TableCell className="text-right">
                            {record.units_sold > 0 && (
                              <span className="flex items-center justify-end gap-1 text-red-600">
                                <ArrowDownCircle className="h-3 w-3" />
                                {record.units_sold}
                              </span>
                            )}
                            {!record.units_sold && "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {record.units_refilled > 0 && (
                              <span className="flex items-center justify-end gap-1 text-green-600">
                                <ArrowUpCircle className="h-3 w-3" />
                                {record.units_refilled}
                              </span>
                            )}
                            {!record.units_refilled && "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {record.units_removed > 0 && (
                              <span className="flex items-center justify-end gap-1 text-orange-600">
                                <ArrowDownCircle className="h-3 w-3" />
                                {record.units_removed}
                              </span>
                            )}
                            {!record.units_removed && "-"}
                          </TableCell>
                          <TableCell className="text-right font-medium">{record.current_stock}</TableCell>
                          <TableCell className={`text-right ${record.discrepancy > 0 ? "text-green-600" : record.discrepancy < 0 ? "text-red-600" : ""}`}>
                            {record.discrepancy !== 0 ? (record.discrepancy > 0 ? "+" : "") + record.discrepancy : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!stockHistory?.length && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No inventory movements recorded yet.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchases">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Purchase History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Unit Cost</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseHistory?.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              {item.purchases?.purchase_date 
                                ? format(new Date(item.purchases.purchase_date), "MMM d, yyyy")
                                : "-"}
                            </div>
                          </TableCell>
                          <TableCell>{item.purchases?.suppliers?.name || "-"}</TableCell>
                          <TableCell>{item.item_name}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${(item.quantity * Number(item.unit_cost)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {!purchaseHistory?.length && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            No purchase history found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Additional Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Product Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{format(new Date(product.created_at), "MMM d, yyyy")}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last Updated</p>
                <p className="font-medium">{format(new Date(product.updated_at), "MMM d, yyyy")}</p>
              </div>
              {product.last_product_purchase && (
                <div>
                  <p className="text-muted-foreground">Last Purchase</p>
                  <p className="font-medium">{format(new Date(product.last_product_purchase), "MMM d, yyyy")}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Product ID</p>
                <p className="font-mono text-xs">{product.id.slice(0, 8)}...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Product Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_product_name">Product Name</Label>
              <Input
                id="edit_product_name"
                value={editForm.product_name}
                onChange={(e) => setEditForm({ ...editForm, product_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_product_type">Product Type</Label>
              <Select 
                value={editForm.product_type} 
                onValueChange={(v) => setEditForm({ ...editForm, product_type: v as typeof PRODUCT_TYPES[number] })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  {PRODUCT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {editForm.product_type === "Other" && (
              <div>
                <Label htmlFor="edit_product_type_other">Specify Type</Label>
                <Input
                  id="edit_product_type_other"
                  value={editForm.product_type_other}
                  onChange={(e) => setEditForm({ ...editForm, product_type_other: e.target.value })}
                />
              </div>
            )}
            <div>
              <Label htmlFor="edit_category">Category (Optional)</Label>
              <Select 
                value={editForm.product_category_id} 
                onValueChange={(v) => setEditForm({ ...editForm, product_category_id: v })}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="none">No category</SelectItem>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_cogs">COGS ($)</Label>
                <Input
                  id="edit_cogs"
                  type="number"
                  step="0.01"
                  value={editForm.cogs}
                  onChange={(e) => setEditForm({ ...editForm, cogs: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_quantity_bodega">Qty in Bodega</Label>
                <Input
                  id="edit_quantity_bodega"
                  type="number"
                  value={editForm.quantity_bodega}
                  onChange={(e) => setEditForm({ ...editForm, quantity_bodega: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => updateMutation.mutate(editForm)}
                disabled={!editForm.product_name || !editForm.product_type || updateMutation.isPending}
              >
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
}
