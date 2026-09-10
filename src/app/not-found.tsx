import { BackLink } from "@/app/back-link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <h1 className="text-2xl font-semibold">Pagină negăsită</h1>
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Linkul e greșit, a expirat sau nu ai acces la ce încerci să deschizi.
      </p>
      <BackLink href="/">Grupurile tale</BackLink>
    </main>
  );
}
