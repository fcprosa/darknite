export const spacing = { xs:4, sm:8, md:12, lg:16, xl:20, xxl:24, xxxl:32 } as const;
export const radius  = { card:14, button:12, chip:20, modal:20 } as const;
export const fontSize = { titleLg:22, titleMd:18, body:15, label:13, caption:12 } as const;
export const fontWeight = { regular:'400', medium:'500', semibold:'600', bold:'700' } as const;
export const color = {
  accent:         '#8B5CF6',
  accentDark:     '#6D4AE8',
  live:           '#F59E0B',
  surface1:       '#0F0F1A',
  surface2:       '#16112A',
  borderDefault:  'rgba(255,255,255,0.08)',
  borderLive:     '#F59E0B',
  textPrimary:    '#FFFFFF',
  textSecondary:  'rgba(255,255,255,0.55)',
  textTertiary:   'rgba(255,255,255,0.35)',
} as const;
export const fontFamily = {
  regular:   'Inter_400Regular',
  medium:    'Inter_500Medium',
  semibold:  'Inter_600SemiBold',
  bold:      'Inter_700Bold',
  extraBold: 'Inter_800ExtraBold',
} as const;

export const chipStyle = {
  paddingHorizontal: 10,
  paddingVertical:   5,
  borderRadius:      radius.chip,
  backgroundColor:   'rgba(255,255,255,0.07)',
  borderWidth:       0.5,
  borderColor:       'rgba(255,255,255,0.10)',
  maxWidth:          160,
} as const;
