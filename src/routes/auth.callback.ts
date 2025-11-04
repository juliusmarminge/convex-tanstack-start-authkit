import { createFileRoute } from "@tanstack/react-router";
import { handleCallbackRoute } from "@workos/authkit-tanstack-react-start/callback";

export const Route = createFileRoute("/auth/callback")({
  server: {
    handlers: {
      GET: handleCallbackRoute(),
    },
  },
});
