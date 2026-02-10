import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "./components/Header";
import AuthModalWrapper from "./components/AuthModalWrapper";
import SiteFooter from "./components/SiteFooter";
import OverscrollGuard from "./components/OverscrollGuard";
import SplashScreen from "./components/SplashScreen";

export const metadata: Metadata = {
  title: "ALLCLOTHES",
  description: "Minimal global streetwear catalog MVP",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fff" }}>
          <Header />

          <div style={{ flex: 1, background: "#fff" }}>{children}</div>

          <SiteFooter />

          <AuthModalWrapper />
          <OverscrollGuard />
          <SplashScreen />
        </div>
      </body>
    </html>
  );
}
