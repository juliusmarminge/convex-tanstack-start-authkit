import { createMiddleware, createStart } from "@tanstack/react-start";
import { authkit } from "@workos/authkit-tanstack-react-start/authkit";

const authMiddleware = createMiddleware().server(async (args) => {
  // authkit.withAuth handles token validation, refresh, and session decryption
  const authResult = await authkit.withAuth(args.request);
  // Store auth result in global context for routes and server functions to access
  return args.next({
    context: { auth: () => authResult },
  });
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [authMiddleware],
  };
});
