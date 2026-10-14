import { createPredictAcceptanceRoutes } from '../../../../server/predict'

export const runtime = 'nodejs'
export const POST = createPredictAcceptanceRoutes().acceptTerms
