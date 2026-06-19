import path from "node:path";

/** @type {import(next).NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.modules = [
      path.join(process.cwd(), "node_modules"),
      ...(config.resolve.modules || []),
    ];
    return config;
  },
};

export default nextConfig;
