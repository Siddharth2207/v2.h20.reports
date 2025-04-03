import { sveltekit } from '@sveltejs/kit/vite';
import {} from '@sveltejs/adapter-vercel';
import { defineConfig } from 'vite';
import { loadEnv } from 'vite';
// import path from 'path';

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
			external: ['sushi', 'sushi/currency', 'sushi/config', 'sushi/router', 'sushi/chain']
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
		'import.meta.vitest': 'undefined'
	}
});
