'use client';

import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SortableHeader } from '@/src/components/data-tables/sortable-header';
import { formatDate, formatDateRange, formatDuration } from '@/src/utils/date-format';
import type { TeamMeetingSchema } from '@hours.frc.sh/api/app/team_meeting/schemas/team_meeting_schema';
import { Sort } from '@jonahsnider/util';
import type { ColumnDef, FilterFnOption } from '@tanstack/react-table';
import { type Duration, intervalToDuration, milliseconds } from 'date-fns';
import { useParams } from 'next/navigation';
import { DurationSlug, toTimeRange } from '../../period-select/duration-slug';
import { RowActionsDropdown } from './row-actions/row-actions-dropdown';

function inDateRange(date: Date, [start, end]: [Date | undefined, Date | undefined]): boolean {
	if (start && end) {
		return date >= start && date <= end;
	}

	if (start) {
		return date >= start;
	}

	if (end) {
		return date <= end;
	}

	return true;
}

export type GlobalFilterValue = { duration: DurationSlug; start: Date | undefined; end: Date | undefined };

export const globalFilterFn: FilterFnOption<TeamMeetingSchema> = (row, _columnId, filterValue: GlobalFilterValue) => {
	const timeRange = toTimeRange(filterValue);

	if (filterValue.duration !== DurationSlug.Custom && !row.original.endedAt) {
		// There is no end date, so the meeting is in progress, but you are querying for some duration relative to now
		// So, we always include the row, since the meeting is happening now
		return true;
	}

	return (
		inDateRange(row.original.startedAt, [timeRange.current.start, timeRange.current.end]) ||
		inDateRange(row.original.endedAt ?? new Date(), [timeRange.current.start, timeRange.current.end])
	);
};

export const columns: ColumnDef<TeamMeetingSchema>[] = [
	{
		id: 'title',
		accessorFn: (meeting) => formatDateRange(meeting.startedAt, meeting.endedAt),
		header: 'Title',
		cell: ({ getValue, row }) => {
			return (
				<div className='flex items-center gap-2'>
					<Tooltip>
						<TooltipTrigger asChild={true}>
							<p className='font-medium'>{getValue<string>()}</p>
						</TooltipTrigger>
						<TooltipContent>{formatDateRange(row.original.startedAt, row.original.endedAt, true)}</TooltipContent>
					</Tooltip>
					{row.original.endedAt === undefined && <Badge className='hover:bg-primary uppercase'>Live</Badge>}
				</div>
			);
		},
	},
	{
		accessorKey: 'attendeeCount',
		header: ({ column }) => {
			return (
				<SortableHeader column={column} side='right'>
					Attendees
				</SortableHeader>
			);
		},
		cell: ({ row }) => {
			// Padding to align with the end of the button text
			return <p className='text-right pr-4'>{row.original.attendeeCount.toLocaleString()}</p>;
		},
	},
	{
		accessorKey: 'start',
		sortingFn: Sort.ascending((row) => row.original.startedAt),
		header: ({ column }) => {
			return <SortableHeader column={column}>Start</SortableHeader>;
		},
		cell: ({ row }) => {
			return (
				<Tooltip>
					<TooltipTrigger asChild={true}>
						<p>{formatDate(row.original.startedAt)}</p>
					</TooltipTrigger>
					<TooltipContent>{formatDate(row.original.startedAt, true)}</TooltipContent>
				</Tooltip>
			);
		},
	},
	{
		accessorKey: 'end',
		// If the meeting is still in progress, treat it as though it had just ended
		// With the default sort, this means it'll be at the top of the list
		sortingFn: Sort.ascending((row) => row.original.endedAt ?? new Date()),
		header: ({ column }) => {
			return <SortableHeader column={column}>End</SortableHeader>;
		},
		cell: ({ row }) => {
			if (row.original.endedAt) {
				// return <p>{formatDate(row.original.endedAt)}</p>;
				return (
					<Tooltip>
						<TooltipTrigger asChild={true}>
							<p>{formatDate(row.original.endedAt)}</p>
						</TooltipTrigger>
						<TooltipContent>{formatDate(row.original.endedAt, true)}</TooltipContent>
					</Tooltip>
				);
			}
		},
	},
	{
		accessorFn: (meeting) =>
			intervalToDuration({
				start: meeting.startedAt,
				end: meeting.endedAt ?? new Date(),
			}),
		id: 'duration',
		sortingFn: (aRow, bRow) => {
			const a = aRow.getValue<Duration>('duration');
			const b = bRow.getValue<Duration>('duration');

			return milliseconds(a) - milliseconds(b);
		},
		header: ({ column }) => {
			return <SortableHeader column={column}>Duration</SortableHeader>;
		},
		cell: ({ getValue }) => {
			const duration = getValue<Duration>();

			return <p>{formatDuration(duration)}</p>;
		},
	},
	{
		id: 'actions',
		cell: ({ row }) => {
			const params = useParams<{ team: string }>();

			if (!params.team) {
				throw new TypeError('Expected team Next.js route param to be defined');
			}

			return <RowActionsDropdown meeting={row.original} team={{ slug: params.team }} />;
		},
	},
];
