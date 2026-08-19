import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(_request: Request,{params}:{params:Promise<{path:string[]}>}){
 const {path:segments}=await params; const path=segments.join("/"); if(!path||path.includes("..")) return new NextResponse("Ruta inválida",{status:400});
 const supabase=await createClient(); const {data,error}=await supabase.storage.from("dress-images").download(path);
 if(error||!data)return new NextResponse("Imagen no disponible",{status:404});
 return new NextResponse(data,{headers:{"Content-Type":data.type||"application/octet-stream","Cache-Control":"public, max-age=300, stale-while-revalidate=3600","X-Content-Type-Options":"nosniff"}});
}
