import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import toast from 'react-hot-toast';

// HTTP Link
const httpLink = createHttpLink({
  uri: import.meta.env.VITE_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql',
});

// Auth Link
const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage if it exists
  const token = localStorage.getItem('safedocs-auth');
  let authToken = '';
  
  if (token) {
    try {
      const parsed = JSON.parse(token);
      authToken = parsed?.state?.token || '';
    } catch (error) {
      console.error('Error parsing auth token:', error);
    }
  }

  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: authToken ? `Bearer ${authToken}` : '',
    },
  };
});

// Error Link
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }) => {
      console.error(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
      
      // Handle specific error types
      if (extensions?.code === 'UNAUTHENTICATED') {
        toast.error('Authentication required. Please connect your wallet.');
        // Optionally redirect to login or clear auth state
        localStorage.removeItem('safedocs-auth');
        window.location.href = '/';
      } else if (extensions?.code === 'FORBIDDEN') {
        toast.error('Access denied. Insufficient permissions.');
      } else {
        toast.error(message || 'An error occurred');
      }
    });
  }

  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
    
    if (networkError.statusCode === 401) {
      toast.error('Authentication expired. Please reconnect your wallet.');
      localStorage.removeItem('safedocs-auth');
      window.location.href = '/';
    } else if (networkError.statusCode === 403) {
      toast.error('Access forbidden.');
    } else if (networkError.statusCode >= 500) {
      toast.error('Server error. Please try again later.');
    } else {
      toast.error('Network error. Please check your connection.');
    }
  }
});

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Document: {
        fields: {
          signatures: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
      User: {
        fields: {
          documents: {
            merge(existing = [], incoming) {
              return incoming;
            },
          },
        },
      },
      Query: {
        fields: {
          documents: {
            keyArgs: ['filter', 'sort'],
            merge(existing, incoming, { args: { offset = 0 } }) {
              const merged = existing ? existing.slice() : [];
              for (let i = 0; i < incoming.length; ++i) {
                merged[offset + i] = incoming[i];
              }
              return merged;
            },
          },
        },
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true,
    },
    query: {
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all',
    },
  },
  connectToDevTools: import.meta.env.DEV,
});

// Helper function to clear cache and reset store
export const resetApolloCache = async () => {
  await apolloClient.clearStore();
};