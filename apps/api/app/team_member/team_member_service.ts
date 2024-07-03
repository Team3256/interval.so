import assert from 'node:assert/strict';
import { inject } from '@adonisjs/core';
import { TRPCError } from '@trpc/server';
import { and, asc, count, eq, isNotNull, isNull } from 'drizzle-orm';
import postgres from 'postgres';
import * as Schema from '#database/schema';
import type { AppBouncer } from '#middleware/initialize_bouncer_middleware';
import { injectHelper } from '../../util/inject_helper.js';
import { AuthorizationService } from '../authorization/authorization_service.js';
import { db } from '../db/db_service.js';
import type { TeamSchema } from '../team/schemas/team_schema.js';
import { MemberRedisEvent } from './events/schemas/redis_event_schema.js';
import { TeamMemberEventsService } from './events/team_member_events_service.js';
import type { SimpleTeamMemberSchema, TeamMemberSchema } from './schemas/team_member_schema.js';

/** A team member is someone whose attendance is tracked by team users. */
@inject()
@injectHelper(TeamMemberEventsService)
export class TeamMemberService {
	private static readonly MAX_MEMBERS_PER_TEAM = 1000;

	constructor(private readonly eventsService: TeamMemberEventsService) {}

	async getTeamMembersSimple(bouncer: AppBouncer, team: Pick<TeamSchema, 'slug'>): Promise<SimpleTeamMemberSchema[]> {
		await AuthorizationService.assertPermission(bouncer.with('TeamMemberPolicy').allows('viewSimpleMemberList', team));

		const result = await db.query.teams.findFirst({
			columns: {},
			where: eq(Schema.teams.slug, team.slug),
			with: {
				members: {
					columns: {
						id: true,
						name: true,
					},
					extras: {
						atMeeting: isNotNull(Schema.teamMembers.pendingSignIn).as('at_meeting'),
					},
					orderBy: asc(Schema.teamMembers.name),
					where: eq(Schema.teamMembers.archived, false),
				},
			},
		});

		return (
			result?.members.map((member) => ({
				id: member.id,
				name: member.name,
				atMeeting: member.atMeeting as boolean,
			})) ?? []
		);
	}

	async getTeamMembersFull(bouncer: AppBouncer, team: Pick<TeamSchema, 'slug'>): Promise<TeamMemberSchema[]> {
		await AuthorizationService.assertPermission(bouncer.with('TeamMemberPolicy').allows('viewFullMemberList', team));

		const result = await db.query.teams.findFirst({
			columns: {},
			where: eq(Schema.teams.slug, team.slug),
			with: {
				members: {
					columns: {
						id: true,
						name: true,
						archived: true,
						createdAt: true,
						pendingSignIn: true,
					},
					with: {
						meetings: {
							columns: {
								endedAt: true,
							},
							limit: 1,
							orderBy: asc(Schema.finishedMemberMeetings.endedAt),
						},
					},
				},
			},
		});

		return (
			result?.members.map((member) => ({
				id: member.id,
				name: member.name,
				archived: member.archived,
				createdAt: member.createdAt,
				atMeeting: Boolean(member.pendingSignIn),
				// If signed in, mark them as last seen now
				// Otherwise, use the last time they signed out
				lastSeenAt: member.pendingSignIn ? 'now' : member.meetings[0]?.endedAt,
			})) ?? []
		);
	}

	async create(
		bouncer: AppBouncer,
		team: Pick<TeamSchema, 'slug'>,
		data: Pick<TeamMemberSchema, 'name'>,
	): Promise<void> {
		await AuthorizationService.assertPermission(bouncer.with('TeamMemberPolicy').allows('create', team));

		// TODO: Limit teams to 1000 members (doesn't matter if unarchived or archived)

		const [dbTeam, [members]] = await Promise.all([
			db.query.teams.findFirst({
				columns: {
					id: true,
				},
				where: eq(Schema.teams.slug, team.slug),
			}),
			db
				.select({ count: count() })
				.from(Schema.teamMembers)
				.innerJoin(Schema.teams, and(eq(Schema.teamMembers.teamId, Schema.teams.id), eq(Schema.teams.slug, team.slug)))
				.where(eq(Schema.teams.slug, team.slug)),
		]);

		assert(dbTeam, new TRPCError({ code: 'NOT_FOUND', message: 'Team not found' }));
		assert(members);

		if (members.count >= TeamMemberService.MAX_MEMBERS_PER_TEAM) {
			throw new TRPCError({
				code: 'UNPROCESSABLE_CONTENT',
				message: `You can't have more than ${TeamMemberService.MAX_MEMBERS_PER_TEAM} members in a team, try deleting some members first`,
			});
		}

		try {
			await db.insert(Schema.teamMembers).values({
				teamId: dbTeam.id,
				name: data.name,
			});
		} catch (error) {
			if (error instanceof postgres.PostgresError && error.code === '23505') {
				// Team member name collision
				throw new TRPCError({
					code: 'UNPROCESSABLE_CONTENT',
					message: 'A team member with that name already exists',
				});
			}

			throw error;
		}

		await this.eventsService.announceEvent(team, MemberRedisEvent.MemberCreated);
	}

	async updateAttendance(
		bouncer: AppBouncer,
		teamMember: Pick<TeamMemberSchema, 'id'>,
		data: Pick<TeamMemberSchema, 'atMeeting'>,
	) {
		await AuthorizationService.assertPermission(
			bouncer.with('TeamMemberPolicy').allows('updateAttendance', teamMember),
		);

		if (data.atMeeting) {
			await this.signIn(teamMember);
		} else {
			await this.signOut(teamMember);
		}

		const teamQuery = await db.query.teamMembers.findFirst({
			columns: {},
			where: eq(Schema.teamMembers.id, teamMember.id),
			with: { team: { columns: { id: true } } },
		});

		assert(teamQuery, new TypeError('Expected team to be associated with the team member'));
	}

	private async signIn(teamMember: Pick<TeamMemberSchema, 'id'>): Promise<void> {
		// Mark the user as pending sign in right now
		// If they were already signed in, do nothing, we don't want to overwrite the old sign in time

		await db
			.update(Schema.teamMembers)
			.set({ pendingSignIn: new Date() })
			.where(
				and(
					eq(Schema.teamMembers.id, teamMember.id),
					isNull(Schema.teamMembers.pendingSignIn),
					eq(Schema.teamMembers.archived, false),
				),
			);

		await this.eventsService.announceEvent([teamMember], MemberRedisEvent.MemberAttendanceUpdated);
	}

	private async signOut(teamMember: Pick<TeamMemberSchema, 'id'>): Promise<void> {
		// TODO: Rewrite this to use a single query (CTE?) instead of doing the select and then insert

		await db.transaction(async (tx) => {
			const [pendingSignIn] = await tx
				.select({ pendingSignIn: Schema.teamMembers.pendingSignIn })
				.from(Schema.teamMembers)
				.where(and(eq(Schema.teamMembers.id, teamMember.id), eq(Schema.teamMembers.archived, false)));

			if (!pendingSignIn?.pendingSignIn) {
				return;
			}

			await tx.insert(Schema.finishedMemberMeetings).values({
				memberId: teamMember.id,
				startedAt: pendingSignIn.pendingSignIn,
				endedAt: new Date(),
			});

			await tx
				.update(Schema.teamMembers)
				.set({ pendingSignIn: null })
				.where(and(eq(Schema.teamMembers.id, teamMember.id), eq(Schema.teamMembers.archived, false)));
		});

		await this.eventsService.announceEvent([teamMember], MemberRedisEvent.MemberAttendanceUpdated);
	}

	async setArchived(bouncer: AppBouncer, member: Pick<TeamMemberSchema, 'id' | 'archived'>): Promise<void> {
		await AuthorizationService.assertPermission(bouncer.with('TeamMemberPolicy').allows('update', [member]));

		if (member.archived) {
			const dbMember = await db.query.teamMembers.findFirst({
				columns: {
					pendingSignIn: true,
				},
				where: eq(Schema.teamMembers.id, member.id),
			});

			if (dbMember?.pendingSignIn) {
				throw new TRPCError({
					code: 'UNPROCESSABLE_CONTENT',
					message: 'Cannot archive a member who is currently signed in',
				});
			}
		}

		await db
			.update(Schema.teamMembers)
			.set({ archived: member.archived, pendingSignIn: null })
			.where(eq(Schema.teamMembers.id, member.id));

		await this.eventsService.announceEvent([member], MemberRedisEvent.MemberUpdated);
	}

	async delete(bouncer: AppBouncer, member: Pick<TeamMemberSchema, 'id'>): Promise<void> {
		await AuthorizationService.assertPermission(bouncer.with('TeamMemberPolicy').allows('delete', [member]));

		let team: Pick<TeamSchema, 'id'> | undefined;

		await db.transaction(async (tx) => {
			// Delete meetings
			await tx.delete(Schema.finishedMemberMeetings).where(eq(Schema.finishedMemberMeetings.memberId, member.id));
			// Delete member
			[team] = await tx.delete(Schema.teamMembers).where(eq(Schema.teamMembers.id, member.id)).returning({
				id: Schema.teamMembers.teamId,
			});
		});

		if (team) {
			await this.eventsService.announceEvent(team, MemberRedisEvent.MemberDeleted);
		}
	}
}
