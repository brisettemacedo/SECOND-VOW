import { Suspense } from "react";
import SignupForm from "@/components/SignupForm";
export const dynamic = "force-dynamic";
export default function Page(){return <Suspense fallback={<main style={{padding:64}}>Cargando...</main>}><SignupForm/></Suspense>}
