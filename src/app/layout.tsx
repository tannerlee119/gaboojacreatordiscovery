import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ConditionalNavbar } from "@/components/layout/conditional-navbar";
import { CreatorProvider } from "@/lib/creator-context";
import { SupabaseAuthProvider } from "@/lib/supabase-auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gabooja - Creator Discovery Platform",
  description: "Discover and analyze Instagram and TikTok creators with real-time engagement metrics",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-background text-foreground">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        <SupabaseAuthProvider>
          <CreatorProvider>
            <ConditionalNavbar />
            <main className="min-h-screen bg-background text-foreground">
              {children}
            </main>
          </CreatorProvider>
        </SupabaseAuthProvider>
      </body>
    </html>
  );
}
