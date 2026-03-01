import { defineConfig } from 'allure'
import * as os from 'node:os'

export default defineConfig({
  name: 'Reqcore E2E Report',
  output: './allure-report',
  historyPath: './allure-history.jsonl',
  plugins: {
    awesome: {
      options: {
        singleFile: false,
        reportLanguage: 'en',
        groupBy: ['parentSuite', 'suite', 'subSuite'],
      },
    },
  },
  variables: {
    os_platform: os.platform(),
    os_release: os.release(),
    node_version: process.version,
  },
})
