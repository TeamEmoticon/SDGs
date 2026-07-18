import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "안심글 — 받은 문자·인터넷 글, 안전할까?",
  description:
    "문자나 인터넷 글을 붙여넣거나 주소만 넣으면, 사기·보이스피싱 위험을 쉬운 말로 알려드리는 SDGs 디지털 안전 도우미입니다.",
  applicationName: "안심글",
};

export const viewport: Viewport = {
  themeColor: "#0d9488",
  width: "device-width",
  initialScale: 1,
};

// Apply the saved font scale before paint so large-text users see no flash.
const FONT_SCRIPT = `(function(){try{var s=localStorage.getItem('ansim-font');if(s){var map={'normal':'16px','large':'18.5px','xl':'21px'};if(map[s]){document.documentElement.style.fontSize=map[s];}}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: FONT_SCRIPT }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
