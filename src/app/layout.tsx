import type { Metadata } from "next";
import { Tajawal } from "next/font/google";
import "./globals.css";
import { PinGate } from "@/components/PinGate";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "مُعبِّر الأحلام",
  description:
    "طبّق يفسّر أحلامك اعتماداً على مراجع تفسير الأحلام الإسلامية، ويحفظ رحلتك مع الأحلام.",
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
      </head>
      <body className="font-sans antialiased">
        <PinGate />
        {children}
      </body>
    </html>
  );
}
