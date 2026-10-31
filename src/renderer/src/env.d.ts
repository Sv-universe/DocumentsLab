/// <reference types="vite/client" />

import type { DoclabApi } from '@shared/types'

declare global {
  interface Window {
    doclab: DoclabApi
  }
}

export {}
