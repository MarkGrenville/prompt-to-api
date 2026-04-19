import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals, url }) => {
	if (!locals.uid) {
		throw redirect(303, `/login?from=${encodeURIComponent(url.pathname)}`);
	}
	return { uid: locals.uid, email: locals.email };
};
