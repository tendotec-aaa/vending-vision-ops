import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package2 } from "lucide-react";

export default function WarehouseProducts() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    final_cogs: "",
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
    queryKey: ["warehouse_finished_products", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouse_finished_products")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("warehouse_finished_products").insert({
        name: data.name,
        quantity: parseInt(data.quantity),
        final_cogs: parseFloat(data.final_cogs),
        company_id: profile?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse_finished_products"] });
      toast({ title: "Product added successfully" });
      setIsOpen(false);
      setFormData({ name: "", quantity: "", final_cogs: "" });
    },
  });

  const filteredProducts = products?.filter((prod) =>
    prod.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Finished Products</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Finished Product</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Product Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Assembled Vending Machine"
                  />
                </div>
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label htmlFor="final_cogs">Final COGS</Label>
                  <Input
                    id="final_cogs"
                    type="number"
                    step="0.01"
                    value={formData.final_cogs}
                    onChange={(e) => setFormData({ ...formData, final_cogs: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.name || !formData.quantity || !formData.final_cogs}
                >
                  Add Product
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-4">
          {filteredProducts?.map((product) => (
            <Card key={product.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package2 className="h-5 w-5 text-primary" />
                  {product.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm"><span className="font-medium">Quantity:</span> {product.quantity}</p>
                <p className="text-sm"><span className="font-medium">COGS:</span> ${product.final_cogs}</p>
                <p className="text-sm"><span className="font-medium">Total Value:</span> ${(product.quantity * parseFloat(product.final_cogs.toString())).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
