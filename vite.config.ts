import { sveltekit } from '@sveltejs/kit/vite';
import {} from '@sveltejs/adapter-vercel'
import { defineConfig } from 'vite';
import {loadEnv} from "vite";

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'process.env': loadEnv('', process.cwd(),''),
		'import.meta.vitest': 'undefined'
	},
});