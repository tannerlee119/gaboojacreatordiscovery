"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  const navigation = [
    { name: "Analyze", href: "/" },
    { name: "Discovery", href: "/discovery" },
    { name: "Trending", href: "/trending" },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        <Link href="/" className="flex items-center space-x-3">
          <img 
            src="/gaboojalogo.png" 
            alt="Gabooja" 
            className="h-10 w-auto transition-transform hover:scale-105 duration-200"
          />
        </Link>

        <nav className="flex items-center space-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-sm font-medium transition-all duration-200 px-4 py-2 rounded-full relative",
                pathname === item.href
                  ? "gabooja-accent bg-primary/8 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/4"
              )}
            >
              {item.name}
              {pathname === item.href && (
                <div className="absolute inset-x-0 -bottom-3 h-0.5 gabooja-accent-bg rounded-full" />
              )}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
} 