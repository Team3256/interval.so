import { MainContent } from '@/src/components/main-content';
import { Navbar } from '@/src/components/navbar/navbar';
import { signupsEnabledFlag } from '@/src/flags';
import { trpcServer } from '@/src/trpc/trpc-server';
import { captureException } from '@sentry/nextjs';
import { unstable_noStore as noStore } from 'next/cache';
import type { ReactNode } from 'react';

type Props = {
	authed: ReactNode;
	landing: ReactNode;
};

// biome-ignore lint/style/noDefaultExport: This must be a default export
export default async function TeamSelectConditionalLayout({ authed, landing }: Props) {
	const signupsEnabled = signupsEnabledFlag();

	if (!signupsEnabled) {
		return landing;
	}

	noStore();

	try {
		const { user } = await trpcServer.user.getSelf.query();

		if (user) {
			return (
				<>
					<Navbar />

					<MainContent>{authed}</MainContent>
				</>
			);
		}

		return landing;
	} catch (error) {
		captureException(error);
		return landing;
	}
}