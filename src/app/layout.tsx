import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Quản trị nội bộ — NTB Pharma New",
  description: "Hệ thống quản trị công việc nội bộ NTB Pharma New",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
