import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";
export const dynamic = "force-dynamic";
export default function Page(){return <Suspense fallback={<main style={{padding:64}}>Cargando...</main>}><LoginForm/></Suspense>}
