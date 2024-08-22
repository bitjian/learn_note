import {createApp} from './main.js'
// 客户端入口，就是创建vue实例，并等异步组件加载完毕进行挂载

const {app, router} = createApp()


router.onReady(() => {
  app.$mount('#app')
})

