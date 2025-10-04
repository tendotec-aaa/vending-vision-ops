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
import { Plus, Box } from "lucide-react";

export default function WarehouseComponents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    quantity: "",
    landed_unit_cost: "",
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

  const { data: components } = useQuery({
    queryKey: ["warehouse_components", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouse_components")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("name");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase.from("warehouse_components").insert({
        name: data.name,
        quantity: parseInt(data.quantity),
        landed_unit_cost: parseFloat(data.landed_unit_cost),
        company_id: profile?.company_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouse_components"] });
      toast({ title: "Component added successfully" });
      setIsOpen(false);
      setFormData({ name: "", quantity: "", landed_unit_cost: "" });
    },
  });

  const filteredComponents = components?.filter((comp) =>
    comp.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Warehouse Components</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Component
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Component</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Component Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Motor Unit"
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
                  <Label htmlFor="landed_unit_cost">Landed Unit Cost</Label>
                  <Input
                    id="landed_unit_cost"
                    type="number"
                    step="0.01"
                    value={formData.landed_unit_cost}
                    onChange={(e) => setFormData({ ...formData, landed_unit_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.name || !formData.quantity || !formData.landed_unit_cost}
                >
                  Add Component
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-4">
          {filteredComponents?.map((component) => (
            <Card key={component.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Box className="h-5 w-5 text-primary" />
                  {component.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-sm"><span className="font-medium">Quantity:</span> {component.quantity}</p>
                <p className="text-sm"><span className="font-medium">Unit Cost:</span> ${component.landed_unit_cost}</p>
                <p className="text-sm"><span className="font-medium">Total Value:</span> ${(component.quantity * parseFloat(component.landed_unit_cost.toString())).toFixed(2)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
