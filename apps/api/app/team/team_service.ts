import { TRPCError } from '@trpc/server';
import { and, count, eq } from 'drizzle-orm';
import postgres from 'postgres';
import * as Schema from '#database/schema';
import { db } from '../db/db_service.js';
import type { UserSchema } from '../user/schemas/user_schema.js';
import type { TeamSchema } from './schemas/team_schema.js';

export class TeamService {
	private static readonly MAX_TEAMS_PER_USER = 10;

	async teamNamesForUser(user: Pick<UserSchema, 'id'>): Promise<Pick<TeamSchema, 'displayName' | 'slug'>[]> {
		const teamUsers = await db.query.teamUsers.findMany({
			where: eq(Schema.teamUsers.userId, user.id),
			with: {
				team: {
					columns: {
						displayName: true,
						slug: true,
					},
				},
			},
		});

		return teamUsers.map((team) => ({
			displayName: team.team.displayName,
			slug: team.team.slug,
		}));
	}

	async create(input: TeamSchema, user: Pick<UserSchema, 'id'>): Promise<void> {
		// Count teams this user is an owner of
		const [ownedTeams] = await db
			.select({ count: count() })
			.from(Schema.teamUsers)
			.where(and(eq(Schema.teamUsers.userId, user.id), eq(Schema.teamUsers.role, 'owner')));

		if (ownedTeams.count > TeamService.MAX_TEAMS_PER_USER) {
			throw new TRPCError({
				code: 'UNPROCESSABLE_CONTENT',
				message: `You can't be the owner of more than ${TeamService.MAX_TEAMS_PER_USER} teams`,
			});
		}

		try {
			await db.transaction(async (tx) => {
				// Create team
				const [team] = await tx.insert(Schema.teams).values(input).returning({ slug: Schema.teams.slug });

				// Create team user
				await tx.insert(Schema.teamUsers).values({
					teamSlug: team.slug,
					userId: user.id,
					role: 'owner',
				});
			});
		} catch (error) {
			if (error instanceof postgres.PostgresError && error.code === '23505') {
				// Team slug collision
				throw new TRPCError({
					code: 'UNPROCESSABLE_CONTENT',
					message: 'A team with that URL already exists',
				});
			}
		}
	}
}
