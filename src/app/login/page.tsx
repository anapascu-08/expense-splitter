import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { inviteContext } from "@/lib/invite";
import { login } from "@/app/auth-actions";
import { AuthForm } from "@/app/auth-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");

  const { next } = await searchParams;
  const invite = await inviteContext(next);

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col gap-6 px-4 py-16">
      <header>
        <h1 className="text-2xl font-semibold">Autentificare</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {invite ? (
            <>
              <span className="font-medium">{invite.inviterName}</span> te-a
              invitat în grupul{" "}
              <span className="font-medium">„{invite.groupName}”</span>. Intră în
              cont ca să accepți.
            </>
          ) : (
            "Intră în cont ca să-ți vezi grupurile."
          )}
        </p>
      </header>
      <AuthForm mode="login" action={login} next={next} />
    </main>
  );
}
