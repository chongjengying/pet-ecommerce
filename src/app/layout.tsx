import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/components/AuthContext";
import AppChrome from "@/components/AppChrome";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PAWLUXE – Premium Pet Store",
  description: "PAWLUXE premium pet supplies and professional dog grooming services.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} font-sans antialiased`}>
        <AuthProvider>
          <CartProvider>
            <AppChrome>{children}</AppChrome>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
