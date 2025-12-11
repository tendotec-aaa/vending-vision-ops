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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Package } from "lucide-react";

const GENERATIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)); // A-Z

export default function Machines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    model: "",
    generation: "",
    number_of_machines: "1",
    purchase_date: "",
    purchase_cost: "",
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

  const { data: machines } = useQuery({
    queryKey: ["machines", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("machines")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("serial_number", { ascending: true });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Get the highest number for a given generation
  const getNextNumberForGeneration = (generation: string) => {
    const genMachines = machines?.filter(m => m.serial_number.startsWith(`${generation}-`)) || [];
    if (genMachines.length === 0) return 1;
    const numbers = genMachines.map(m => {
      const match = m.serial_number.match(/-(\d+)$/);
      return match ? parseInt(match[1]) : 0;
    });
    return Math.max(...numbers) + 1;
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const numberOfMachines = parseInt(data.number_of_machines) || 1;
      const startNumber = getNextNumberForGeneration(data.generation);
      
      const machinesToCreate = Array.from({ length: numberOfMachines }, (_, i) => ({
        serial_number: `${data.generation}-${String(startNumber + i).padStart(3, '0')}`,
        model: data.model || null,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
        company_id: profile?.company_id,
      }));

      const { error } = await supabase.from("machines").insert(machinesToCreate);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "Machines added successfully" });
      setIsOpen(false);
      setFormData({ model: "", generation: "", number_of_machines: "1", purchase_date: "", purchase_cost: "" });
    },
    onError: (error) => {
      toast({ title: "Error adding machines", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    const num = parseInt(formData.number_of_machines);
    if (!formData.generation) {
      toast({ title: "Please select a generation", variant: "destructive" });
      return;
    }
    if (isNaN(num) || num < 1 || num > 100) {
      toast({ title: "Number of machines must be between 1 and 100", variant: "destructive" });
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredMachines = machines?.filter((machine) =>
    machine.serial_number.toLowerCase().includes(search.toLowerCase()) ||
    machine.model?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Machines</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Machine
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Machines</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="model">Machine Model</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g., Crane Master 3000"
                  />
                </div>
                <div>
                  <Label htmlFor="generation">Generation *</Label>
                  <Select
                    value={formData.generation}
                    onValueChange={(value) => setFormData({ ...formData, generation: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select generation (A-Z)" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENERATIONS.map((gen) => (
                        <SelectItem key={gen} value={gen}>
                          Generation {gen}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="number_of_machines">Number of Machines (1-100) *</Label>
                  <Input
                    id="number_of_machines"
                    type="number"
                    min="1"
                    max="100"
                    value={formData.number_of_machines}
                    onChange={(e) => setFormData({ ...formData, number_of_machines: e.target.value })}
                  />
                  {formData.generation && formData.number_of_machines && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Will create: {formData.generation}-{String(getNextNumberForGeneration(formData.generation)).padStart(3, '0')} to {formData.generation}-{String(getNextNumberForGeneration(formData.generation) + parseInt(formData.number_of_machines || "1") - 1).padStart(3, '0')}
                    </p>
                  )}
                </div>
                <div>
                  <Label htmlFor="purchase_date">Purchase Date</Label>
                  <Input
                    id="purchase_date"
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="purchase_cost">Purchase Cost (per machine)</Label>
                  <Input
                    id="purchase_cost"
                    type="number"
                    value={formData.purchase_cost}
                    onChange={(e) => setFormData({ ...formData, purchase_cost: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleSubmit}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? "Adding..." : "Add Machines"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Input
          placeholder="Search by serial number or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid gap-4">
          {filteredMachines?.map((machine) => (
            <Card key={machine.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {machine.serial_number}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {machine.model && (
                  <p className="text-sm"><span className="font-medium">Model:</span> {machine.model}</p>
                )}
                {machine.purchase_date && (
                  <p className="text-sm"><span className="font-medium">Purchased:</span> {new Date(machine.purchase_date).toLocaleDateString()}</p>
                )}
                {machine.purchase_cost && (
                  <p className="text-sm"><span className="font-medium">Cost:</span> ${machine.purchase_cost}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <MobileNav />
    </div>
  );
}
