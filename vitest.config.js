import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(viteConfig, defineConfig({
  test: {
    // Vitestのワークスペース設定
    // 各ワークスペースは独自のテスト設定を持つことができる
    // ここでは、clientとserverのテストを分離して管理する
    workspace: {
      // clientディレクトリのテスト設定
      // Vueコンポーネントのテストにはjsdom環境が必要
      'client': {
        environment: 'jsdom',
        include: ['client/tests/**/*.test.js'], // client/tests以下のテストファイル
        testTimeout: 20000,
      },
      // serverディレクトリのテスト設定
      // Node.js環境でAPIやDB関連のテストを実行
      'server': {
        environment: 'node',
        include: ['server/tests/**/*.test.js'], // server/tests以下のテストファイル
        testTimeout: 20000,
      },
    },
  },
}))