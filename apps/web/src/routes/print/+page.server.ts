import type { PageServerLoad } from './$types';
import { artifact } from '$lib/server/artifact.ts';
import { buildPageModel } from '$lib/sections/model.ts';

/** The CV: the same page model as `/`, laid out for one A4 sheet. `bun content:render` prints it. */
export const load: PageServerLoad = () => ({
  model: buildPageModel(artifact.nodes, artifact.edges),
});
