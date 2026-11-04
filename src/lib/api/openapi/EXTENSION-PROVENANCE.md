# Scripting and retained-download contracts

Vendored 2026-10-31 from the local development candidates. These documents are
generated from registered QQQ endpoint descriptors, not hand-authored route lists.
They do not assert that an application has enabled the optional extensions.

| Document | Source | Operations |
| --- | --- | --- |
| `extensions/scripting.json` | `qbit-scripting/middleware/src/main/resources/openapi/qqq-v1/scripting.yaml` | 14 |
| `extensions/record-files-downloads.json` | `TrackedDownloadApi.register(QInstance)` extension `record-files-downloads`, generated with `UiApiContract.generateExtensionYaml(new MiddlewareVersionV1(), extension)` | 2 |

The scripting source is checked by `ScriptingApiContractTest.generatedContractMatches`.
The download source currently has registered native descriptors and real HTTP
delivery/receipt tests, but no checked-in generated YAML drift test. That backend
follow-up remains explicit; this frontend change does not fabricate one.

The download generation used the compiled Record Files test classpath, without
changing backend sources or replacing any dependency artifact. Equivalent Java:

```java
QInstance instance = new QInstance();
TrackedDownloadApi.register(instance);
var extension = MiddlewareSpecExtensionsMetaData.ofOrWithNew(instance)
   .getExtensions().get("record-files-downloads");
String yaml = UiApiContract.generateExtensionYaml(new MiddlewareVersionV1(), extension);
```

Both YAML results were converted without schema modification using the already
installed `yaml@2.9.1` parser and `JSON.stringify(model, null, 2) + '\n'`.
No dependencies were installed. The generated download descriptors share identical
body/receipt component definitions; the native generator reports duplicate component
names while resolving these identical schemas.

SHA-256 provenance:

| Input/output | SHA-256 |
| --- | --- |
| Scripting source YAML | `C091669660C20A05B653B6E0371D9E468801D60F934AE52332E80D1CD4954242` |
| Download generated YAML | `AC808285C310B87CBF04748DB7085FEF154DF9349AAED22AA725A65269098518` |
| TrackedDownloadApi.java | `C8E2BB37C9ED62466BEBA5475114B3EDC1E44DE939A3D1CE47C55660BB75AC58` |
| DownloadEndpointSpec.java | `73AC88745A54DC8305C54802029AFCC99A24BF40F6F65864CB11169AF8964BD3` |
| TrackedDownloadApi.class | `242A80F8F7D523B266B6CA39D8DFADA41C1B370493EAAA2F0241D9DA943FE01C` |
| DownloadEndpointSpec.class | `16DA3B06C640224DB403EC73085D8CE705D45F56D1AC8718A80606BFA8F05078` |
| Vendored scripting JSON | `DBB99B3DC0AB6B31A210CB7358A7608EB742CA29EBD61AAB325876CDAEFC6DF6` |
| Vendored downloads JSON | `0B76F04195747768F14F371BAED6CEB388423A24D9889485EBA350EA0318A649` |

Computed call mappings remain exact file/expression entries. The scripting helper
is named `scriptProjectPath` to avoid a global `path` collision. Tracked download
validates its exact native route before creating a fresh attempt UUID; the receipt
appends only `/receipt` to that same validated route. PDF preview now admits only
the standard four-coordinate table-file path at the configured API origin, plus
local browser blobs. Its mapping does not cover arbitrary table GET operations.
`OFF_SPEC_CALLS` and its ceiling remain zero; mapped operations still must exist
in generated documents, and stale mapping entries still fail the contract test.

Verification: 28 tests passed across `ui-api-contract.test.ts`,
`pdf-preview.test.ts`, `scripting.test.ts`, and `attachment-download.test.ts`.
Scoped ESLint and the repository's `pnpm typecheck` also passed. Full frontend
production and suite verification remain separate parent-coordinated gates.
