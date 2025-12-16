import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Loader2 } from "lucide-react";

interface Product {
  id: string;
  product_name: string;
}

interface ToySlot {
  id: string;
  slot_number: number;
  toy_id: string | null;
  product_id: string | null;
  products?: Product;
}

interface Props {
  machineId: string;
  companyId: string;
  slots: ToySlot[];
  products: Product[];
  slotCount: number;
}

export function MachineSlotManager({ machineId, companyId, slots, products, slotCount }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingSlot, setPendingSlot] = useState<number | null>(null);

  const updateSlotMutation = useMutation({
    mutationFn: async ({ slotNumber, productId }: { slotNumber: number; productId: string | null }) => {
      const existingSlot = slots.find(s => s.slot_number === slotNumber);
      
      if (existingSlot) {
        const { error } = await supabase
          .from("machine_toy_slots")
          .update({ product_id: productId })
          .eq("id", existingSlot.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("machine_toy_slots")
          .insert({
            machine_id: machineId,
            company_id: companyId,
            slot_number: slotNumber,
            product_id: productId,
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

  const getSlotProduct = (slotNumber: number) => {
    const slot = slots.find(s => s.slot_number === slotNumber);
    return slot?.product_id || "";
  };

  const handleSlotChange = (slotNumber: number, productId: string) => {
    setPendingSlot(slotNumber);
    updateSlotMutation.mutate({ 
      slotNumber, 
      productId: productId === "empty" ? null : productId 
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
            value={getSlotProduct(slotNum) || "empty"}
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
              {products.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.product_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
