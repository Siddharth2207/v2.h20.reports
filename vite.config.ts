import { sveltekit } from '@sveltejs/kit/vite';
import {} from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	optimizeDeps: {
		include: ['sushi/router', 'sushi/currency', 'sushi/tines', 'sushi/config', 'sushi/chain']
	},
	build: {
		commonjsOptions: {
			include: [/sushi\/router/, /sushi\/currency/, /sushi\/tines/, /sushi\/config/, /sushi\/chain/]
		},
		rollupOptions: {
			external: [
				/sushi\/[a-zA-Z0-9-_]/,
				/@ethersproject\/[a-zA-Z0-9-_]/,
				'buffer',
				'interval-tree-1d'
			]
		}
	},
	server: {
		fs: {
			// Allow serving files from the sushi package directory
			allow: [
				// // Default directories
				// 'src',
				// 'node_modules',
				// '.svelte-kit',
				// Add sushi package directory
				'./lib'
			]
		}
	},
	define: {
		'process.env': loadEnv('', process.cwd(), ''),
		'import.meta.vitest': 'undefined'
	}
});
