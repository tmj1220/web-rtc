import { join } from "path";
import babel from "rollup-plugin-babel";
import RollupTypescript from "rollup-plugin-typescript2";
import resolve from "rollup-plugin-node-resolve";
import commonjs from "rollup-plugin-commonjs";
import { eslint } from "rollup-plugin-eslint";
import copy from "rollup-plugin-copy";
import { terser } from "rollup-plugin-terser";
import { DEFAULT_EXTENSIONS } from "@babel/core";

// import pkg from "./package.json";

const paths = {
  input: join(__dirname, "src/index.ts"),
  output: join(__dirname, "/lib"),
};

export default {
  // 入口文件
  input: paths.input,
  // 出口配置
  output: [
    {
      // 打包名称
      name: "rokid-rtc-sdk",
      // 打包的文件
      file: join(paths.output, "rtc-sdk-min.js"),
      // 打包的格式，umd 支持 commonjs/amd/life 三种方式
      format: "cjs",
      exports: "auto",
    },
    {
      // 打包名称
      name: "rokid-rtc-sdk",
      // 打包的文件
      file: join(paths.output, "rtc-sdk.esm.js"),
      // 打包的格式，umd 支持 commonjs/amd/life 三种方式
      format: "es",
      exports: "auto",
    },
  ],
  plugins: [
    // 验证导入的文件
    eslint({
      throwOnError: true, // lint 结果出现错误即跑出异常
      throwOnWarning: true,
      include: ["/src/**/*.ts"], // 包含文件
      exclude: ["/node_modules/**", "/lib/**", "*.js", "/example/**"], // 排除文件
    }),
    // 支持 commonjs 规范
    commonjs({
      include: /node_modules/,
    }),
    // 配合 commonjs 解析第三方模块
    resolve({
      // 自定义参数
      preferBuiltins: true,
      mainFields: ["browser"],
      customResolveOptions: {
        moduleDirectory: "node_modules",
      },
    }),
    // ts解析
    RollupTypescript(),
    // 转译es5
    babel({
      runtimeHelpers: true,
      exclude: "node_modules/**",
      presets: ["@babel/preset-env"],
      extensions: [...DEFAULT_EXTENSIONS, ".ts", "tsx"],
      include: ["src/**/*"],
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
    }),
    // 混淆代码
    terser({
      compress: {
        drop_console: true,
      },
    }),
    // 复制文件
    copy({
      targets: [
        {
          src: "copy-file/*",
          dest: "lib/",
        },
      ],
    }),
  ],
};
