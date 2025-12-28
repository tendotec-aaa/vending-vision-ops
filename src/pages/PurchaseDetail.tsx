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
import { ArrowLeft, ShoppingCart, Package, Calendar, MapPin, Truck, Receipt } from "lucide-react";

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

  const itemsSubtotal = purchaseItems?.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0) || 0;

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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/purchases")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Purchase Details</h1>
        </div>

        {/* Purchase Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              {purchase.purchase_type}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Date:</span>{" "}
                {new Date(purchase.purchase_date).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                <span className="font-medium">Destination:</span> {purchase.destination}
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
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {purchaseItems?.map((item) => {
                      const product = getProductInfo(item.product_id);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.item_name}</TableCell>
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
              {Number(purchase.shipping_cost) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Shipping Cost</span>
                  <span>${Number(purchase.shipping_cost).toFixed(2)}</span>
                </div>
              )}
              {Number(purchase.duties_taxes) > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Duties & Taxes</span>
                  <span>${Number(purchase.duties_taxes).toFixed(2)}</span>
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
