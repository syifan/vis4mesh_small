const path = require("path");
const {
	webpack
} = require("webpack");

module.exports = {
	mode: 'development',
	entry: './src/index.ts',
	devtool: 'inline-source-map',
	devServer: {
		static: './dist',
		port: 1234,
	},
	module: {
		rules: [{
			test: /\.tsx?$/,
			use: "ts-loader",
			exclude: /node_modules/,
		}]
	},
	resolve: {
		extensions: [".ts", ".js"]
	},
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist')
	}
}