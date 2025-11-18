import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { authkit } from "@workos/authkit-tanstack-react-start/authkit";
import { createServerFn } from "@tanstack/react-start";
import { AddNumberButton, Numbers } from "../component/numbers";

const getSignInUrl = createServerFn().handler(async () => {
  return await authkit.getSignInUrl();
});

export const Route = createFileRoute("/")({
  component: RouteComponent,
  loader: async () => {
    const signInUrl = await getSignInUrl();
    return { signInUrl };
  },
});

function RouteComponent() {
  const { user } = useAuth();

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">
        Hello, {user?.firstName ?? "Anon"}!
      </h1>
      <Numbers />
      <AddNumberButton />
      <div>{user ? <SignOutButton /> : <SignInButton />}</div>
    </div>
  );
}

function SignInButton() {
  const href = Route.useLoaderData({ select: (data) => data.signInUrl });
  return (
    <a href={href} className="inline-block mt-2 text-blue-600 hover:underline">
      Sign In
    </a>
  );
}

function SignOutButton() {
  const { signOut } = useAuth();
  return (
    <button
      onClick={() => signOut()}
      className="inline-block mt-2 text-blue-600 hover:underline"
    >
      Sign Out
    </button>
  );
}
