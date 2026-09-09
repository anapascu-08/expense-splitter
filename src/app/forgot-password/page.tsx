import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { requestPasswordReset } from "@/app/auth-actions";
import { FeedbackForm } from "@/app/feedback-form";
import { SubmitButton } from "@/app/submit-button";

export default async function ForgotPasswordPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Resetează parola</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Introdu emailul contului — dacă există, primești un link de
          resetare valabil o oră.
        </p>
      </header>
      <FeedbackForm
        action={requestPasswordReset}
        rowClassName="flex flex-col gap-3"
        stickyOk
      >
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            className="field"
          />
        </label>
        <SubmitButton variant="primary" pendingLabel="Se trimite…">
          Trimite linkul
        </SubmitButton>
      </FeedbackForm>
      <Link
        href="/login"
        className="text-sm text-gray-500 hover:underline dark:text-gray-400"
      >
        ← Înapoi la autentificare
      </Link>
    </main>
  );
}
