import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Package, DollarSign, Truck, Link, Globe, MapPin, Warehouse, Calculator, Scale, Hash, Boxes } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PurchaseItem {
  id: string;
  item_name: string;
  product_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  quantity: number;
  unit_cost: number;
  item_fees: number;
  weight_kg: number;
  sku: string;
}

interface GlobalFee {
  id: string;
  name: string;
  amount: number;
}

const PURCHASE_TYPES = [
  "Toys",
  "Components",
  "Machines",
  "Parts",
  "Supplies",
  "Other",
];

const FEE_DISTRIBUTION_METHODS = [
  { value: "by_value", label: "By Value", icon: DollarSign, description: "Proportional to item cost" },
  { value: "by_quantity", label: "By Quantity", icon: Hash, description: "Equal per unit" },
  { value: "by_weight", label: "By Weight", icon: Scale, description: "Based on item weight" },
];

export default function NewPurchase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Order Details
  const [orderType, setOrderType] = useState<"local" | "import">("local");
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseType, setPurchaseType] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [newWarehouseName, setNewWarehouseName] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Fee Distribution
  const [feeDistributionMethod, setFeeDistributionMethod] = useState<string>("by_value");

  // Global Fees
  const [globalFees, setGlobalFees] = useState<GlobalFee[]>([
    { id: "shipping", name: "Shipping", amount: 0 },
  ]);

  // Local Tax (for local orders)
  const [localTaxRate, setLocalTaxRate] = useState<string>("0");

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: crypto.randomUUID(), item_name: "", product_id: null, category_id: null, subcategory_id: null, quantity: 1, unit_cost: 0, item_fees: 0, weight_kg: 0, sku: "" },
  ]);

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

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: warehouses, refetch: refetchWarehouses } = useQuery({
    queryKey: ["warehouses", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouses")
        .select("id, name")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: products } = useQuery({
    queryKey: ["products", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, product_name, cogs, product_type, weight_kg, sku")
        .eq("company_id", profile?.company_id)
        .order("product_name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: subcategories } = useQuery({
    queryKey: ["subcategories", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("product_subcategories")
        .select("id, name, code, category_id")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Calculations
  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  }, [items]);

  const itemFeesTotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.item_fees, 0);
  }, [items]);

  const globalFeesTotal = useMemo(() => {
    return globalFees.reduce((sum, fee) => sum + fee.amount, 0);
  }, [globalFees]);

  const totalWeight = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.weight_kg * item.quantity), 0);
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const localTaxAmount = useMemo(() => {
    if (orderType !== "local") return 0;
    return itemsSubtotal * (parseFloat(localTaxRate || "0") / 100);
  }, [orderType, itemsSubtotal, localTaxRate]);

  const totalCost = useMemo(() => {
    return itemsSubtotal + itemFeesTotal + globalFeesTotal + localTaxAmount;
  }, [itemsSubtotal, itemFeesTotal, globalFeesTotal, localTaxAmount]);

  // Calculate landed cost per item based on distribution method
  const calculateLandedCosts = useMemo(() => {
    return items.map(item => {
      const itemValue = item.quantity * item.unit_cost;
      const itemWeight = item.weight_kg * item.quantity;
      let distributedFees = 0;

      if (feeDistributionMethod === "by_value" && itemsSubtotal > 0) {
        distributedFees = (itemValue / itemsSubtotal) * globalFeesTotal;
      } else if (feeDistributionMethod === "by_quantity" && totalQuantity > 0) {
        distributedFees = (item.quantity / totalQuantity) * globalFeesTotal;
      } else if (feeDistributionMethod === "by_weight" && totalWeight > 0) {
        distributedFees = (itemWeight / totalWeight) * globalFeesTotal;
      }

      const landedCost = itemValue + item.item_fees + distributedFees;
      const landedCostPerUnit = item.quantity > 0 ? landedCost / item.quantity : 0;

      return {
        ...item,
        distributedFees,
        landedCost,
        landedCostPerUnit,
      };
    });
  }, [items, feeDistributionMethod, itemsSubtotal, totalQuantity, totalWeight, globalFeesTotal]);

  // Generate SKU based on category and subcategory
  const generateSKU = (categoryId: string | null, subcategoryId: string | null, productType: string) => {
    const category = categories?.find(c => c.id === categoryId);
    const subcategory = subcategories?.find(s => s.id === subcategoryId);
    
    const catCode = category?.name?.substring(0, 2).toUpperCase() || "XX";
    const subCode = subcategory?.code || subcategory?.name?.substring(0, 2).toUpperCase() || "XX";
    const typeCode = productType?.substring(0, 4).toUpperCase() || "PROD";
    
    return `${catCode}-${subCode}-${typeCode}-${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`;
  };

  // Item management
  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), item_name: "", product_id: null, category_id: null, subcategory_id: null, quantity: 1, unit_cost: 0, item_fees: 0, weight_kg: 0, sku: "" },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof PurchaseItem, value: string | number | null) => {
    setItems(
      items.map((item) => {
        if (item.id !== id) return item;
        
        // If selecting a product, auto-fill fields
        if (field === "product_id" && value) {
          const product = products?.find((p) => p.id === value);
          if (product) {
            return {
              ...item,
              product_id: value as string,
              item_name: product.product_name,
              unit_cost: Number(product.cogs) || item.unit_cost,
              weight_kg: Number(product.weight_kg) || 0,
              sku: product.sku || "",
            };
          }
        }

        // Auto-generate SKU when category/subcategory changes
        if (field === "category_id" || field === "subcategory_id") {
          const newCategoryId = field === "category_id" ? value as string : item.category_id;
          const newSubcategoryId = field === "subcategory_id" ? value as string : item.subcategory_id;
          const sku = generateSKU(newCategoryId, newSubcategoryId, purchaseType);
          return { ...item, [field]: value, sku };
        }
        
        return { ...item, [field]: value };
      })
    );
  };

  // Global fee management
  const addGlobalFee = () => {
    setGlobalFees([
      ...globalFees,
      { id: crypto.randomUUID(), name: "", amount: 0 },
    ]);
  };

  const removeGlobalFee = (id: string) => {
    setGlobalFees(globalFees.filter((fee) => fee.id !== id));
  };

  const updateGlobalFee = (id: string, field: keyof GlobalFee, value: string | number) => {
    setGlobalFees(
      globalFees.map((fee) =>
        fee.id === id ? { ...fee, [field]: value } : fee
      )
    );
  };

  // Create warehouse on the fly
  const createWarehouse = async () => {
    if (!profile?.company_id || !newWarehouseName.trim()) return;
    
    const { data, error } = await supabase
      .from("warehouses")
      .insert({
        company_id: profile.company_id,
        name: newWarehouseName.trim(),
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating warehouse", description: error.message, variant: "destructive" });
      return;
    }

    await refetchWarehouses();
    setWarehouseId(data.id);
    setNewWarehouseName("");
    toast({ title: "Warehouse created" });
  };

  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company ID");
      if (!supplierId) throw new Error("Please select a supplier");
      if (!purchaseType) throw new Error("Please select a purchase type");
      if (!warehouseId) throw new Error("Please select a warehouse destination");
      if (items.some((item) => !item.item_name.trim())) {
        throw new Error("All items must have a name");
      }

      // Create the purchase
      const { data: purchase, error: purchaseError } = await supabase
        .from("purchases")
        .insert({
          company_id: profile.company_id,
          supplier_id: supplierId,
          purchase_type: purchaseType,
          destination: warehouses?.find(w => w.id === warehouseId)?.name || "Warehouse",
          warehouse_id: warehouseId,
          order_type: orderType,
          fee_distribution_method: feeDistributionMethod,
          purchase_date: purchaseDate,
          shipping_cost: globalFees.find(f => f.name.toLowerCase() === "shipping")?.amount || 0,
          customs_fees: globalFees.find(f => f.name.toLowerCase().includes("customs"))?.amount || 0,
          handling_fees: globalFees.find(f => f.name.toLowerCase().includes("handling"))?.amount || 0,
          duties_taxes: orderType === "import" ? globalFees.filter(f => !["shipping", "customs", "handling"].some(n => f.name.toLowerCase().includes(n))).reduce((sum, f) => sum + f.amount, 0) : 0,
          local_tax_rate: orderType === "local" ? parseFloat(localTaxRate || "0") : 0,
          total_cost: totalCost,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items with landed costs
      const purchaseItems = calculateLandedCosts
        .filter((item) => item.item_name.trim())
        .map((item) => ({
          company_id: profile.company_id,
          purchase_id: purchase.id,
          item_name: item.item_name.trim(),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
          item_fees: item.item_fees,
          weight_kg: item.weight_kg,
          landed_cost: item.landedCostPerUnit,
        }));

      if (purchaseItems.length > 0) {
        const { error: itemsError } = await supabase
          .from("purchase_items")
          .insert(purchaseItems);
        if (itemsError) throw itemsError;
      }

      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchases"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({ title: "Purchase created successfully" });
      navigate("/purchases");
    },
    onError: (error: Error) => {
      toast({
        title: "Error creating purchase",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const isFormValid =
    supplierId &&
    purchaseType &&
    warehouseId &&
    items.every((item) => item.item_name.trim());

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">New Purchase Order</h1>
            <p className="text-sm text-muted-foreground">Create a purchase with landed cost tracking</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Type Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Order Type
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={orderType} onValueChange={(v) => setOrderType(v as "local" | "import")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="local" className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Local Purchase
                    </TabsTrigger>
                    <TabsTrigger value="import" className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Import Purchase
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="local" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Local purchases include VAT/IVA tax calculations applied to line items.
                    </p>
                  </TabsContent>
                  <TabsContent value="import" className="mt-4">
                    <p className="text-sm text-muted-foreground">
                      Import purchases include customs, duties, and international shipping fees.
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Purchase Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  Purchase Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supplier">Supplier *</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers?.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchaseType">Purchase Type *</Label>
                    <Select value={purchaseType} onValueChange={setPurchaseType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {PURCHASE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warehouse">Warehouse Destination *</Label>
                    <div className="flex gap-2">
                      <Select value={warehouseId} onValueChange={setWarehouseId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select warehouse" />
                        </SelectTrigger>
                        <SelectContent>
                          {warehouses?.map((warehouse) => (
                            <SelectItem key={warehouse.id} value={warehouse.id}>
                              <span className="flex items-center gap-2">
                                <Warehouse className="h-4 w-4" />
                                {warehouse.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Create new warehouse inline */}
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Or create new warehouse..."
                        value={newWarehouseName}
                        onChange={(e) => setNewWarehouseName(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={createWarehouse}
                        disabled={!newWarehouseName.trim()}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="purchaseDate">Purchase Date</Label>
                    <Input
                      id="purchaseDate"
                      type="date"
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Purchase Items */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Boxes className="h-5 w-5 text-primary" />
                  Items
                </CardTitle>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                  <Link className="h-3 w-3" />
                  Link items to products to automatically update warehouse inventory
                </div>
                
                {items.map((item, index) => {
                  const landedData = calculateLandedCosts[index];
                  const filteredSubcategories = subcategories?.filter(s => s.category_id === item.category_id) || [];
                  
                  return (
                    <div
                      key={item.id}
                      className="space-y-3 p-4 bg-muted/30 rounded-lg border"
                    >
                      {/* Product Link or Manual Entry */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground flex items-center gap-1">
                            <Link className="h-3 w-3" />
                            Link to Product
                          </Label>
                          <Select
                            value={item.product_id || "none"}
                            onValueChange={(value) =>
                              updateItem(item.id, "product_id", value === "none" ? null : value)
                            }
                          >
                            <SelectTrigger className={item.product_id ? "border-primary/50 bg-primary/5" : ""}>
                              <SelectValue placeholder="Select or create new" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Create new item</SelectItem>
                              {products?.map((product) => (
                                <SelectItem key={product.id} value={product.id}>
                                  {product.product_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {!item.product_id && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Category</Label>
                            <Select
                              value={item.category_id || "none"}
                              onValueChange={(value) =>
                                updateItem(item.id, "category_id", value === "none" ? null : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No category</SelectItem>
                                {categories?.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {!item.product_id && item.category_id && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Sub-Category</Label>
                            <Select
                              value={item.subcategory_id || "none"}
                              onValueChange={(value) =>
                                updateItem(item.id, "subcategory_id", value === "none" ? null : value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select sub-category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No sub-category</SelectItem>
                                {filteredSubcategories.map((sub) => (
                                  <SelectItem key={sub.id} value={sub.id}>
                                    {sub.name} ({sub.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {item.sku && (
                            <div className="space-y-1">
                              <Label className="text-xs text-muted-foreground">Generated SKU</Label>
                              <div className="h-10 flex items-center px-3 bg-muted border rounded-md">
                                <Badge variant="secondary" className="font-mono">
                                  {item.sku}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Main item fields */}
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-12 md:col-span-4 space-y-1">
                          <Label className="text-xs text-muted-foreground">Item Name *</Label>
                          <Input
                            placeholder="Item name"
                            value={item.item_name}
                            onChange={(e) =>
                              updateItem(item.id, "item_name", e.target.value)
                            }
                            disabled={!!item.product_id}
                            className={item.product_id ? "bg-muted" : ""}
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Qty</Label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(item.id, "quantity", parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <div className="col-span-4 md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Unit Cost</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_cost}
                            onChange={(e) =>
                              updateItem(item.id, "unit_cost", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="col-span-3 md:col-span-2 space-y-1">
                          <Label className="text-xs text-muted-foreground">Weight (kg)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.weight_kg}
                            onChange={(e) =>
                              updateItem(item.id, "weight_kg", parseFloat(e.target.value) || 0)
                            }
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            disabled={items.length === 1}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Item-specific fees */}
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Item Fees</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.item_fees}
                            onChange={(e) =>
                              updateItem(item.id, "item_fees", parseFloat(e.target.value) || 0)
                            }
                            placeholder="0.00"
                          />
                        </div>
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Line Total</Label>
                          <div className="h-10 flex items-center px-3 bg-background border rounded-md text-sm font-medium">
                            ${(item.quantity * item.unit_cost).toFixed(2)}
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Distributed Fees</Label>
                          <div className="h-10 flex items-center px-3 bg-muted border rounded-md text-sm text-muted-foreground">
                            ${landedData?.distributedFees.toFixed(2) || "0.00"}
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground font-semibold">Landed Cost/Unit</Label>
                          <div className="h-10 flex items-center px-3 bg-primary/10 border border-primary/30 rounded-md text-sm font-bold text-primary">
                            ${landedData?.landedCostPerUnit.toFixed(2) || "0.00"}
                          </div>
                        </div>
                      </div>
                      
                      {item.product_id && (
                        <p className="text-xs text-primary">
                          ✓ This item will add {item.quantity} units to warehouse inventory
                        </p>
                      )}
                    </div>
                  );
                })}

                <div className="flex justify-end pt-2 border-t">
                  <div className="text-right space-y-1">
                    <div>
                      <span className="text-sm text-muted-foreground">Items Subtotal: </span>
                      <span className="font-semibold">${itemsSubtotal.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Total Weight: </span>
                      <span className="font-semibold">{totalWeight.toFixed(2)} kg</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Global Fees */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calculator className="h-5 w-5 text-primary" />
                    Global Fees
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    These fees will be distributed across all items
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addGlobalFee}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fee
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fee Distribution Method */}
                <div className="space-y-2">
                  <Label>Distribution Method</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {FEE_DISTRIBUTION_METHODS.map((method) => (
                      <Button
                        key={method.value}
                        type="button"
                        variant={feeDistributionMethod === method.value ? "default" : "outline"}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setFeeDistributionMethod(method.value)}
                      >
                        <method.icon className="h-4 w-4 mb-1" />
                        <span className="text-xs">{method.label}</span>
                      </Button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {FEE_DISTRIBUTION_METHODS.find(m => m.value === feeDistributionMethod)?.description}
                  </p>
                </div>

                {/* Fee List */}
                <div className="space-y-2">
                  {globalFees.map((fee) => (
                    <div key={fee.id} className="flex gap-2 items-center">
                      <Input
                        placeholder="Fee name (e.g., Shipping, Customs)"
                        value={fee.name}
                        onChange={(e) => updateGlobalFee(fee.id, "name", e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Amount"
                        value={fee.amount}
                        onChange={(e) => updateGlobalFee(fee.id, "amount", parseFloat(e.target.value) || 0)}
                        className="w-32"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeGlobalFee(fee.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Local Tax (only for local orders) */}
                {orderType === "local" && (
                  <div className="pt-4 border-t space-y-2">
                    <Label>Local Tax Rate (VAT/IVA) %</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={localTaxRate}
                      onChange={(e) => setLocalTaxRate(e.target.value)}
                      placeholder="0"
                      className="w-32"
                    />
                    {parseFloat(localTaxRate) > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Tax Amount: ${localTaxAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-2 border-t">
                  <div className="text-right">
                    <span className="text-sm text-muted-foreground">Total Global Fees: </span>
                    <span className="font-semibold">${globalFeesTotal.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cost Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Cost Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Items Subtotal</span>
                      <span className="font-medium">${itemsSubtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Item Fees</span>
                      <span className="font-medium">${itemFeesTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Global Fees</span>
                      <span className="font-medium">${globalFeesTotal.toFixed(2)}</span>
                    </div>
                    {orderType === "local" && parseFloat(localTaxRate) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Local Tax ({localTaxRate}%)</span>
                        <span className="font-medium">${localTaxAmount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Grand Total</span>
                      <span className="text-2xl font-bold text-primary">${totalCost.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="pt-4 space-y-2 text-xs text-muted-foreground border-t">
                    <div className="flex justify-between">
                      <span>Total Items</span>
                      <span>{items.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Quantity</span>
                      <span>{totalQuantity} units</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Weight</span>
                      <span>{totalWeight.toFixed(2)} kg</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Distribution Method</span>
                      <Badge variant="outline" className="text-xs">
                        {FEE_DISTRIBUTION_METHODS.find(m => m.value === feeDistributionMethod)?.label}
                      </Badge>
                    </div>
                  </div>

                  <Button
                    size="lg"
                    className="w-full"
                    onClick={() => createPurchaseMutation.mutate()}
                    disabled={!isFormValid || createPurchaseMutation.isPending}
                  >
                    {createPurchaseMutation.isPending ? "Creating..." : "Create Purchase"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
