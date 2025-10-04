import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function Purchases() {
  const { user } = useAuth();

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
        <h1 className="text-3xl font-bold">Purchase History</h1>

        <div className="grid gap-4">
          {purchases?.map((purchase) => (
            <Card key={purchase.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  {purchase.purchase_type}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm"><span className="font-medium">Date:</span> {new Date(purchase.purchase_date).toLocaleDateString()}</p>
                <p className="text-sm"><span className="font-medium">Destination:</span> {purchase.destination}</p>
                <p className="text-sm"><span className="font-medium">Total Cost:</span> ${purchase.total_cost}</p>
                {purchase.shipping_cost > 0 && <p className="text-sm"><span className="font-medium">Shipping:</span> ${purchase.shipping_cost}</p>}
                {purchase.duties_taxes > 0 && <p className="text-sm"><span className="font-medium">Duties/Taxes:</span> ${purchase.duties_taxes}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
