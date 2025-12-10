import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Settings } from 'lucide-react';

interface Setup {
  id: string;
  name: string;
}

interface AssignSetupDialogProps {
  spotId: string;
  currentSetupId: string | null;
  setups: Setup[];
}

export function AssignSetupDialog({ spotId, currentSetupId, setups }: AssignSetupDialogProps) {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedSetupId, setSelectedSetupId] = useState(currentSetupId || '');

  const assignSetupMutation = useMutation({
    mutationFn: async (setupId: string | null) => {
      const { error } = await supabase
        .from('location_spots')
        .update({ setup_id: setupId })
        .eq('id', spotId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location_spots'] });
      setIsOpen(false);
      toast.success('Setup assigned successfully');
    },
    onError: (error) => {
      toast.error('Failed to assign setup: ' + error.message);
    },
  });

  const handleAssign = () => {
    assignSetupMutation.mutate(selectedSetupId === 'none' ? null : selectedSetupId || null);
  };

  const currentSetup = setups.find(s => s.id === currentSetupId);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs">
          <Settings className="h-3 w-3 mr-1" />
          {currentSetup ? currentSetup.name : 'Assign Setup'}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Setup to Spot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <Select value={selectedSetupId || 'none'} onValueChange={setSelectedSetupId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a setup" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Setup</SelectItem>
              {setups.map((setup) => (
                <SelectItem key={setup.id} value={setup.id}>
                  {setup.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button 
            onClick={handleAssign} 
            className="w-full"
            disabled={assignSetupMutation.isPending}
          >
            {assignSetupMutation.isPending ? 'Assigning...' : 'Save Assignment'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
