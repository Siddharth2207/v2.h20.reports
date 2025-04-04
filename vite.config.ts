import { sveltekit } from '@sveltejs/kit/vite';
import {} from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: [
			'sushi/router',
			'sushi/currency',
			'sushi/tines',
			'sushi/config',
			'sushi/chain',
			'buffer',
			// Add ethersproject packages that are being used
			'@ethersproject/bytes',
			'@ethersproject/constants',
			'@ethersproject/bignumber',
			'@ethersproject/contracts',
			'@ethersproject/providers',
			'@ethersproject/units',
			'@ethersproject/wallet',
			'@ethersproject/abstract-provider',
			'@ethersproject/abstract-signer'
		],
		esbuildOptions: {
			target: 'es2020'
		}
	},
	build: {
		target: 'es2020',
		rollupOptions: {
			external: [
				'sushi/router',
				'sushi/currency',
				'sushi/tines',
				'sushi/config',
				'sushi/chain',
				'buffer',
				'interval-tree-1d'
			]
		}
	},
	resolve: {
		alias: {
			// Add aliases for ethersproject packages
			'@ethersproject/bytes': '@ethersproject/bytes/lib.esm/index.js',
			'@ethersproject/constants': '@ethersproject/constants/lib.esm/index.js',
			'@ethersproject/bignumber': '@ethersproject/bignumber/lib.esm/index.js',
			'@ethersproject/contracts': '@ethersproject/contracts/lib.esm/index.js',
			'@ethersproject/providers': '@ethersproject/providers/lib.esm/index.js',
			'@ethersproject/units': '@ethersproject/units/lib.esm/index.js',
			'@ethersproject/wallet': '@ethersproject/wallet/lib.esm/index.js',
			'@ethersproject/abstract-provider': '@ethersproject/abstract-provider/lib.esm/index.js',
			'@ethersproject/abstract-signer': '@ethersproject/abstract-signer/lib.esm/index.js',
			process: 'process/browser',
			stream: 'stream-browserify',
			zlib: 'browserify-zlib',
			util: 'util'
		}
	},
	server: {
		fs: {
			// Allow serving files from the sushi package directory
			allow: [
				// Default directories
				'src',
				'node_modules',
				'.svelte-kit',
				// Add sushi package directory
				'./lib'
			]
		}
	},
	define: {
		'process.env': loadEnv('', process.cwd(), ''),
		'import.meta.vitest': 'undefined',
		global: 'globalThis'
	}
});
