/** @type {import('next').NextConfig} */
const path = require("path");

const nextConfig = {
  transpilePackages: ["backend"],
  outputFileTracingRoot: path.join(__dirname, ".."),
  images: {
    remotePatterns: [],
    unoptimized: true,
  },
};

module.exports = nextConfig;
