import { Button } from "@/components/ui/button";

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ text }) {
  return (
    <div className="py-12 text-center text-sm text-slate-500 border border-dashed border-slate-200 rounded-md bg-white">
      {text}
    </div>
  );
}
