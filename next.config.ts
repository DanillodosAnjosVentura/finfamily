import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf2json', 'pdf-parse', 'pdfjs-dist'],
};

export default nextConfig;
