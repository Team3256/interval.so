import { cn } from '@/lib/utils';
import type { PropsWithChildren } from 'react';
import dotsStyles from '../dots/dots.module.css';

type Props = PropsWithChildren<{
	className?: string;
}>;

export function MainContent({ children, className }: Props) {
	return (
		<main className={cn('py-4 [view-transition-name:main-content] flex-1 flex', dotsStyles.dots, className)}>
			<div className='mx-auto container max-w-6xl flex flex-col flex-1'>{children}</div>
		</main>
	);
}