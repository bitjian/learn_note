import Vue from 'vue'
import Router from 'vue-router'
import HelloWorld from '@/components/HelloWorld'
import HelloSsr from '@/components/HelloSsr'

Vue.use(Router)

export function createRouter () {
  return new Router({
    mode: 'history',
    routes: [
      {
        path: '/',
        name: 'HelloWorld',
        component: HelloWorld
      },{
      path: '/ssr',
      name: 'HelloSsr',
      component: HelloSsr
    }]
  })
}
