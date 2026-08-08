import type { Metadata } from "next";
import { Spectral, Archivo } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";
const spectral=Spectral({subsets:["latin"],weight:["400","500","600","700"],style:["normal","italic"],variable:"--font-heading",display:"swap"});
const archivo=Archivo({subsets:["latin"],variable:"--font-body",display:"swap"});
export const metadata:Metadata={title:"SecondVow — Vestidos de novia de segunda mano en México",description:"Marketplace de vestidos de novia de segunda mano en México."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es-MX" className={`${spectral.variable} ${archivo.variable}`}><body><SiteHeader/>{children}<SiteFooter/></body></html>}
