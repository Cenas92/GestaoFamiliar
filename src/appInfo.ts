export const APP_INFO = {
  name: 'Gestão Familiar',
  version: typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.1.0',
  buildDate: typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : '',
  creator: typeof __APP_CREATOR__ !== 'undefined' ? __APP_CREATOR__ : 'AI-Cenas92',
  repoUrl: 'https://github.com/Cenas92/GestaoFamiliar',
} as const;
