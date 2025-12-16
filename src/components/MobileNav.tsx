import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, MapPin, ClipboardList, User, Menu, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/lib/auth';
import { toast } from 'sonner';

export function MobileNav() {
  const { signOut } = useAuth();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/locations', icon: MapPin, label: 'Locations' },
    { to: '/visit-reports', icon: ClipboardList, label: 'Reports' },
  ];

  const menuItems = [
    { to: '/routes', label: 'Routes' },
    { to: '/maintenance', label: 'Maintenance' },
    { to: '/machines', label: 'Machines' },
    { to: '/setups', label: 'Setups' },
    { to: '/warehouse/components', label: 'Components' },
    { to: '/warehouse/products', label: 'Products' },
    { to: '/suppliers', label: 'Suppliers' },
    { to: '/purchases', label: 'Purchases' },
    { to: '/compliance', label: 'Compliance' },
    { to: '/feedback', label: 'Feedback' },
    { to: '/promotions', label: 'Promotions' },
    { to: '/profile', label: 'Profile' },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      setSheetOpen(false);
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 md:hidden">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center justify-center flex-1 h-full transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )
              }
            >
              <item.icon className="h-5 w-5 mb-1" />
              <span className="text-xs font-medium">{item.label}</span>
            </NavLink>
          ))}
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" className="flex flex-col items-center justify-center flex-1 h-full gap-0 p-0 rounded-none">
                <Menu className="h-5 w-5 mb-1" />
                <span className="text-xs font-medium">More</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh]">
              <SheetHeader>
                <SheetTitle>All Features</SheetTitle>
              </SheetHeader>
              <div className="grid gap-2 mt-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                {menuItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setSheetOpen(false)}
                    className={({ isActive }) =>
                      cn(
                        'block p-4 rounded-lg transition-colors font-medium',
                        isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
                <Button
                  variant="destructive"
                  className="w-full mt-4 justify-start p-4 h-auto"
                  onClick={() => {
                    setSheetOpen(false);
                    setShowSignOutDialog(true);
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>

      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You will be redirected to the login page and will need to sign in again to access your account.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
