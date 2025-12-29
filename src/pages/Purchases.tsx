import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Plus, Globe, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function Purchases() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const { data: purchases } = useQuery({
    queryKey: ["purchases", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchases")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("purchase_date", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Purchase History</h1>
          <Button onClick={() => navigate("/purchases/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Purchase
          </Button>
        </div>

        <div className="grid gap-4">
          {purchases?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No purchases yet. Click "New Purchase" to add one.
              </CardContent>
            </Card>
          )}
          {purchases?.map((purchase) => {
            const orderType = purchase.order_type || "local";
            return (
              <Card 
                key={purchase.id} 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => navigate(`/purchases/${purchase.id}`)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                    {purchase.purchase_type}
                    <Badge variant={orderType === "import" ? "default" : "secondary"} className="ml-2">
                      {orderType === "import" ? (
                        <><Globe className="h-3 w-3 mr-1" />Import</>
                      ) : (
                        <><MapPin className="h-3 w-3 mr-1" />Local</>
                      )}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm"><span className="font-medium">Date:</span> {new Date(purchase.purchase_date).toLocaleDateString()}</p>
                  <p className="text-sm"><span className="font-medium">Destination:</span> {purchase.destination}</p>
                  <p className="text-sm"><span className="font-medium">Total Cost:</span> <span className="text-primary font-semibold">${Number(purchase.total_cost).toFixed(2)}</span></p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
