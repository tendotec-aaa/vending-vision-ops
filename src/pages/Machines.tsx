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

const GENERATIONS = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

type Machine = {
  id: string;
  serial_number: string;
  model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  company_id: string;
  created_at: string;
};

export default function Machines() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [generationFilter, setGenerationFilter] = useState<string>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState({
    model: "",
    generation: "",
    number_of_machines: "1",
    purchase_date: "",
    purchase_cost: "",
    slots_per_machine: "8",
  });

  const [editFormData, setEditFormData] = useState({
    model: "",
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

  const { data: machines = [] } = useQuery({
    queryKey: ["machines", profile?.company_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("machines")
        .select("*")
        .eq("company_id", profile?.company_id)
        .order("serial_number", { ascending: true });
      return (data || []) as Machine[];
    },
    enabled: !!profile?.company_id,
  });

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
      const slotsPerMachine = parseInt(data.slots_per_machine) || 8;
      const startNumber = getNextNumberForGeneration(data.generation);
      
      const machinesToCreate = Array.from({ length: numberOfMachines }, (_, i) => ({
        serial_number: `${data.generation}-${String(startNumber + i).padStart(3, '0')}`,
        model: data.model || null,
        purchase_date: data.purchase_date || null,
        purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
        slots_per_machine: slotsPerMachine,
        company_id: profile?.company_id,
      }));

      const { data: createdMachines, error } = await supabase
        .from("machines")
        .insert(machinesToCreate)
        .select();
      if (error) throw error;

      if (createdMachines && slotsPerMachine > 0) {
        const slotsToCreate = createdMachines.flatMap((machine) =>
          Array.from({ length: slotsPerMachine }, (_, i) => ({
            machine_id: machine.id,
            slot_number: i + 1,
            company_id: profile?.company_id,
          }))
        );
        const { error: slotsError } = await supabase.from("machine_toy_slots").insert(slotsToCreate);
        if (slotsError) throw slotsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "Machines added successfully" });
      setIsAddOpen(false);
      setFormData({ model: "", generation: "", number_of_machines: "1", purchase_date: "", purchase_cost: "", slots_per_machine: "8" });
    },
    onError: (error) => {
      toast({ title: "Error adding machines", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof editFormData }) => {
      const { error } = await supabase
        .from("machines")
        .update({
          model: data.model || null,
          purchase_date: data.purchase_date || null,
          purchase_cost: data.purchase_cost ? parseFloat(data.purchase_cost) : null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: "Machine updated successfully" });
      setEditingMachine(null);
    },
    onError: (error) => {
      toast({ title: "Error updating machine", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      // Delete associated slots first
      const { error: slotsError } = await supabase
        .from("machine_toy_slots")
        .delete()
        .in("machine_id", ids);
      if (slotsError) throw slotsError;

      const { error } = await supabase
        .from("machines")
        .delete()
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast({ title: `${selectedIds.size} machine(s) deleted` });
      setSelectedIds(new Set());
      setShowDeleteConfirm(false);
    },
    onError: (error) => {
      toast({ title: "Error deleting machines", description: error.message, variant: "destructive" });
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

  const handleEdit = (machine: Machine) => {
    setEditingMachine(machine);
    setEditFormData({
      model: machine.model || "",
      purchase_date: machine.purchase_date || "",
      purchase_cost: machine.purchase_cost?.toString() || "",
    });
  };

  const handleUpdateSubmit = () => {
    if (editingMachine) {
      updateMutation.mutate({ id: editingMachine.id, data: editFormData });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredMachines.map(m => m.id)));
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
    const headers = ["Serial Number", "Model", "Purchase Date", "Purchase Cost"];
    const rows = filteredMachines.map(m => [
      m.serial_number,
      m.model || "",
      m.purchase_date || "",
      m.purchase_cost?.toString() || "",
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(","))
      .join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "machines.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported to CSV" });
  };

  const filteredMachines = machines.filter((machine) => {
    const matchesSearch = 
      machine.serial_number.toLowerCase().includes(search.toLowerCase()) ||
      machine.model?.toLowerCase().includes(search.toLowerCase());
    const matchesGeneration = 
      generationFilter === "all" || machine.serial_number.startsWith(`${generationFilter}-`);
    return matchesSearch && matchesGeneration;
  });

  const uniqueGenerations = [...new Set(machines.map(m => m.serial_number.split("-")[0]))].sort();

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto p-4 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Machines</h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
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
                    <Label htmlFor="slots_per_machine">Slots per Machine *</Label>
                    <Input
                      id="slots_per_machine"
                      type="number"
                      min="1"
                      max="20"
                      value={formData.slots_per_machine}
                      onChange={(e) => setFormData({ ...formData, slots_per_machine: e.target.value })}
                    />
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
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by serial number or model..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={generationFilter} onValueChange={setGenerationFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Filter by generation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Generations</SelectItem>
              {uniqueGenerations.map((gen) => (
                <SelectItem key={gen} value={gen}>
                  Generation {gen}
                </SelectItem>
              ))}
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
                      checked={filteredMachines.length > 0 && selectedIds.size === filteredMachines.length}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Serial Number</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Purchase Date</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMachines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No machines found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMachines.map((machine) => (
                    <TableRow key={machine.id} className="hover:bg-muted/30">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(machine.id)}
                          onCheckedChange={(checked) => handleSelectOne(machine.id, !!checked)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{machine.serial_number}</TableCell>
                      <TableCell>{machine.model || "—"}</TableCell>
                      <TableCell>
                        {machine.purchase_date
                          ? new Date(machine.purchase_date).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {machine.purchase_cost ? `$${machine.purchase_cost}` : "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(machine)}
                        >
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
          Showing {filteredMachines.length} of {machines.length} machines
        </p>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingMachine} onOpenChange={(open) => !open && setEditingMachine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Machine: {editingMachine?.serial_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_model">Model</Label>
              <Input
                id="edit_model"
                value={editFormData.model}
                onChange={(e) => setEditFormData({ ...editFormData, model: e.target.value })}
                placeholder="e.g., Crane Master 3000"
              />
            </div>
            <div>
              <Label htmlFor="edit_purchase_date">Purchase Date</Label>
              <Input
                id="edit_purchase_date"
                type="date"
                value={editFormData.purchase_date}
                onChange={(e) => setEditFormData({ ...editFormData, purchase_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit_purchase_cost">Purchase Cost</Label>
              <Input
                id="edit_purchase_cost"
                type="number"
                value={editFormData.purchase_cost}
                onChange={(e) => setEditFormData({ ...editFormData, purchase_cost: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <Button
              className="w-full"
              onClick={handleUpdateSubmit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Machine(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the selected machines and their associated toy slots.
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

      <MobileNav />
    </div>
  );
}
