import Link from 'next/link';
import { cn } from './cn';

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('wordmark text-[1.35rem] leading-none text-ink', className)}>NASCO.</span>;
}

/** Monogramme « N » encadré, repris de la charte. */
export function Monogram({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'wordmark inline-grid size-7 place-items-center rounded-[3px] border-2 border-ink text-[0.95rem] leading-none',
        className,
      )}
    >
      N
    </span>
  );
}

/** Lettrage vertical N A S C O. */
export function VerticalMark({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn('wordmark flex flex-col items-center text-[0.7rem] leading-[1.05]', className)}>
      {'NASCO'.split('').map((l, i) => (
        <span key={i}>{l}</span>
      ))}
    </span>
  );
}

export function BrandBar({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('flex h-1.5 gap-1', className)}>
      <span className="flex-1 rounded-[2px] bg-green" />
      <span className="flex-1 rounded-[2px] bg-ink" />
      <span className="flex-1 rounded-[2px] border border-ink/60" />
    </div>
  );
}

export function AppHeader({ children }: { children?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-cream/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-3" aria-label="Accueil">
          <Wordmark />
        </Link>
        <span className="hidden h-6 w-px bg-line sm:block" />
        <span className="font-display hidden text-[1.05rem] sm:block">Pavillon N°1 · Déclarations préalables</span>
        <div className="ml-auto flex items-center gap-3">{children}</div>
      </div>
    </header>
  );
}
