export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-2 max-w-prose text-mist-300">{description}</p>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-ink-700 p-8">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-mist-300">{hint}</p>
    </div>
  );
}
