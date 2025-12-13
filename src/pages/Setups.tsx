import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Settings, Pencil, Trash2 } from "lucide-react";

type SetupType = "individual" | "double" | "triple";

const SETUP_TYPE_CONFIG = {
  individual: { label: "Individual", positions: ["center"] as const },
  double: { label: "Double", positions: ["left", "right"] as const },
  triple: { label: "Triple", positions: ["left", "center", "right"] as const },
};

type Setup = {
  id: string;
  name: string;
  setup_type: string | null;
  company_id: string;
  created_at: string;
};

export default function Setups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
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

  // Get machines that are not assigned to any setup (or assigned to the setup being edited)
  const getAvailableMachinesBase = (excludeSetupId?: string) => {
    return machines?.filter(machine => 
      !setupMachines?.some(sm => sm.machine_id === machine.id && sm.setup_id !== excludeSetupId)
    ) || [];
  };

  const availableMachines = getAvailableMachinesBase(editingSetup?.id);

  // Filter available machines excluding already selected ones
  const getAvailableMachinesForPosition = (position: string) => {
    const selectedIds = Object.entries(selectedMachines)
      .filter(([pos]) => pos !== position)
      .map(([, id]) => id);
    return availableMachines.filter(m => !selectedIds.includes(m.id));
  };

  // Generate setup name from machine serial numbers
  const generateSetupName = (type: SetupType, machineSelections: Record<string, string>) => {
    const config = SETUP_TYPE_CONFIG[type];
    const positions = config.positions;
    
    // Get machines in position order
    const machinesInOrder = positions.map(pos => {
      const machineId = machineSelections[pos];
      return machines?.find(m => m.id === machineId);
    });
    
    // Extract generation letters and numbers
    // Serial format: "A-001" → generation "A", number "001"
    const parts = machinesInOrder.map(machine => {
      if (!machine?.serial_number) return { gen: "?", num: "00" };
      const match = machine.serial_number.match(/^([A-Z])-(\d+)$/);
      if (!match) return { gen: "?", num: "00" };
      return { gen: match[1], num: match[2].slice(-2).padStart(2, "0") }; // Last 2 digits
    });
    
    // Combine: generations + "-" + concatenated numbers
    const generations = parts.map(p => p.gen).join("");
    const numbers = parts.map(p => p.num).join("");
    
    return `${generations}-${numbers}`;
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

      // Auto-generate setup name from machine serial numbers
      const setupName = generateSetupName(setupType, selectedMachines);
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
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error creating setup", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editingSetup || !setupType) throw new Error("Invalid setup data");
      
      const config = SETUP_TYPE_CONFIG[setupType];
      const positions = config.positions;
      
      // Validate all positions have a machine selected
      for (const pos of positions) {
        if (!selectedMachines[pos]) {
          throw new Error(`Please select a machine for ${pos} position`);
        }
      }

      // Auto-generate setup name from machine serial numbers
      const setupName = generateSetupName(setupType, selectedMachines);
      
      // Update setup
      const { error: setupError } = await supabase
        .from("setups")
        .update({
          name: setupName,
          setup_type: setupType,
        })
        .eq("id", editingSetup.id);
      
      if (setupError) throw setupError;

      // Delete existing setup_machines
      const { error: deleteError } = await supabase
        .from("setup_machines")
        .delete()
        .eq("setup_id", editingSetup.id);
      
      if (deleteError) throw deleteError;

      // Create new setup_machines entries
      const setupMachineEntries = positions.map(pos => ({
        setup_id: editingSetup.id,
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
      toast({ title: "Setup updated successfully" });
      closeDialog();
    },
    onError: (error) => {
      toast({ title: "Error updating setup", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (setupId: string) => {
      // Delete setup_machines first (due to foreign key)
      const { error: machinesError } = await supabase
        .from("setup_machines")
        .delete()
        .eq("setup_id", setupId);
      
      if (machinesError) throw machinesError;

      // Delete setup
      const { error: setupError } = await supabase
        .from("setups")
        .delete()
        .eq("id", setupId);
      
      if (setupError) throw setupError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setups"] });
      queryClient.invalidateQueries({ queryKey: ["setup_machines"] });
      toast({ title: "Setup deleted successfully" });
    },
    onError: (error) => {
      toast({ title: "Error deleting setup", description: error.message, variant: "destructive" });
    },
  });

  const getMachinesForSetup = (setupId: string) => {
    return setupMachines?.filter(sm => sm.setup_id === setupId) || [];
  };

  const handleSetupTypeChange = (value: SetupType) => {
    setSetupType(value);
    setSelectedMachines({});
  };

  const closeDialog = () => {
    setIsOpen(false);
    setEditingSetup(null);
    setSetupType("");
    setSelectedMachines({});
  };

  const openEditDialog = (setup: Setup) => {
    setEditingSetup(setup);
    setSetupType((setup.setup_type as SetupType) || "");
    
    // Pre-populate selected machines
    const setupMachinesList = getMachinesForSetup(setup.id);
    const machineSelections: Record<string, string> = {};
    setupMachinesList.forEach(sm => {
      if (sm.position && sm.machine_id) {
        machineSelections[sm.position] = sm.machine_id;
      }
    });
    setSelectedMachines(machineSelections);
    setIsOpen(true);
  };

  const handleSubmit = () => {
    if (editingSetup) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Setups</h1>
          <Dialog open={isOpen} onOpenChange={(open) => open ? setIsOpen(true) : closeDialog()}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Setup
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSetup ? "Edit Setup" : "Create New Setup"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Setup Type *</Label>
                  <Select 
                    value={setupType} 
                    onValueChange={(v) => handleSetupTypeChange(v as SetupType)}
                    disabled={!!editingSetup}
                  >
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
                  onClick={handleSubmit}
                  disabled={!setupType || isPending || availableMachines.length === 0}
                >
                  {isPending ? (editingSetup ? "Updating..." : "Creating...") : (editingSetup ? "Update Setup" : "Create Setup")}
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
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      {setup.name}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(setup)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Setup</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{setup.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(setup.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
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
