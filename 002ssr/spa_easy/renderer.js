// 第一步创建一个vue实例
const Vue = require('vue')
const fs = require('fs')
const path = require('path')
const server = require('express')()

const app = new Vue({
  data: {
    message: 'Hellooooo Vue SSR'
  },
  template: '<div>{{message}}</div>'
})

// 读取模板文件内容
const templateStr = fs.readFileSync(path.join(__dirname,'index.template.html'), 'utf-8')
// 第二步创建一个 ssr 渲染器
const renderer = require('vue-server-renderer').createRenderer({
  template: templateStr
})



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