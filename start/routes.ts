/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

const HealthController = () => import('#controllers/health_controller')
const SearchController = () => import('#controllers/search_controller')
const KindleController = () => import('#controllers/kindle_controller')

// Public
router.get('/api/health', [HealthController, 'handle'])

// Protected
router
  .group(() => {
    router.post('/search', [SearchController, 'handle'])
    router.post('/send-to-kindle', [KindleController, 'handle'])
  })
  .prefix('/api')
  .use(middleware.apiKey())
