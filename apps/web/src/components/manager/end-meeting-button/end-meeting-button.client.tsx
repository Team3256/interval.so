'use client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRightStartOnRectangleIcon } from '@heroicons/react/16/solid';
import type { TeamSchema } from '@hours.frc.sh/api/app/team/schemas/team_schema';
import clsx from 'clsx';
import { use } from 'react';
import { EndMeetingAlert, EndMeetingAlertTrigger } from '../end-meeting-alert';

type Props = {
	width?: 'full' | 'auto';
	enabledPromise: Promise<boolean>;
	team: Pick<TeamSchema, 'slug'>;
};

export function EndMeetingButtonClient({ width = 'auto', team, enabledPromise }: Props) {
	const enabled = use(enabledPromise);

	return (
		<EndMeetingAlert team={team}>
			<Tooltip>
				<TooltipTrigger asChild={true}>
					{/* biome-ignore lint/a11y/noNoninteractiveTabindex: This is interactive */}
					<span tabIndex={0} className={clsx({ 'w-full': width === 'full' })}>
						<EndMeetingAlertTrigger>
							<Button className='w-full' variant='outline' disabled={!enabled}>
								<ArrowRightStartOnRectangleIcon className='h-4 w-4 mr-2' />
								End meeting
							</Button>
						</EndMeetingAlertTrigger>
					</span>
				</TooltipTrigger>
				{!enabled && (
					<TooltipContent>
						<p>No meeting is currently in progress</p>
					</TooltipContent>
				)}
			</Tooltip>
		</EndMeetingAlert>
	);
}