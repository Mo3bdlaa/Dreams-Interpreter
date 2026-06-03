import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { PinGate } from "@/components/PinGate";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  applicationName: "مُعبِّر الأحلام",
  title: "مُعبِّر الأحلام",
  description:
    "طبّق يفسّر أحلامك اعتماداً على مراجع تفسير الأحلام الإسلامية، ويحفظ رحلتك مع الأحلام.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "مُعبِّر",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0e0b29",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <head>
        {/* Apply saved theme before paint to avoid a flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('theme-light')}catch(e){}`,
          }}
        />
        {/* Register the service worker for offline support / installability. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <PinGate />
        {children}
      </body>
    </html>
  );
}
