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
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, Package, DollarSign, Truck, Link } from "lucide-react";

interface PurchaseItem {
  id: string;
  item_name: string;
  product_id: string | null;
  quantity: number;
  unit_cost: number;
}

const PURCHASE_TYPES = [
  "Toys",
  "Components",
  "Machines",
  "Parts",
  "Supplies",
  "Other",
];

const DESTINATIONS = [
  "Warehouse",
  "Direct to Location",
  "Office",
  "Other",
];

export default function NewPurchase() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [supplierId, setSupplierId] = useState<string>("");
  const [purchaseType, setPurchaseType] = useState<string>("");
  const [destination, setDestination] = useState<string>("");
  const [purchaseDate, setPurchaseDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [shippingCost, setShippingCost] = useState<string>("0");
  const [dutiesTaxes, setDutiesTaxes] = useState<string>("0");
  const [items, setItems] = useState<PurchaseItem[]>([
    { id: crypto.randomUUID(), item_name: "", product_id: null, quantity: 1, unit_cost: 0 },
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

  const { data: products } = useQuery({
    queryKey: ["products", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, product_name, cogs")
        .eq("company_id", profile?.company_id)
        .order("product_name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const itemsSubtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  }, [items]);

  const totalCost = useMemo(() => {
    return itemsSubtotal + parseFloat(shippingCost || "0") + parseFloat(dutiesTaxes || "0");
  }, [itemsSubtotal, shippingCost, dutiesTaxes]);

  const addItem = () => {
    setItems([
      ...items,
      { id: crypto.randomUUID(), item_name: "", product_id: null, quantity: 1, unit_cost: 0 },
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
        
        // If selecting a product, auto-fill the name and cost
        if (field === "product_id" && value) {
          const product = products?.find((p) => p.id === value);
          if (product) {
            return {
              ...item,
              product_id: value as string,
              item_name: product.product_name,
              unit_cost: Number(product.cogs) || item.unit_cost,
            };
          }
        }
        
        return { ...item, [field]: value };
      })
    );
  };

  const createPurchaseMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.company_id) throw new Error("No company ID");
      if (!supplierId) throw new Error("Please select a supplier");
      if (!purchaseType) throw new Error("Please select a purchase type");
      if (!destination) throw new Error("Please enter a destination");
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
          destination: destination,
          purchase_date: purchaseDate,
          shipping_cost: parseFloat(shippingCost || "0"),
          duties_taxes: parseFloat(dutiesTaxes || "0"),
          total_cost: totalCost,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items (trigger will auto-update inventory for linked products)
      const purchaseItems = items
        .filter((item) => item.item_name.trim())
        .map((item) => ({
          company_id: profile.company_id,
          purchase_id: purchase.id,
          item_name: item.item_name.trim(),
          product_id: item.product_id,
          quantity: item.quantity,
          unit_cost: item.unit_cost,
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
    destination &&
    items.every((item) => item.item_name.trim());

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">New Purchase</h1>
        </div>

        {/* Purchase Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
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
                <Label htmlFor="destination">Destination *</Label>
                <Select value={destination} onValueChange={setDestination}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent>
                    {DESTINATIONS.map((dest) => (
                      <SelectItem key={dest} value={dest}>
                        {dest}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
              <DollarSign className="h-5 w-5 text-primary" />
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
            
            {items.map((item) => (
              <div
                key={item.id}
                className="space-y-3 p-4 bg-muted/30 rounded-lg"
              >
                {/* Product Link */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    <Link className="h-3 w-3" />
                    Link to Product (optional)
                  </Label>
                  <Select
                    value={item.product_id || "none"}
                    onValueChange={(value) =>
                      updateItem(item.id, "product_id", value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger className={item.product_id ? "border-primary/50 bg-primary/5" : ""}>
                      <SelectValue placeholder="Select product to link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No product link (manual entry)</SelectItem>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.product_name} (COGS: ${product.cogs})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 md:col-span-5 space-y-1">
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
                    <Label className="text-xs text-muted-foreground">Subtotal</Label>
                    <div className="h-10 flex items-center px-3 bg-background border rounded-md text-sm font-medium">
                      ${(item.quantity * item.unit_cost).toFixed(2)}
                    </div>
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
                
                {item.product_id && (
                  <p className="text-xs text-primary">
                    ✓ This item will add {item.quantity} units to warehouse inventory
                  </p>
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t">
              <div className="text-right">
                <span className="text-sm text-muted-foreground">Items Subtotal: </span>
                <span className="font-semibold">${itemsSubtotal.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Additional Costs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-primary" />
              Additional Costs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="shippingCost">Shipping Cost</Label>
                <Input
                  id="shippingCost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={shippingCost}
                  onChange={(e) => setShippingCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dutiesTaxes">Duties & Taxes</Label>
                <Input
                  id="dutiesTaxes"
                  type="number"
                  min="0"
                  step="0.01"
                  value={dutiesTaxes}
                  onChange={(e) => setDutiesTaxes(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Total & Submit */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <p className="text-sm text-muted-foreground">Total Purchase Cost</p>
                <p className="text-3xl font-bold text-primary">${totalCost.toFixed(2)}</p>
              </div>
              <Button
                size="lg"
                onClick={() => createPurchaseMutation.mutate()}
                disabled={!isFormValid || createPurchaseMutation.isPending}
                className="w-full md:w-auto"
              >
                {createPurchaseMutation.isPending ? "Creating..." : "Create Purchase"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNav />
    </div>
  );
}
