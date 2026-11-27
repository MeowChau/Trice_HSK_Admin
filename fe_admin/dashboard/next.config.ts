import type { NextConfig } from "next";

const svgLoader = {
  loader: "@svgr/webpack",
  options: {
    svgoConfig: {
      // Icons keep their intrinsic size and scale when CSS sets a different size.
      plugins: [
        { name: "preset-default", params: { overrides: { removeViewBox: false } } },
        "prefixIds",
      ],
    },
  },
};

const nextConfig: NextConfig = {
  output: "standalone",
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: [svgLoader],
    });
    return config;
  },
  turbopack: {
    // Keep module resolution inside this independently installed admin app.
    root: __dirname,
    rules: {
      "*.svg": {
        loaders: [svgLoader],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
