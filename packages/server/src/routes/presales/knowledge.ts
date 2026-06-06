import Router from '@koa/router'
import * as ctrl from '../../controllers/presales/knowledge'
import { requirePresalesTenant } from '../../services/presales/tenant-context'

export const presalesKnowledgeRoutes = new Router()

presalesKnowledgeRoutes.get('/api/presales/knowledge', requirePresalesTenant, ctrl.list)
presalesKnowledgeRoutes.post('/api/presales/knowledge/upload', requirePresalesTenant, ctrl.upload)
