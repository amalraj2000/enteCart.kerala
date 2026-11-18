export default function InfoPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand-700">{title}</h1>
      {intro && <p className="mt-2 text-lg text-gray-600">{intro}</p>}
      <div className="card mt-6 space-y-6 p-6 text-gray-700 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">{children}</div>
    </article>
  );
}
