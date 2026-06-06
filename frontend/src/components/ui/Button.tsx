import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'outline' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition disabled:pointer-events-none disabled:opacity-40';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-acc text-[#06241a] shadow-[0_2px_10px_rgba(79,227,161,0.25)] hover:bg-acc-bright active:translate-y-px',
  outline: 'border border-line-2 bg-bg-2 text-t-hi hover:border-line-strong hover:bg-bg-3',
  ghost: 'text-t-mid hover:bg-hover hover:text-t-hi',
};

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-3.5 py-2 text-sm',
  lg: 'px-4 py-3 text-sm',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
}

/** Shared button — replaces the green/outline/ghost styles that were copy-pasted
 *  across the surfaces. Extra `className` is appended for one-off tweaks. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
