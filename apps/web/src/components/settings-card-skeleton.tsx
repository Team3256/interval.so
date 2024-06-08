import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function SettingsCardSkeleton() {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<Skeleton />
				</CardTitle>
			</CardHeader>
			<CardFooter>
				<Skeleton />
			</CardFooter>
		</Card>
	);
}