import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "立项裁判",
  description: "把拍脑袋立项变成看证据立项。SABC 判决书。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
