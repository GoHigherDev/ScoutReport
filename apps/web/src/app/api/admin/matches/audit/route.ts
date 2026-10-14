import { createMatchRoutes } from '../../../../../server/matches'

export const runtime = 'nodejs'
const routes = createMatchRoutes()
export const POST = routes.audit
export const PUT = routes.audit
