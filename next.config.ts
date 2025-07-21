import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Reduce webpack caching issues in development
  webpack: (config, { dev }) => {
    if (dev) {
      // Reduce cache-related issues in development
      config.cache = {
        type: 'memory',
      };
      
      // Reduce file watching issues
      config.watchOptions = {
        ignored: ['**/node_modules', '**/.git'],
        aggregateTimeout: 300,
        poll: 1000,
      };
    }
    return config;
  },
  
  // Improve development experience
  experimental: {
    // Reduce memory usage in development
    optimizeCss: false,
  },
};

export default nextConfig;
