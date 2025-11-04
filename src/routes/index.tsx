import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { api } from "../../convex/_generated/api";
import { useAuth } from "@workos/authkit-tanstack-react-start/client";
import { useSessionId } from "../use-session";
import { authkit } from "@workos/authkit-tanstack-react-start/authkit";
import { createServerFn } from "@tanstack/react-start";
import { Id } from "../../convex/_generated/dataModel";

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

function Numbers() {
  const sessionId = useSessionId();
  const { data } = useSuspenseQuery(
    convexQuery(api.myFunctions.listNumbers, {
      sessionId,
      count: 10,
    }),
  );

  console.log("numbers", data.numbers);

  return (
    <ul className="mb-4 list-disc pl-5">
      {data.numbers.map(({ id, value }) => (
        <li key={id} className="text-blue-700">
          {value}
        </li>
      ))}
    </ul>
  );
}

function AddNumberButton() {
  const sessionId = useSessionId();
  const addNumber = useMutation(api.myFunctions.addNumber).withOptimisticUpdate(
    (localStore, args) => {
      const queryArgs = { sessionId, count: 10 };
      const query = localStore.getQuery(api.myFunctions.listNumbers, queryArgs);
      if (query) {
        const newNumbers = [
          ...query.numbers.slice(1, 10),
          { id: crypto.randomUUID() as Id<"numbers">, value: args.value },
        ];

        localStore.setQuery(api.myFunctions.listNumbers, queryArgs, {
          ...query,
          numbers: newNumbers,
        });
      }
    },
  );

  return (
    <button
      className="mb-3 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
      onClick={() => addNumber({ value: Math.floor(Math.random() * 100) })}
    >
      Add Number
    </button>
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
