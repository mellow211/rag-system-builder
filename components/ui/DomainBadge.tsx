import React from 'react';
import { DomainType, DOMAIN_CONFIGS } from '@/types/rag';
import { cn } from '@/lib/utils';

interface DomainBadgeProps {
  domain: DomainType;
  className?: string;
  size?: 'sm' | 'md';
}

export const DomainBadge: React.FC<DomainBadgeProps> = ({ domain, className, size = 'md' }) => {
  const config = DOMAIN_CONFIGS[domain];
  if (!config) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border transition-colors',
        config.badgeClass,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        className
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: config.primaryHex }}
      />
      {config.shortName}
    </span>
  );
};
