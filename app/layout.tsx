import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import CookiePreferences from "@/components/CookiePreferences";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-site",
  display: "swap",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-logo",
  display: "swap",
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "SECOND VOW México | Vestidos de novia de segunda mano",
    template: "%s | SECOND VOW",
  },
  description: "SECOND VOW es el marketplace mexicano para comprar y vender vestidos de novia de segunda mano. Publica gratis, conversa y paga dentro de la plataforma.",
  applicationName: "SECOND VOW México",
  verification: { google: "reVqMc0xMVVWK1xfyO8Zu9XPb3MwG9lNIBNectbxbmQ" },
  keywords: ["vestidos de novia de segunda mano", "vestidos de novia usados", "comprar vestido de novia", "vender vestido de novia", "vestidos de novia México"],
  alternates: { languages: { "es-MX": "/" } },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/",
    siteName: "SECOND VOW México",
    title: "SECOND VOW México | Vestidos de novia de segunda mano",
    description: "Marketplace mexicano para comprar y vender vestidos de novia nuevos y usados entre mujeres de todo México.",
    images: [{ url: "/images/hero-1.webp", width: 1600, height: 900, alt: "Vestido de novia disponible en SECOND VOW" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "SECOND VOW México | Vestidos de novia de segunda mano",
    description: "Compra y vende vestidos de novia usados dentro de México en second-vow.com.",
    images: ["/images/hero-1.webp"],
  },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${dmSans.variable} ${cormorant.variable}`}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
        <CookiePreferences />
      </body>
    </html>
  );
}
