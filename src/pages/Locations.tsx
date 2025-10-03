import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { MobileNav } from '@/components/MobileNav';
import { MapPin, Search, Phone, DollarSign } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address: string;
  contact_name: string;
  contact_phone: string;
  is_active: boolean;
  is_prospect: boolean;
  rent_amount: number;
}

export default function Locations() {
  const { user } = useAuth();
  const [locations, setLocations] = useState<Location[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLocations = async () => {
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('company_id', profile.company_id)
        .order('name');

      if (!error && data) {
        setLocations(data);
      }
      setLoading(false);
    };

    fetchLocations();
  }, [user]);

  const filteredLocations = locations.filter((location) =>
    location.name.toLowerCase().includes(search.toLowerCase()) ||
    location.address?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold mb-4">Locations</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search locations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : filteredLocations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {search ? 'No locations found' : 'No locations yet'}
            </CardContent>
          </Card>
        ) : (
          filteredLocations.map((location) => (
            <Card key={location.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 p-2 bg-primary/10 rounded-lg">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{location.name}</CardTitle>
                      {location.address && (
                        <p className="text-sm text-muted-foreground mt-1">{location.address}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {location.is_prospect && (
                      <Badge variant="outline">Prospect</Badge>
                    )}
                    <Badge variant={location.is_active ? 'default' : 'secondary'}>
                      {location.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {location.contact_name && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">Contact:</span>
                    <span>{location.contact_name}</span>
                  </div>
                )}
                {location.contact_phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{location.contact_phone}</span>
                  </div>
                )}
                {location.rent_amount && (
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${location.rent_amount}/month</span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </main>

      <MobileNav />
    </div>
  );
}
