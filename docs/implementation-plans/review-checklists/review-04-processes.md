# Review Checklist: Package 4 — Process Execution

### Requirements Coverage
- [ ] Section 5.2.4: Standalone process at /app/{processName}
- [ ] Section 5.2.4: Table-scoped process with recordIds
- [ ] Section 5.2.4: Table-scoped process with filterJSON
- [ ] Section 5.3.4: Step wizard with stepper UI
- [ ] Section 5.3.4: All 14 component types rendered
- [ ] Section 5.3.4: Validation review screen
- [ ] Section 5.3.4: Bulk load workflows (file mapping, value mapping, profiles)
- [ ] Section 5.3.4: Process results summary
- [ ] Section 5.3.4: Async job progress display
- [ ] Section 3.5.1: POST /processes/{p}/init
- [ ] Section 3.5.2: POST /processes/{p}/{uuid}/step/{stepName}
- [ ] Section 3.5.3: GET /processes/{p}/{uuid}/status/{jobUUID}
- [ ] Section 3.5.4: GET /processes/{p}/{uuid}/records
- [ ] Section 3.5.5: GET /processes/{p}/{uuid}/cancel

### Integration Check
- [ ] Form components reused from Package 3 (EntityForm, DynamicFormField)
- [ ] Possible values autocomplete from Package 3
- [ ] Process can be launched from Record Query toolbar (Package 2)
- [ ] Process can be launched from Record View action menu (Package 3)
- [ ] Process results link back to affected records (Package 3 routes)
- [ ] Widget component type delegates to Package 5

### API Contract Compliance
- [ ] POST /processes/{p}/init — multipart/form-data with values, recordsParam, file
- [ ] POST /processes/{p}/{uuid}/step/{s} — multipart/form-data with values, file
- [ ] GET /processes/{p}/{uuid}/status/{j} — returns QJobRunning | QJobComplete | QJobError
- [ ] GET /processes/{p}/{uuid}/records — query params skip, limit
- [ ] GET /processes/{p}/{uuid}/cancel — returns boolean
- [ ] Exponential backoff polling: 1.5s initial, 1.5x multiplier, 12s max

### Metadata-Driven Check
- [ ] Steps rendered from QFrontendStepMetaData.components
- [ ] Form fields from step.formFields metadata
- [ ] View fields from step.viewFields metadata
- [ ] Process label from metadata (not process name)
- [ ] ProcessMetaDataAdjustment handled (step list and field updates)
- [ ] minInputRecords/maxInputRecords enforced

### Responsive Check
- [ ] Full-screen steps on mobile
- [ ] Stepper horizontal scrollable on mobile
- [ ] Bottom-anchored navigation buttons on mobile
- [ ] File upload drop zone works on touch devices
- [ ] Progress display readable at all breakpoints

### Accessibility Check
- [ ] Stepper has aria-label and step indicators
- [ ] Current step has aria-current="step"
- [ ] Progress bar has role="progressbar" with aria-valuenow/min/max
- [ ] Cancel button has confirmation dialog
- [ ] Form steps use accessible form patterns from Package 3
- [ ] Error messages linked to relevant fields via aria-describedby

### Type Safety Check
- [ ] Process response union type properly discriminated (QJobStarted | QJobComplete | QJobError)
- [ ] ProcessMetaDataAdjustment typed
- [ ] Step component type discriminated on QComponentType enum
- [ ] File upload typed with File/FormData
- [ ] No `any` in process state management
