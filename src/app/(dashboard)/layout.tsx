"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Package,
  Tags,
  ShoppingCart,
  BarChart3,
  Settings,
  Zap,
  Home,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ErrorBoundary } from "@/components/error-boundary";
import { cn } from "@/lib/utils";
import { UserProfile } from "@/components/user-profile";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Listings", href: "/listings", icon: Tags },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Autopilot", href: "/settings/autopilot", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 p-4">
      {navigation.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-3 md:py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}
    </nav>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <Package className="h-6 w-6" />
            ResellerOS
          </Link>
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <NavLinks />
          <UserProfile />
        </div>
      </aside>

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle className="flex items-center gap-2 font-bold text-lg">
              <Package className="h-6 w-6" />
              ResellerOS
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col justify-between h-[calc(100%-65px)]">
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <UserProfile />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header with hamburger */}
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </Button>
          <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
            <Package className="h-5 w-5" />
            ResellerOS
          </Link>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="container py-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
