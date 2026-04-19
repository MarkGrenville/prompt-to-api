import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		port: 5260,
		strictPort: true
	},
	preview: {
		port: 5261,
		strictPort: true
	}
});
