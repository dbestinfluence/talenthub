import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Sharp menggunakan native binary.
   * Biarkan Sharp dijalankan sebagai package eksternal di server.
   */
  serverExternalPackages: ["sharp"],

  /*
   * Pastikan binary Sharp dan libvips untuk Linux ikut dimasukkan
   * ke Vercel Function Quick Search.
   */
  outputFileTracingIncludes: {
    "/api/discovery/quick-search": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
};

export default nextConfig;