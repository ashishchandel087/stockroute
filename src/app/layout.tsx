import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "StockRoute", template: "%s · StockRoute" },
  description: "Order booking and inventory for distributors",
  applicationName: "StockRoute",
  appleWebApp: { capable: true, title: "StockRoute", statusBarStyle: "default" },
  icons: { icon: "/pwa-icon/192", apple: "/pwa-icon/192" },
};

export const viewport: Viewport = {
  themeColor: "#1f63dc",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
