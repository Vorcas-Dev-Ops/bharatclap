import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import StyledComponentsRegistry from "./AntdRegistry";
import { ConfigProvider, App } from "antd";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { SettingsProvider } from "@/context/SettingsContext";
import AxiosInterceptor from "@/components/common/AxiosInterceptor";
import { GoogleOAuthProvider } from "@react-oauth/google";
import OtpAlertModalClient from "@/components/common/OtpAlertModalClient";
import { GoogleMapsProvider } from "@/components/common/GoogleMapsProvider";
import NetworkStatusBanner from "@/components/common/NetworkStatusBanner";
import CookieConsentBanner from "@/components/common/CookieConsentBanner";
import { ChatProvider } from "@/context/ChatContext";

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
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
        <StyledComponentsRegistry>
          <ConfigProvider
            theme={{
              token: {
                colorPrimary: "#1D2B83",
                borderRadius: 8,
              },
            }}
          >
            {(() => {
              const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
              const hasValidGoogleClientId = Boolean(googleClientId && googleClientId !== "YOUR_GOOGLE_CLIENT_ID" && googleClientId.trim() !== "");
              const appContent = (
                <GoogleMapsProvider>
                  <App>
                    <AuthProvider>
                      <SettingsProvider>
                        <CartProvider>
                          <ChatProvider>
                            <AxiosInterceptor />
                            <OtpAlertModalClient />
                            <NetworkStatusBanner />
                            <CookieConsentBanner />
                            {children}
                          </ChatProvider>
                        </CartProvider>
                      </SettingsProvider>
                    </AuthProvider>
                  </App>
                </GoogleMapsProvider>
              );

              return hasValidGoogleClientId ? (
                <GoogleOAuthProvider clientId={googleClientId!}>
                  {appContent}
                </GoogleOAuthProvider>
              ) : (
                appContent
              );
            })()}
          </ConfigProvider>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
