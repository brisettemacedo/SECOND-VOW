import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-site",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SecondVow | Vestidos de novia de segunda mano en México",
  description: "Marketplace de vestidos de novia de segunda mano en México.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={dmSans.variable}>
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
