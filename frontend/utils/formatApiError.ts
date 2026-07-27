export interface FormattedError {
  title: string;
  message: string;
  code: string;
  status?: number;
}

export function formatApiError(error: any): FormattedError {
  if (!error) {
    return {
      title: 'Unexpected Error',
      message: 'Something went wrong. Please try again.',
      code: 'UNKNOWN_ERROR',
    };
  }

  // Network offline or fetch failed
  if (typeof window !== 'undefined' && !navigator.onLine) {
    return {
      title: 'No Internet Connection',
      message: 'Please check your internet connection and try again.',
      code: 'OFFLINE',
    };
  }

  // Timeout error
  if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') || error?.status === 408) {
    return {
      title: 'Request Timed Out',
      message: 'The request took too long to complete. Please try again.',
      code: 'TIMEOUT',
      status: 408,
    };
  }

  const status = error?.response?.status || error?.status;
  const backendMessage = error?.response?.data?.message || error?.message;

  switch (status) {
    case 401:
      return {
        title: 'Session Expired',
        message: 'Your session has expired. Please log in again.',
        code: 'UNAUTHORIZED',
        status: 401,
      };

    case 403:
      return {
        title: 'Access Denied',
        message: "You don't have permission to perform this action.",
        code: 'FORBIDDEN',
        status: 403,
      };

    case 404:
      return {
        title: 'Not Found',
        message: backendMessage || 'The requested resource could not be found.',
        code: 'NOT_FOUND',
        status: 404,
      };

    case 429:
      return {
        title: 'Too Many Requests',
        message: 'You are making requests too quickly. Please slow down and try again.',
        code: 'TOO_MANY_REQUESTS',
        status: 429,
      };

    case 500:
      return {
        title: 'Server Error',
        message: 'Something went wrong on our side. Please try again in a few minutes.',
        code: 'SERVER_ERROR',
        status: 500,
      };

    case 503:
      return {
        title: 'Maintenance Mode',
        message: "We're performing maintenance or servers are temporarily busy. Please check back shortly.",
        code: 'SERVICE_UNAVAILABLE',
        status: 503,
      };

    default:
      if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
        return {
          title: 'Connection Refused',
          message: 'Unable to connect to our servers. Please verify backend services are running.',
          code: 'NETWORK_ERROR',
        };
      }
      return {
        title: 'Error',
        message: backendMessage || 'An error occurred while processing your request.',
        code: 'API_ERROR',
        status,
      };
  }
}
