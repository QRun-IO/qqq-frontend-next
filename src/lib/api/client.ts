/** API Client — Singleton Axios instance with global 401 interceptor for all QQQ API calls. */
// All API calls must go through this client

import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios'

/** Base URL for all QQQ API requests, read from the environment at module load time. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'

/**
 * Singleton HTTP client wrapping Axios for all QQQ API communication.
 *
 * Automatically attaches the `sessionUUID` cookie on every request via
 * `withCredentials: true` and intercepts 401 responses globally so that
 * the application can trigger a logout / redirect-to-login flow without
 * each call site having to handle it individually.
 */
class APIClient {
  /** Underlying Axios instance pre-configured with the QQQ base URL and credentials. */
  private client: AxiosInstance

  /**
   * Optional callback invoked when the server returns a 401 Unauthorized response.
   * Typically wired to the auth provider's logout / redirect-to-login function.
   */
  private unauthorizedCallback?: () => void

  /**
   * Creates the Axios instance and registers the global 401 response interceptor.
   */
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      withCredentials: true, // Send sessionUUID cookie
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Global 401 interceptor — triggers logout flow
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && this.unauthorizedCallback) {
          this.unauthorizedCallback()
        }
        return Promise.reject(error)
      }
    )
  }

  /**
   * Registers a callback to be invoked whenever the API returns a 401 Unauthorized response.
   *
   * The auth provider calls this during initialisation so that any unauthenticated
   * API response automatically triggers the logout / redirect flow.
   *
   * @param callback - Function to call on receipt of a 401 response.
   */
  setUnauthorizedCallback(callback: () => void): void {
    this.unauthorizedCallback = callback
  }

  /**
   * Performs an HTTP GET request and returns the response body.
   *
   * @param url - Path relative to the API base URL (e.g. `/metaData`).
   * @param config - Optional Axios request configuration (query params, headers, etc.).
   * @returns The deserialized response body typed as `T`.
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  /**
   * Performs an HTTP POST request and returns the response body.
   *
   * @param url - Path relative to the API base URL.
   * @param data - Request body to serialize and send.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized response body typed as `T`.
   */
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  /**
   * Performs an HTTP PUT request and returns the response body.
   *
   * @param url - Path relative to the API base URL.
   * @param data - Request body to serialize and send.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized response body typed as `T`.
   */
  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  /**
   * Performs an HTTP DELETE request and returns the response body.
   *
   * @param url - Path relative to the API base URL.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized response body typed as `T`.
   */
  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }

  /**
   * Exposes the raw Axios instance for use-cases that require lower-level access
   * (e.g. MSW handler registration in tests).
   *
   * @returns The underlying `AxiosInstance`.
   */
  getInstance(): AxiosInstance {
    return this.client
  }
}

/** Shared singleton instance used by all API modules. */
const apiClient = new APIClient()
export default apiClient
