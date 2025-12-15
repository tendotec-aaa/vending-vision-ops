import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { MobileNav } from "@/components/MobileNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, Pencil, Search } from "lucide-react";

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
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isOpen, setIsOpen] = useState(false);
  const [editingSetup, setEditingSetup] = useState<Setup | null>(null);
  const [setupType, setSetupType] = useState<SetupType | "">("");
  const [selectedMachines, setSelectedMachines] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const { data: setups = [] } = useQuery({
    queryKey: ["setups", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("setups")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("name", { ascending: true });
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

  const getAvailableMachinesBase = (excludeSetupId?: string) => {
    return machines?.filter(machine => 
      !setupMachines?.some(sm => sm.machine_id === machine.id && sm.setup_id !== excludeSetupId)
    ) || [];
  };

  const availableMachines = getAvailableMachinesBase(editingSetup?.id);

  const getAvailableMachinesForPosition = (position: string) => {
    const selectedMachineIds = Object.entries(selectedMachines)
      .filter(([pos]) => pos !== position)
      .map(([, id]) => id);
    return availableMachines.filter(m => !selectedMachineIds.includes(m.id));
  };

  const generateSetupName = (type: SetupType, machineSelections: Record<string, string>) => {
    const config = SETUP_TYPE_CONFIG[type];
    const positions = config.positions;
    
    const machinesInOrder = positions.map(pos => {
      const machineId = machineSelections[pos];
      return machines?.find(m => m.id === machineId);
    });
    
    const parts = machinesInOrder.map(machine => {
      if (!machine?.serial_number) return { gen: "?", num: "00" };
      const match = machine.serial_number.match(/^([A-Z])-(\d+)$/);
      if (!match) return { gen: "?", num: "00" };
      return { gen: match[1], num: match[2].slice(-2).padStart(2, "0") };
    });
    
    const generations = parts.map(p => p.gen).join("");
    const numbers = parts.map(p => p.num).join("");
    
    return `${generations}-${numbers}`;
  };

  const getMachinesForSetup = (setupId: string) => {
    return setupMachines?.filter(sm => sm.setup_id === setupId) || [];
  };

  const getTotalSlotsForSetup = (setupId: string) => {
    const setupMachinesList = getMachinesForSetup(setupId);
    return setupMachinesList.reduce((total, sm) => {
      const machine = sm.machines as { slots_per_machine?: number } | null;
      return total + (machine?.slots_per_machine || 8);
    }, 0);
  };

  const getMachineSerials = (setupId: string) => {
    const setupMachinesList = getMachinesForSetup(setupId);
    return setupMachinesList
      .sort((a, b) => {
        const posOrder = { left: 0, center: 1, right: 2 };
        return (posOrder[a.position as keyof typeof posOrder] || 0) - (posOrder[b.position as keyof typeof posOrder] || 0);
      })
      .map(sm => {
        const machine = sm.machines as { serial_number?: string } | null;
        return machine?.serial_number || "—";
      })
      .join(", ");
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!setupType) throw new Error("Please select a setup type");
      
      const config = SETUP_TYPE_CONFIG[setupType];
      const positions = config.positions;
      
      for (const pos of positions) {
        if (!selectedMachines[pos]) {
          throw new Error(`Please select a machine for ${pos} position`);
        }
      }

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
      
      for (const pos of positions) {
        if (!selectedMachines[pos]) {
          throw new Error(`Please select a machine for ${pos} position`);
        }
      }

      const setupName = generateSetupName(setupType, selectedMachines);
      
      const { error: setupError } = await supabase
        .from("setups")
        .update({
          name: setupName,
          setup_type: setupType,
        })
        .eq("id", editingSetup.id);
      
      if (setupError) throw setupError;

      const { error: deleteError } = await supabase
        .from("setup_machines")
        .delete()
        .eq("setup_id", editingSetup.id);
      
      if (deleteError) throw deleteError;

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
    mutationFn: async (setupIds: string[]) => {
      for (const setupId of setupIds) {
        const { error: machinesError } = await supabase
          .from("setup_machines")
          .delete()
          .eq("setup_id", setupId);
        
        if (machinesError) throw machinesError;

        const { error: setupError } = await supabase
          .from("setups")
          .delete()
          .eq("id", setupId);
        
        if (setupError) throw setupError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["setups"] });
      queryClient.invalidateQueries({ queryKey: ["setup_machines"] });
      toast({ title: `${selectedIds.size} setup(s) deleted` });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast({ title: "Error deleting setups", description: error.message, variant: "destructive" });
    },
  });

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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredSetups.map(s => s.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const exportToCSV = () => {
    const headers = ["Name", "Type", "Total Slots", "Machines"];
    const rows = filteredSetups.map(s => [
      s.name,
      s.setup_type || "",
      getTotalSlotsForSetup(s.id).toString(),
      getMachineSerials(s.id),
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "setups.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported to CSV" });
  };

  const filteredSetups = setups.filter((setup) => {
    const matchesSearch = setup.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || setup.setup_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Setups</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
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
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by setup name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="double">Double</SelectItem>
              <SelectItem value="triple">Triple</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Selected
            </Button>
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear Selection
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-12">
                    <Checkbox
                      checked={filteredSetups.length > 0 && selectedIds.size === filteredSetups.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Total Slots</TableHead>
                  <TableHead>Machines</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSetups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No setups found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSetups.map((setup) => (
                    <TableRow key={setup.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(setup.id)}
                          onCheckedChange={(checked) => handleSelectOne(setup.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{setup.name}</TableCell>
                      <TableCell className="capitalize">{setup.setup_type || "—"}</TableCell>
                      <TableCell className="text-primary font-semibold">{getTotalSlotsForSetup(setup.id)}</TableCell>
                      <TableCell className="text-muted-foreground">{getMachineSerials(setup.id) || "—"}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(setup)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Showing {filteredSetups.length} of {setups.length} setups
        </p>

        {/* Bulk Delete Confirmation */}
        <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {selectedIds.size} Setup(s)?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the selected setups and unassign their machines.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate(Array.from(selectedIds))}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      <MobileNav />
    </div>
  );
}
