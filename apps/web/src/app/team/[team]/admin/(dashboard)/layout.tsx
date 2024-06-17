import { AdminDashboardProvider } from '@/src/components/admin/dashboard/admin-dashboard-context';
import { AdminDashboardPeriodSelect } from '@/src/components/admin/dashboard/period-select';
import { CombinedHoursTile } from '@/src/components/admin/dashboard/tiles/combined-hours-tile';
import { LiveMemberCountTile } from '@/src/components/admin/dashboard/tiles/live-member-count-tile';
import { EndMeetingButton } from '@/src/components/admin/end-meeting-button/end-meeting-button';
import { MainContent } from '@/src/components/main-content';
import { PageHeader } from '@/src/components/page-header';
import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{
	params: {
		team: string;
	};
}>;

// biome-ignore lint/style/noDefaultExport: This must be a default export
export default function AdminDashboardLayout({ children, params }: Props) {
	const team = { slug: params.team };

	return (
		<AdminDashboardProvider>
			<PageHeader title='Dashboard' className='flex items-end'>
				<div className='flex gap-8'>
					<EndMeetingButton team={team} />
					<AdminDashboardPeriodSelect />
				</div>
			</PageHeader>
			<MainContent>
				<div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8'>
					<LiveMemberCountTile team={team} />
					<CombinedHoursTile />

					<div className='col-span-full'>{children}</div>
				</div>
			</MainContent>
		</AdminDashboardProvider>
	);
}
