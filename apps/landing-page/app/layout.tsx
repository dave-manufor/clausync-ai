import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Particles } from "@/components/particles";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ClauSync.ai | AI-Powered Contract Monitoring",
  description: "Stop contract surprises before they cost you. ClauSync monitors vendor terms 24/7 and alerts you with AI-powered risk analysis—powered by Gemini 2.0 Flash.",
  keywords: ["contract monitoring", "legal tech", "AI", "terms of service", "compliance", "risk management"],
  openGraph: {
    title: "ClauSync.ai | AI-Powered Contract Monitoring",
    description: "Stop contract surprises before they cost you. ClauSync monitors vendor terms 24/7 with AI-powered risk analysis.",
    type: "website",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "ClauSync.ai | AI-Powered Contract Monitoring",
    description: "Stop contract surprises before they cost you. AI-powered contract monitoring.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} antialiased`}>
        {/* Animated Grid Background */}
        <div className="grid-background" aria-hidden="true" />
        
        {/* Floating Particles */}
        <Particles />
        
        {/* Aurora Glow Effects */}
        <div className="aurora-blob aurora-primary" style={{ top: '-200px', left: '30%' }} aria-hidden="true" />
        <div className="aurora-blob aurora-accent" style={{ top: '40%', right: '-100px' }} aria-hidden="true" />
        <div className="aurora-blob aurora-primary" style={{ bottom: '10%', left: '-200px', opacity: 0.2 }} aria-hidden="true" />
        
        {/* Noise Texture */}
        <div className="noise-overlay" aria-hidden="true" />
        
        {/* Main Content */}
        <div className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}

