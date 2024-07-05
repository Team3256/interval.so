import type { ServerResponse } from 'node:http';
import app from '@adonisjs/core/services/app';
import logger from '@adonisjs/core/services/logger';
import adonisServer from '@adonisjs/core/services/server';
import { Session } from '@adonisjs/session';
import { applyWSSHandler } from '@trpc/server/adapters/ws';
import { WebSocketServer } from 'ws';
import sessionConfig from '#config/session';
import { createBouncer } from '#middleware/initialize_bouncer_middleware';
import { AppRouter } from '../app/routers/app_router.js';

const wss = new WebSocketServer({ server: adonisServer.getNodeServer() });

const address = wss.address();
if (typeof address === 'string') {
	logger.info('started WS server on %s', address);
} else {
	logger.info('started WS server on %s:%s', address.address, address.port);
}

const appRouter = await app.container.make(AppRouter);

const resolvedSessionConfig = await sessionConfig.resolver(app);
const sessionStoreFactory = resolvedSessionConfig.stores[resolvedSessionConfig.store];
const emitterService = await app.container.make('emitter');
const handler = applyWSSHandler({
	wss,
	router: appRouter.getRouter(),
	createContext: async (options) => {
		const adonisHttpRequest = adonisServer.createRequest(options.req, {} as unknown as ServerResponse);
		const adonisHttpResponse = adonisServer.createResponse(options.req, {} as unknown as ServerResponse);

		const adonisHttpContext = adonisServer.createHttpContext(
			adonisHttpRequest,
			adonisHttpResponse,
			app.container.createResolver(),
		);

		const session = new Session(resolvedSessionConfig, sessionStoreFactory, emitterService, adonisHttpContext);

		await session.initiate(false);

		return {
			bouncer: createBouncer(session).setContainerResolver(adonisHttpContext.containerResolver),
			session,
		};
	},
	keepAlive: {
		enabled: true,
		pingMs: 30000,
		pongWaitMs: 5000,
	},
	onError(options) {
		// Ensure this stays in sync with the error handler in TrpcController

		if (options.error.code === 'INTERNAL_SERVER_ERROR') {
			// Log error and have tRPC respond like normal
			logger.error(options.error);
			// TODO: Log to Sentry

			options.error.message = 'Internal server error';
			options.error.stack = undefined;
		}

		// Use default TRPC error response for client errors
	},
});

app.terminating(() => {
	handler.broadcastReconnectNotification();
	wss.close();
});