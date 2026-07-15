import { SVGProps } from 'react';

const STAR_PATH =
  'M14.6137 4.96516C15.0899 3.67828 16.9101 3.67828 17.3863 4.96515L19.7564 11.3703C19.9061 11.7749 20.2251 12.0939 20.6297 12.2436L27.0348 14.6137C28.3217 15.0899 28.3217 16.9101 27.0348 17.3863L20.6297 19.7564C20.2251 19.9061 19.9061 20.2251 19.7564 20.6297L17.3863 27.0348C16.9101 28.3217 15.0899 28.3217 14.6137 27.0348L12.2436 20.6297C12.0939 20.2251 11.7749 19.9061 11.3703 19.7564L4.96516 17.3863C3.67828 16.9101 3.67828 15.0899 4.96515 14.6137L11.3703 12.2436C11.7749 12.0939 12.0939 11.7749 12.2436 11.3703L14.6137 4.96516Z';

export function StarOutlineIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d={STAR_PATH} stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function StarFilledIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d={STAR_PATH} fill="currentColor" />
    </svg>
  );
}
