import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/vestidos", "/vestidos/", "/como-funciona", "/vender-vestido-de-novia", "/nosotros", "/faq"],
      disallow: [
        "/admin", "/api", "/auth", "/cuenta", "/favoritos", "/mensajes",
        "/mis-vestidos", "/ofertas", "/pedidos", "/publicar", "/recuperar",
        "/actualizar-password", "/verificar-identidad", "/login", "/signup", "/registro",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
