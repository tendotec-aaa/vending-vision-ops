import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Package2, DollarSign, TrendingUp, Boxes, RefreshCw, PackagePlus } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

const PRODUCT_TYPES = ["Toys", "Spare Parts", "Stickers", "Other"] as const;

export default function WarehouseProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [formData, setFormData] = useState({
    product_name: "",
    product_type: "" as typeof PRODUCT_TYPES[number] | "",
    product_type_other: "",
    product_category_id: "",
    cogs: "",
    quantity_bodega: "",
  });
  const [addStockData, setAddStockData] = useState({
    product_id: "",
    quantity: "",
    notes: "",
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

  const { data: products } = useQuery({
    queryKey: ["products", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, product_categories(name)")
        .eq("company_id", profile?.company_id)
        .order("product_name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

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

  const createProductMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("products").insert({
        product_name: data.product_name,
        product_type: data.product_type,
        product_type_other: data.product_type === "Other" ? data.product_type_other : null,
        product_category_id: data.product_category_id || null,
        cogs: parseFloat(data.cogs) || 0,
        quantity_bodega: parseInt(data.quantity_bodega) || 0,
        company_id: profile?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product added successfully" });
      setIsOpen(false);
      setFormData({ product_name: "", product_type: "", product_type_other: "", product_category_id: "", cogs: "", quantity_bodega: "" });
    },
    onError: (error) => {
      toast({ title: "Error adding product", description: error.message, variant: "destructive" });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("product_categories").insert({
        name,
        company_id: profile?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product_categories"] });
      toast({ title: "Category added successfully" });
      setIsCategoryOpen(false);
      setNewCategoryName("");
    },
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('recalculate_product_stats', {
        p_company_id: profile?.company_id
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Product stats recalculated successfully" });
    },
    onError: (error) => {
      toast({ title: "Error recalculating stats", description: error.message, variant: "destructive" });
    }
  });

  const addStockMutation = useMutation({
    mutationFn: async (data: typeof addStockData) => {
      const quantity = parseInt(data.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new Error("Please enter a valid quantity");
      }
      
      // Get current product quantities
      const { data: product, error: fetchError } = await supabase
        .from('products')
        .select('quantity_bodega, quantity_purchased')
        .eq('id', data.product_id)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Update with new quantities
      const { error: updateError } = await supabase
        .from('products')
        .update({
          quantity_bodega: (product?.quantity_bodega || 0) + quantity,
          quantity_purchased: (product?.quantity_purchased || 0) + quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.product_id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Stock added successfully" });
      setIsAddStockOpen(false);
      setAddStockData({ product_id: "", quantity: "", notes: "" });
    },
    onError: (error) => {
      toast({ title: "Error adding stock", description: error.message, variant: "destructive" });
    }
  });

  const filteredProducts = products?.filter((prod) => {
    const matchesSearch = prod.product_name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || prod.product_type === filterType;
    const matchesCategory = filterCategory === "all" || prod.product_category_id === filterCategory;
    return matchesSearch && matchesType && matchesCategory;
  });

  // Calculate summary statistics
  const summary = {
    totalProducts: filteredProducts?.length || 0,
    totalValue: filteredProducts?.reduce((sum, p) => sum + (p.quantity_bodega * Number(p.cogs)), 0) || 0,
    totalQuantity: filteredProducts?.reduce((sum, p) => sum + p.quantity_bodega, 0) || 0,
    totalSales: filteredProducts?.reduce((sum, p) => sum + Number(p.total_sales_amount), 0) || 0,
  };

  const exportToCSV = () => {
    if (!filteredProducts?.length) return;
    
    const headers = ["Product Name", "Type", "Category", "COGS", "Qty Bodega", "Qty Machines", "Qty Sold", "Total Value", "Total Sales", "Gross Profit", "Gross Margin %"];
    const rows = filteredProducts.map(p => {
      const totalValue = p.quantity_bodega * Number(p.cogs);
      const grossProfit = Number(p.total_sales_amount) - (p.quantity_sold * Number(p.cogs));
      const grossMargin = Number(p.total_sales_amount) > 0 ? (grossProfit / Number(p.total_sales_amount) * 100).toFixed(1) : "0";
      return [
        p.product_name,
        p.product_type === "Other" ? p.product_type_other : p.product_type,
        (p.product_categories as any)?.name || "",
        p.cogs,
        p.quantity_bodega,
        p.quantity_in_machines,
        p.quantity_sold,
        totalValue.toFixed(2),
        Number(p.total_sales_amount).toFixed(2),
        grossProfit.toFixed(2),
        grossMargin
      ];
    });
    
    const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "products_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Products</h1>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={recalculateMutation.isPending}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculateMutation.isPending ? 'animate-spin' : ''}`} />
                  Recalculate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recalculate Product Stats?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will recalculate all product statistics (In Machines, Sold, +/- Diff, Total Sales) 
                    based on current machine slots and movement history. Use this after a rollback or if 
                    stats appear incorrect.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => recalculateMutation.mutate()}>
                    Recalculate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={exportToCSV} disabled={!filteredProducts?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isAddStockOpen} onOpenChange={setIsAddStockOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">
                  <PackagePlus className="h-4 w-4 mr-2" />
                  Add Stock
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Stock to Bodega</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="stock_product">Product</Label>
                    <Select 
                      value={addStockData.product_id} 
                      onValueChange={(v) => setAddStockData({ ...addStockData, product_id: v })}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50 max-h-[300px]">
                        {products?.map(prod => (
                          <SelectItem key={prod.id} value={prod.id}>
                            {prod.product_name} (Current: {prod.quantity_bodega})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="stock_quantity">Quantity to Add</Label>
                    <Input
                      id="stock_quantity"
                      type="number"
                      min="1"
                      value={addStockData.quantity}
                      onChange={(e) => setAddStockData({ ...addStockData, quantity: e.target.value })}
                      placeholder="Enter quantity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="stock_notes">Notes (Optional)</Label>
                    <Textarea
                      id="stock_notes"
                      value={addStockData.notes}
                      onChange={(e) => setAddStockData({ ...addStockData, notes: e.target.value })}
                      placeholder="e.g., Purchase order #123, Supplier delivery"
                      rows={2}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => addStockMutation.mutate(addStockData)}
                    disabled={!addStockData.product_id || !addStockData.quantity || addStockMutation.isPending}
                  >
                    {addStockMutation.isPending ? "Adding..." : "Add Stock"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Product
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Product</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="product_name">Product Name</Label>
                    <Input
                      id="product_name"
                      value={formData.product_name}
                      onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                      placeholder="Enter product name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="product_type">Product Type</Label>
                    <Select value={formData.product_type} onValueChange={(v) => setFormData({ ...formData, product_type: v as typeof PRODUCT_TYPES[number] })}>
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
                  {formData.product_type === "Other" && (
                    <div>
                      <Label htmlFor="product_type_other">Specify Type</Label>
                      <Input
                        id="product_type_other"
                        value={formData.product_type_other}
                        onChange={(e) => setFormData({ ...formData, product_type_other: e.target.value })}
                        placeholder="Enter custom type"
                      />
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="category">Category (Optional)</Label>
                      <Button variant="ghost" size="sm" onClick={() => setIsCategoryOpen(true)}>
                        <Plus className="h-3 w-3 mr-1" />
                        New
                      </Button>
                    </div>
                    <Select value={formData.product_category_id} onValueChange={(v) => setFormData({ ...formData, product_category_id: v })}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-background z-50">
                        {categories?.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cogs">COGS ($)</Label>
                      <Input
                        id="cogs"
                        type="number"
                        step="0.01"
                        value={formData.cogs}
                        onChange={(e) => setFormData({ ...formData, cogs: e.target.value })}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <Label htmlFor="quantity_bodega">Qty in Bodega</Label>
                      <Input
                        id="quantity_bodega"
                        type="number"
                        value={formData.quantity_bodega}
                        onChange={(e) => setFormData({ ...formData, quantity_bodega: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    onClick={() => createProductMutation.mutate(formData)}
                    disabled={!formData.product_name || !formData.product_type || createProductMutation.isPending}
                  >
                    {createProductMutation.isPending ? "Adding..." : "Add Product"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Products</p>
                <p className="text-2xl font-bold">{summary.totalProducts}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Boxes className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Quantity</p>
                <p className="text-2xl font-bold">{summary.totalQuantity.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">${summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Sales</p>
                <p className="text-2xl font-bold">${summary.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="md:max-w-xs"
          />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="md:w-[180px] bg-background">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Types</SelectItem>
              {PRODUCT_TYPES.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="md:w-[180px] bg-background">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent className="bg-background z-50">
              <SelectItem value="all">All Categories</SelectItem>
              {categories?.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Products Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[200px]">Product Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">COGS</TableHead>
                    <TableHead className="text-right">Bodega</TableHead>
                    <TableHead className="text-right">In Machines</TableHead>
                    <TableHead className="text-right">Sold</TableHead>
                    <TableHead className="text-right">+/- Diff</TableHead>
                    <TableHead className="text-right">Total Value</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Gross Profit</TableHead>
                    <TableHead className="text-right">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => {
                    const totalValue = product.quantity_bodega * Number(product.cogs);
                    const grossProfit = Number(product.total_sales_amount) - (product.quantity_sold * Number(product.cogs));
                    const grossMargin = Number(product.total_sales_amount) > 0 
                      ? (grossProfit / Number(product.total_sales_amount) * 100).toFixed(1) 
                      : "0.0";
                    return (
                      <TableRow key={product.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/warehouse/products/${product.id}`)}>
                        <TableCell className="font-medium">{product.product_name}</TableCell>
                        <TableCell>
                          {product.product_type === "Other" ? product.product_type_other : product.product_type}
                        </TableCell>
                        <TableCell>{(product.product_categories as any)?.name || "-"}</TableCell>
                        <TableCell className="text-right">${Number(product.cogs).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{product.quantity_bodega}</TableCell>
                        <TableCell className="text-right">{product.quantity_in_machines}</TableCell>
                        <TableCell className="text-right">{product.quantity_sold}</TableCell>
                        <TableCell className={`text-right ${product.quantity_surplus_shortage > 0 ? "text-green-600" : product.quantity_surplus_shortage < 0 ? "text-red-600" : ""}`}>
                          {product.quantity_surplus_shortage > 0 ? "+" : ""}{product.quantity_surplus_shortage}
                        </TableCell>
                        <TableCell className="text-right">${totalValue.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${Number(product.total_sales_amount).toFixed(2)}</TableCell>
                        <TableCell className={`text-right ${grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          ${grossProfit.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">{grossMargin}%</TableCell>
                      </TableRow>
                    );
                  })}
                  {!filteredProducts?.length && (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                        No products found. Add your first product to get started.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* New Category Dialog */}
      <Dialog open={isCategoryOpen} onOpenChange={setIsCategoryOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category_name">Category Name</Label>
              <Input
                id="category_name"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g., Electronics, Capsules"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => createCategoryMutation.mutate(newCategoryName)}
              disabled={!newCategoryName || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <MobileNav />
    </div>
  );
}
