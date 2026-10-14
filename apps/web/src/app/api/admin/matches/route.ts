import { createMatchRoutes } from '../../../../server/matches'

export const runtime = 'nodejs'
const routes = createMatchRoutes()
export const GET = routes.GET
export const POST = routes.POST
