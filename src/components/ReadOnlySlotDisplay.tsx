import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Package, AlertTriangle } from 'lucide-react';

interface Product {
  id: string;
  product_name: string;
}

interface ToySlot {
  id: string;
  slot_number: number;
  toy_id: string | null;
  product_id: string | null;
  toy_capacity?: number | null;
  toy_current_stock?: number | null;
  products?: Product | null;
}

interface Props {
  slots: ToySlot[];
  slotCount: number;
}

export function ReadOnlySlotDisplay({ slots, slotCount }: Props) {
  const getSlotData = (slotNumber: number) => {
    return slots.find(s => s.slot_number === slotNumber);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {Array.from({ length: slotCount }, (_, i) => i + 1).map((slotNum) => {
        const slot = getSlotData(slotNum);
        const capacity = slot?.toy_capacity || 20;
        const currentStock = slot?.toy_current_stock || 0;
        const stockPercentage = capacity > 0 ? (currentStock / capacity) * 100 : 0;
        const isLowStock = stockPercentage < 25;
        const isEmpty = !slot?.product_id;

        return (
          <div 
            key={slotNum} 
            className={`p-2 rounded-md border ${
              isEmpty 
                ? 'bg-muted/30 border-dashed border-muted-foreground/30' 
                : isLowStock 
                  ? 'bg-red-500/5 border-red-500/20' 
                  : 'bg-background border-border'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Package className="h-3 w-3" />
                Slot {slotNum}
              </span>
              {isLowStock && !isEmpty && (
                <AlertTriangle className="h-3 w-3 text-red-500" />
              )}
            </div>
            
            {isEmpty ? (
              <p className="text-xs text-muted-foreground italic">Empty</p>
            ) : (
              <div className="space-y-1">
                <p className="text-xs font-medium truncate" title={slot?.products?.product_name}>
                  {slot?.products?.product_name || 'Unknown Product'}
                </p>
                <div className="flex items-center justify-between text-xs">
                  <span className={`${isLowStock ? 'text-red-600' : 'text-muted-foreground'}`}>
                    {currentStock}/{capacity}
                  </span>
                  <Badge 
                    variant={isLowStock ? 'destructive' : stockPercentage < 50 ? 'secondary' : 'default'}
                    className="text-[10px] h-4 px-1"
                  >
                    {stockPercentage.toFixed(0)}%
                  </Badge>
                </div>
                <Progress 
                  value={stockPercentage} 
                  className={`h-1 ${isLowStock ? '[&>div]:bg-red-500' : ''}`}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
