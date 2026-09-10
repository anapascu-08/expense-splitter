import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, checkPasswordResetToken } from "@/lib/auth";
import { resetPassword } from "@/app/auth-actions";
import { ResetPasswordForm } from "@/app/reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { token } = await params;

  const check = await checkPasswordResetToken(token);
  if (!check.valid) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
        <h1 className="text-2xl font-semibold">Link invalid</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Linkul de resetare a expirat, a fost deja folosit sau nu există.
          Cere unul nou.
        </p>
        <Link href="/forgot-password" className="text-sm underline">
          Cere un link nou
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Parolă nouă</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Alege o parolă nouă pentru contul tău.
        </p>
      </header>
      <ResetPasswordForm action={resetPassword} token={token} />
    </main>
  );
}
