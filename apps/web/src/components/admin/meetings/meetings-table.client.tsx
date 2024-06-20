'use client';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { TeamMeetingSchema } from '@hours.frc.sh/api/app/team_meeting/schemas/team_meeting_schema';
import {
	type SortingState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useQueryStates } from 'nuqs';
import { use, useState } from 'react';
import { type GlobalFilterValue, columns, globalFilterFn } from './columns';
import { InnerTableContainer, OuterTableContainer } from './meetings-table-common';
import { MeetingsTableFilters } from './meetings-table-filters';
import { searchParamParsers } from './search-params';

type Props = {
	dataPromise: Promise<TeamMeetingSchema[]>;
};

export function MeetingsTableClient({ dataPromise }: Props) {
	const data = use(dataPromise);

	const [queryStates] = useQueryStates(searchParamParsers);

	const [sorting, setSorting] = useState<SortingState>([
		{
			id: 'end',
			desc: true,
		},
	]);

	const [globalFilter, setGlobalFilter] = useState<GlobalFilterValue>({
		duration: queryStates.duration,
		start: queryStates.start ?? undefined,
		end: queryStates.end ?? undefined,
	});

	const table = useReactTable({
		data,
		columns,
		getCoreRowModel: getCoreRowModel(),
		onSortingChange: setSorting,
		onGlobalFilterChange: setGlobalFilter,
		getSortedRowModel: getSortedRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		getColumnCanGlobalFilter(column) {
			return column.id === 'end' || column.id === 'start';
		},
		globalFilterFn,
		state: {
			sorting,
			globalFilter,
		},
	});

	return (
		<OuterTableContainer>
			<MeetingsTableFilters table={table} />

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