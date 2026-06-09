import Router from '@koa/router'
import * as ctrl from '../../controllers/presales/tenants'

export const presalesTenantRoutes = new Router()

presalesTenantRoutes.get('/api/presales/tenants', ctrl.list)
presalesTenantRoutes.post('/api/presales/tenants', ctrl.create)
