import { ConvexReactSessionClient } from "convex-helpers/react/sessions";
import { useConvex } from "convex/react";

export const useSessionId = () => {
  const convex = useConvex() as ConvexReactSessionClient;
  return convex.getSessionId();
};
