import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill';
import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill';
import rollupNodePolyFill from 'rollup-plugin-node-polyfills';

export default defineConfig({
	plugins: [sveltekit()],
	resolve: {
		alias: {
			buffer: 'buffer/',
		}
	},
	optimizeDeps: {
		include: [
			'buffer',
			'sushi/router',
			'sushi/currency',
			'sushi/tines',
			'sushi/config',
			'sushi/chain'
		],
		esbuildOptions: {
			define: {
				global: 'globalThis'
			},
			plugins: [
				NodeGlobalsPolyfillPlugin({
					buffer: true
				}),
				NodeModulesPolyfillPlugin()
			]
		}
	},
	build: {
		rollupOptions: {
			plugins: [rollupNodePolyFill()],
			external: [
				/sushi\/[a-zA-Z0-9-_]/,
				/@ethersproject\/[a-zA-Z0-9-_]/,
				'interval-tree-1d' // keep external ones like this
			]
		},
		commonjsOptions: {
			include: [/sushi\/router/, /sushi\/currency/, /sushi\/tines/, /sushi\/config/, /sushi\/chain/]
		}
	},
	define: {
		'process.env': loadEnv('', process.cwd(), ''),
		'import.meta.vitest': 'undefined'
	}
});
