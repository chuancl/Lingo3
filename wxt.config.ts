import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  manifest: {
    name: 'ContextLingo - 沉浸式英语学习',
    description: '在浏览中文网页时，自动将指定词汇替换为英文，结合上下文沉浸式学习。',
    version: '3.2.0',
    permissions: ['storage', 'activeTab', 'scripting', 'contextMenus', 'unlimitedStorage'],
    host_permissions: [
      "https://*.tencentcloudapi.com/*",
      "https://translation.googleapis.com/*",
      "https://api-free.deepl.com/*"
    ],
    action: {
      default_title: '打开 ContextLingo 仪表盘'
    },
    commands: {
      "translate-page": {
        "suggested_key": {
          "default": "Alt+T",
          "mac": "Alt+T"
        },
        "description": "开始当前页面翻译替换"
      }
    }
  },
  modules: ['@wxt-dev/module-react'],
});