import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'list', component: () => import('@/views/RestaurantList.vue') },
    {
      path: '/restaurants/:id',
      name: 'detail',
      component: () => import('@/views/RestaurantDetail.vue'),
      props: true,
    },
  ],
  scrollBehavior() {
    return { top: 0 }
  },
})

export default router
