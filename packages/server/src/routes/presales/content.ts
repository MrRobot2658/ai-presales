import Router from '@koa/router'
import * as ctrl from '../../controllers/presales/content'
import { requirePresalesTenant } from '../../services/presales/tenant-context'

export const presalesContentRoutes = new Router()

presalesContentRoutes.get('/api/presales/content', requirePresalesTenant, ctrl.list)
presalesContentRoutes.post('/api/presales/content', requirePresalesTenant, ctrl.create)
presalesContentRoutes.get('/api/presales/content/:id', requirePresalesTenant, ctrl.get)
presalesContentRoutes.patch('/api/presales/content/:id', requirePresalesTenant, ctrl.patch)
