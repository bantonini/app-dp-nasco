'use client';

import { forwardRef, useId } from 'react';
import { cn } from './cn';

type ButtonVariant = 'primary' | 'accent' | 'outline' | 'ghost' | 'danger';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-cream hover:bg-ink/85',
  accent: 'bg-green text-cream hover:bg-green-600',
  outline: 'border border-ink/80 text-ink hover:bg-ink hover:text-cream',
  ghost: 'text-ink hover:bg-ink/5',
  danger: 'text-danger hover:bg-danger/8',
};

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }
>(function Button({ variant = 'primary', size = 'md', className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-brand font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' && 'h-8 px-3 text-[0.8rem]',
        size === 'md' && 'h-10 px-4 text-sm',
        size === 'lg' && 'h-12 px-6 text-[0.95rem]',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
});

export function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  className?: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-[0.78rem] font-medium tracking-wide text-muted uppercase">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

const inputClass =
  'h-10 w-full rounded-brand border border-line bg-paper px-3 text-[0.95rem] text-ink placeholder:text-muted/60 transition-colors hover:border-ink/40 focus:border-ink focus:outline-none';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(inputClass, 'h-auto min-h-28 py-2.5 leading-relaxed', className)} {...props} />;
}

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(inputClass, 'appearance-none pr-8', className)} {...props} />;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn('inline-flex rounded-brand border border-line bg-paper p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 rounded-[3px] px-3 text-sm transition-colors',
            value === o.value ? 'bg-ink text-cream' : 'text-muted hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-xs">
        <label htmlFor={id} className="font-medium tracking-wide text-muted uppercase">
          {label}
        </label>
        <span className="tabular text-ink">{format(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-green"
      />
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('rounded-[6px] border border-line bg-paper', className)}>{children}</section>;
}

export function SectionTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-medium tracking-[0.14em] text-green uppercase">{eyebrow}</p>}
        <h2 className="font-display text-[2rem] leading-none">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'ok'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-brand border px-3.5 py-2.5 text-sm leading-relaxed',
        tone === 'info' && 'border-line bg-cream/60 text-ink',
        tone === 'warn' && 'border-[#d9b26a] bg-[#f6ecd3] text-[#5c4210]',
        tone === 'ok' && 'border-green/30 bg-green-50 text-green',
      )}
    >
      {children}
    </div>
  );
}
