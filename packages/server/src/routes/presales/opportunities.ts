import Router from '@koa/router'
import * as ctrl from '../../controllers/presales/opportunities'
import { requirePresalesTenant } from '../../services/presales/tenant-context'

export const presalesOpportunityRoutes = new Router()

presalesOpportunityRoutes.get('/api/presales/opportunities', requirePresalesTenant, ctrl.list)
presalesOpportunityRoutes.post('/api/presales/opportunities', requirePresalesTenant, ctrl.create)
presalesOpportunityRoutes.get('/api/presales/opportunities/:id', requirePresalesTenant, ctrl.get)
presalesOpportunityRoutes.patch('/api/presales/opportunities/:id', requirePresalesTenant, ctrl.patch)
presalesOpportunityRoutes.get('/api/presales/profile-manifest', requirePresalesTenant, ctrl.manifest)
