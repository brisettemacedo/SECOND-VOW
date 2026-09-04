import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/server/adminSupabase";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(_request: Request,{params}:{params:Promise<{path:string[]}>}){
 const {path:segments}=await params;
 const path=segments.join("/");
 if(!path||path.includes("..")) return new NextResponse("Ruta inválida",{status:400});

 const admin=createAdminClient();
 const {data:photo}=await admin.from("dress_photos").select("dress_id").eq("storage_path",path).maybeSingle();
 if(!photo)return new NextResponse("Imagen no disponible",{status:404});
 const {data:dress}=await admin.from("dresses").select("seller_id,status,removed_by_seller_at").eq("id",photo.dress_id).maybeSingle();
 if(!dress||dress.removed_by_seller_at)return new NextResponse("Imagen no disponible",{status:404});

 const publiclyVisible=dress.status==="approved";
 if(!publiclyVisible){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  let allowed=user?.id===dress.seller_id;
  if(user&&!allowed){
   const {data:profile}=await supabase.from("profiles").select("role").eq("id",user.id).maybeSingle();
   allowed=profile?.role==="admin";
  }
  if(!allowed)return new NextResponse("No autorizado",{status:403});
 }

 const {data,error}=await admin.storage.from("dress-images").createSignedUrl(path,60*60);
 if(error||!data?.signedUrl)return new NextResponse("Imagen no disponible",{status:404});
 return NextResponse.redirect(data.signedUrl,{status:307,headers:{"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}
