import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
      <Link href="/schedule" className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white">
        Open Scheduler
      </Link>
    </main>
  );
}
