import { vi } from "vitest";

export async function getAuthkitComponentsMocks() {
  const user = {
    id: "123",
    email: "test@test.com",
    firstName: "Test",
    lastName: "Test",
    profilePictureUrl: "https://test.com/profile.png",
    externalId: "123",
    workosId: "123",
  };
  const accessToken = undefined;

  const signOut = vi.fn(async () => undefined);
  const refresh = vi.fn(async () => accessToken);
  const getAccessToken = vi.fn(async () => accessToken);

  function AuthKitProvider({ children }: { children: React.ReactNode }) {
    return children;
  }

  function useAuth() {
    return {
      loading: false,
      signOut,
      user,
    };
  }

  function useAccessToken() {
    return {
      error: null,
      loading: false,
      accessToken,
      getAccessToken,
      refresh,
    };
  }

  return {
    AuthKitProvider,
    useAuth,
    useAccessToken,
  };
}

export async function getAuthkitIndexMocks() {
  const authkit = vi.fn(async () => ({
    headers: new Headers(),
    session: { user: null },
    authorizationUrl: undefined,
  }));
  const getSignInUrl = vi.fn(async () => "https://test.com/signin");
  const refreshSession = vi.fn(async () => undefined);

  return {
    authkit,
    getSignInUrl,
    refreshSession,
  };
}
