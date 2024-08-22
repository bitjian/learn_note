# 手写ssr渲染
## 前言
在正式搭建项目之前，我们还是要回顾下vue服务器端渲染的一些特性。
服务器端渲染的 Vue.js 应用程序，是使vue应用既可以在客户端（浏览器）执行，也可以在服务器端执行，我们称之为“同构”或“通用”。
之所以能够实现同构，是因为在客户端和服务端都创建了vue应用程序，并都用webpack进行打包，生成了server bundle和client bundle。server bundle用于服务器渲染，client bundle是一个客户端的静态标记，服务器渲染好html页面片段后，会发送给客户端，然后混合客户端静态标记，这样应用就具有vue应用的特性。
需要注意是：

服务器端渲染过程中，只会调用beforeCreate和created两个钩子函数，其它的只会在客户端执行。那么以前spa应用中，在created中创建一个setInterval，然后在destroyed中将其销毁的类似操作就不能出现了，服务器渲染期间不会调用销毁钩子函数，所以这个定时器会永远保留下来，服务器很容易就崩了。
由于服务器可客户端是两种不同的执行平台环境，那么一些特定平台的API就不能用了，比如window和document，在node.js（比如created钩子函数）中执行就会报错。并且，我们使用的第三方API中，需要确保能在node和浏览器都能正常运行，比如axios，它向服务器和客户端都暴露相同的 API（浏览器的源生XHR就不行）

## 安装依赖包
```bash
npm install vue@2 vue-server-renderer express --save
```

## 1.创建一个简单的ssr渲染

### 创建一个vue ssr 渲染器
> renderer.js
```javascript
// 第一步创建一个vue实例
const Vue = require('vue')
const app = new Vue({
  data: {
    message: 'Hellooooo Vue SSR'
  },
  template: '<div>{{message}}</div>'
})

// 第二步创建一个 ssr 渲染器
const renderer = require('vue-server-renderer').createRenderer()

// 第三步将vue实例渲染为html字符串

renderer.renderToString(app, (err, html) => {
  if (err) throw err
  console.log(html)
})
```

### 创建ssr模板文件
vue渲染的内容会替换 `<!--vue-ssr-outlet-->`
> index.template.html
```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
  <head><title>Hello</title></head>
  <body>
    <!-- ssr渲染内容会插入到下面注释当中 -->
    <!--vue-ssr-outlet-->
  </body>
</html>
```

### 将模板文件内容设置到渲染器里
> renderer.js
```javascript
// 读取模板文件内容
const templateStr = fs.readFileSync(path.join(__dirname,'index.template.html'), 'utf-8')
// 第二步创建一个 ssr 渲染器
const renderer = require('vue-server-renderer').createRenderer({
  template: templateStr
})
```

### 创建一个express服务
> renderer.js
```javascript
const server = require('express')()
// 创建一个express服务，将渲染的内容返回给前端
server.get('*', (req, res) => {
  // 第三步将vue实例渲染为html字符串
  renderer.renderToString(app, (err, html) => {
    if (err) {
      res.status(500).end('Internal Server Error')
      return
    }
    console.log(html)
    res.end(html)
  })
})
// 设置监听端口
server.listen(3300,()=>{
  console.log('server is running')
})
```

## 2.利用vue-cli创建一个ssr模板

### 安装vue-cli脚手架
```bash
 npm i @vue/cli -g 
 npm i -g @vue/cli-init
```

### 创建项目

``` bash
npm init webapck spa_ssr
cd spa_ssr
npm i & npm run dev
```

### 安装vue-server-renderer

```bash
npm install vue-server-renderer --save-dev
```

### 改造src下的文件

```
src
├── router
│   └── index.js
├── components
│   └── HelloSsr.vue
├── App.vue
├── main.js
├── entry-client.js # 仅运行于浏览器
└── entry-server.js # 仅运行于服务器
```

#### 通用入口main.js和路由router.js改造
main.js作为浏览器和服务器通用创建实例入口，需要改造成工厂函数来创建实例，保证各自独立性。且因单线程的机制，在服务器端渲染时，过程中有类似于单例的操作，那么所有的请求都会共享这个单例的操作。

```js
// main.js
// The Vue build version to load with the `import` command
// (runtime-only or standalone) has been set in webpack.base.conf with an alias.
import Vue from 'vue'
import App from './App'
import {createRouter} from './router'

Vue.config.productionTip = false

/* eslint-disable no-new */
const createApp = () => {
  const router = createRouter()
  const app = new Vue({
    router,
    render: h => h(App)
  })
  return {app, router}
}
export {createApp}
```
同样router.js也需要通过工厂函数创建
```js
// router.js
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
```

#### 客户端 entry-client.js
> 客户端的entry要做的很简单，就是将vue实例挂载到DOM上，只不过，考虑到可能存在异步组件，需要等到路由将异步组件加载完毕，才进行此操作。  
```js
// entry-client.js
import {createApp} from './main.js'
// 客户端入口，就是创建vue实例，并等异步组件加载完毕进行挂载
const {app, router} = createApp()
router.onReady(() => {
  app.$mount('#app')
})
```

#### 服务端 entry-server.js

> 服务器entry要做的有两步：1.解析服务器端路由；2.返回一个vue实例用于渲染。
```js
// entry-server.js
import { createApp } from './main'
export default context => {
  // 因为有可能会是异步路由钩子函数或组件，所以我们将返回一个 Promise，
  // 以便服务器能够等待所有的内容在渲染前，
  // 就已经准备就绪。
  return new Promise((resolve, reject) => {
    const { app, router } = createApp()
    // 设置服务器端 router 的位置
    router.push(context.url)
    // 等到 router 将可能的异步组件和钩子函数解析完
    router.onReady(() => {
      const matchedComponents = router.getMatchedComponents()
      // 匹配不到的路由，执行 reject 函数，并返回 404
      if (!matchedComponents.length) {
        // eslint-disable-next-line
        return reject({ code: 404 })
      }
      // Promise 应该 resolve 应用程序实例，以便它可以渲染
      resolve(app)
    }, reject)
  })
}
```

### webpack 配置
vue相关代码已处理完毕，接下来就需要对webpack打包配置进行修改了。 官方推荐了下面配置：
``` js
 build
  ├── webpack.base.conf.js  # 基础通用配置
  ├── webpack.client.conf.js  # 客户端打包配置
  └── webpack.server.conf.js  # 服务器端打包配置
```

### webpack.base.conf.js修改

#### 1.修改入口配置
> 修改webpack.base.conf.js的entry入口配置为：./src/entry-client.js，来生成客户端的构建清单client manifest。
```javascript
// webpack.base.conf.js
module.exports = {
  entry: {
    // app: './src/main.js'
    app: './src/entry-client.js'   // <-修改入口文件改为
  },
  // ...
}
```
### webpack.prod.conf.js修改

#### 1.引入SSR渲染插件client-plugin
> 在客户端的配置prod中，我们需要引入一个服务器端渲染的插件client-plugin，用来生成vue-ssr-client-manifest.json（用作静态资源注入），同时，我们需要把HtmlWebpackPlugin给去掉，在SPA应用中，我们用它来生成index.html文件，但是这里我们有vue-ssr-client-manifest.json之后，服务器端会帮我们做好这个工作。
```javascript
// webpack.prod.conf.js
const VueSSRClientPlugin = require('vue-server-renderer/client-plugin')
// ...
  plugins: [
    new webpack.DefinePlugin({
      'process.env': env,
      'process.env.VUE_ENV': '"client"' // 增加process.env.VUE_ENV
    }),
    // ...
    // 以下内容注释（或去除）
    // new HtmlWebpackPlugin({
    //   filename: config.build.index,
    //   template: 'index.html',
    //   inject: true,
    //   minify: {
    //     removeComments: true,
    //     collapseWhitespace: true,
    //     removeAttributeQuotes: true
    //     // more options:
    //     // https://github.com/kangax/html-minifier#options-quick-reference
    //   },
    //   // necessary to consistently work with multiple chunks via CommonsChunkPlugin
    //   chunksSortMode: 'dependency'
    // }),
    // ...
    // 此插件在输出目录中生成 `vue-ssr-client-manifest.json`。
    new VueSSRClientPlugin()
  ]
// ...
```

### 修改utils.js
> 在客户端渲染中，CSS 可以通过 JavaScript 动态注入到 DOM 中，因此可以使用 ExtractTextPlugin 将 CSS 提取到单独的文件中。但在服务端渲染中，服务器需要生成完整的 HTML 字符串并发送给客户端，因此不能依赖 JavaScript 来注入 CSS。
#### 修改 css loaders 引入方式
```js
// utils.js
function generateLoaders {
  ...
  //  if (options.extract) {
  //       return ExtractTextPlugin.extract({
  //         use: loaders,
  //         fallback: 'vue-style-loader'
  //       })
  //   } else {
  //     return ['vue-style-loader'].concat(loaders)
  //   }
  return ['vue-style-loader'].concat(loaders)
  // ...
}
```

#### 注释webpack.prod.conf.js的 ExtractTextPlugin 插件
```js
// webpack.prod.conf.js
  plugins:[
  // ...
  // new ExtractTextPlugin({
  //     filename: utils.assetsPath('css/[name].[contenthash].css'),
  //     // Setting the following option to `false` will not extract CSS from codesplit chunks.
  //     // Their CSS will instead be inserted dynamically with style-loader when the codesplit chunk has been loaded by webpack.
  //     // It's currently set to `true` because we are seeing that sourcemaps are included in the codesplit bundle as well when it's `false`,
  //     // increasing file size: https://github.com/vuejs-templates/webpack/issues/1110
  //     allChunks: true,
  //   }),
  // ...
]
```

### webpack.server.conf.js配置

#### 1.引入 webpack-node-externals, 引入并使用server-plugin

> 这里使用了`webpack-node-externals`来加快构建速度和减小打包体积，所以我们要先安装一下它：`npm install webpack-node-externals --save-dev`。
> 和prod配置一样，这里需要引入并使用`server-plugin`插件来生成`vue-ssr-server-bundle.json`。这东西是用来等会做服务器端渲染的。

```js
// webpack.server.conf.js
const webpack = require('webpack')
const merge = require('webpack-merge')
const nodeExternals = require('webpack-node-externals')
const baseConfig = require('./webpack.base.conf.js')
const VueSSRServerPlugin = require('vue-server-renderer/server-plugin')

module.exports = merge(baseConfig, {
  // 将 entry 指向应用程序的 server entry 文件
  entry: './src/entry-server.js',
  // 这允许 webpack 以 Node 适用方式(Node-appropriate fashion)处理动态导入(dynamic import)，
  // 并且还会在编译 Vue 组件时，
  // 告知 `vue-loader` 输送面向服务器代码(server-oriented code)。
  target: 'node',
  // 对 bundle renderer 提供 source map 支持
  devtool: 'source-map',
  // 此处告知 server bundle 使用 Node 风格导出模块(Node-style exports)
  output: {
    libraryTarget: 'commonjs2'
  },
  module: {},
  // https://webpack.js.org/configuration/externals/#function
  // https://github.com/liady/webpack-node-externals
  // 外置化应用程序依赖模块。可以使服务器构建速度更快，
  // 并生成较小的 bundle 文件。
  externals: nodeExternals({
    // 不要外置化 webpack 需要处理的依赖模块。
    // 你可以在这里添加更多的文件类型。例如，未处理 *.vue 原始文件，
    // 你还应该将修改 `global`（例如 polyfill）的依赖模块列入白名单
    whitelist: /\.css$/
  }),
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      'process.env.VUE_ENV': '"server"'
    }),
    // 这是将服务器的整个输出
    // 构建为单个 JSON 文件的插件。
    // 默认文件名为 `vue-ssr-server-bundle.json`
    new VueSSRServerPlugin()
  ]
})
```

### package.json打包命令修改

> 这里需要先安装`cross-env`。（`cross-env`用来防止使用`NODE_ENV =production`来设置环境变量时，Windows命令提示会报错）
```js
npm install --save-dev cross-env
```
> 打包命令
```json
// package.json
"scripts": {
    //...
    "build:client": "node build/build.js",
    "build:server": "cross-env NODE_ENV=production webpack --config build/webpack.server.conf.js --progress --hide-modules",
    "build": "rimraf dist && npm run build:client && npm run build:server"
} 
```

### 修改index.html

> 插入一个`<!--vue-ssr-outlet-->`注释标记，用来标识服务器渲染的html代码片段插入的地方,同时删掉原先的`<div id="app">`。
> 服务器端会在这个标记的位置自动生成一个`<div id="app" data-server-rendered="true">`，客户端会通过`app.$mount('#app')`挂载到服务端生成的元素上，并变为响应式的。

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1.0">
    <title>spa_ssr</title>
  </head>
  <body>
    <!--vue-ssr-outlet-->
  </body>
</html>
```

### 打包构建

> 在dist目录下会生成两个json文件：vue-ssr-server-bundle.json和vue-ssr-client-manifest.json，用于服务端端渲染和静态资源注入。

```sh
npm run build
```

### 构建服务器端

> 安装`express`服务

```sh
npm install express --save
```

> 在根目录下创建server.js，代码主要分为3步：

> 采用createBundleRenderer来创建renderer，我们引入之前生成好的json文件，并读取index.html作为外层模板；
> 设置路由，当请求指定路由的时候，设置请求头，调用渲染函数，将渲染好的html返回给客户端；
> 监听3001端口。

```js
const express = require('express')
const app = express()

const fs = require('fs')
const path = require('path')
const { createBundleRenderer } = require('vue-server-renderer')

const resolve = file => path.resolve(__dirname, file)

// 生成服务端渲染函数
const renderer = createBundleRenderer(require('./dist/vue-ssr-server-bundle.json'), {
  // 模板html文件
  template: fs.readFileSync(resolve('./index.html'), 'utf-8'),
  // client manifest
  clientManifest: require('./dist/vue-ssr-client-manifest.json')
})

function renderToString (context) {
  return new Promise((resolve, reject) => {
    renderer.renderToString(context, (err, html) => {
      err ? reject(err) : resolve(html)
    })
  })
}
app.use(express.static('./dist'))

app.use(async(req, res, next) => {
  try {
    const context = {
      title: '服务端渲染测试', // {{title}}
      url: req.url
    }
    // 设置请求头
    res.set('Content-Type', 'text/html')
    const render = await renderToString(context)
    // 将服务器端渲染好的html返回给客户端
    res.end(render)
  } catch (e) {
    console.log(e)
    // 如果没找到，放过请求，继续运行后面的中间件
    next()
  }
})

app.listen(3000)
```

> 启动服务

```sh 
node server.js
```

> 访问路由
访问localhost:3000/ssr，就能获取我们之前定义好的页面。

## 引用
[带你走近Vue服务器端渲染（VUE SSR）](https://juejin.cn/post/6844903656827912206)