import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import {loadEnv} from "vite";
import { exec } from 'child_process';
import { promisify } from 'util';

// const execAsync = promisify(exec);

// function prepSushiPlugin() {
// 	return {
// 		name: 'prep-sushi',
// 		// This hook runs before the build starts
// 		async buildStart() {
// 			try {
// 				console.log('Running prep-sushi.sh...');
// 				await execAsync('chmod +x ./prep-sushi.sh && ./prep-sushi.sh');
// 				console.log('Running npm install...');
// 				await execAsync('npm install');
// 			} catch (error) {
// 				console.error('Error running scripts:', error);
// 				throw error;
// 			}
// 		}
// 	};
// }

export default defineConfig({
	plugins: [
		// prepSushiPlugin(),
		sveltekit()
	],
	define: {
		'process.env': loadEnv('', process.cwd(),''),
		'import.meta.vitest': 'undefined'
	},
});
