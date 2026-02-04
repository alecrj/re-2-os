"use client";

import Link from "next/link";
import {
  Package,
  Tags,
  ShoppingCart,
  BarChart3,
  Settings,
  Zap,
  Home,
} from "lucide-react";
import { ErrorBoundary } from "@/components/error-boundary";

const navigation = [
  { name: "Dashboard", href: "/inventory", icon: Home },
  { name: "Inventory", href: "/inventory", icon: Package },
  { name: "Listings", href: "/listings", icon: Tags },
  { name: "Orders", href: "/orders", icon: ShoppingCart },
  { name: "Analytics", href: "/analytics", icon: BarChart3 },
  { name: "Autopilot", href: "/settings/autopilot", icon: Zap },
  { name: "Settings", href: "/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card">
        <div className="flex h-16 items-center border-b px-6">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <Package className="h-6 w-6" />
            ResellerOS
          </Link>
        </div>
        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Main content with error boundary */}
      <main className="flex-1 overflow-auto">
        <div className="container py-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
