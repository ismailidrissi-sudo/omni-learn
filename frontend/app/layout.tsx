import type { Metadata } from "next";
import Script from "next/script";
import { Jost } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { BrandingProvider } from "@/components/providers/branding-provider";
import { GoogleAuthProvider } from "@/components/providers/google-auth-provider";
import { GoogleOneTapGlobal } from "@/components/auth/GoogleOneTapGlobal";
import { I18nProvider } from "@/lib/i18n/context";
import { LandingFooter } from "@/components/landing";
import { ScrollToHash } from "@/components/ui/scroll-to-hash";
import { ToastContainer } from "@/components/ui/toast";
import { SessionTracker } from "@/components/providers/session-tracker";
import { ReferralParamCapture } from "@/components/providers/referral-param-capture";
import "./globals.css";

const GA_MEASUREMENT_ID = "G-F5378K8LEG";

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
      <head>
        <Script
          id="google-tag-manager"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-TKWB89XQ');`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans bg-[#F5F5DC] text-[#1a1212] dark:bg-[#0f1510] dark:text-[#F5F5DC]">
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-TKWB89XQ"
            height={0}
            width={0}
            style={{ display: "none", visibility: "hidden" }}
            title="Google Tag Manager"
          />
        </noscript>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics-gtag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem storageKey="omnilearn-theme">
          <GoogleAuthProvider>
            <GoogleOneTapGlobal />
            <I18nProvider>
              <BrandingProvider>
                <ScrollToHash />
                <ReferralParamCapture />
                <ToastContainer />
                <SessionTracker />
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
