"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { User, Settings, LogOut, ChevronDown } from "lucide-react";
import { useSupabaseAuth } from "@/lib/supabase-auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, session, signOut } = useSupabaseAuth();
  const isAuthenticated = !!session;

  const navigation = [
    { name: "Analyze", href: "/analyze" },
    { name: "Discovery", href: "/discovery" },
    { name: "Bookmarks", href: "/bookmarks" },
  ];

  const handleLogout = async () => {
    try {
      console.log('Attempting to sign out...');
      const { error } = await signOut();
      
      // Always redirect to login page regardless of whether signOut had an error
      // This handles cases where the session is already invalid but UI still shows user as logged in
      if (error) {
        console.log('Sign out had an error (possibly session already expired), but proceeding with logout:', error);
      } else {
        console.log('Sign out successful');
      }
      
      // Clear any local storage or cached data
      localStorage.clear();
      sessionStorage.clear();
      
      // Redirect to login page
      router.push('/login');
      router.refresh();
      
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      // Even if there's an error, clear local state and redirect
      localStorage.clear();
      sessionStorage.clear();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-20 items-center justify-between px-6">
        <Link href="/analyze" className="flex items-center space-x-3">
          <Image 
            src="/gaboojalogo.png" 
            alt="Gabooja" 
            width={40}
            height={40}
            className="h-10 w-auto transition-transform hover:scale-105 duration-200"
          />
        </Link>

        <nav className="flex items-center space-x-8">
          {navigation.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "text-base font-medium transition-all duration-200 px-4 py-2 rounded-full relative cursor-pointer",
                pathname === item.href
                  ? "text-foreground bg-primary/8 shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-primary/4"
              )}
            >
              {item.name}
              {pathname === item.href && (
                <div className="absolute inset-x-0 -bottom-3 h-0.5 bg-primary rounded-full" />
              )}
            </Link>
          ))}

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2 cursor-pointer hover:bg-primary/4 hover:text-foreground transition-all duration-200">
                  <User className="w-4 h-4" />
                  <span>{profile?.username || user?.username}</span>
                  <ChevronDown className="w-3 h-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{profile?.username || user?.username}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.username}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings" className="flex items-center space-x-2">
                    <Settings className="w-4 h-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleLogout();
                  }} 
                  className="text-red-600 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/login">
              <Button variant="outline" className="flex items-center space-x-2 cursor-pointer hover:bg-primary/4 hover:text-foreground transition-all duration-200">
                <User className="w-4 h-4" />
                <span>Sign in</span>
              </Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
} 