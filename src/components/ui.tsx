import React, { useEffect, useId } from 'react';
import { LucideIcon, X } from 'lucide-react';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}> = ({ title, description, eyebrow, actions }) => (
  <header className="app-page-header">
    <div className="min-w-0">
      {eyebrow && <p className="app-eyebrow">{eyebrow}</p>}
      <h1 className="app-page-title">{title}</h1>
      {description && <p className="app-page-description">{description}</p>}
    </div>
    {actions && <div className="app-page-actions">{actions}</div>}
  </header>
);

export const Surface: React.FC<React.HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
  selected?: boolean;
}> = ({ interactive, selected, className, ...props }) => (
  <div
    className={cx('app-surface', interactive && 'app-surface-interactive', selected && 'app-surface-selected', className)}
    {...props}
  />
);

export const FilterBar: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div className={cx('app-filter-bar', className)} {...props} />
);

const badgeVariants = {
  neutral: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200',
  success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  danger: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

export const StatusBadge: React.FC<{
  children: React.ReactNode;
  variant?: keyof typeof badgeVariants;
  className?: string;
}> = ({ children, variant = 'neutral', className }) => (
  <span className={cx('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold', badgeVariants[variant], className)}>
    {children}
  </span>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  icon: LucideIcon;
  tone?: 'neutral' | 'primary' | 'danger';
}> = ({ label, icon: Icon, tone = 'neutral', className, ...props }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx('app-icon-button', `app-icon-button-${tone}`, className)}
    {...props}
  >
    <Icon className="h-4 w-4" />
  </button>
);

export const SectionHeader: React.FC<{
  title: string;
  description?: string;
  actions?: React.ReactNode;
}> = ({ title, description, actions }) => (
  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
      {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export const Modal: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}> = ({ open, onClose, title, description, children, footer, size = 'md' }) => {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' };

  return (
    <div className="app-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('app-modal', sizes[size])}
      >
        <header className="app-modal-header">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
            {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          <IconButton icon={X} label="Fechar" onClick={onClose} />
        </header>
        <div className="app-modal-content">{children}</div>
        {footer && <footer className="app-modal-footer">{footer}</footer>}
      </section>
    </div>
  );
};
