import { TotogiLogo } from './ui/totogi-logo';

export interface AppHeaderProps {
  title?: string;
  showTitle?: boolean;
  className?: string;
}

export function AppHeader({
  title = 'BSS Application',
  showTitle = true,
  className = '',
}: AppHeaderProps) {
  return (
    <header className={`border-b bg-background px-6 py-4 ${className}`}>
      <div className="flex items-center gap-4">
        <TotogiLogo size="sm" priority />
        {showTitle && (
          <div className="flex items-center gap-2">
            <div className="h-6 w-px bg-border" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
        )}
      </div>
    </header>
  );
}
