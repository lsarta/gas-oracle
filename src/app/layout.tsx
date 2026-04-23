import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { PrivyProviders } from "@/components/providers/PrivyProviders";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.gyasss.com"),
  title: "Gyasss — Get paid to confirm gas prices",
  description:
    "A transaction-verified pricing oracle. Report a gas price, earn USDC. Built on Circle Nanopayments.",
  openGraph: {
    title: "Gyasss — Get paid to confirm gas prices",
    description:
      "A transaction-verified pricing oracle. Report a gas price, earn USDC. Built on Circle Nanopayments.",
    type: "website",
    siteName: "Gyasss",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gyasss — Get paid to confirm gas prices",
    description:
      "A transaction-verified pricing oracle. Report a gas price, earn USDC.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <PrivyProviders>{children}</PrivyProviders>
      </body>
    </html>
  );
}
