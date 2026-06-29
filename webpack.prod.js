const { merge } = require("webpack-merge");
const common = require("./webpack.common.js");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const WorkboxWebpackPlugin = require("workbox-webpack-plugin");

module.exports = merge(common, {
  mode: "production",
  devtool: false,
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
    ],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new MiniCssExtractPlugin({
      filename: "[name].[contenthash].css",
    }),
    new WorkboxWebpackPlugin.GenerateSW({
      swDest: "sw.js",
      clientsClaim: true,
      skipWaiting: true,
      // Naikkan batas agar weights.bin (~2MB) ikut di-precache.
      maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      // Precache semua aset hasil build + CopyWebpackPlugin (HTML/CSS/JS,
      // ikon, manifest, dan berkas MODEL: model.json, weights.bin, metadata.json).
      include: [/\.(html|css|js|json|bin|png|ico|webmanifest)$/],
      navigateFallback: "/index.html",
      navigateFallbackDenylist: [/^\/model\//, /^\/sw\.js$/],
      runtimeCaching: [
        // 1) Model Generative AI dari Hugging Face Hub (CacheFirst -> offline AI).
        {
          urlPattern:
            /^https:\/\/(huggingface\.co|cdn-lfs\.huggingface\.co|cdn-lfs-us-1\.hf\.co)\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "transformers-cache",
            expiration: {
              maxEntries: 60,
              maxAgeSeconds: 60 * 60 * 24 * 30,
            },
            cacheableResponse: { statuses: [0, 200] },
            rangeRequests: true,
          },
        },
        // 2) Library CDN (lucide, dll).
        {
          urlPattern: /^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\/.*/i,
          handler: "CacheFirst",
          options: {
            cacheName: "cdn-cache",
            expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
        // 3) Google Fonts.
        {
          urlPattern:
            /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
          handler: "StaleWhileRevalidate",
          options: {
            cacheName: "google-fonts",
            expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            cacheableResponse: { statuses: [0, 200] },
          },
        },
      ],
    }),
  ],
});
