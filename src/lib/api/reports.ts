/** Reports API — Report run and status endpoints for QQQ report execution. */

import apiClient from './client'

/**
 * Request body accepted by the report run endpoint.
 */
export interface RunReportRequest {
  /**
   * The output format for the generated report.
   * Defaults to CSV when omitted.
   */
  reportFormat?: 'CSV' | 'EXCEL' | 'JSON'
}

/**
 * Response returned by the report run and status endpoints.
 *
 * The backend may resolve the report synchronously (returning results immediately)
 * or asynchronously (returning a `jobUUID` to poll via {@link getReportStatus}).
 */
export interface RunReportResponse {
  /** UUID of the async job when the report is running asynchronously. */
  jobUUID?: string
  /** Inline result records when the report completes synchronously. */
  records?: unknown[]
  /** Suggested file name for the downloadable output file. */
  downloadFileName?: string
  /** URL to download the generated report file. */
  downloadUrl?: string
  /** Job status string (e.g. "RUNNING", "COMPLETE", "ERROR"). */
  status?: string
  /** Human-readable error message when `status` is "ERROR". */
  error?: string
}

/**
 * Initiates report execution via `POST /report/{reportName}/run`.
 *
 * The backend may return results immediately (synchronous) or start an async
 * job and return a `jobUUID` to poll. Check `response.jobUUID` to determine
 * which path was taken.
 *
 * @param reportName - Backend-registered name of the report to run.
 * @param request - Optional run parameters, including the desired output format.
 * @returns A {@link RunReportResponse} describing either the completed result or a pending job.
 */
export async function runReport(
  reportName: string,
  request: RunReportRequest = {}
): Promise<RunReportResponse> {
  return apiClient.post<RunReportResponse>(
    `/report/${encodeURIComponent(reportName)}/run`,
    request
  )
}

/**
 * Polls the status of an asynchronous report job via `GET /report/status/{jobUUID}`.
 *
 * Call this repeatedly after {@link runReport} returns a `jobUUID` until
 * `status` is no longer "RUNNING".
 *
 * @param jobUUID - The async job UUID returned by {@link runReport}.
 * @returns A {@link RunReportResponse} with the current job state.
 */
export async function getReportStatus(jobUUID: string): Promise<RunReportResponse> {
  return apiClient.get<RunReportResponse>(`/report/status/${encodeURIComponent(jobUUID)}`)
}
