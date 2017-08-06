module.exports = {
  entry: "./src/dropcursor.js",
  dest: "dist/dropcursor.js",
  format: "cjs",
  sourceMap: true,
  plugins: [require("rollup-plugin-buble")()],
  external(id) { return !/^[\.\/]/.test(id) }
}
