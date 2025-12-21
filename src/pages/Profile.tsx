import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MobileNav } from '@/components/MobileNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { 
  User, Building2, LogOut, Shield, Phone, MapPin, Car, Globe, Clock, 
  AlertTriangle, Calendar, Activity, Loader2, Edit2, Save, X
} from 'lucide-react';
import { toast } from 'sonner';

export default function Profile() {
  const { user, signOut, isAdmin } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [company, setCompany] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<any>({});
  const [stats, setStats] = useState({ machinesManaged: 0, routeCompletionRate: 0 });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*, companies(*)')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setProfile(profileData);
        setCompany(profileData.companies);
        setEditedProfile(profileData);
      }

      // Fetch stats
      const { count: machinesCount } = await supabase
        .from('machine_toy_slots')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', user.id);

      setStats(prev => ({ ...prev, machinesManaged: machinesCount || 0 }));
    };

    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);

    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editedProfile.first_name,
        last_name: editedProfile.last_name,
        phone_number: editedProfile.phone_number,
        job_title: editedProfile.job_title,
        preferred_language: editedProfile.preferred_language,
        timezone: editedProfile.timezone,
        emergency_contact_name: editedProfile.emergency_contact_name,
        emergency_contact_phone: editedProfile.emergency_contact_phone,
      })
      .eq('id', user.id);

    setIsSaving(false);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      setProfile(editedProfile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    }
  };

  const getInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    return profile?.email?.[0]?.toUpperCase() || 'U';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-8">
      <header className="bg-card border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold">Profile</h1>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => {
                setIsEditing(false);
                setEditedProfile(profile);
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        {/* Identity & Role Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Identity & Role
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url} />
                <AvatarFallback className="text-xl">{getInitials()}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                {isEditing ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>First Name</Label>
                      <Input 
                        value={editedProfile.first_name || ''} 
                        onChange={(e) => setEditedProfile({...editedProfile, first_name: e.target.value})}
                      />
                    </div>
                    <div>
                      <Label>Last Name</Label>
                      <Input 
                        value={editedProfile.last_name || ''} 
                        onChange={(e) => setEditedProfile({...editedProfile, last_name: e.target.value})}
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold">
                      {profile?.first_name} {profile?.last_name}
                    </h2>
                    <p className="text-muted-foreground">{profile?.email}</p>
                  </>
                )}
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Job Title</p>
                {isEditing ? (
                  <Input 
                    value={editedProfile.job_title || ''} 
                    onChange={(e) => setEditedProfile({...editedProfile, job_title: e.target.value})}
                    placeholder="e.g., Route Manager"
                  />
                ) : (
                  <p className="font-medium">{profile?.job_title || 'Not set'}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Employee ID</p>
                <p className="font-medium">{profile?.employee_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <Badge variant={isAdmin ? 'default' : 'secondary'} className="mt-1">
                  <Shield className="h-3 w-3 mr-1" />
                  {isAdmin ? 'Administrator' : 'Employee'}
                </Badge>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {profile?.account_status || 'Active'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Operational Details Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Operational Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" /> Phone Number
                </Label>
                {isEditing ? (
                  <Input 
                    value={editedProfile.phone_number || ''} 
                    onChange={(e) => setEditedProfile({...editedProfile, phone_number: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                  />
                ) : (
                  <p className="font-medium mt-1">{profile?.phone_number || 'Not set'}</p>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3 w-3" /> Assigned Territory
                </Label>
                <p className="font-medium mt-1">{profile?.assigned_territory || 'Not assigned'}</p>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Car className="h-3 w-3" /> Vehicle Assigned
                </Label>
                <p className="font-medium mt-1">{profile?.vehicle_assigned || 'None'}</p>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  Driver's License
                </Label>
                <p className="font-medium mt-1">{profile?.drivers_license_number ? '••••••' + profile.drivers_license_number.slice(-4) : 'Not on file'}</p>
              </div>
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Globe className="h-3 w-3" /> Language
                </Label>
                {isEditing ? (
                  <Input 
                    value={editedProfile.preferred_language || 'en'} 
                    onChange={(e) => setEditedProfile({...editedProfile, preferred_language: e.target.value})}
                    placeholder="en, es, etc."
                  />
                ) : (
                  <p className="font-medium mt-1 uppercase">{profile?.preferred_language || 'EN'}</p>
                )}
              </div>
              <div>
                <Label className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" /> Timezone
                </Label>
                {isEditing ? (
                  <Input 
                    value={editedProfile.timezone || 'UTC'} 
                    onChange={(e) => setEditedProfile({...editedProfile, timezone: e.target.value})}
                    placeholder="UTC, America/New_York, etc."
                  />
                ) : (
                  <p className="font-medium mt-1">{profile?.timezone || 'UTC'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance & Activity Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Performance & Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{formatDate(profile?.start_date || profile?.created_at)}</p>
                <p className="text-sm text-muted-foreground">Date Joined</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{formatDate(profile?.last_login_at)}</p>
                <p className="text-sm text-muted-foreground">Last Login</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{stats.machinesManaged}</p>
                <p className="text-sm text-muted-foreground">Slots Managed</p>
              </div>
              <div className="text-center p-3 bg-muted/50 rounded-lg">
                <p className="text-2xl font-bold">{formatDate(profile?.last_sync_at)}</p>
                <p className="text-sm text-muted-foreground">Last Sync</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety & Compliance Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Safety & Compliance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Emergency Contact Name</Label>
                {isEditing ? (
                  <Input 
                    value={editedProfile.emergency_contact_name || ''} 
                    onChange={(e) => setEditedProfile({...editedProfile, emergency_contact_name: e.target.value})}
                    placeholder="Contact name"
                  />
                ) : (
                  <p className="font-medium mt-1">{profile?.emergency_contact_name || 'Not set'}</p>
                )}
              </div>
              <div>
                <Label className="text-muted-foreground">Emergency Contact Phone</Label>
                {isEditing ? (
                  <Input 
                    value={editedProfile.emergency_contact_phone || ''} 
                    onChange={(e) => setEditedProfile({...editedProfile, emergency_contact_phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                  />
                ) : (
                  <p className="font-medium mt-1">{profile?.emergency_contact_phone || 'Not set'}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information Section */}
        {company && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Company Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Company Name</p>
                  <p className="font-medium">{company.legal_business_name || company.name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tax ID</p>
                  <p className="font-medium">{company.tax_id || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Support Email</p>
                  <p className="font-medium">{company.support_email || company.company_email || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Support Phone</p>
                  <p className="font-medium">{company.support_phone || company.phone_number || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Address</p>
                  <p className="font-medium">{company.hq_address || company.address || 'Not set'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Billing Currency</p>
                  <p className="font-medium">{company.billing_currency || 'USD'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sign Out */}
        <Card>
          <CardContent className="pt-6">
            <Button
              variant="destructive"
              onClick={signOut}
              className="w-full flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </main>

      <MobileNav />
    </div>
  );
}
