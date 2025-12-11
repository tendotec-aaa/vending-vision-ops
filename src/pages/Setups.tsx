import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings } from "lucide-react";

type SetupType = "individual" | "double" | "triple";

const SETUP_TYPE_CONFIG = {
  individual: { label: "Individual", positions: ["center"] as const },
  double: { label: "Double", positions: ["left", "right"] as const },
  triple: { label: "Triple", positions: ["left", "center", "right"] as const },
};

export default function Setups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [setupType, setSetupType] = useState<SetupType | "">("");
  const [selectedMachines, setSelectedMachines] = useState<Record<string, string>>({});

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

  const { data: setups } = useQuery({
    queryKey: ["setups", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("setups")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: setupMachines } = useQuery({
    queryKey: ["setup_machines", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("setup_machines")
        .select("*, machines(*)")
        .eq("company_id", profile?.company_id);
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  const { data: machines } = useQuery({
    queryKey: ["machines", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("machines")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("serial_number");
      return data || [];
    },
    enabled: !!profile?.company_id,
  });

  // Get machines that are not assigned to any setup
  const availableMachines = machines?.filter(machine => 
    !setupMachines?.some(sm => sm.machine_id === machine.id)
  ) || [];

  // Filter available machines excluding already selected ones
  const getAvailableMachinesForPosition = (position: string) => {
    const selectedIds = Object.entries(selectedMachines)
      .filter(([pos]) => pos !== position)
      .map(([, id]) => id);
    return availableMachines.filter(m => !selectedIds.includes(m.id));
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!setupType) throw new Error("Please select a setup type");
      
      const config = SETUP_TYPE_CONFIG[setupType];
      const positions = config.positions;
      
      // Validate all positions have a machine selected
      for (const pos of positions) {
        if (!selectedMachines[pos]) {
          throw new Error(`Please select a machine for ${pos} position`);
        }
      }

      // Create setup with type as name
      const setupName = `${config.label} Setup`;
      const { data: setup, error: setupError } = await supabase
        .from("setups")
        .insert({
          name: setupName,
          setup_type: setupType,
          company_id: profile?.company_id,
        })
        .select()
        .single();
      
      if (setupError) throw setupError;

      // Create setup_machines entries
      const setupMachineEntries = positions.map(pos => ({
        setup_id: setup.id,
        machine_id: selectedMachines[pos],
        position: pos,
        company_id: profile?.company_id!,
      }));

      const { error: machinesError } = await supabase
        .from("setup_machines")
        .insert(setupMachineEntries);

      if (machinesError) throw machinesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setups"] });
      queryClient.invalidateQueries({ queryKey: ["setup_machines"] });
      toast({ title: "Setup created successfully" });
      setIsOpen(false);
      setSetupType("");
      setSelectedMachines({});
    },
    onError: (error) => {
      toast({ title: "Error creating setup", description: error.message, variant: "destructive" });
    },
  });

  const getMachinesForSetup = (setupId: string) => {
    return setupMachines?.filter(sm => sm.setup_id === setupId) || [];
  };

  const handleSetupTypeChange = (value: SetupType) => {
    setSetupType(value);
    setSelectedMachines({});
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Setups</h1>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Setup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Setup</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Setup Type *</Label>
                  <Select value={setupType} onValueChange={(v) => handleSetupTypeChange(v as SetupType)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select setup type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="individual">Individual (1 machine - Center)</SelectItem>
                      <SelectItem value="double">Double (2 machines - Left, Right)</SelectItem>
                      <SelectItem value="triple">Triple (3 machines - Left, Center, Right)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {setupType && (
                  <div className="space-y-3">
                    <Label>Select Machines</Label>
                    {availableMachines.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No available machines. All machines are assigned to setups.</p>
                    ) : (
                      SETUP_TYPE_CONFIG[setupType].positions.map((position) => (
                        <div key={position}>
                          <Label className="text-sm capitalize text-muted-foreground">{position} Machine</Label>
                          <Select
                            value={selectedMachines[position] || ""}
                            onValueChange={(value) => setSelectedMachines({ ...selectedMachines, [position]: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${position} machine`} />
                            </SelectTrigger>
                            <SelectContent>
                              {getAvailableMachinesForPosition(position).map((machine) => (
                                <SelectItem key={machine.id} value={machine.id}>
                                  {machine.serial_number} {machine.model && `(${machine.model})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))
                    )}
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => createMutation.mutate()}
                  disabled={!setupType || createMutation.isPending || availableMachines.length === 0}
                >
                  {createMutation.isPending ? "Creating..." : "Create Setup"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {setups?.map((setup) => {
            const setupMachinesList = getMachinesForSetup(setup.id);
            return (
              <Card key={setup.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5 text-primary" />
                    {setup.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {setup.setup_type && (
                    <p className="text-sm">
                      <span className="font-medium">Type:</span>{" "}
                      <span className="capitalize">{setup.setup_type}</span>
                    </p>
                  )}
                  {setupMachinesList.length > 0 ? (
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Machines:</p>
                      {setupMachinesList.map((sm) => (
                        <p key={sm.id} className="text-sm text-muted-foreground pl-2">
                          • <span className="capitalize">{sm.position || "N/A"}</span>: {sm.machines?.serial_number}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No machines assigned</p>
                  )}
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
