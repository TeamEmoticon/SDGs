import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "안심글 - 문자·인터넷 글 사기 예방",
    short_name: "안심글",
    description: "문자와 인터넷 글의 사기·보이스피싱 위험을 쉬운 말로 알려드립니다.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    background_color: "#fffdf7",
    theme_color: "#fffdf7",
    lang: "ko",
    orientation: "portrait-primary",
    categories: ["utilities", "security", "education"],
    icons: [
      {
        src: "/icons/ansimgle-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ansimgle-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/ansimgle-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/ansimgle-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/ansimgle-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
