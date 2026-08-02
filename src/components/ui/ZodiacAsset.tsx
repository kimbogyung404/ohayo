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
  // 이 이미지는 항상 fill이라 렌더 크기를 CSS(부모 컨테이너)가 결정한다. Next.js가
  // 적절한 소스 해상도를 고르도록, 호출부의 실제 컨테이너 픽셀 크기를 넘긴다.
  sizes?: string;
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

export default function ZodiacAsset({ zodiac, alt, className = '', sizes = '100px' }: ZodiacAssetProps) {
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
      sizes={sizes}
      draggable={false}
      className={[
        'pointer-events-none select-none [-webkit-user-drag:none] object-contain',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={transforms ? { transform: transforms } : undefined}
    />
  );
}
