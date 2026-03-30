import { ApolloClient, InMemoryCache, HttpLink, from } from "@apollo/client/core";
import { setContext } from "@apollo/client/link/context";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

const authLink = setContext((_, { headers }) => {
  if (typeof window === "undefined") return { headers };
  const token = localStorage.getItem("omnilearn_token");
  return {
    headers: {
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
});

const httpLink = new HttpLink({
  uri: `${API_URL}/graphql`,
  credentials: "include",
});

export const apolloGeoClient = new ApolloClient({
  link: from([authLink, httpLink]),
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: { fetchPolicy: "network-only" },
    query: { fetchPolicy: "network-only" },
  },
});
