module.exports = {
  input: "./src/dropcursor.js",
  output: {format: "cjs", file: "dist/dropcursor.js"},
  sourcemap: true,
  plugins: [require("rollup-plugin-buble")()],
  external(id) { return !/^[\.\/]/.test(id) }
}
