import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "./AntdRegistry";
import { ConfigProvider, App } from "antd";
import { CartProvider } from "@/context/CartContext";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FIXVO - Your trusted partner for home services",
  description: "Modern, responsive home service marketplace UI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-slate-50/50" suppressHydrationWarning>
        <StyledComponentsRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#1D2B83", // Dark Blue from the design
                borderRadius: 8,
              },
            }}
          >
            <App>
              <CartProvider>
                {children}
              </CartProvider>
            </App>

          </ConfigProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
