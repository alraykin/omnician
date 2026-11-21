import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.omnician',
  appName: 'Omnician',
  webDir: 'dist',
  backgroundColor: '#0B0F1A',
  ios: {
    backgroundColor: '#0B0F1A',
    contentInset: 'never',
    scheme: 'Omnician',
  },
}

export default config
