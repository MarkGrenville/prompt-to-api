/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				// Dark-only palette — see docs/UXGuidelines.md
				ink: {
					950: '#07070a', // page background (below cards)
					900: '#0d0d12', // card surface
					800: '#14141a', // raised surface / input
					700: '#1f1f28', // border
					600: '#2a2a36'  // hover border
				},
				accent: {
					400: '#8b8cff',
					500: '#6366f1',
					600: '#4f46e5'
				}
			},
			fontFamily: {
				sans: [
					'Inter',
					'ui-sans-serif',
					'system-ui',
					'-apple-system',
					'Segoe UI',
					'Roboto',
					'sans-serif'
				],
				mono: [
					'ui-monospace',
					'SFMono-Regular',
					'Menlo',
					'monospace'
				]
			}
		}
	},
	plugins: []
};
