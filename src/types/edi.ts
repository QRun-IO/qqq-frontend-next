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

/** @file Generated from the vendored edi.json. Run scripts/generate-edi-types.mjs; do not edit. */

/** Concatenated acknowledgement previews; type is 997, 999, TA1, CONTRL, NONE or MIXED. text is null for PHI. */
export type EdiAckV1 = {
  text?: string | null
  type?: string | null
}

/** Direct QQQ association and its target fields. */
export type EdiAssociationV1 = {
  fields?: Array<EdiFieldV1>
  label?: string | null
  name?: string | null
  table?: string | null
}

/** Only differing records are returned. Both lists are empty for PHI. */
export type EdiDiffV1 = {
  againstExpected?: Array<EdiDifferenceV1>
  againstPreviousRevision?: Array<EdiDifferenceV1>
}

/** One document comparison; documentIndex is zero based. */
export type EdiDifferenceV1 = {
  after?: Record<string, unknown> | null
  before?: unknown
  documentIndex?: number | null
}

/** Element or composite component; codes contain at most 200 active codes in lexical order. */
export type EdiElementV1 = {
  codeListId?: number | null
  codes?: Array<string | null>
  component?: number | null
  id?: string | null
  maxLength?: number | null
  minLength?: number | null
  name?: string | null
  position?: number | null
  type?: string | null
  usage?: string | null
}

/** Core middleware error body. */
export type EdiErrorV1 = {
  error?: string | null
}

/** QQQ target field metadata. */
export type EdiFieldV1 = {
  label?: string | null
  name?: string | null
  possibleValueSourceName?: string | null
  required?: boolean
  type?: string | null
}

/** Value-free diagnostic. PHI messages are generic; only positions and codes are retained. */
export type EdiFindingV1 = {
  code?: string | null
  elementPosition?: number | null
  loopId?: string | null
  message?: string | null
  segmentId?: string | null
  segmentPosition?: number | null
  severity?: string | null
  snipLevel?: number | null
}

/** Ordered guide tree. Root segments are outside loops; nested loops retain parent scope. */
export type EdiGuideTreeV1 = {
  loops?: Array<EdiLoopV1>
  segments?: Array<EdiSegmentV1>
}

/** Guide loop, nested within its parent; repeat is the maximum occurrence count. */
export type EdiLoopV1 = {
  id?: string | null
  loops?: Array<EdiLoopV1>
  repeat?: number | null
  segments?: Array<EdiSegmentV1>
}

/** Counts of wire interchanges, groups and documents. */
export type EdiParseV1 = {
  documents?: number | null
  groups?: number | null
  interchanges?: number | null
}

/** mapId is required. Supply exactly one of sampleId or sampleBase64. Uploads are at most 5 MiB decoded, stored encrypted. ruleOverrides replaces the whole rule set in memory. CURRENT (default) uses the newest active guide in the pinned guide family; ORIGINAL uses the pinned guide. */
export type EdiPreviewRequestV1 = {
  guideRevision?: "CURRENT" | "ORIGINAL" | null
  mapId?: number | null
  ruleOverrides?: Array<EdiRuleV1> | null
  sampleBase64?: string | null
  sampleId?: number | null
  sampleName?: string | null
}

/** Parse, validate, acknowledge and map without target writes. PHI suppresses result, ack text, and both diffs. */
export type EdiPreviewV1 = {
  ack?: EdiAckV1
  diff?: EdiDiffV1
  findings?: Array<EdiFindingV1>
  parse?: EdiParseV1
  phiSuppressed?: boolean
  result?: EdiResultV1 | null
}

/** Field values and recursively associated records. Values use the target table field types. */
export type EdiRecordV1 = {
  associations?: Record<string, Array<EdiRecordV1>>
  values?: Record<string, unknown>
}

/** Mapped records in document order; no target writes. */
export type EdiResultV1 = {
  records?: Array<EdiRecordV1>
}

/** Correlate errors using zero-based index, optional id and sequence. */
export type EdiRuleErrorsV1 = {
  errors?: Array<string | null>
  id?: number | null
  index?: number | null
  sequence?: number | null
}

/** Map rule. id is optional for unsaved rules. transformArgs is a JSON object encoded as a string, as in core table CRUD. */
export type EdiRuleV1 = {
  condition?: string | null
  defaultValue?: string | null
  ediPath?: string | null
  id?: number | null
  qqqPath?: string | null
  required?: boolean | null
  sequence?: number | null
  transform?: string | null
  transformArgs?: string | null
}

/** Segment definition in guide sequence order. */
export type EdiSegmentV1 = {
  elements?: Array<EdiElementV1>
  id?: string | null
  max?: number | null
  min?: number | null
  name?: string | null
  position?: string | null
  usage?: string | null
}

/** Target metadata visible to the caller, current rules and registered transforms. */
export type EdiTargetV1 = {
  associations?: Array<EdiAssociationV1>
  fields?: Array<EdiFieldV1>
  rules?: Array<EdiRuleV1>
  table?: string | null
  transforms?: Array<EdiTransformV1>
}

/** Registered transform and JSON Schema describing its string-valued arguments. */
export type EdiTransformV1 = {
  argumentSchema?: Record<string, unknown>
  name?: string | null
}

/** rules is required and may be empty; rules are never persisted. */
export type EdiValidateRequestV1 = {
  rules?: Array<EdiRuleV1>
}

/** One result per submitted rule, including rules with no errors. */
export type EdiValidationV1 = {
  rules?: Array<EdiRuleErrorsV1>
}
