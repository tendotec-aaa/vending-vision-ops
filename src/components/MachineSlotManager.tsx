import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Loader2 } from "lucide-react";

interface Toy {
  id: string;
  name: string;
}

interface ToySlot {
  id: string;
  slot_number: number;
  toy_id: string | null;
  toys?: Toy;
}

interface Props {
  machineId: string;
  companyId: string;
  slots: ToySlot[];
  toys: Toy[];
  slotCount: number;
}

export function MachineSlotManager({ machineId, companyId, slots, toys, slotCount }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const updateSlotMutation = useMutation({
    mutationFn: async ({ slotNumber, toyId }: { slotNumber: number; toyId: string | null }) => {
      const existingSlot = slots.find(s => s.slot_number === slotNumber);
      
      if (existingSlot) {
        const { error } = await supabase
          .from("machine_toy_slots")
          .update({ toy_id: toyId })
          .eq("id", existingSlot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("machine_toy_slots")
          .insert({
            machine_id: machineId,
            company_id: companyId,
            slot_number: slotNumber,
            toy_id: toyId,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machine_slots"] });
      queryClient.invalidateQueries({ queryKey: ["location_machines"] });
      toast({ title: "Slot updated" });
      setPendingSlot(null);
    },
    onError: () => {
      toast({ title: "Failed to update slot", variant: "destructive" });
      setPendingSlot(null);
    },
  });

  const getSlotToy = (slotNumber: number) => {
    const slot = slots.find(s => s.slot_number === slotNumber);
    return slot?.toy_id || "";
  };

  const handleSlotChange = (slotNumber: number, toyId: string) => {
    setPendingSlot(slotNumber);
    updateSlotMutation.mutate({ 
      slotNumber, 
      toyId: toyId === "empty" ? null : toyId 
    });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {Array.from({ length: slotCount }, (_, i) => i + 1).map((slotNum) => (
        <div key={slotNum} className="space-y-1">
          <label className="text-xs text-muted-foreground flex items-center gap-1">
            <Package className="h-3 w-3" />
            Slot {slotNum}
          </label>
          <Select
            value={getSlotToy(slotNum) || "empty"}
            onValueChange={(value) => handleSlotChange(slotNum, value)}
            disabled={pendingSlot === slotNum}
          >
            <SelectTrigger className="h-8 text-xs">
              {pendingSlot === slotNum ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <SelectValue placeholder="Empty" />
              )}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="empty">Empty</SelectItem>
              {toys.map((toy) => (
                <SelectItem key={toy.id} value={toy.id}>
                  {toy.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
