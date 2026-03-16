import type { Metadata } from "next";
import { Jost } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { GoogleAuthProvider } from "@/components/providers/google-auth-provider";
import { I18nProvider } from "@/lib/i18n/context";
import { LandingFooter } from "@/components/landing";
import { ScrollToHash } from "@/components/ui/scroll-to-hash";
import { ToastContainer } from "@/components/ui/toast";
import "./globals.css";

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-futura",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OmniLearn.space — The Platform That Learns With You | Afflatus Consulting Group",
  description:
    "One platform. Every way to learn. Democratizing learning for everyone — structured courses, micro-learning, podcasts, implementation guides, gamification, and social learning. Your space. Every skill. For everyone.",
  keywords: ["OmniLearn", "LMS", "democratizing learning", "corporate training", "Afflatus Consulting Group", "micro-learning", "social learning"],
  icons: {
    icon: "/omni-learn-logo.png",
    shortcut: "/omni-learn-logo.png",
    apple: "/omni-learn-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jost.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen font-sans bg-[#F5F5DC] text-[#1a1212] dark:bg-[#0f1510] dark:text-[#F5F5DC]">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="omnilearn-theme">
          <GoogleAuthProvider>
            <I18nProvider>
              <BrandingProvider>
                <ScrollToHash />
                <ToastContainer />
                <div className="flex min-h-screen flex-col">
                  <main className="flex-1">{children}</main>
                  <LandingFooter />
                </div>
              </BrandingProvider>
            </I18nProvider>
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
