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
 * @file us-map-projection — places a latitude and longitude on the `usaMap` basemap the
 * way the Material dashboard's jvectormap `us_aea` map does: an Albers equal-area conic
 * projection (standard parallels 29.5 and 45.5 degrees, central meridian -100) whose
 * projected area is drawn into three insets (Alaska, Hawaii, the contiguous states).
 */

/** Width of the basemap in pixels. */
export const US_MAP_WIDTH = 900

/** Height of the basemap in pixels. */
export const US_MAP_HEIGHT = 612.395

/** Central meridian of the projection, in degrees. */
const CENTRAL_MERIDIAN = -100

/** Earth radius jvectormap projects with, in meters. */
const RADIUS = 6381372

/** Degrees to radians. */
const RAD = Math.PI / 180

/** One inset: the projected bounding box (top-left, bottom-right) drawn into a pixel box. */
interface Inset {
  left: number
  top: number
  width: number
  height: number
  bbox: [[number, number], [number, number]]
}

/** Alaska, Hawaii and the contiguous states (jvectormap `us_aea` insets). */
const INSETS: Inset[] = [
  { left: 0, top: 440, width: 220, height: 172.395413, bbox: [[-4774054.664881942, -8441276.54251503], [-1949590.5739843722, -6227982.667213126]] },
  { left: 245, top: 460, width: 80, height: 151.483374, bbox: [[-5906305.806252358, -4196208.652471859], [-5621698.812337889, -3657293.3059425415]] },
  { left: 0, top: 0, width: 900, height: 550.112205, bbox: [[-2029882.6485830692, -5490816.561605522], [2552322.14899711, -2690009.0242363815]] },
]

/**
 * Albers equal-area conic projection (jvectormap `Proj.aea`).
 *
 * @param latitude - Latitude in degrees.
 * @param longitude - Longitude in degrees.
 * @returns Projected coordinates in meters.
 */
function albers(latitude: number, longitude: number): { x: number; y: number } {
  const fi1 = 29.5 * RAD
  const fi2 = 45.5 * RAD
  const n = (Math.sin(fi1) + Math.sin(fi2)) / 2
  const c = Math.cos(fi1) * Math.cos(fi1) + 2 * n * Math.sin(fi1)
  const theta = n * (longitude * RAD - CENTRAL_MERIDIAN * RAD)
  const ro = Math.sqrt(c - 2 * n * Math.sin(latitude * RAD)) / n
  const ro0 = Math.sqrt(c) / n
  return { x: ro * Math.sin(theta) * RADIUS, y: -(ro0 - ro * Math.cos(theta)) * RADIUS }
}

/**
 * The basemap pixel for a latitude and longitude (jvectormap `latLngToPoint`).
 *
 * @param latitude - Latitude in degrees.
 * @param longitude - Longitude in degrees.
 * @returns The pixel, or `null` when the point is outside every inset (not in the US).
 */
export function projectUsLatLng(latitude: number, longitude: number): { x: number; y: number } | null {
  const point = albers(latitude, longitude < -180 + CENTRAL_MERIDIAN ? longitude + 360 : longitude)
  const inset = INSETS.find(({ bbox }) => point.x > bbox[0][0] && point.x < bbox[1][0] && point.y > bbox[0][1] && point.y < bbox[1][1])
  if (!inset) return null
  const [[x0, y0], [x1, y1]] = inset.bbox
  return {
    x: ((point.x - x0) / (x1 - x0)) * inset.width + inset.left,
    y: ((point.y - y0) / (y1 - y0)) * inset.height + inset.top,
  }
}
