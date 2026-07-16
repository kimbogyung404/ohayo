import Image from 'next/image';

export type ZodiacAssetName =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces';

interface ZodiacAssetProps {
  zodiac: ZodiacAssetName;
  alt: string;
  className?: string;
}

interface ZodiacAssetCorrection {
  scale?: number;
  translateX?: number;
  translateY?: number;
  mirror?: boolean;
}

const ZODIAC_ASSET_CORRECTIONS: Record<ZodiacAssetName, ZodiacAssetCorrection> = {
  aries: {},
  taurus: {},
  gemini: {},
  cancer: {},
  leo: {},
  virgo: { mirror: true },
  libra: {},
  scorpio: {},
  sagittarius: {},
  capricorn: {},
  aquarius: {},
  pisces: {},
};

export default function ZodiacAsset({ zodiac, alt, className = '' }: ZodiacAssetProps) {
  const { scale = 1, translateX = 0, translateY = 0, mirror = false } = ZODIAC_ASSET_CORRECTIONS[zodiac];

  const transforms = [
    translateX || translateY ? `translate(${translateX}%, ${translateY}%)` : '',
    mirror ? 'scaleX(-1)' : '',
    scale !== 1 ? `scale(${scale})` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Image
      src={`/images/zodiac/${zodiac}.png`}
      alt={alt}
      fill
      className={['object-contain', className].filter(Boolean).join(' ')}
      style={transforms ? { transform: transforms } : undefined}
    />
  );
}
