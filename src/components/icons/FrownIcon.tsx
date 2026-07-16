import { SVGProps } from 'react';

export function FrownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth={1.5} />
      <path d="M8.5 10.25V10.75" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M15.5 10.25V10.75" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M8 16C8.85 14.9 10.3 14.2 12 14.2C13.7 14.2 15.15 14.9 16 16"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
