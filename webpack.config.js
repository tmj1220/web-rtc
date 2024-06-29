const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const vc = require("./version.config.json");
const pkg = require("./package.json");
const env = process.env.NODE_ENV;

module.exports = {
  entry: path.join(__dirname, "/example/main.tsx"),
  devtool: "eval-cheap-module-source-map",
  module: {
    rules: [
      //{
      //  test: /\.(ts|tsx)?$/,
      //  use: "ts-loader",
      //  exclude: /node_modules/,
      //},
      {
        test: /\.(ts|tsx)?$/,
        loader: "babel-loader",
        exclude: /node_modules/,
        options: {
          presets: [
            [
              "@babel/preset-env",
              {
                modules: false,
              },
            ],
            "@babel/preset-react",
            "@babel/preset-typescript",
          ],
          plugins: [
            [
              "@babel/plugin-transform-runtime",
              {
                absoluteRuntime: false,
                corjs: 2,
                helpers: true,
                regenerator: true,
                useESModules: false,
              },
            ],
          ],
        },
      },
      {
        test: /\.css$/,
        exclude: /node_modules/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "/src"),
      "~": path.join(__dirname, "/lib"),
      "!": path.join(__dirname, "/example"),
    },
    extensions: [".tsx", ".ts", ".js"],
  },
  output: {
    clean: true,
    path: path.join(__dirname, "/dist"),
    filename: "bundle.[chunkhash].js",
    publicPath: env
      ? `https://static.rokidcdn.com/${env}/${pkg.name}/${vc[env]}/`
      : "",
  },
  devServer: {
    port: 3001,
    https: true,
    allowedHosts: "all",
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "/example/public/index.html"),
    }),
  ],
};
