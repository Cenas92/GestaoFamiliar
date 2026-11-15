import type { LucideIcon } from 'lucide-react';

export interface TypeVisualMeta {
  Icon: LucideIcon;
  label: string;
  bgClass: string;
  textClass: string;
}

const BADGE_SIZE_CLASSES = {
  sm: { box: 'h-7 w-7 rounded-lg', icon: 'h-4 w-4' },
  md: { box: 'h-9 w-9 rounded-xl', icon: 'h-5 w-5' },
  lg: { box: 'h-11 w-11 rounded-2xl', icon: 'h-6 w-6' },
} as const;

export type TypeBadgeSize = keyof typeof BADGE_SIZE_CLASSES;

export function TypeIconBadge({
  visual,
  size = 'md',
}: {
  visual: TypeVisualMeta;
  size?: TypeBadgeSize;
}) {
  const { Icon } = visual;
  const dims = BADGE_SIZE_CLASSES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${dims.box} ${visual.bgClass} ${visual.textClass}`}
      title={visual.label}
      aria-label={visual.label}
    >
      <Icon className={dims.icon} aria-hidden="true" />
    </span>
  );
}
