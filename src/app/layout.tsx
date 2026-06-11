import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import Attribution from "./_components/Attribution";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "NextFlow — Advanced LLM Workflow Builder",
  description: "Build, execute, and monitor complex LLM workflows with React Flow and Trigger.dev.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={`${inter.variable} h-full antialiased`}>
        <body className="min-h-full flex flex-col font-sans bg-gray-50 text-gray-950">
          <Attribution />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
