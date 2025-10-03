import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { MobileNav } from '@/components/MobileNav';
import { toast } from 'sonner';
import { Camera, AlertCircle, Loader2 } from 'lucide-react';

interface Location {
  id: string;
  name: string;
}

interface Toy {
  id: string;
  name: string;
  cogs: number;
}

export default function VisitReport() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [toys, setToys] = useState<Toy[]>([]);
  
  const [selectedLocation, setSelectedLocation] = useState('');
  const [isJammed, setIsJammed] = useState(false);
  const [jamStatus, setJamStatus] = useState('');
  const [hasObservation, setHasObservation] = useState(false);
  const [observation, setObservation] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  
  // Stock tracking for up to 7 toys
  const [toyStock, setToyStock] = useState<Record<string, { lastStock: number; currentStock: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      // Fetch locations
      const { data: locationsData } = await supabase
        .from('locations')
        .select('id, name')
        .eq('company_id', profile.company_id)
        .eq('is_active', true)
        .order('name');

      if (locationsData) setLocations(locationsData);

      // Fetch toys
      const { data: toysData } = await supabase
        .from('toys')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');

      if (toysData) {
        setToys(toysData);
        // Initialize stock tracking
        const initialStock: Record<string, { lastStock: number; currentStock: number }> = {};
        toysData.forEach(toy => {
          initialStock[toy.id] = { lastStock: 0, currentStock: 0 };
        });
        setToyStock(initialStock);
      }
    };

    fetchData();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedLocation) {
      toast.error('Please select a location');
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user!.id)
        .single();

      if (!profile) throw new Error('Profile not found');

      // Create visit report
      const { data: report, error: reportError } = await supabase
        .from('visit_reports')
        .insert({
          company_id: profile.company_id,
          location_id: selectedLocation,
          employee_id: user!.id,
          photo_url: photoUrl || null,
          is_jammed: isJammed,
          jam_status: isJammed ? jamStatus : null,
          has_observation: hasObservation,
          observation_text: hasObservation ? observation : null,
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Insert stock records for each toy with changes
      const stockRecords = Object.entries(toyStock)
        .filter(([_, stock]) => stock.currentStock > 0 || stock.lastStock > 0)
        .map(([toyId, stock]) => ({
          visit_report_id: report.id,
          toy_id: toyId,
          last_stock: stock.lastStock,
          current_stock: stock.currentStock,
        }));

      if (stockRecords.length > 0) {
        const { error: stockError } = await supabase
          .from('visit_report_stock')
          .insert(stockRecords);

        if (stockError) throw stockError;
      }

      toast.success('Visit report submitted successfully!');
      
      // Reset form
      setSelectedLocation('');
      setIsJammed(false);
      setJamStatus('');
      setHasObservation(false);
      setObservation('');
      setPhotoUrl('');
      const resetStock: Record<string, { lastStock: number; currentStock: number }> = {};
      toys.forEach(toy => {
        resetStock[toy.id] = { lastStock: 0, currentStock: 0 };
      });
      setToyStock(resetStock);
    } catch (error) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const updateToyStock = (toyId: string, field: 'lastStock' | 'currentStock', value: number) => {
    setToyStock(prev => ({
      ...prev,
      [toyId]: {
        ...prev[toyId],
        [field]: value,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold">Visit Report</h1>
          <p className="text-sm text-muted-foreground mt-1">Submit field service data</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Location & Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="photo">Photo URL</Label>
                <div className="flex gap-2">
                  <Camera className="h-5 w-5 text-muted-foreground mt-2" />
                  <Input
                    id="photo"
                    type="url"
                    placeholder="https://..."
                    value={photoUrl}
                    onChange={(e) => setPhotoUrl(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="jammed" className="text-base">Machine Jammed?</Label>
                  <p className="text-sm text-muted-foreground">Toggle if machine has issues</p>
                </div>
                <Switch
                  id="jammed"
                  checked={isJammed}
                  onCheckedChange={setIsJammed}
                />
              </div>

              {isJammed && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="jamStatus">Jam Status *</Label>
                  <Input
                    id="jamStatus"
                    placeholder="e.g., Blocked by coin, Display failure"
                    value={jamStatus}
                    onChange={(e) => setJamStatus(e.target.value)}
                    required={isJammed}
                  />
                </div>
              )}

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="observation" className="text-base">General Observation?</Label>
                  <p className="text-sm text-muted-foreground">Add notes about this visit</p>
                </div>
                <Switch
                  id="observation"
                  checked={hasObservation}
                  onCheckedChange={setHasObservation}
                />
              </div>

              {hasObservation && (
                <div className="space-y-2 animate-fade-in">
                  <Label htmlFor="observationText">Observation Notes *</Label>
                  <Textarea
                    id="observationText"
                    placeholder="Enter your observations..."
                    value={observation}
                    onChange={(e) => setObservation(e.target.value)}
                    required={hasObservation}
                    rows={3}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Stock Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {toys.slice(0, 7).map((toy, index) => (
                <div key={toy.id} className="space-y-3 pb-4 border-b last:border-0">
                  <div className="flex items-center justify-between">
                    <Label className="font-semibold">Toy {index + 1}: {toy.name}</Label>
                    <span className="text-sm text-muted-foreground">
                      COGS: ${toy.cogs.toFixed(2)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`last-${toy.id}`} className="text-sm">Last Stock</Label>
                      <Input
                        id={`last-${toy.id}`}
                        type="number"
                        min="0"
                        value={toyStock[toy.id]?.lastStock || 0}
                        onChange={(e) => updateToyStock(toy.id, 'lastStock', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`current-${toy.id}`} className="text-sm">Current Stock</Label>
                      <Input
                        id={`current-${toy.id}`}
                        type="number"
                        min="0"
                        value={toyStock[toy.id]?.currentStock || 0}
                        onChange={(e) => updateToyStock(toy.id, 'currentStock', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                  {toyStock[toy.id] && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Variance: </span>
                      <span className={
                        toyStock[toy.id].currentStock - toyStock[toy.id].lastStock > 0
                          ? 'text-success font-medium'
                          : toyStock[toy.id].currentStock - toyStock[toy.id].lastStock < 0
                          ? 'text-warning font-medium'
                          : 'text-muted-foreground'
                      }>
                        {toyStock[toy.id].currentStock - toyStock[toy.id].lastStock > 0 ? '+' : ''}
                        {toyStock[toy.id].currentStock - toyStock[toy.id].lastStock}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Report'
            )}
          </Button>
        </form>
      </main>

      <MobileNav />
    </div>
  );
}
