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
    default: "Vestidos de novia de segunda mano en México | SECOND VOW",
    template: "%s | SECOND VOW",
  },
  description: "Compra y vende vestidos de novia de segunda mano en México. Explora vestidos nuevos y usados, conversa con la vendedora y paga de forma segura.",
  applicationName: "SECOND VOW",
  verification: { google: "reVqMc0xMVVWK1xfyO8Zu9XPb3MwG9lNIBNectbxbmQ" },
  keywords: ["vestidos de novia de segunda mano", "vestidos de novia usados", "comprar vestido de novia", "vender vestido de novia", "vestidos de novia México"],
  alternates: { languages: { "es-MX": "/" } },
  openGraph: {
    type: "website",
    locale: "es_MX",
    url: "/",
    siteName: "SECOND VOW",
    title: "Vestidos de novia de segunda mano en México | SECOND VOW",
    description: "Encuentra o vende vestidos de novia nuevos y usados entre mujeres de todo México.",
    images: [{ url: "/images/hero-1.webp", width: 1600, height: 900, alt: "Vestido de novia disponible en SECOND VOW" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vestidos de novia de segunda mano en México | SECOND VOW",
    description: "Compra y vende vestidos de novia nuevos y usados en México.",
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
