import { useSessionId } from "../use-session";
import { useSuspenseQuery } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "../../convex/_generated/api";

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
