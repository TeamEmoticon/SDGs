import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import PwaRegistration from "@/components/PwaRegistration";
import "./globals.css";

export const metadata: Metadata = {
  title: "안심글 — 받은 문자·인터넷 글, 안전할까?",
  description:
    "문자나 인터넷 글을 붙여넣거나 주소만 넣으면, 사기·보이스피싱 위험을 쉬운 말로 알려드리는 SDGs 디지털 안전 도우미입니다.",
  applicationName: "안심글",
  icons: {
    icon: [{ url: "/icons/ansimgle-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/ansimgle-icon-512.png", sizes: "512x512", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#fffdf7",
  width: "device-width",
  initialScale: 1,
};

const PREFERENCE_SCRIPT = `(function(){try{var root=document.documentElement;var scale=localStorage.getItem('ansim-font');var fontMap={'normal':'18px','large':'20px','xl':'22px'};if(scale&&fontMap[scale]){root.style.fontSize=fontMap[scale];}var contrast=localStorage.getItem('ansim-contrast');root.dataset.contrast=contrast==='high'?'high':'normal';}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCE_SCRIPT }} />
      </head>
      <body className="min-h-[100dvh] antialiased">
        {children}
        <PwaRegistration />
      </body>
    </html>
  );
}
