import { appConfig } from '../../config/app.config';

export default function Footer() {
  return (
    <footer className="no-print flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-primary/30 px-4 py-2 text-xs text-muted lg:px-6">
      <span>{appConfig.footerNotice}</span>
      <span>
        Support: <span className="text-fg">{appConfig.supportContact}</span>
      </span>
    </footer>
  );
}
