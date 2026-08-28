import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { register } from "@/app/auth-actions";
import { AuthForm } from "@/app/auth-form";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Cont nou</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Creează un cont ca să pornești sau să intri într-un grup.
        </p>
      </header>
      <AuthForm mode="register" action={register} />
    </main>
  );
}
