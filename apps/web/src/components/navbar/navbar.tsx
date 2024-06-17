import { cn } from '@/lib/utils';
import { Link } from 'next-view-transitions';
import type { PropsWithChildren } from 'react';
import { ProfileMenu } from './profile-menu/profile-menu';

type Props = {
	left?: React.ReactNode;
	center?: React.ReactNode;
	right?: React.ReactNode;
	className?: string;
};

export function Navbar({ children, center, left, right, className }: PropsWithChildren<Props>) {
	// TODO: Nothing uses the center, but it still takes up space on small screens. Refactor to make this just a flex between with left/right, no center
	return (
		<header className={cn('w-full py-4 bg-background border-b flex flex-col', className)}>
			<div className='grid grid-rows-1 grid-cols-3 items-center justify-between container max-w-6xl mx-auto'>
				<div className='flex justify-start items-center col-span-1'>
					<Link href='/' className='text-xl font-semibold leading-none'>
						hours.frc.sh
					</Link>
					{left}
				</div>

				{center && <div className='flex justify-center col-span-1'>{center}</div>}

				<div className='flex justify-end col-span-1 col-start-3'>
					<ProfileMenu />
					{right}
				</div>

				{children}
			</div>
		</header>
	);
}
