import Link from "next/link";
import { Package, TrendingUp, Zap, ShoppingCart } from "lucide-react";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between text-sm">
        <h1 className="text-4xl font-bold text-center mb-4">
          Welcome to ResellerOS
        </h1>
        <p className="text-xl text-muted-foreground text-center mb-12">
          Your AI-powered operating system for reselling
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <FeatureCard
            icon={<Package className="h-8 w-8" />}
            title="Smart Inventory"
            description="AI-generated listings from photos. Track cost basis, floor prices, and profit margins."
          />
          <FeatureCard
            icon={<TrendingUp className="h-8 w-8" />}
            title="Cross-List Everywhere"
            description="Native eBay integration. Assisted templates for Poshmark, Mercari, and more."
          />
          <FeatureCard
            icon={<Zap className="h-8 w-8" />}
            title="Autopilot Mode"
            description="Auto-accept offers, smart repricing, and instant delist-on-sale across platforms."
          />
          <FeatureCard
            icon={<ShoppingCart className="h-8 w-8" />}
            title="Profit Tracking"
            description="Real fee calculations, cost tracking, and analytics to maximize your margins."
          />
        </div>

        <div className="flex justify-center gap-4">
          <Link
            href="/inventory"
            className="rounded-lg bg-primary px-6 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <div className="mb-4 text-primary">{icon}</div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
