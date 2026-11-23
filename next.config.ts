import type { NextConfig } from "next";
import { marketingPhotoPatterns } from "./src/lib/marketing-console";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  images: {
    // /marketing 모델 카드 사진 — 마케팅 콘솔의 공개 사진 경로만 허락한다(src/lib/marketing-console.ts)
    remotePatterns: marketingPhotoPatterns(),
    // 로컬에서는 콘솔이 localhost:3100 이다 — 개발 중에만 내부 주소 사진을 줄이게 둔다
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
