import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ShoppingCart, Package, Calendar, MapPin, Truck, Receipt, Globe, Box, DollarSign, Hash, Warehouse } from "lucide-react";

export default function PurchaseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: purchase, isLoading: purchaseLoading } = useQuery({
    queryKey: ["purchase", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: supplier } = useQuery({
    queryKey: ["supplier", purchase?.supplier_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", purchase?.supplier_id)
        .single();
      return data;
    },
    enabled: !!purchase?.supplier_id,
  });

  const { data: warehouse } = useQuery({
    queryKey: ["warehouse", purchase?.warehouse_id],
    queryFn: async () => {
      if (!purchase?.warehouse_id) return null;
      const { data } = await supabase
        .from("warehouses")
        .select("*")
        .eq("id", purchase.warehouse_id)
        .maybeSingle();
      return data;
    },
    enabled: !!purchase?.warehouse_id,
  });

  const { data: purchaseItems, isLoading: itemsLoading } = useQuery({
    queryKey: ["purchase-items", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("*")
        .eq("purchase_id", id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: globalFees } = useQuery({
    queryKey: ["purchase-global-fees", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_global_fees")
        .select("*")
        .eq("purchase_id", id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const { data: itemFees } = useQuery({
    queryKey: ["purchase-item-fees", purchaseItems?.map(i => i.id)],
    queryFn: async () => {
      const itemIds = purchaseItems?.map(i => i.id) || [];
      if (itemIds.length === 0) return [];
      const { data } = await supabase
        .from("purchase_item_fees")
        .select("*")
        .in("purchase_item_id", itemIds);
      return data || [];
    },
    enabled: !!purchaseItems && purchaseItems.length > 0,
  });

  const { data: products } = useQuery({
    queryKey: ["products-for-items", purchaseItems?.map(i => i.product_id).filter(Boolean)],
    queryFn: async () => {
      const productIds = purchaseItems?.map(i => i.product_id).filter(Boolean) || [];
      if (productIds.length === 0) return [];
      const { data } = await supabase
        .from("products")
        .select("id, product_name, product_type")
        .in("id", productIds);
      return data || [];
    },
    enabled: !!purchaseItems && purchaseItems.length > 0,
  });

  const getProductInfo = (productId: string | null) => {
    if (!productId || !products) return null;
    return products.find(p => p.id === productId);
  };

  const getItemFees = (itemId: string) => {
    return itemFees?.filter(f => f.purchase_item_id === itemId) || [];
  };

  const itemsSubtotal = purchaseItems?.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0) || 0;
  const itemFeesTotal = itemFees?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
  const globalFeesTotal = globalFees?.reduce((sum, fee) => sum + Number(fee.amount), 0) || 0;
  const totalCBM = purchaseItems?.reduce((sum, item) => sum + ((Number(item.cbm) || 0) * item.quantity), 0) || 0;

  const getFeeDistributionLabel = (method: string | null) => {
    switch (method) {
      case "by_value": return "By Value";
      case "by_quantity": return "By Quantity";
      case "by_cbm": return "By CBM";
      default: return "By Value";
    }
  };

  const getFeeDistributionIcon = (method: string | null) => {
    switch (method) {
      case "by_value": return DollarSign;
      case "by_quantity": return Hash;
      case "by_cbm": return Box;
      default: return DollarSign;
    }
  };

  if (purchaseLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading purchase...</p>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="container mx-auto p-4">
          <Button variant="ghost" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Purchases
          </Button>
          <Card className="mt-4">
            <CardContent className="py-8 text-center text-muted-foreground">
              Purchase not found.
            </CardContent>
          </Card>
        </div>
        <MobileNav />
      </div>
    );
  }

  const orderType = purchase.order_type || "local";
  const localTaxRate = Number(purchase.local_tax_rate) || 0;
  const localTaxAmount = localTaxRate > 0 ? itemsSubtotal * (localTaxRate / 100) : 0;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Purchase Details</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={orderType === "import" ? "default" : "secondary"}>
                {orderType === "import" ? (
                  <><Globe className="h-3 w-3 mr-1" />Import</>
                ) : (
                  <><MapPin className="h-3 w-3 mr-1" />Local</>
                )}
              </Badge>
              <Badge variant="outline">
                {purchase.purchase_type}
              </Badge>
            </div>
          </div>
        </div>

        {/* Purchase Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Date:</span>{" "}
                {new Date(purchase.purchase_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Warehouse className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Destination:</span>{" "}
                {warehouse?.name || purchase.destination}
              </span>
            </div>
            {supplier && (
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  <span className="font-medium">Supplier:</span> {supplier.name}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Total Cost:</span>{" "}
                <span className="text-primary font-semibold">${Number(purchase.total_cost).toFixed(2)}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Total CBM:</span> {totalCBM.toFixed(3)} m³
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Line Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Line Items ({purchaseItems?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading items...</p>
            ) : purchaseItems?.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No items found.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Linked Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">CBM</TableHead>
                      <TableHead className="text-right">Item Fees</TableHead>
                      <TableHead className="text-right">Landed Cost</TableHead>
                      <TableHead className="text-right">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems?.map((item) => {
                      const product = getProductInfo(item.product_id);
                      const landedCost = Number(item.landed_cost) || 0;
                      const cbm = Number(item.cbm) || 0;
                      const fees = getItemFees(item.id);
                      const feesTotal = fees.reduce((sum, f) => sum + Number(f.amount), 0);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            {item.item_name}
                            {fees.length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                {fees.map(f => `${f.fee_name}: $${Number(f.amount).toFixed(2)}`).join(", ")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {product ? (
                              <Badge variant="secondary" className="gap-1">
                                <Package className="h-3 w-3" />
                                {product.product_name}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not linked</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_cost).toFixed(2)}</TableCell>
                          <TableCell className="text-right">{(cbm * item.quantity).toFixed(3)} m³</TableCell>
                          <TableCell className="text-right">${feesTotal.toFixed(2)}</TableCell>
                          <TableCell className="text-right text-primary font-medium">
                            ${landedCost.toFixed(2)}/unit
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${(item.quantity * Number(item.unit_cost)).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global Fees */}
        {globalFees && globalFees.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Global Fees</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {globalFees.map((fee) => {
                  const Icon = getFeeDistributionIcon(fee.distribution_method);
                  return (
                    <div key={fee.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span>{fee.fee_name}</span>
                        <Badge variant="outline" className="text-xs gap-1">
                          <Icon className="h-3 w-3" />
                          {getFeeDistributionLabel(fee.distribution_method)}
                        </Badge>
                      </div>
                      <span className="font-medium">${Number(fee.amount).toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Cost Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Items Subtotal</span>
                <span>${itemsSubtotal.toFixed(2)}</span>
              </div>
              {itemFeesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Item-Specific Fees</span>
                  <span>${itemFeesTotal.toFixed(2)}</span>
                </div>
              )}
              {globalFeesTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Global Fees</span>
                  <span>${globalFeesTotal.toFixed(2)}</span>
                </div>
              )}
              {localTaxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Local Tax ({localTaxRate}%)</span>
                  <span>${localTaxAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-2 mt-2">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">${Number(purchase.total_cost).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <MobileNav />
    </div>
  );
}
