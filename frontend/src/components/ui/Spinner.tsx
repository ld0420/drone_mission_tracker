/** Minimal ring spinner. Size via `className` (e.g. "h-3 w-3"). */
export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-line-2 border-t-acc ${className}`}
    />
  );
}
