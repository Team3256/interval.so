import { TeamSlugProvider } from '@/src/components/team-dashboard/team-slug-provider';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
	params: {
		team: string;
	};
}>;

// biome-ignore lint/style/noDefaultExport: This must be a default export
export default function TeamPageLayout({ params, children }: Props) {
	return <TeamSlugProvider team={{ slug: params.team }}>{children}</TeamSlugProvider>;
}