'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { trpc } from '@/src/trpc/trpc-client';
import type { TeamSchema } from '@hours.frc.sh/api/app/team/schemas/team_schema';
import type { TeamMeetingSchema } from '@hours.frc.sh/api/app/team_meeting/schemas/team_meeting_schema';
import type { TimeRangeSchema } from '@hours.frc.sh/api/app/team_stats/schemas/time_range_schema';
import {
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { use, useState } from 'react';
import { columns } from './columns';
import { InnerTableContainer, OuterTableContainer } from './meetings-table-common';
import { MeetingsTableFilters } from './meetings-table-filters';

type Props = {
	team: Pick<TeamSchema, 'slug'>;
	initialDataPromise: Promise<TeamMeetingSchema[]>;
	timeRange: TimeRangeSchema;
};

export function MeetingsTableClient({ initialDataPromise, team, timeRange }: Props) {
	const initialData = use(initialDataPromise);
	const [data, setData] = useState(initialData);

	trpc.teams.meetings.meetingsSubscription.useSubscription({ team, timeRange }, { onData: setData });

	const [sorting, setSorting] = useState<SortingState>([
		{
			id: 'endedAt',
			desc: true,
		},
	]);

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
		},
	});

	return (
		<OuterTableContainer>
			<MeetingsTableFilters />

			<InnerTableContainer>
				<Table>
					<TableHeader>
						{table.getHeaderGroups().map((headerGroup) => (
							<TableRow key={headerGroup.id}>
								{headerGroup.headers.map((header) => {
									return (
										<TableHead key={header.id}>
											{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
										</TableHead>
									);
								})}
							</TableRow>
						))}
					</TableHeader>
					<TableBody>
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className='h-24 text-center'>
									No results.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</InnerTableContainer>
		</OuterTableContainer>
	);
}
