import { SVGProps } from 'react';

export function UserIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.8758 11.1974C20.8758 8.33706 18.5852 6 15.7816 6C12.9781 6 10.6875 8.33706 10.6875 11.1974C10.6875 14.0577 12.9781 16.3948 15.7816 16.3948C18.5852 16.3948 20.8758 14.0577 20.8758 11.1974Z"
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M6 26.0001C11.7895 18.1915 20.2105 18.1914 26 26.0001"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
