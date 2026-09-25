/*
 * Copyright 2026 QRun.IO, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @file API Client — Singleton Axios instance with global 401 interceptor for all QQQ API calls.
 */

import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios'

/** Base URL for all QQQ API requests, read from the environment at module load time. */
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'

/**
 * Whether a request URL is a session endpoint whose 401 means "sign-in denied"
 * rather than "the current session expired".
 *
 * @param url - The request URL (relative to its base URL).
 * @returns True for `/manageSession` and `/logout`.
 */
export function isSessionEndpoint(url: string | undefined): boolean {
  return Boolean(url && /(^|\/)(manageSession|logout)(\?|$)/.test(url))
}

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
      timeout: 30_000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Global 401 interceptor — triggers the re-authentication flow. Session calls
    // (manageSession, logout) report their own 401s to the auth provider instead.
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401 && this.unauthorizedCallback && !isSessionEndpoint(error.config?.url)) {
          this.unauthorizedCallback()
        }
        // Surface the backend's own explanation (e.g. "Permission denied.") instead of
        // axios' generic "Request failed with status code 403".
        const backendMessage = (error.response?.data as { error?: unknown } | undefined)?.error
        if (typeof backendMessage === 'string' && backendMessage.trim()) {
          error.message = backendMessage.trim()
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
   * @param callback - Typically wired to the `AuthProvider`'s logout function so
   *   that a session timeout or expired cookie automatically triggers a redirect
   *   to the login page. Invoked automatically on HTTP 401 before the failed
   *   request's `Promise.reject` is propagated to the call site.
   */
  setUnauthorizedCallback(callback: () => void): void {
    this.unauthorizedCallback = callback
  }

  /**
   * Performs an HTTP GET request and returns the response body.
   *
   * On a 401 response the global unauthorized callback is invoked (typically
   * redirecting to the login page) before this promise rejects.
   *
   * @param url - Path relative to the API base URL (e.g. `/metaData`).
   * @param config - Optional Axios request configuration (query params, headers, etc.).
   * @returns The deserialized `response.data` typed as `T`. Rejects with an
   *   `AxiosError` on any non-2xx status; on 401 the auth redirect fires first.
   */
  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  /**
   * Performs an HTTP POST request and returns the response body.
   *
   * On a 401 response the global unauthorized callback is invoked (typically
   * redirecting to the login page) before this promise rejects.
   *
   * @param url - Path relative to the API base URL.
   * @param data - Request body to serialize and send. Pass `FormData` for
   *   multipart uploads; pass a plain object for JSON bodies.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized `response.data` typed as `T`. Rejects with an
   *   `AxiosError` on any non-2xx status; on 401 the auth redirect fires first.
   */
  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  /**
   * Performs an HTTP PUT request and returns the response body.
   *
   * On a 401 response the global unauthorized callback is invoked (typically
   * redirecting to the login page) before this promise rejects.
   *
   * @param url - Path relative to the API base URL.
   * @param data - Request body to serialize and send. Pass `FormData` for
   *   multipart uploads; pass a plain object for JSON bodies.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized `response.data` typed as `T`. Rejects with an
   *   `AxiosError` on any non-2xx status; on 401 the auth redirect fires first.
   */
  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  /**
   * Performs an HTTP DELETE request and returns the response body.
   *
   * On a 401 response the global unauthorized callback is invoked (typically
   * redirecting to the login page) before this promise rejects.
   *
   * @param url - Path relative to the API base URL.
   * @param config - Optional Axios request configuration.
   * @returns The deserialized `response.data` typed as `T`. Rejects with an
   *   `AxiosError` on any non-2xx status; on 401 the auth redirect fires first.
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
