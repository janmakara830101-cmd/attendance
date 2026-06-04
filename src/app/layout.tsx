import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ប្រព័ន្ធគ្រប់គ្រងវត្តមាន និងប្រាក់ខែ",
  description: "Employee Attendance and Payroll Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="km">
      <body className="antialiased bg-gray-50 text-gray-900">
        {children}
      </body>
    </html>
  );
}
