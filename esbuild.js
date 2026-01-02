const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const copyHtmlPlugin = {
	name: 'copy-html',
	setup(build) {
		build.onEnd(() => {
			const destDir = path.join(__dirname, 'dist', 'webview');
			
			if (!fs.existsSync(destDir)) {
				fs.mkdirSync(destDir, { recursive: true });
			}
			
			// Copy HTML
			const srcHtmlPath = path.join(__dirname, 'src', 'webview', 'strucdbgView.html');
			const destHtmlPath = path.join(destDir, 'strucdbgView.html');
			fs.copyFileSync(srcHtmlPath, destHtmlPath);
			console.log('[copy] HTML copied to dist/webview/');
			
			// Copy CSS
			const srcCssPath = path.join(__dirname, 'src', 'webview', 'styles.css');
			const destCssPath = path.join(destDir, 'styles.css');
			if (fs.existsSync(srcCssPath)) {
				fs.copyFileSync(srcCssPath, destCssPath);
				console.log('[copy] CSS copied to dist/webview/');
			}
			
			// Copy JavaScript
			const srcJsPath = path.join(__dirname, 'src', 'webview', 'webview.js');
			const destJsPath = path.join(destDir, 'webview.js');
			if (fs.existsSync(srcJsPath)) {
				fs.copyFileSync(srcJsPath, destJsPath);
				console.log('[copy] JS copied to dist/webview/');
			}
		});
	}
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyAssetsPlugin = {
	name: 'copy-assets',
	setup(build) {
		build.onEnd(() => {
			const srcAssetsDir = path.join(__dirname, 'src', 'webview', 'assets');
			const destAssetsDir = path.join(__dirname, 'dist', 'webview', 'assets');

			if (!fs.existsSync(srcAssetsDir)) {
				// nothing to copy
				return;
			}
			if (!fs.existsSync(destAssetsDir)) {
				fs.mkdirSync(destAssetsDir, { recursive: true });
			}

			const entries = fs.readdirSync(srcAssetsDir);
			entries.forEach((name) => {
				const srcPath = path.join(srcAssetsDir, name);
				const destPath = path.join(destAssetsDir, name);
				const stat = fs.statSync(srcPath);
				if (stat.isFile()) {
					fs.copyFileSync(srcPath, destPath);
				} else if (stat.isDirectory()) {
					// copy directory recursively
					const copyDir = (from, to) => {
						if (!fs.existsSync(to)) fs.mkdirSync(to, { recursive: true });
						fs.readdirSync(from).forEach((entry) => {
							const f = path.join(from, entry);
							const t = path.join(to, entry);
							if (fs.statSync(f).isDirectory()) copyDir(f, t);
							else fs.copyFileSync(f, t);
						});
					};
					copyDir(srcPath, destPath);
				}
			});
			console.log('[copy] assets copied to dist/webview/assets/');
		});
	}
};

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyHtmlPlugin,
			copyAssetsPlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
