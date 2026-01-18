import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SideNav } from "./components/SideNav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://eric-fong.ca"),
  title: {
    default: "Historical Paintings of Toronto | Chinatown & Kensington Market",
    template: "%s | Eric Fong",
  },
  description:
    "Toronto artist creating historical paintings inspired by Chinatown and Kensington Market — capturing street life, local landmarks, and Toronto’s cultural history.",
  keywords: [
    "Toronto artist",
    "historical paintings",
    "Toronto Chinatown",
    "Kensington Market",
    "Toronto street scenes",
    "Toronto history",
    "Canadian painter",
    "original paintings Toronto",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: "/",
    title: "Historical Paintings of Toronto | Chinatown & Kensington Market",
    description:
      "Historical paintings inspired by Toronto’s Chinatown and Kensington Market — street scenes, landmarks, and local culture.",
    siteName: "Eric Fong",
    locale: "en_CA",
    images: [
      {
        url: "/og.jpg",
        width: 1200,
        height: 630,
        alt: "Historical painting of Toronto Chinatown / Kensington Market",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Historical Paintings of Toronto | Chinatown & Kensington Market",
    description:
      "Toronto artist painting Chinatown and Kensington Market through history, street life, and local landmarks.",
    images: ["/og.jpg"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  category: "art",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <div className="min-h-screen bg-white text-neutral-900">
          <div className="mx-auto flex max-w-6xl gap-10 px-4 pt-30 pb-12 lg:px-10 lg:pt-12 lg:pb-12 lg:translate-x-6">
            <SideNav />
            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
