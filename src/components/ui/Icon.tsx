import { ComponentType, SVGProps } from 'react';
import { FolderOutlineIcon, FolderFilledIcon } from '@/components/icons/FolderIcon';
import { StarOutlineIcon, StarFilledIcon } from '@/components/icons/StarIcon';
import { UserIcon } from '@/components/icons/UserIcon';
import { InfoIcon } from '@/components/icons/InfoIcon';
import { ChevronRightIcon } from '@/components/icons/ChevronRightIcon';
import { ChevronLeftIcon } from '@/components/icons/ChevronLeftIcon';
import { CheckIcon } from '@/components/icons/CheckIcon';
import { VolumeIcon } from '@/components/icons/VolumeIcon';

export type IconName =
  | 'folder'
  | 'star'
  | 'user'
  | 'info'
  | 'chevron-right'
  | 'chevron-left'
  | 'check'
  | 'volume';

export type IconVariant = 'outline' | 'filled';

type SvgComponent = ComponentType<SVGProps<SVGSVGElement>>;

const iconMap: Record<IconName, { outline: SvgComponent; filled?: SvgComponent }> = {
  folder: { outline: FolderOutlineIcon, filled: FolderFilledIcon },
  star: { outline: StarOutlineIcon, filled: StarFilledIcon },
  user: { outline: UserIcon },
  info: { outline: InfoIcon },
  'chevron-right': { outline: ChevronRightIcon },
  'chevron-left': { outline: ChevronLeftIcon },
  check: { outline: CheckIcon },
  volume: { outline: VolumeIcon },
};

type FilledIconName = 'folder' | 'star';

interface IconBaseProps extends SVGProps<SVGSVGElement> {
  size?: number;
  'aria-label'?: string;
}

type IconProps =
  | (IconBaseProps & { name: FilledIconName; variant?: IconVariant })
  | (IconBaseProps & { name: Exclude<IconName, FilledIconName>; variant?: never });

export default function Icon({
  name,
  variant = 'outline',
  size = 24,
  'aria-label': ariaLabel,
  ...props
}: IconProps) {
  const entry = iconMap[name];
  const Component = (variant === 'filled' && entry.filled) || entry.outline;

  return (
    <Component
      {...props}
      width={size}
      height={size}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
    />
  );
}
