import assert from 'node:assert/strict';
import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray } from 'drizzle-orm';
import * as Schema from '#database/schema';
import type { AppBouncer } from '#middleware/initialize_bouncer_middleware';
import { AuthorizationService } from '../authorization/authorization_service.js';
import { db } from '../db/db_service.js';
import type { TeamSchema } from '../team/schemas/team_schema.js';
import type { UserSchema } from '../user/schemas/user_schema.js';
import type { TeamUserSchema } from './schemas/team_user_schema.js';

/** Team users are editors/viewers/admins of a team, who manage settings & attendance. */
export class TeamUserService {
	async userHasRoleInTeam(
		actor: Pick<UserSchema, 'id'>,
		team: Pick<TeamSchema, 'slug'> | Pick<TeamSchema, 'id'>,
		roles: Schema.TeamUserRole[],
	): Promise<boolean> {
		let result:
			| {
					count: number;
			  }
			| undefined;

		if ('id' in team) {
			// Get team by ID
			[result] = await db
				.select({ count: count() })
				.from(Schema.teamUsers)
				.where(
					and(
						// User is a team user
						eq(Schema.teamUsers.userId, actor.id),
						// Team ID matches the input
						eq(Schema.teamUsers.teamId, team.id),
						// User has a role with edit permissions
						inArray(Schema.teamUsers.role, roles),
					),
				);
		} else {
			// Get team by slug
			[result] = await db
				.select({ count: count() })
				.from(Schema.teamUsers)
				.innerJoin(
					Schema.teams,
					and(
						// User is on the team
						eq(Schema.teamUsers.teamId, Schema.teams.id),
						// Team slug matches the input
						eq(Schema.teams.slug, team.slug),
					),
				)
				.where(
					and(
						// User is a team user
						eq(Schema.teamUsers.userId, actor.id),
						// User has a role with edit permissions
						inArray(Schema.teamUsers.role, roles),
					),
				);
		}

		return result ? result.count > 0 : false;
	}

	async getUserRole(
		bouncer: AppBouncer,
		team: Pick<TeamSchema, 'slug'>,
		user: Pick<TeamUserSchema, 'id'>,
	): Promise<Pick<TeamUserSchema, 'role'>> {
		// Don't leak team user IDs if the actor isn't in the team
		await AuthorizationService.assertPermission(bouncer.with('TeamPolicy').allows('viewSettings', team));

		const dbTeam = await db.query.teams.findFirst({
			columns: {},
			where: eq(Schema.teams.slug, team.slug),
			with: {
				users: {
					where: eq(Schema.teamUsers.userId, user.id),
					columns: {
						role: true,
					},
					limit: 1,
				},
			},
		});

		const result = dbTeam?.users[0];

		assert(result, new TRPCError({ code: 'NOT_FOUND', message: 'User not found' }));

		return result;
	}

	async removeUser(
		bouncer: AppBouncer,
		team: Pick<TeamSchema, 'slug'>,
		user: Pick<TeamUserSchema, 'id'>,
	): Promise<void> {
		await AuthorizationService.assertPermission(bouncer.with('TeamPolicy').allows('removeUser', bouncer, team, user));

		const teams = db
			.$with('team_input')
			.as(db.select({ id: Schema.teams.id }).from(Schema.teams).where(eq(Schema.teams.slug, team.slug)));

		await db.with(teams).delete(Schema.teamUsers).where(eq(Schema.teamUsers.userId, user.id));
	}
}
