// Base API client with global 401 interceptor
// All API calls must go through this client

import axios, { type AxiosInstance, type AxiosError, type AxiosRequestConfig } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || '/qqq/v1'

class APIClient {
  private client: AxiosInstance
  private unauthorizedCallback?: () => void

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

  setUnauthorizedCallback(callback: () => void): void {
    this.unauthorizedCallback = callback
  }

  async get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }

  getInstance(): AxiosInstance {
    return this.client
  }
}

const apiClient = new APIClient()
export default apiClient
