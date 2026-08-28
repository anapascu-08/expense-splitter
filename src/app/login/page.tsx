import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/auth-actions";
import { AuthForm } from "@/app/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");

  const { next } = await searchParams;
  const boundLogin = login.bind(null, next ?? "/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Autentificare</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Intră în cont ca să-ți vezi grupurile.
        </p>
      </header>
      <AuthForm mode="login" action={boundLogin} />
    </main>
  );
}
