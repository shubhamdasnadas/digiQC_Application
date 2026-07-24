import React from 'react';

interface BadgeProps {
  status: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ status, className = '' }) => {
  const norm = (status || '').toLowerCase().replace(' ', '_');

  let style = 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';

  if (['active', 'passed', 'resolved', 'active_assigned', 'enterprise'].includes(norm)) {
    style = 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-200/80 dark:border-emerald-800/80';
  } else if (['completed', 'closed', 'professional', 'inspection'].includes(norm)) {
    style = 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400 border-sky-200/80 dark:border-sky-800/80';
  } else if (['on_hold', 'pending', 'medium', 'starter', 'audit'].includes(norm)) {
    style = 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-200/80 dark:border-amber-800/80';
  } else if (['failed', 'critical', 'high', 'rfi', 'void', 'disabled'].includes(norm)) {
    style = 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-200/80 dark:border-rose-800/80';
  } else if (['in_progress', 'open', 'compliance'].includes(norm)) {
    style = 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border-indigo-200/80 dark:border-indigo-800/80';
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border tracking-tight capitalize ${style} ${className}`}
    >
      {status.replace('_', ' ')}
    </span>
  );
};
