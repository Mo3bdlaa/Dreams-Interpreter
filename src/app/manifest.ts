import type { MetadataRoute } from "next";

// Served by Next.js at /manifest.webmanifest (and linked automatically).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "مُعبِّر الأحلام",
    short_name: "مُعبِّر",
    description:
      "تطبيق يفسّر أحلامك اعتماداً على مراجع تفسير الأحلام الإسلامية الكلاسيكية، ويحفظ رحلتك مع الأحلام.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0b29",
    theme_color: "#0e0b29",
    lang: "ar",
    dir: "rtl",
    categories: ["lifestyle", "education"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
