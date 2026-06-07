import type { GlobalThemeOverrides } from 'naive-ui'

const PRESALES_TEAL = '#009999'
const PRESALES_TEAL_HOVER = '#007a7a'
const PRESALES_TEAL_PRESSED = '#006666'

export const presalesThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: PRESALES_TEAL,
    primaryColorHover: PRESALES_TEAL_HOVER,
    primaryColorPressed: PRESALES_TEAL_PRESSED,
    primaryColorSuppl: PRESALES_TEAL,
    bodyColor: '#f5f7fa',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#ffffff',
    actionColor: '#eef2f6',
    textColorBase: '#1a1a2e',
    textColor1: '#1a1a2e',
    textColor2: '#4a5568',
    textColor3: '#8896a6',
    dividerColor: '#dde3ea',
    borderColor: '#dde3ea',
    hoverColor: 'rgba(0, 153, 153, 0.06)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontSize: '14px',
    fontSizeMedium: '14px',
    heightMedium: '36px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyMono: 'JetBrains Mono, Fira Code, Consolas, monospace',
  },
  Layout: {
    color: '#f5f7fa',
    siderColor: '#ffffff',
    headerColor: '#f5f7fa',
  },
  Menu: {
    itemTextColorActive: PRESALES_TEAL,
    itemTextColorActiveHover: PRESALES_TEAL_HOVER,
    itemTextColorChildActive: PRESALES_TEAL,
    itemIconColorActive: PRESALES_TEAL,
    itemIconColorActiveHover: PRESALES_TEAL_HOVER,
    itemColorActive: 'rgba(0, 153, 153, 0.1)',
    itemColorActiveHover: 'rgba(0, 153, 153, 0.14)',
    arrowColorActive: PRESALES_TEAL,
  },
  Button: {
    textColorPrimary: '#ffffff',
    colorPrimary: PRESALES_TEAL,
    colorHoverPrimary: PRESALES_TEAL_HOVER,
    colorPressedPrimary: PRESALES_TEAL_PRESSED,
    borderRadiusMedium: '6px',
  },
  Input: {
    color: '#ffffff',
    colorFocus: '#ffffff',
    border: '1px solid #dde3ea',
    borderHover: '1px solid #8896a6',
    borderFocus: `1px solid ${PRESALES_TEAL}`,
    placeholderColor: '#8896a6',
    caretColor: '#1a1a2e',
  },
  Card: {
    color: '#ffffff',
    borderColor: '#dde3ea',
  },
  Modal: {
    color: '#ffffff',
  },
  Tag: {
    borderRadius: '6px',
  },
  DataTable: {
    thColor: '#f8fafb',
    tdColor: '#ffffff',
    borderColor: '#e8ecf0',
  },
}

export const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#333333',
    primaryColorHover: '#1a1a1a',
    primaryColorPressed: '#000000',
    primaryColorSuppl: '#333333',
    bodyColor: '#fafafa',
    cardColor: '#ffffff',
    modalColor: '#ffffff',
    popoverColor: '#ffffff',
    tableColor: '#ffffff',
    inputColor: '#ffffff',
    actionColor: '#f0f0f0',
    textColorBase: '#1a1a1a',
    textColor1: '#1a1a1a',
    textColor2: '#666666',
    textColor3: '#999999',
    dividerColor: '#e0e0e0',
    borderColor: '#e0e0e0',
    hoverColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontSize: '14px',
    fontSizeMedium: '14px',
    heightMedium: '36px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyMono: 'JetBrains Mono, Fira Code, Consolas, monospace',
  },
  Layout: {
    color: '#fafafa',
    siderColor: '#f5f5f5',
    headerColor: '#fafafa',
  },
  Menu: {
    itemTextColorActive: '#1a1a1a',
    itemTextColorActiveHover: '#1a1a1a',
    itemTextColorChildActive: '#1a1a1a',
    itemIconColorActive: '#1a1a1a',
    itemIconColorActiveHover: '#000000',
    itemColorActive: 'rgba(0, 0, 0, 0.06)',
    itemColorActiveHover: 'rgba(0, 0, 0, 0.1)',
    arrowColorActive: '#1a1a1a',
  },
  Button: {
    textColorPrimary: '#ffffff',
    colorPrimary: '#333333',
    colorHoverPrimary: '#1a1a1a',
    colorPressedPrimary: '#000000',
  },
  Input: {
    color: '#ffffff',
    colorFocus: '#ffffff',
    border: '1px solid #e0e0e0',
    borderHover: '1px solid #999999',
    borderFocus: '1px solid #333333',
    placeholderColor: '#999999',
    caretColor: '#1a1a1a',
  },
  Card: {
    color: '#ffffff',
    borderColor: '#e0e0e0',
  },
  Modal: {
    color: '#ffffff',
  },
  Tag: {
    borderRadius: '6px',
  },
}

export const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#e0e0e0',
    primaryColorHover: '#f5f5f5',
    primaryColorPressed: '#ffffff',
    primaryColorSuppl: '#e0e0e0',
    bodyColor: '#1a1a1a',
    cardColor: '#2a2a2a',
    modalColor: '#2a2a2a',
    popoverColor: '#2a2a2a',
    tableColor: '#2a2a2a',
    inputColor: '#2a2a2a',
    actionColor: '#252525',
    textColorBase: '#e0e0e0',
    textColor1: '#e0e0e0',
    textColor2: '#a0a0a0',
    textColor3: '#666666',
    dividerColor: '#3a3a3a',
    borderColor: '#3a3a3a',
    hoverColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    borderRadiusSmall: '6px',
    fontSize: '14px',
    fontSizeMedium: '14px',
    heightMedium: '36px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    fontFamilyMono: 'JetBrains Mono, Fira Code, Consolas, monospace',
  },
  Layout: {
    color: '#1a1a1a',
    siderColor: '#202020',
    headerColor: '#1a1a1a',
  },
  Menu: {
    itemTextColorActive: '#e0e0e0',
    itemTextColorActiveHover: '#e0e0e0',
    itemTextColorChildActive: '#e0e0e0',
    itemIconColorActive: '#e0e0e0',
    itemIconColorActiveHover: '#ffffff',
    itemColorActive: 'rgba(255, 255, 255, 0.08)',
    itemColorActiveHover: 'rgba(255, 255, 255, 0.12)',
    arrowColorActive: '#e0e0e0',
  },
  Button: {
    textColorPrimary: '#1a1a1a',
    colorPrimary: '#e0e0e0',
    colorHoverPrimary: '#f5f5f5',
    colorPressedPrimary: '#ffffff',
  },
  Input: {
    color: '#2a2a2a',
    colorFocus: '#2a2a2a',
    border: '1px solid #3a3a3a',
    borderHover: '1px solid #666666',
    borderFocus: '1px solid #e0e0e0',
    placeholderColor: '#666666',
    caretColor: '#e0e0e0',
  },
  Card: {
    color: '#2a2a2a',
    borderColor: '#3a3a3a',
  },
  Modal: {
    color: '#2a2a2a',
  },
  Tag: {
    borderRadius: '6px',
  },
  Switch: {
    railColor: '#3a3a3a',
    railColorActive: '#66bb6a',
    loadingColor: '#e0e0e0',
    opacityDisabled: 0.4,
  },
}

export function getThemeOverrides(isDark: boolean, isComic?: boolean, isPresales?: boolean): GlobalThemeOverrides {
  if (isPresales && !isDark) return presalesThemeOverrides
  const base = isDark ? darkThemeOverrides : lightThemeOverrides
  if (!isComic) return base
  const comicFont = "'Comic Neue', 'ZCOOL KuaiLe', 'Zen Maru Gothic', 'Gaegu', cursive, sans-serif"
  return {
    ...base,
    common: {
      ...base.common!,
      fontFamily: comicFont,
    },
  }
}
