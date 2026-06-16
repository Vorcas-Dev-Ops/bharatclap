import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "./AntdRegistry";
import { ConfigProvider, App } from "antd";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import AxiosInterceptor from "@/components/common/AxiosInterceptor";


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Home Services Marketplace - Book Trusted Professionals",
  description: "Modern, responsive home service marketplace — book trusted professionals for repairs, cleaning, and more.",
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
              <SettingsProvider>
                <CartProvider>
                  <AxiosInterceptor />
                  {children}
                </CartProvider>
              </SettingsProvider>
            </App>

          </ConfigProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
