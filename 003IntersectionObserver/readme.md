# IntersectionObserver 交叉观察器

> 可以用来判断一个元素是否出现在视图内，比如：曝光上报场景
> 实例代码 https://stackblitz.com/edit/vitejs-vite-efnpaw8b?file=src%2Fcomponents%2FExpose.vue
## API

用法也很简单

> 1.创建一个观察器
```js
var io = new IntersectionObserver(callback, option);
```

> 2.监听元素，停止监听，关闭监听

```js
// 开始观察 
io.observe(document.getElementById('example'));
// 可以观察多个元素
io.observe(document.getElementById('example2'));
// 停止观察
io.unobserve(element);

// 关闭观察器
io.disconnect();
```

## 3.callback 回调

```js
// entries 交叉观察器 监听的 元素
 entries => {
    if (!entries.length) return;
    // 获取第一个监听的元素
    const entries = changes[0];
    // 当监听元素进入可视区时候
    if (entries.isIntersecting) {
      // 可以处理一些操作
    }
  }
```
> entries 是一个观察元素对象数组

## 4.封装一个简易vue3曝光上报的组件

```html
<template>
  <div ref="refEl">
    <slot></slot>
  </div>
</template>

<script lang="ts" setup>
import { reactive, onMounted, ref, onBeforeUnmount, onUnmounted } from 'vue';
const props = defineProps({
  posIndex: Number,
  threshold: Array,
});
const refEl = ref<any>(null);
console.log(props.threshold);
let observer = reactive<any>(null);
observer = new IntersectionObserver(
  (entries) => {
    if (!entries.length) return;
    const entrie = entries[0];
    // 当监听元素进入可视区时候
    if (entrie.isIntersecting) {
      // 曝光处理
      console.log('曝光', props.posIndex);
    }
  },
  {
    threshold: props.threshold,  // 通过threshold 可以设置达到交叉比例多少才执行
  }
);
onMounted(() => {
  // 开始观察
  observer.observe(refEl.value);
});
onBeforeUnmount(() => {
  // 停止观察
  observer.unobserve(refEl.value);
});
onUnmounted(() => {
  // 关闭观察器
  observer.disconnect();
});
</script>

```

> 使用组件

```html
<script setup>
import Expose from './components/Expose.vue';
</script>

<template>
  <div>
    <template v-for="item in 10">
      <Expose :pos-index="item" :threshold=[0.3, 0.6]>
        <div class="item-box">{{ item }}</div>
      </Expose>
    </template>
  </div>
</template>

<style scoped>
.item-box {
  width: 100px;
  height: 100px;
  background-color: orange;
  margin-bottom: 10px;
  color: black;
}
</style>

```

> 实例代码 https://stackblitz.com/edit/vitejs-vite-efnpaw8b?file=src%2Fcomponents%2FExpose.vue

## 5.封装一个简易vue2曝光上报的组件

```vue
<template>
    <div>
        <slot></slot>
    </div>
</template>

<script>
export default {
    data() {
        return {
            observer: undefined,
        }
    },
    created() {
        this.observer = new IntersectionObserver((entries) => {
            if (!entries.length) return;
            const entrie = entries[0];
            if (entrie.isIntersecting) {
                this.$emit("exposed")
                return;
            }
        });
    },
    mounted() {
        this.observer.observe(this.$el);
    },
    unmounted() {
        this.observer.unobserve(this.$el);
    },
    destroyed() {
        this.observer.disconnect();
    },
}
</script>

```

## 总结

> 通过交叉观察器，可以做很有事情： 例如
1.曝光上报，
2.曝光达到多少比例上报
3.只在获取展示区域的数据状态，而不用获取全部加载数据的状态
4.离开可视区的时候 移除一些数据的监听