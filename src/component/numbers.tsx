import { useSessionId } from "../use-session";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";
import { useMutation } from "convex/react";
import { Id } from "../../convex/_generated/dataModel";

export function Numbers() {
  const sessionId = useSessionId();
  const { data } = useSuspenseQuery(
    convexQuery(api.myFunctions.listNumbers, {
      sessionId,
      count: 10,
    }),
  );

  console.log("numbers", data.numbers);

  return (
    <ul className="mb-4 list-disc pl-5" data-testid="numbers">
      {data.numbers.map(({ id, value }) => (
        <li key={id} className="text-blue-700">
          {value}
        </li>
      ))}
    </ul>
  );
}

export function AddNumberButton() {
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
