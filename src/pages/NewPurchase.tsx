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
import { ArrowLeft, Plus, Trash2, Package, DollarSign, Truck, Link, Globe, MapPin, Warehouse, Calculator, Hash, Boxes, Box } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ItemFee {
  id: string;
  name: string;
  amount: number;
}

interface PurchaseItem {
  id: string;
  item_name: string;
  product_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  quantity: number;
  unit_cost: number;
  cbm: number;
  sku: string;
  fees: ItemFee[];
}

interface GlobalFee {
  id: string;
  name: string;
  amount: number;
  distribution_method: string;
}

const FEE_DISTRIBUTION_METHODS = [
  { value: "by_value", label: "By Value", icon: DollarSign, description: "Proportional to item cost" },
  { value: "by_quantity", label: "By Quantity", icon: Hash, description: "Equal per unit" },
  { value: "by_cbm", label: "By CBM", icon: Box, description: "Based on item CBM" },
];

export default function NewPurchase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Order Details
  const [orderType, setOrderType] = useState<"local" | "import">("local");
  const [supplierId, setSupplierId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [newWarehouseName, setNewWarehouseName] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );

  // Global Fees
  const [globalFees, setGlobalFees] = useState<GlobalFee[]>([
    { id: crypto.randomUUID(), name: "Shipping", amount: 0, distribution_method: "by_value" },
  ]);

  // Local Tax (for local orders)
  const [localTaxRate, setLocalTaxRate] = useState<string>("0");

  // Category creation
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState<Record<string, boolean>>({});

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: crypto.randomUUID(), item_name: "", product_id: null, category_id: null, subcategory_id: null, quantity: 1, unit_cost: 0, cbm: 0, sku: "", fees: [] },
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
        .select("id, product_name, cogs, product_type, cbm, sku")
        .eq("company_id", profile?.company_id)
        .order("product_name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: categories, refetch: refetchCategories } = useQuery({
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
    return items.reduce((sum, item) => sum + item.fees.reduce((feeSum, fee) => feeSum + fee.amount, 0), 0);
  }, [items]);

  const totalCBM = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.cbm * item.quantity), 0);
  }, [items]);

  const totalQuantity = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  }, [items]);

  const globalFeesTotal = useMemo(() => {
    return globalFees.reduce((sum, fee) => sum + fee.amount, 0);
  }, [globalFees]);

  const localTaxAmount = useMemo(() => {
    if (orderType !== "local") return 0;
    return itemsSubtotal * (parseFloat(localTaxRate || "0") / 100);
  }, [orderType, itemsSubtotal, localTaxRate]);

  const totalCost = useMemo(() => {
    return itemsSubtotal + itemFeesTotal + globalFeesTotal + localTaxAmount;
  }, [itemsSubtotal, itemFeesTotal, globalFeesTotal, localTaxAmount]);

  // Calculate distributed fees per item for each global fee independently
  const calculateDistributedFees = (item: PurchaseItem) => {
    const itemValue = item.quantity * item.unit_cost;
    const itemCBM = item.cbm * item.quantity;
    let totalDistributed = 0;

    for (const fee of globalFees) {
      if (fee.amount === 0) continue;
      
      if (fee.distribution_method === "by_value" && itemsSubtotal > 0) {
        totalDistributed += (itemValue / itemsSubtotal) * fee.amount;
      } else if (fee.distribution_method === "by_quantity" && totalQuantity > 0) {
        totalDistributed += (item.quantity / totalQuantity) * fee.amount;
      } else if (fee.distribution_method === "by_cbm" && totalCBM > 0) {
        totalDistributed += (itemCBM / totalCBM) * fee.amount;
      }
    }

    return totalDistributed;
  };

  // Calculate landed cost per item
  const calculateLandedCosts = useMemo(() => {
    return items.map(item => {
      const itemValue = item.quantity * item.unit_cost;
      const itemFeesSum = item.fees.reduce((sum, fee) => sum + fee.amount, 0);
      const distributedFees = calculateDistributedFees(item);
      const landedCost = itemValue + itemFeesSum + distributedFees;
      const landedCostPerUnit = item.quantity > 0 ? landedCost / item.quantity : 0;

      return {
        ...item,
        distributedFees,
        itemFeesSum,
        landedCost,
        landedCostPerUnit,
      };
    });
  }, [items, globalFees, itemsSubtotal, totalQuantity, totalCBM]);

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
      { id: crypto.randomUUID(), item_name: "", product_id: null, category_id: null, subcategory_id: null, quantity: 1, unit_cost: 0, cbm: 0, sku: "", fees: [] },
    ]);
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter((item) => item.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof Omit<PurchaseItem, 'fees'>, value: string | number | null) => {
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
              cbm: Number(product.cbm) || 0,
              sku: product.sku || "",
            };
          }
        }

        // Auto-generate SKU when category/subcategory changes
        if (field === "category_id" || field === "subcategory_id") {
          const newCategoryId = field === "category_id" ? value as string : item.category_id;
          const newSubcategoryId = field === "subcategory_id" ? value as string : item.subcategory_id;
          const sku = generateSKU(newCategoryId, newSubcategoryId, "PROD");
          return { ...item, [field]: value, sku };
        }
        
        return { ...item, [field]: value };
      })
    );
  };

  // Item fee management
  const addItemFee = (itemId: string) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        fees: [...item.fees, { id: crypto.randomUUID(), name: "", amount: 0 }]
      };
    }));
  };

  const removeItemFee = (itemId: string, feeId: string) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        fees: item.fees.filter(fee => fee.id !== feeId)
      };
    }));
  };

  const updateItemFee = (itemId: string, feeId: string, field: keyof ItemFee, value: string | number) => {
    setItems(items.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        fees: item.fees.map(fee => fee.id === feeId ? { ...fee, [field]: value } : fee)
      };
    }));
  };

  // Global fee management
  const addGlobalFee = () => {
    setGlobalFees([
      ...globalFees,
      { id: crypto.randomUUID(), name: "", amount: 0, distribution_method: "by_value" },
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

  // Create category on the fly
  const createCategory = async (itemId: string) => {
    if (!profile?.company_id || !newCategoryName.trim()) return;
    
    const { data, error } = await supabase
      .from("product_categories")
      .insert({
        company_id: profile.company_id,
        name: newCategoryName.trim(),
      })
      .select()
      .single();

    if (error) {
      toast({ title: "Error creating category", description: error.message, variant: "destructive" });
      return;
    }

    await refetchCategories();
    updateItem(itemId, "category_id", data.id);
    setNewCategoryName("");
    setCategoryPopoverOpen(prev => ({ ...prev, [itemId]: false }));
    toast({ title: "Category created" });
  };

  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company ID");
      if (!supplierId) throw new Error("Please select a supplier");
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
          purchase_type: orderType === "local" ? "Local Purchase" : "Import Purchase",
          destination: warehouses?.find(w => w.id === warehouseId)?.name || "Warehouse",
          warehouse_id: warehouseId,
          order_type: orderType,
          purchase_date: purchaseDate,
          local_tax_rate: orderType === "local" ? parseFloat(localTaxRate || "0") : 0,
          total_cost: totalCost,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create global fees
      const globalFeeRecords = globalFees
        .filter(fee => fee.name.trim() && fee.amount > 0)
        .map(fee => ({
          company_id: profile.company_id,
          purchase_id: purchase.id,
          fee_name: fee.name.trim(),
          amount: fee.amount,
          distribution_method: fee.distribution_method,
        }));

      if (globalFeeRecords.length > 0) {
        const { error: globalFeesError } = await supabase
          .from("purchase_global_fees")
          .insert(globalFeeRecords);
        if (globalFeesError) throw globalFeesError;
      }

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
          cbm: item.cbm,
          landed_cost: item.landedCostPerUnit,
        }));

      if (purchaseItems.length > 0) {
        const { data: insertedItems, error: itemsError } = await supabase
          .from("purchase_items")
          .insert(purchaseItems)
          .select();
        if (itemsError) throw itemsError;

        // Create item fees
        const itemFeeRecords: { company_id: string; purchase_item_id: string; fee_name: string; amount: number }[] = [];
        calculateLandedCosts.forEach((item, index) => {
          const insertedItem = insertedItems?.[index];
          if (insertedItem && item.fees.length > 0) {
            item.fees.filter(fee => fee.name.trim() && fee.amount > 0).forEach(fee => {
              itemFeeRecords.push({
                company_id: profile.company_id,
                purchase_item_id: insertedItem.id,
                fee_name: fee.name.trim(),
                amount: fee.amount,
              });
            });
          }
        });

        if (itemFeeRecords.length > 0) {
          const { error: itemFeesError } = await supabase
            .from("purchase_item_fees")
            .insert(itemFeeRecords);
          if (itemFeesError) throw itemFeesError;
        }
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
                            <Popover 
                              open={categoryPopoverOpen[item.id] || false} 
                              onOpenChange={(open) => setCategoryPopoverOpen(prev => ({ ...prev, [item.id]: open }))}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  className="w-full justify-between"
                                >
                                  {item.category_id
                                    ? categories?.find(c => c.id === item.category_id)?.name
                                    : "Select category..."}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[300px] p-0">
                                <Command>
                                  <CommandInput 
                                    placeholder="Search or create category..." 
                                    value={newCategoryName}
                                    onValueChange={setNewCategoryName}
                                  />
                                  <CommandList>
                                    <CommandEmpty>
                                      <div className="p-2">
                                        <Button 
                                          size="sm" 
                                          className="w-full"
                                          onClick={() => createCategory(item.id)}
                                          disabled={!newCategoryName.trim()}
                                        >
                                          <Plus className="h-4 w-4 mr-2" />
                                          Create "{newCategoryName}"
                                        </Button>
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {categories?.map((cat) => (
                                        <CommandItem
                                          key={cat.id}
                                          value={cat.name}
                                          onSelect={() => {
                                            updateItem(item.id, "category_id", cat.id);
                                            setCategoryPopoverOpen(prev => ({ ...prev, [item.id]: false }));
                                          }}
                                        >
                                          {cat.name}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
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
                          <Label className="text-xs text-muted-foreground">CBM</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.001"
                            value={item.cbm}
                            onChange={(e) =>
                              updateItem(item.id, "cbm", parseFloat(e.target.value) || 0)
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

                      {/* Item-specific fees section */}
                      <div className="space-y-2 pt-2 border-t border-dashed">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs text-muted-foreground">Item Fees</Label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => addItemFee(item.id)}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Fee
                          </Button>
                        </div>
                        {item.fees.map((fee) => (
                          <div key={fee.id} className="flex gap-2 items-center">
                            <Input
                              placeholder="Fee name"
                              value={fee.name}
                              onChange={(e) => updateItemFee(item.id, fee.id, "name", e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Amount"
                              value={fee.amount}
                              onChange={(e) => updateItemFee(item.id, fee.id, "amount", parseFloat(e.target.value) || 0)}
                              className="w-24 h-8 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItemFee(item.id, fee.id)}
                              className="h-8 w-8 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>

                      {/* Landed cost summary */}
                      <div className="grid grid-cols-12 gap-2 items-end pt-2 border-t">
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Line Total</Label>
                          <div className="h-10 flex items-center px-3 bg-background border rounded-md text-sm font-medium">
                            ${(item.quantity * item.unit_cost).toFixed(2)}
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-3 space-y-1">
                          <Label className="text-xs text-muted-foreground">Item Fees Total</Label>
                          <div className="h-10 flex items-center px-3 bg-muted border rounded-md text-sm text-muted-foreground">
                            ${landedData?.itemFeesSum.toFixed(2) || "0.00"}
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
                      <span className="text-sm text-muted-foreground">Total CBM: </span>
                      <span className="font-semibold">{totalCBM.toFixed(3)} m³</span>
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
                    Each fee has its own distribution method
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={addGlobalFee}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Fee
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fee List */}
                <div className="space-y-3">
                  {globalFees.map((fee) => (
                    <div key={fee.id} className="p-3 bg-muted/30 rounded-lg border space-y-2">
                      <div className="flex gap-2 items-center">
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
                      <div className="flex gap-1">
                        {FEE_DISTRIBUTION_METHODS.map((method) => (
                          <Button
                            key={method.value}
                            type="button"
                            variant={fee.distribution_method === method.value ? "default" : "outline"}
                            size="sm"
                            className="flex-1 text-xs"
                            onClick={() => updateGlobalFee(fee.id, "distribution_method", method.value)}
                          >
                            <method.icon className="h-3 w-3 mr-1" />
                            {method.label}
                          </Button>
                        ))}
                      </div>
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
                      <span>Total CBM</span>
                      <span>{totalCBM.toFixed(3)} m³</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Order Type</span>
                      <Badge variant="outline" className="text-xs">
                        {orderType === "local" ? "Local" : "Import"}
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
