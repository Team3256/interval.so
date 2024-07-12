'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TablePagination } from '@/src/components/data-tables/table-pagination';
import { TableSelectionStatus } from '@/src/components/data-tables/table-selection-status';
import { toTimeFilter } from '@/src/components/manager/period-select/duration-slug';
import { trpc } from '@/src/trpc/trpc-client';
import type { MeetingAttendeeSchema } from '@hours.frc.sh/api/app/meeting/schemas/team_meeting_schema';
import type { TeamMemberSchema } from '@hours.frc.sh/api/app/team_member/schemas/team_member_schema';
import {
	type SortingState,
	flexRender,
	getCoreRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useQueryStates } from 'nuqs';
import { useMemo, useState } from 'react';
import { searchParamParsers } from '../../search-params';
import { columns } from './columns';

type Props = {
	member: Pick<TeamMemberSchema, 'id'>;
	loading: boolean;
	initialMeetings: Pick<MeetingAttendeeSchema, 'attendanceId' | 'startedAt' | 'endedAt'>[];
};

function RowSkeleton() {
	return (
		<TableRow>
			{/* Select */}
			<TableCell>
				<Skeleton className='w-4 h-4' />
			</TableCell>
			{/* Signed in */}
			<TableCell>
				<Skeleton className='w-full h-4' />
			</TableCell>
			{/* Signed out */}
			<TableCell>
				<Skeleton className='w-full h-4' />
			</TableCell>
			{/* Duration */}
			<TableCell>
				<Skeleton className='w-full h-4' />
			</TableCell>
			{/* Actions */}
			<TableCell>
				<div className='flex justify-end items-center'>
					<Skeleton className='w-8 h-8' />
				</div>
			</TableCell>
		</TableRow>
	);
}

export function MemberAttendanceTableClient({ initialMeetings, member, loading }: Props) {
	const [meetings, setMeetings] =
		useState<Pick<MeetingAttendeeSchema, 'attendanceId' | 'startedAt' | 'endedAt'>[]>(initialMeetings);
	const [searchParams] = useQueryStates(searchParamParsers);
	const timeFilter = useMemo(() => toTimeFilter(searchParams), [searchParams]);

	trpc.teams.meetings.meetingsForMemberSubscription.useSubscription({ member, timeFilter }, { onData: setMeetings });

	const [sorting, setSorting] = useState<SortingState>([
		{
			id: 'startedAt',
			desc: true,
		},
	]);

	const data = meetings;

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onSortingChange: setSorting,
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		state: {
			sorting,
		},
	});

	return (
		<div className='flex flex-col gap-4'>
			<div className='rounded-md border bg-background overflow-hidden'>
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
						{loading && (
							<>
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
								<RowSkeleton />
							</>
						)}
						{table.getRowModel().rows?.length ? (
							table.getRowModel().rows.map((row) => (
								<TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
									{row.getVisibleCells().map((cell) => (
										<TableCell key={cell.id} className='py-0.5'>
											{flexRender(cell.column.columnDef.cell, cell.getContext())}
										</TableCell>
									))}
								</TableRow>
							))
						) : (
							<TableRow>
								<TableCell colSpan={columns.length} className='h-24 text-center'>
									No results
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<div className='flex items-center justify-between flex-wrap text-nowrap gap-2'>
				<TableSelectionStatus table={table} />
				<TablePagination table={table} />
			</div>
		</div>
	);
}
