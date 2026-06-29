const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: {
    app: path.resolve(__dirname, "src/scripts/index.js"),
  },
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "dist"),
  },
  module: {
    rules: [
      {
        test: /\.(png|jpe?g|gif)$/i,
        type: "asset/resource",
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ],
    parser: {
      javascript: {
        importMeta: true,
      },
    },
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "src/index.html"),
      scriptLoading: "module",
    }),
    new CopyWebpackPlugin({
      patterns: [
        // Aset publik (favicon, ikon PWA, manifest, _redirects) -> root dist.
        {
          from: path.resolve(__dirname, "src/public"),
          to: path.resolve(__dirname, "dist"),
        },
        // Model AI (model.json, weights.bin, metadata.json) -> dist/model.
        {
          from: path.resolve(__dirname, "src/model"),
          to: path.resolve(__dirname, "dist/model"),
        },
      ],
    }),
  ],
  stats: {
    warningsFilter: /import\.meta/,
  },
};
