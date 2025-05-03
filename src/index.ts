import { configureAuthRoutes } from './routes/auth'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import type { ApiContext } from './types'
import { requireAuth } from './middleware/auth'

// Create our main Hono app instance with proper typing
const app = new Hono<ApiContext>()

// Create a separate router for API endpoints to keep things organized
const api = new Hono<ApiContext>()

// Set up global middleware that runs on every request
// - Logger gives us visibility into what is happening
app.use('*', logger())

// Wire up all our authentication routes (login, etc)
// These will be mounted under /api/v1/auth/
api.route('/auth', configureAuthRoutes())

// Mount all API routes under the version prefix (for example, /api/v1)
// This allows us to make breaking changes in v2 without affecting v1 users
app.route('/api/v1', api)

export default app
