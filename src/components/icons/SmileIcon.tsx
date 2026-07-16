import { SVGProps } from 'react';

export function SmileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth={1.5} />
      <path d="M8.5 10.25V10.75" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path d="M15.5 10.25V10.75" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
      <path
        d="M8 14.5C8.85 15.6 10.3 16.3 12 16.3C13.7 16.3 15.15 15.6 16 14.5"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
