# Changelog

All notable changes to `@tornotron/echno-core` will be documented in this file.

From `v1.0.0` the package follows [semantic versioning](https://semver.org/). See
[docs/API-STABILITY.md](docs/API-STABILITY.md) for what counts as the public API.

## [v4.1.0] - 2026-09-01

The client half of echno-backend#636, which froze a verified payment voucher and had to build a
route back out of the freeze in the same change. Additive: one new service method and one new
optional field on the read type. Nothing is removed and no signature moves.

### Added

- **`financeConstructionPaymentService.cancel(id, reason)`** — `POST /finance/construction-payments/web/{id}/cancel`,
  body `{ reason }`, returns the updated voucher.

  This is now the only route to `CANCELLED`. It used to be a status you set through `update`, and
  echno-backend#636 refuses that outright, so a client without this method cannot cancel a voucher
  at all. The same change froze a verified voucher against editing, which makes cancel-and-re-raise
  the only way to correct one, so the method is what reopens a document that would otherwise be
  stuck.

  The reason is required and non-blank, max 1000 characters; a blank one is refused. A voided
  voucher that does not say what was wrong with it explains nothing, and on a verified voucher it
  is the only record of why somebody's check was set aside.

  Cancelling is one-way, a second cancellation is refused, and the verification stamp deliberately
  stays where it is. A cancelled voucher therefore still names its verifier, and a screen should
  read that as "checked, then voided" rather than as a contradiction. There is still no unverify.

- **`ConstructionPayment.cancellationReason`** — why the voucher was voided, unset on one that has
  not been cancelled.

  Set by the cancel action and read-only. Left `undefined` rather than defaulted to an empty
  string, so a screen can decide on the field itself whether the line is worth drawing.

### Changed

- **`update` now documents the two states it is refused in**, because both are visible to the
  caller before the request goes out and neither is worth discovering through a 400: the voucher is
  verified, or `status` is `CANCELLED`. A screen is better off not offering the edit than letting
  somebody fill a form in and lose it.

  No signature moves and nothing is removed here. `UpdateConstructionPaymentRequest.status` still
  accepts the whole enum, because `CANCELLED` is a real status to read back and a screen still has
  to render it; it is only setting it through this call that the backend refuses.

## [v4.0.0] - 2026-09-01

The client half of the five backend changes that took "who did this" off the wire, and the first
release to remove rather than deprecate. Breaking: one function signature narrows and two request
fields come out. Nothing in `echno-web` sets either field, and the one call site that passes the
removed argument is updated alongside this, so the upgrade is a version bump and one edit.

### Removed

- **`verifiedBy` and `verifiedAt` are gone from `CreateConstructionPaymentRequest` and
  `UpdateConstructionPaymentRequest`.**

  `v3.6.0` stopped sending the pair and left both declared and deprecated so no caller broke on
  that upgrade. This is the major the note there promised. A caller that still sets one now fails
  to compile instead of filling in a field the server reads off nothing.

  **Both stay on the read type**, where they are what the backend stamped.

  Worth knowing for anyone reviewing the diff: the public-API snapshot does not move for this. It
  records exported symbol names, not their members, so a removed interface field passes `api:check`
  in silence. `etc/public-api.md` being unchanged is not evidence that nothing broke here.

### Changed

- **`movementService.verifyMovement(id, verifiedBy)` becomes `verifyMovement(id)`**, and
  `useVerifyMovement`'s mutation argument narrows from `{ id, verifiedBy }` to `{ id }`.

  echno-backend#635 removed the `verifiedBy` request parameter from both verify handlers and now
  resolves the verifier from the session. The old flow was the live one: `echno-web` sent
  `currentEmployee?.name ?? currentEmployee?.employeeId ?? ''`, so the verifier recorded against an
  attendance movement was whatever the client put there, into a free-text column nothing checked.

  The backend ignores the parameter rather than rejecting it, so the old client kept working; it
  just stopped influencing the stamp, which was the point. Removing the argument is what stops a
  future reader concluding the client still chooses.

  Two consequences for callers. A screen no longer needs a resolved employee before it can offer
  the action, so any guard that waited for one can go. And verification can now be **refused**,
  which it never could before: 400 when the movement is already verified, when the caller is the
  employee the movement belongs to, and when the session resolves to no user of the organization.
  A fixed error string is wrong for all three; render the `ApiError` message.

### Added

- **`financeConstructionPaymentService.verify(id)`** — `POST /finance/construction-payments/web/{id}/verify`,
  no body, returns the updated voucher.

  echno-backend#631 built this action to replace the two removed fields, and until now no client
  could reach it: the fields were dropped in `v3.6.0` and nothing took their place, so a published
  package had no way to verify a payment at all. Refused, with the reason in the message, on a
  cancelled voucher, one already verified, and a caller who raised it (segregation of duties).

  Named `verify` rather than `verifyConstructionPayment` to sit with `create`, `update` and
  `getById` on the same service object, which do not repeat the entity either.

- **`MovementRecord.verifiedById`** — the verifier's employee id, unset where the verifier has no
  employee record in the organization. That is why `verifiedBy` stays the field to render and this
  is the field to link on.

  Added to both parsers. This DTO has two: the zod schema in `types/attendance/movement.ts` and the
  hand-built `parseMovement` in `movement-service.ts`, and only the second runs on a response. A
  field added to the schema alone compiles cleanly and is dead on every real payload.

- **`ConstructionPayment.raisedBy` and `raisedByName`** — who raised the voucher, the counterpart to
  the verifier and the field the backend's segregation-of-duties refusal compares against.

- **`ConstructionPayment.verifiedByName`** — the verifier's display name. It was on the DTO before
  today and the schema never declared it, so a plain `z.object` stripped it: this is why the payment
  detail screen renders the verifier as `User #7`. Found while adding `raisedByName`, which
  echno-core#74 described as being "on the same fallbacks as `verifiedByName`".

  All three fall back to the account's email where it has no name, and to `User #<id>` where the
  account is gone.

## [v3.6.0] - 2026-08-31

Follows echno-backend#631 off this client. Additive: no export renamed or removed, nothing made
required.

### Changed

- `createConstructionPaymentToJson` and `updateConstructionPaymentToJson` stop sending
  **`verifiedBy` and `verifiedAt`**.

  Verification is an action rather than an attribute. echno-backend#631 removed both fields from
  `CreateConstructionPaymentRequest` and `UpdateConstructionPaymentRequest` and replaced them with
  `POST /construction-payments/web/{id}/verify`, which stamps the verifier from the session. The
  reason is the one that took the six identity fields out in `v3.0.0`: a payload with a slot for
  "who checked this" lets anyone able to edit a voucher record that a named colleague checked a
  payment, at a time of their choosing, and the audit trail then says so silently.

  The timestamp goes with the id because the pair only ever moves together, so a settable
  `verifiedAt` is a settable verification.

  **Both stay on the read type**, where they are what the backend stamped, and the payment detail
  screen renders `verifiedBy` as a link. They stay on the two request interfaces too, deprecated,
  so no caller breaks; they come out in a later major once nothing passes one.

  Four request-contract findings clear. They appeared only after the backend deployed, which is the
  ratchet doing its job: the record is checked against the backend's current `development`, so the
  removal surfaced here within the hour rather than as a silently dropped key.

## [v3.5.0] - 2026-08-31

Eight request-contract findings that were held back as decisions rather than repairs, plus the
three NCR people filters the register needs before "raised by" can become a link. Additive: no
export renamed or removed, nothing made required.

### Added

- `NcrListParams` takes `raisedById`, `verifiedById` and `closedById` beside the `siteEngineerId`
  it already had, and `ncrService.getAll` forwards each one. `GET /ncrs/web` grew them in
  echno-backend#626; they AND with each other and with every filter already there, on the same
  specification, server-side.

  **All three are employee ids, not user ids.** The backend writes the columns from
  `NcrService.currentEmployeeId()`, which resolves the session user through
  `findByUserIdAndOrganizationId`, so they take the same value `siteEngineerId` does. The
  distinction is easy to get wrong and hard to notice: on a fresh database the user and employee
  sequences run in lockstep, so a caller passing a user id gets the right rows by coincidence until
  the two diverge, and then quietly names somebody else.

  This is what unblocks echno-web#35 for NCRs. Narrowing the fetched page in the browser was not an
  option there, because the register is paged: it would hide every match outside the page while
  still reading as a complete answer.

### Changed

- `createMaterialToJson` and `updateMaterialToJson` stop sending **`category`, `status` and
  `trend`**. Nothing in the backend names any of the three at any layer: not on `Material`, not on
  `MaterialCreationDto` or `MaterialUpdateDto`, not on `MaterialDto`. There is also no input on the
  material form that could set one, so the request never carried a value; the keys were read off no
  field and dropped, and the response could not have carried them back.

  Growing three columns instead would have meant building a feature nobody had asked for, to serve
  a form with no way to fill it in. The read side is a separate matter and is untouched here: the
  materials dashboard renders a category column that is always a dash, a category filter whose
  option list is always empty, and a sparkline drawn from an empty array. That is dead UI in
  echno-web, not a request-contract finding.

- `createTaskToJson` and `updateTaskToJson` stop sending **`priority`**. Same argument, one step
  further along: no column, no DTO field, and no control anywhere in the client. `TaskService`
  names it above its `default` branch as a key this package sends that the endpoint has no field
  for.

  **Issue `priority` is deliberately still sent**, and the contrast is the reason both are pinned
  in one test file. The two read identically on the findings list and collapse in opposite
  directions: the issue form has a real priority control that defaults to `medium`, colour-codes
  the value and branches on `critical`, so dropping the request field would freeze a half-built
  feature as permanently decorative. That one waits on the backend growing the column.

All five properties stay on their request interfaces, deprecated, so no caller breaks on the
upgrade. They come out in a later major once nothing passes one.

### Fixed

- The `v3.3.0` and `v3.4.0` entries below were in the wrong order, `v3.3.0` having been written on
  top of a `v3.4.0` that landed first. Newest-first again.

## [v3.4.0] - 2026-08-31

Error notifications stop misreading the backend's error body. Three things were wrong at once, and
they compounded: a 403 was titled as a login problem, the sentence explaining the refusal was used
as the title rather than the body, and the body showed the request URI.

A 403 was titled "Authentication Required". `isAuthError` covers 401 and 403 together, which is
right for the retry policy in `retry.ts` (neither is worth retrying) and wrong for anything that
speaks to a user: a 403 means the caller is signed in and the account lacks the permission, so
"authenticate" sends them to a login screen that will change nothing. This matters more than it
used to, because a run of refusals moved onto stored records and session-derived actors, and every
one of them answers 403 to a signed-in caller who needs a role rather than a session.

`details` was being read as the human explanation. It is not one. Every handled failure comes back
from the backend's `GlobalExceptionHandler` as an RFC 7807 problem whose legacy keys are filled in
deliberately: `message` mirrors `detail` and carries the sentence, and `details` carries the
request description, the literal string `uri=/api/v1/leave-requests/9/approve`. Because
`getErrorMessage` preferred `details`, that URI was the description under every toast; because
`getErrorTitle` fell through to `error.message` whenever `details` was set, and it was always set,
the sentence became the title. The pair was inverted on every handled failure, not only on 403.

The subscription endpoints made the same key worse. They answer 402 with `details` as an object
holding the quota breakdown, so a plan-limit refusal put an object where a string was declared.

### Changed

- `getErrorTitle` distinguishes 401 from 403, and prefers the title the server sent.

  A 401 keeps "Authentication Required". Otherwise the problem's own `title` is used when the body
  carried one, which gives "Access Denied", "Validation Failed", "Duplicate Resource" and the rest,
  each paired with the server's sentence as the description. A 403 with no body reads "Not
  Permitted". Timeouts, network failures and body-less gateway errors keep their generic titles,
  since there is nothing to read.

- `getErrorMessage` returns `message`, the sentence written for the caller, and no longer prefers
  `details`. On a refused `@PreAuthorize` that sentence names the organization role or authority
  that was missing, which is the one thing the user needs.

### Added

- `ApiError.title`, the problem class from the response body, `undefined` when the body carried
  none. `ApiErrorData.title` alongside it.

### Fixed

- A non-string `details` no longer reaches `ApiError.details`, which is declared as a string. The
  402 quota object is dropped rather than passed through.

### Migrating

Nothing to change at a call site: `getErrorTitle` and `getErrorMessage` keep their signatures, and
the caller's `defaultTitle` still applies wherever the server said nothing. What changes is the
text users see, so a test that pinned the old strings needs updating. A 403 that asserted
"Authentication Required" should assert the server's title, and anything that asserted a
`uri=...` description was asserting the bug.

`isAuthError` is unchanged and still covers both statuses. It is the right test for "do not retry"
and the wrong one for "what do we tell the user", and its doc comment now says so.

## [v3.3.0] - 2026-08-31

A storage location can be deactivated again, and two form fields that wrote to nothing now reach
real columns. Additive: no export renamed or removed, nothing made required.

Seven request-contract findings clear, and only one of them needed a change here. Project
`description` and material `ltc` were already being sent correctly; they were findings because the
backend had no such column, and echno-backend#627 added both. The storage-location flag is the one
that needed the client to move.

### Changed

- `createStorageLocationToJson` and `updateStorageLocationToJson` now put the active flag on the
  wire as **`isActive`** rather than `active`.

  **No storage location could be deactivated through the update endpoint**, and the cause was a
  Lombok naming split in the backend rather than anything here. `StorageLocationCreationDto`
  declared a primitive `boolean isActive`, which Lombok gives `isActive()`/`setActive()` accessors
  and Jackson therefore published as `active`. `StorageLocationUpdateDto` declared a wrapper
  `Boolean isActive`, whose accessors are `getIsActive()`/`setIsActive()`, published as `isActive`.
  One field, two names. This client sent `active` to both, so create worked and update bound to
  nothing, dropped the value, and answered 200.

  Both DTOs settled on `isActive` in echno-backend#627, each keeping a `@JsonAlias("active")` so a
  published core still sending the old spelling keeps working. This release is the middle step of
  that sequence; the aliases come out once no published core sends `active`.

  **The TypeScript property is still called `active`.** The response DTO continues to serialise the
  flag as `active`, so `StorageLocation.active` is the read name, and renaming only the request
  property would make callers rename a field while round-tripping one shape into the other. Only
  the wire key differs, the same way `issueType` maps to `type`.

### Fixed upstream, no client change needed

- Project `description` (4 findings) and material `ltc` (2 findings) are real columns now. Both were
  already in the payloads, so nothing here moved; they simply stop being dropped.

  `description` is a prominent labelled textarea on the project create and edit forms that wrote to
  a concept existing at no layer: type one, get a 200, reopen the project, find the box blank.
  `ltc` drove a client-side recompute of `minStock`, `reorderLevel` and `maxStock`, so the derived
  numbers persisted while the input that produced them was lost, and reopening the form recomputed
  from a blank field.

### Ordering, which matters here

The wire rename must not reach a backend that has not deployed echno-backend#627. Until it does,
the old creation DTO binds only `active`, so a payload naming `isActive` would leave its primitive
at `false` and create the location **inactive**. That deploy went out before this release.

## [v3.2.0] - 2026-08-31

Nineteen request-contract findings in one sweep, all of them the same shape: a key this package put
on the wire that the endpoint receiving it has no field for. Spring leaves
`FAIL_ON_UNKNOWN_PROPERTIES` off, so each one came back 200 with the value discarded, which is why
none of them ever arrived as a bug report. Additive: nothing was renamed or removed, and nothing
became required.

Every one of them is fixed on the client rather than on the backend, and three of them are worth
saying out loud, because the reading the tooling suggests is the wrong one.

A project's `organizationId` must **not** be honoured. `ProjectService` takes the organization from
the tenant on the request context, which comes from the caller's token. A server that read it off
the body instead would let a caller file a project into an organization they are not in, or move
one out of their own, so this is the one key where "the backend should gain the field" is actively
the wrong answer.

A storage location's `projectName` is **not** a misspelt `projectId`. The id is already sent
alongside and the association works. The name is a read-side flattening, put on the response so a
list does not need a second call, and the client was echoing it back on write.

An issue's `projectId` on create is dead on the wire but alive in the browser. The backend walks
`taskId` to the task's project; `useCreateIssue` reads `projectId` to append the new issue to the
right project's cached list. It leaves the payload and stays on the interface.

### Changed

- The multipart create and update paths on projects, tasks and issues no longer add
  `attachments: []` to the JSON half of the body when there is nothing to upload.

  Three doc comments said this told the backend that no files were uploaded, or separated "no
  upload" from "untouched". None of it was true, and the comments are corrected. Files reach these
  endpoints as their own multipart part and the controllers read them from a `@RequestParam`, so
  the JSON key is not something the backend looks at. On create there is no `attachments` property
  on `ProjectCreationDto`, `TaskCreationDto` or `IssueCreationDto` for it to bind to; on update the
  partial handler switches over the keys it was given and names `attachments` in the branch it
  deliberately drops. The two cases the key was meant to separate were always the same request.

- `createProjectToJson` and `updateProjectToJson` no longer emit `organizationId` or `employees`.
- `createIssueToJson` no longer emits `projectId`.
- `updateIndentToJson` no longer emits `items`.
- `createStorageLocationToJson` and `updateStorageLocationToJson` no longer emit `projectName`.
- `createOrganizationToJson` no longer emits `creatorId`.

### Deprecated

- `organizationId` and `memberIds` on `CreateProjectRequest` and `UpdateProjectRequest`.

  `memberIds` travelled as `employees`, which neither project DTO declares. Membership already has
  its own working pair of routes, `POST` and `DELETE /project/web/{projectId}/employees/{employeeId}`,
  reached through `projectService.addEmployee` and `projectService.removeEmployee`, which is what
  the product uses and what this package's own docs point at.

- `items` on `UpdateIndentRequest`. Its doc comment promised that the server took the array as the
  new full set of line items. That PATCH binds `IndentUpdateDto`, which has no line-item
  collection, so the promise was never kept. Line items genuinely are editable, one at a time,
  through `indentItemsService` against `/indents/web/{indentId}/items/{itemId}`.

- `projectName` on `CreateStorageLocationRequest` and `UpdateStorageLocationRequest`.

- `creatorId` on `CreateOrganizationRequest`, now optional. The server takes the owner from the
  subject claim of the caller's access token. Honouring a body value would let a caller name
  somebody else as the owner of an organization they just created.

- `projectId` on `CreateIssueRequest`, now optional. It is not part of the request body, but a
  caller that has it should keep passing it: the create mutation needs it to patch the right
  project's cached issue list.

### Migrating

Nothing has to change to keep working. Every deprecated property is still accepted and still
typechecks, and the two that were required are now optional, so a caller can stop supplying them at
its own pace. A form that only ever existed to collect one of these values can come out: a project
form's organization picker, a storage-location form's project-name field, an organization form's
creator id.

One reversed test is worth knowing about if you have a copy of it.
`session-derived-attribution.test.ts` asserted that issue create still sent `projectId`, on the
grounds that it was a field the caller was free to set. It never was one. That line now asserts the
key is absent, with a comment saying why the reversal is not a regression.

Findings on the contract record fall from 54 to 35. The 19 that go are the whole of this sweep; the
35 that stay are decisions that are not this package's alone to make, or need work on the backend
first, and they are triaged on #57.

## [v3.1.0] - 2026-08-31

The four document reference numbers stop being sent. An indent, purchase order, site transfer and
GRN are all numbered by the server, and always were: `DocumentNumberAllocator` hands out each one
atomically per organisation, document type and year, and every create service calls it
unconditionally before it saves anything. Each creation DTO's schema already said the number "is
allocated by the server ... it is not part of this payload". The allocator exists because these
numbers used to be invented in the browser from whatever page of the list happened to be loaded,
so two people on the same screen would propose the same one.

The client had not been told. All four serializers sent a key no request DTO declares, so it was
read off no field and dropped, and the record came back carrying the allocator's answer.

Two of the four are worse than inert on the web side, because they reach the wire from required,
user-editable inputs: someone could type `PO-LEGACY-0042`, be told the order was saved, and find it
filed under a different number.

### Changed

- `createIndentToJson`, `createPurchaseOrderToJson`, `createSiteTransferToJson` and
  `createGrnToJson` no longer emit `indentNumber`, `poNumber`, `transferNumber` or `grnNumber`.
  Read the allocated number off the created entity in the response.

  One asymmetry decides where a genuine correction goes: `IndentUpdateDto` does declare
  `indentNumber`, so an indent's number can be amended afterwards through `indentsService.update`.
  No update DTO on the other three does, so the allocated number stands.

### Deprecated

- `indentNumber` on `CreateIndentRequest`, `poNumber` on `CreatePurchaseOrderRequest`,
  `transferNumber` on `CreateSiteTransferRequest` and `grnNumber` on `CreateGrnRequest`.

  **All four become optional, which is the point of the release rather than a side effect.** They
  were required, so no caller could stop passing them; a consumer that wanted to take the input off
  its form could not, because the type still demanded a string. Widening them is what unblocks that
  work. Deleting them outright would have been the tidier diff and the wrong order: it breaks the
  build of every caller on a published core before anyone has had the chance to remove the input
  that feeds them.

  They are removed in a later major once no caller passes one.

### For `echno-web`

Now unblocked, and owed: the purchase-order and indent number inputs come off the forms, the
site-transfer and GRN screens stop displaying a predicted number derived from the loaded list
(which is wrong under concurrency and is not what gets saved), `lib/utils/document-number-utils.ts`
goes, and so does the test that locks in the discarded `poNumber`. Tracked on echno-core#57.

## [v3.0.0] - 2026-08-31

**Breaking.** Four request payloads no longer carry the id of whoever is acting. The backend reads
all four from the signed-in session instead (echno-backend #598 / PR #607) and its OpenAPI document
no longer declares them, so anything still sending one is stating an authorship the server ignores.

Nothing is broken by the old behaviour: every value a client sent was the signed-in employee's own
id anyway, and Spring discards properties it does not recognise. What the fields made possible is
the reason they are gone. A payload with a field for "who did this" is a payload someone can put a
colleague's id into, and only the server can tell the difference. The server closed that door; the
client stops rattling it.

### Removed

- `creatorId` from `CreateIssueRequest` and the `createdById` key from `createIssueToJson`.
- `authorId` from `CreateIssueCommentRequest` and from `createIssueCommentToJson`.
- `creatorId` from `CreateTaskRequest` and `UpdateTaskRequest`, and from both task serializers.
  The update side is the sharper of the two: a task edit form has no creator field, so the value
  a caller put there was the editing session's own id, and every edit asked to record the editor
  as the task's creator. `TaskUpdateFieldsDto` has no such property and dropped it, so nothing was
  corrupted, but the request was stating an intent nobody meant.
- `approverId` from `LeaveApprovalAction` and from `approvalActionToJson`. An action with neither
  comments nor a delegate now serializes to an empty body, which is the right shape.

### Changed

- `useApproveLeaveRequest`, `useRejectLeaveRequest` and `useDelegateApproval` take the acting
  approver as its own mutation variable: `{ requestId, approverId, dto }`. It is not sent. The
  pending-approvals cache is keyed by approver, so the id is still needed to patch the right list
  when a decision lands, and reading it off the payload was the only reason the payload had it.

### Migrating

Drop the four fields from anything constructing these payloads, and pass `approverId` beside `dto`
rather than inside it on the three leave-decision mutations. A caller that has no employee record in
the current organization now gets a 403 from all four actions, where it could previously act by
naming a colleague, so a screen that reads every 403 as a permissions failure is worth a look.

- `etc/backend-request-fields.json` refreshed from the backend's committed OpenAPI document; the
  four fields are gone from the four schemas and nothing else moved.

## [v2.4.0] - 2026-08-31

A construction invoice's approval stamps carried only user ids, so the screens showing them had
nothing to render but the number. The backend now resolves each stamp to a name and the client
type carries it. Additive: no export was renamed or removed and no field became required.

### Added

- `submittedByName`, `approvedByName` and `paymentRecordedByName` on `ConstructionInvoice`,
  read by `parseConstructionInvoice` from the matching backend fields.

  Each name is set exactly when its id is, which keeps two different situations apart on screen:
  an invoice that was never approved has neither field, while one approved by an account that has
  since been deleted still carries the literal `User #<id>` in the name. An account with no name
  resolves to its email. A consumer can therefore render the name unconditionally wherever the id
  is present, and needs no fallback of its own.

  These stamps are **user** ids rather than employee ids, which is why the name has to come from
  the server: the employee lookup a screen would otherwise reach for is keyed by a different
  sequence, so it misses for most ids and names a different person whenever the two collide.

## [v2.3.0] - 2026-08-31

The accounts-receivable invoice module had no listing and dropped the field that links a receivable
to the construction invoice that raised it. Both gaps are closed. Additive on the public surface: no
export was renamed or removed and no field became required, so `echno-web` picks this up on its
`^2.2.0` range with a lockfile bump.

### Added

- `financeInvoiceService.list(params)` for `GET /finance/invoices/web`, with optional `customerId`,
  `status` and `openOnly` filters. It returns a `PagedInvoice` rather than unwrapping to an array,
  because a receivables table pages on `totalElements` and cannot recover it from a single page of
  rows. A filter the caller leaves unset is not sent, and `openOnly` only when it is true, since an
  absent parameter leaves that dimension unfiltered on the server.
- `PagedInvoice`, `InvoiceListParams` and `INVOICE_PAGE_SIZE` (20, matching the other finance
  listings rather than the server's default of 10).
- `financeKeys.invoicesList(params)` and the `useFinanceInvoices(params)` hook.
- `ConstructionInvoice.arInvoiceId`: the receivable a sales or service construction invoice
  materializes when it is approved. The backend has always sent it and this package parsed it away,
  so nothing downstream could join the two documents. It is what lets a receivables screen identify
  the rows `InvoiceService.cancel` refuses by name, rather than offering the action and letting the
  backend refuse.

### Fixed

- The module doc claiming "the spec exposes no invoice **list** endpoint ... A list endpoint is a
  pending backend request". It landed in tornotron/echno-backend#582 and the comment went on saying
  otherwise, which is why `echno-web` grew a screen-local client for the one call.

## [v2.2.0] - 2026-08-30

Both purchase-order update calls pointed at routes the backend does not serve, so editing a
purchase order's header, its remarks, or any line item had been a 404 since those routes were
written. Additive on the public surface: no export was renamed or removed and no field became
required, so `echno-web` picks this up without a code change.

### Fixed

- `purchaseOrdersService.update` posts to `PATCH /purchase-orders/web`, not
  `/purchase-orders/web/{id}`. The id-carrying route serves `GET` and nothing else; the PATCH is on
  the collection with the id in the body, which the payload has always carried and a comment above
  the call has always said. Somebody appended it to the URL as well and nothing caught it.
- `purchaseOrderItemsService.update` posts to `PATCH /purchase-order-items/web`, not
  `/purchase-order-items/{id}`. The id-less family has no PATCH at all. Correcting the path alone
  would have turned the 404 into a 400, because `PurchaseOrderItemUpdateDto` requires `id` and the
  serializer never sent it, so the two move together.

### Added

- `UpdatePurchaseOrderItemRequest.id`, optional on the type and filled in by
  `purchaseOrderItemsService.update` from its own argument, so no call site passes the id twice.
- `UpdatePurchaseOrderRequest.projectId` and `UpdatePurchaseOrderItemRequest.materialId` now reach
  a backend that applies them (tornotron/echno-backend#591). Both were already being sent by
  `echno-web`'s project select and material select, and both were dropped for want of a field on
  the update DTO. A line's material can only change while nothing has been received against it.

### Deprecated

- `UpdatePurchaseOrderRequest.totalAmount`, `UpdatePurchaseOrderItemRequest.totalPrice` and
  `UpdatePurchaseOrderItemRequest.purchaseOrderId` are no longer sent. The two totals are derived
  server-side and recomputed on every line change, so a value sent for either would be overwritten
  in the same request; a line cannot be moved between orders at all. They stay on the types for
  this major version so no caller breaks.

## [v2.1.0] - 2026-08-29

The inspection contract, which the backend had shipped and core did not carry. Purely additive:
no export was renamed or removed, so `echno-web` picks this up without a code change.

### Added

- Photo annotations for the `/inspections/web/{id}/annotations` endpoints: the
  `DefectAnnotationShape` enum (rectangle / ellipse / arrow), the `DefectPhotoAnnotation` type with
  `parseDefectPhotoAnnotation`, the `DefectPhotoAnnotationRequest` / `ReplaceAnnotationsRequest`
  payloads with `replaceAnnotationsToJson`, and `inspectionService.getAnnotations` /
  `replaceAnnotations`. A mark is keyed by the **photograph reference**, not by a defect id and not
  by a position in the defect list, because an inspection's defects are cleared and rebuilt on every
  save; `annotationsByPhoto` is the grouping the contract supports. The four coordinates are
  fractions of the image in `[0, 1]`, never pixels, and `isAnnotationWithinImage` catches the pixel
  mistake before the backend answers 400. `MAX_DEFECT_ANNOTATIONS` mirrors the server cap of 400.
- The non-conformance report, previously typed inside `echno-web`: the `Ncr` type (now including
  `verifiedById`, which the web copy was missing) with `parseNcr`, the `NcrType` and `NcrStatus`
  enums and their labels, the `CreateNcrRequest` / `AssignNcrRequest` / `NcrRemarksRequest` payloads
  with serializers, the `availableNcrActions` transition table mirroring the backend's, and
  `isNcrOverdue` / `ncrDaysOverdue`, which read the target date as a `LocalDate` rather than through
  `new Date`. `ncrService` covers the listing (with the `open=true` punch-list filter), the single
  fetch, create, and all six lifecycle transitions, one method each, because the backend has no
  settable status.
- Checklist templates, likewise previously web-side: `ChecklistTemplate`, `ChecklistTemplateItem`
  and `StarterChecklistTemplate` with their parsers, the `ChecklistTemplateRequest` payload with
  `checklistTemplateToJson`, and `checklistTemplateService` (`getAll`, `getById`, `create`,
  `update`, `getStarters`, `adoptStarter`). The check points are sorted by `lineOrder` on parse: the
  order is what the checklist means and the backend stores it as a column.
- `InspectionCategory` and `InspectionTrade` (16 trades) with labels, `inspectionTradeOrder`, their
  parsers, and `defaultInspectionCategoryFor`, which mirrors the backend's type-to-category fallback
  so a payload from before the column existed still buckets correctly.
- `category` and `trade` on `Inspection`, on `CreateInspectionRequest` / `UpdateInspectionRequest`
  and their serializers, and as filters on `InspectionListParams`, which `inspectionService.getAll`
  now forwards. The QA/QC views could previously filter on nothing but `InspectionType`.
- `acceptanceCriterion`, `tolerance`, `deviation` and `bimElementGuid` on `InspectionCheckItem`.
  `deviation` is computed server-side from the measurement and the expected value, so it is read but
  never sent; the other three are on the request as well.
- `DefectSeverity` and `DefectStatus` enums with labels and parsers. `InspectionDefect.severity` and
  `.status` stay typed as free strings for now: narrowing them would break every consumer comparing
  against a string literal, so it waits for a major release.
- A wire-value guard test that pins every inspection enum against the Java enum it mirrors and
  refuses any value that is not hyphenated lowercase. The failure it exists for is an enum written
  with the Java constant name (`QA_QC` for `qa-qc`), which typechecks and then 400s on every
  request.

## [v1.14.0] - 2026-08-27

### Added

- Material movement-history layer for the backend's
  `GET /inventory-transactions/web/material/{materialId}/history` endpoint: the
  `MaterialMovementHistoryEntry` type with the `StockDirection` enum (INCREASE / DECREASE / EITHER,
  mirroring the backend `StockEffect`), `parseMaterialMovementHistoryEntry` (coerces the stock
  figures, defaults a missing direction to `EITHER`, leaves an uncredited movement's
  `createdByName` undefined), and the `PagedMaterialMovementHistory` envelope. Each entry carries
  the location, project, movement type and direction, the running balance either side of the
  movement, the source reference and the name of whoever booked it.
- `inventoryTransactionsService.getMaterialMovementHistory(materialId, pageNo, pageSize)` and the
  `useMaterialMovementHistory` query hook, with the `materialHistory` key under
  `inventoryTransactionKeys`. The endpoint returns the movements ordered oldest first, so consumers
  no longer sort a material's timeline client-side.

## [v1.13.0] - 2026-08-25

### Added

- Receipt domain layer for the `/receipts/web` backend endpoints: the `Receipt` type with the
  `ReceiptType` (payment / advance / deposit / refund / other) and `ReceiptStatus` (draft / issued /
  cancelled) enums, `parseReceipt` (coerces the money amount and tax figures and the `receiptDate` /
  `createdAt` / `updatedAt` timestamps, narrows the enums with a sensible default), the
  `CreateReceiptRequest` / `UpdateReceiptRequest` payloads and their serializers, and the
  `PagedReceipt` envelope.
- `financeReceiptService` (`getAll`, `getPage`, `getById`, `create`, `update`, `remove`), the
  `useReceipts` / `useReceiptsPage` / `useReceipt` query hooks and the `useCreateReceipt` /
  `useUpdateReceipt` / `useDeleteReceipt` mutation hooks, with the `receipts` / `receiptsList` /
  `receiptsPage` / `receipt` query keys under `financeKeys`.

## [v1.12.0] - 2026-08-25

### Added

- Expense domain layer for the `/expenses/web` backend endpoints: the `Expense` type with the
  `ExpenseType` / `ExpenseCategory` / `ExpenseStatus` enums, `parseExpense` (coerces the money
  amount and the `expenseDate` / `createdAt` / `updatedAt` timestamps, narrows the enums with a
  sensible default), the `CreateExpenseRequest` / `UpdateExpenseRequest` payloads and their
  serializers, and the `PagedExpense` envelope.
- `financeExpenseService` (`getAll`, `getPage`, `getById`, `create`, `update`, `remove`), the
  `useExpenses` / `useExpensesPage` / `useExpense` query hooks and the `useCreateExpense` /
  `useUpdateExpense` / `useDeleteExpense` mutation hooks, with the `expenses` / `expensesList` /
  `expensesPage` / `expense` query keys under `financeKeys`.

## [v1.2.1] - 2026-08-17

### Added

- `EmployeeLookup.status` (and the backend `EmployeeLookupDto` field behind it), so pickers can
  filter to active employees and member-facing counts do not need the full, management-only read.

## [v1.2.0] - 2026-08-17

### Added

- `employeeService.getLookup` and the `useEmployeeLookup` hook, returning the minimal
  `EmployeeLookup` projection (id, employee id, name, designation) for pickers. It reads a
  member-accessible endpoint, so it can replace `useEmployees` (the full, now management-only
  read) anywhere only an id-and-name list is needed.

## [v1.1.0] - 2026-08-15

### Added

- Server-paginated read layer for the issue and employee tables, alongside the existing
  full-list methods (which back dropdowns, badges, and name resolution): `issueService.getPage` /
  `employeeService.getPage` returning `PagedIssue` / `PagedEmployee`, and the `useIssuesPage` /
  `useEmployeesPage` hooks (with `keepPreviousData`).
- Server-side filters on those hooks: `projectId` / `search` / `status` / `type` for issues,
  `search` / `status` / `department` for employees.
- `issueService.getStats` / `useIssueStats` and the `IssueStats` type for the issues dashboard
  cards, so the per-status counts stay accurate under server pagination.

### Changed

- Issue and employee create/update/delete mutations now invalidate the paginated and stats
  caches (`issueKeys.pages()` / `issueKeys.statsAll()` / `employeeKeys.pages()`), which are
  refetch-driven rather than optimistically patched.

## [v1.0.0] - 2026-08-14

First stable release. The public API is now the set of entry points in the `exports` map,
covered by semantic versioning and guarded by a snapshot check in CI.

### Added

- API stability policy in `docs/API-STABILITY.md` defining the public surface, the meaning of
  each version bump, and the deprecation lifecycle.
- Generated public-API snapshot `etc/public-api.md` and `scripts/api-snapshot.ts`, with
  `api:snapshot` (regenerate) and `api:check` (verify) scripts. CI runs `api:check` on every
  pull request so any change to the exported surface must be reviewed and committed.
- Root barrel exports for the `movement`, `indent-items`, and `purchase-order-items` modules
  and for the `material-consumption` types, so the root barrel matches the modules already
  reachable through the subpath exports.

### Changed

- Adopted semantic versioning. Package version bumped to `1.0.0`.

## [v0.29.0] - 2026-08-13

### Added

- Inspection domain types and parsers for work inspections, check items, and defects.
- Inspection service methods for inspection CRUD and check-item/defect operations.
- Public package exports for the inspection types and service.

### Changed

- Package version bumped to `0.29.0`.

## [v0.28.0] - 2026-08-12

### Added

- Construction-finance domain types and parsers for construction invoices and payments,
  including line items and the construction invoice/payment status enums.
- Construction invoice and payment services and their TanStack Query hooks and query-key
  factories.
- Public package exports for the construction-finance types, services, and hooks.

### Changed

- Package version bumped to `0.28.0`.

## [v0.27.1] - 2026-08-03

### Added

- Journal-entry domain types, parsers, and request serializers for manual postings and reversals.
- Finance journal service methods for listing, fetching, posting, and reversing journal entries.
- TanStack Query hooks and query-key factories for journal-entry queries and mutations.
- Public package exports for the finance journal APIs.

### Changed

- Journal-entry mutations now seed detail caches and invalidate journal-entry and report caches when ledger balances change.
- Package version bumped to `0.27.1`.

## [v0.27.0] - 2026-07-28

### Added

- Finance domain types for chart-of-accounts, account trees, company bank accounts, customers, invoices, payments, and financial reports.
- Finance services for account, bank-account, customer, invoice, payment, and report operations.
- TanStack Query hooks and query-key factories for finance queries and mutations.
- Public package exports for the finance types, services, and hooks.

### Changed

- API requests can now include additional request headers.
- Added `parseUuid` for validating and normalizing UUID values.
- Package version bumped to `0.27.0`.

## [v0.26.1] - 2026-07-15

### Changed

- Removed the unused `use-attendance-settings-page` hook and the corresponding attendance-settings barrel export.
- Package version bumped to `0.26.1`.

## [v0.26.0] - 2026-07-15

### Added

- Leave-management domain types for policies, balances, requests, approvals, calendar views, notifications, and related helper enums/parsers.
- Leave service methods for policy, balance, request, approval, calendar, and notification workflows.
- TanStack Query hooks for leave policy, balance, request, approval, calendar, and notification queries.
- Leave mutation hooks for policy CRUD, balance adjustments, request workflows, approval actions, and notification updates.
- Derived approver-dashboard hook for urgent and non-urgent pending approvals.
- Public module exports for the leave-management APIs.

### Changed

- Leave query and mutation caches now use dedicated key namespaces for policies, balances, requests, approvals, calendar views, and notifications.
- Leave mutations patch cached policy and request lists directly where possible and update approver pending counts without a refetch.
- Package version bumped to `0.26.0`.

## [v0.25.0] - 2026-07-15

### Added

- Attendance domain types for check-ins, clock events, summaries, reports, profiles, status, movements, regularizations, and work-duration calculations.
- Attendance service methods for core attendance reads and writes, including check-in, clock events, approvals, absences, deletes, and summary retrieval.
- Attendance-settings service methods for attendance profiles and resolved organization/project settings.
- Attendance-regularization service methods for request processing and queue access.
- Movement service methods for movement logging, retrieval, and verification.
- TanStack Query hooks for attendance, attendance settings, attendance regularization, and movement queries plus mutation workflows.
- Attendance settings page orchestration helpers for managing profile and shift dialogs.
- Public module exports for the attendance-related APIs.

### Changed

- Attendance mutations now patch detail and list caches in place where possible, while invalidating dependent summary caches that are recomputed server-side.
- Movement mutations now patch the parent attendance's embedded movement list directly instead of forcing a parent refetch.
- Regularization mutations preserve enriched cached context fields while syncing the parent attendance's embedded regularization state.
- Package version bumped to `0.25.0`.

## [v0.24.1] - 2026-07-15

### Added

- Invitation service methods for organization-scoped invite generation, validation, and listing.
- TanStack Query hooks for fetching invitations by organization and validating invite codes.
- Invitation create/request serializers for organization invite payloads.
- Rich invitation domain types, status helpers, and share-message builders for employee invite codes.
- Public module exports for the invitation APIs.

### Changed

- Invitation validation now normalizes backend responses into a typed invitation shape and treats invalid or expired codes as non-fatal validation results.
- Invitation mutations now invalidate the affected user, employee, and invitation caches after a successful validation.
- Invite-code generation now serializes optional employee details, status defaults, and date fields consistently for the backend.
- Package version bumped to `0.24.1`.

## [v0.24.0] - 2026-06-20

### Added

- Role-management service methods for assigning and unassigning organization roles via the Keycloak group endpoints.
- TanStack Query hooks for derived role-management reads and role assignment mutations.
- Public module exports for the role-management APIs.

### Changed

- Role assignments now patch the employee detail and list caches directly from request parameters instead of refetching.
- `useRoleManagement` now derives current and available roles from the shared employees cache without its own query namespace.
- Package version bumped to `0.24.0`.

## [v0.23.0] - 2026-06-20

### Added

- Shift timing domain types, create/update payloads, service methods, and query hooks for scheduling and attendance rules.
- Public module exports for the shift-timing APIs.

### Changed

- Shift timing serialization now normalizes `HH:MM` inputs to backend `LocalTime` strings and preserves server defaults for omitted thresholds.
- Package version bumped to `0.23.0`.

## [v0.22.0] - 2026-06-11

### Added

- WBS-element domain types for hierarchical work-breakdown structures, including create/update/move payloads and tree/leaf nodes.
- WBS-element service methods for project-scoped writes and reads: single/bulk create, hierarchical tree reads, flat list reads, leaf filtering, move (reparenting), and recalculation.
- TanStack Query hooks for WBS-element reads and mutation workflows, with integrated cross-namespace cache invalidation.
- Public module exports for the WBS-element APIs.

### Changed

- WBS-element mutations now automatically invalidate derived tree and leaf views while patching flat list and detail caches from full DTO responses.
- Package version bumped to `0.22.0`.

## [v0.21.0] - 2026-06-11

### Added

- Site-transfer domain types for transfers, line items, and create payloads.
- Site-transfer service methods for list/detail reads, paginated access, status filtering, and sending/receiving project filtering.
- TanStack Query hooks for site-transfer reads and mutation workflows (create, status transition).
- Public module exports for the site-transfers APIs.

### Changed

- Site-transfer mutations now invalidate material-stock and inventory-transaction caches to propagate stock movements and ledger writes.
- Package version bumped to `0.21.0`.

## [v0.20.0] - 2026-06-11

### Added

- GRN domain types for goods-received notes, line items, and create/update payloads.
- GRN service methods for list/detail reads, paginated access, vendor/date-range filtering, and CRUD operations.
- TanStack Query hooks for GRN reads and mutation workflows.
- Public module exports for the GRN APIs.

### Changed

- GRN create mutations now invalidate material-stock, purchase-order, and inventory-transaction caches to propagate stock increments and PO advancement.
- Package version bumped to `0.20.0`.

## [v0.19.0] - 2026-06-11

### Added

- Inventory-transaction domain types for ledger entries, transaction types, and stock-status summaries.
- Inventory-transaction service methods for read-only ledger access: list, detail, paginated, and filtered reads (by material, type, date-range, and storage-location).
- Material and Storage-Location stock methods to retrieve current inventory levels.
- TanStack Query hooks for inventory-transaction list/detail queries and stock-level tracking.
- Public module exports for the inventory-transactions APIs.

### Changed

- Renamed `MaterialStock` to `MaterialWithStock` in the materials module to avoid collision with inventory-transaction stock models and improve clarity.
- Updated materials service, hooks, and types to use the new `MaterialWithStock` interface.
- Package version bumped to `0.19.0`.

## [v0.18.0] - 2026-06-10

### Added

- Indent domain types for requisitions, statuses, and create/update payloads.
- Indent item domain types and serializers for line items on requisitions.
- Indent service methods for list/detail reads, paginated reads, create, update, and delete operations.
- Indent item service methods for direct line-item reads, create, update, delete, and conversion operations.
- TanStack Query hooks for indent and indent-item reads plus mutation workflows.
- Public module exports for the indent APIs.

### Changed

- Indent and indent-item mutations now patch parent-indent item arrays directly and invalidate dependent purchase-order caches where needed.
- Package version bumped to `0.18.0`.

## [v0.17.1] - 2026-06-10

### Added

- Per-domain `keys.ts` barrels for every hook module so query-key factories share a consistent import path.

### Changed

- Replaced the remaining `*-keys.ts` hook key files with `keys.ts` and updated imports across all hook modules.
- Removed the deprecated hook, service, and type root barrels to keep imports domain-local.
- Package version bumped to `0.17.1`.

## [v0.17.0] - 2026-06-10

### Added

- Local `keys.ts` barrel files for each hook module so query-key factories can be imported from a consistent module path.

### Changed

- Removed the top-level `hooks/index.ts`, `hooks/keys.ts`, `services/index.ts`, and `types/index.ts` barrels in favour of per-domain imports.
- Package version bumped to `0.17.0`.

## [v0.16.0] - 2026-06-10

### Added

- Purchase order domain types for purchase orders, line items, statuses, and create/update payloads.
- Purchase order service methods for list/detail reads, vendor/indent/status filters, CRUD operations, and status transitions.
- Purchase order item service methods for line-item reads and create/update/delete operations.
- TanStack Query hooks for purchase order and line-item query variants plus mutation workflows.
- Public module exports for the purchase order APIs.

### Changed

- Purchase order parsing now normalizes legacy `createdBy` shapes and embedded line items into a canonical domain object.
- Purchase order and line-item mutation hooks now keep embedded `items` arrays and vendor summary caches consistent across writes.
- Package version bumped to `0.16.0`.

## [v0.15.0] - 2026-06-10

### Added

- Barrel files for top-level type, service, hook, and query-key exports.
- Package entrypoint exports for the new barrel files.

### Changed

- Package exports now centralize module access through `types/index.ts`, `services/index.ts`, `hooks/index.ts`, and `hooks/keys.ts`.
- Package version bumped to `0.15.0`.

## [v0.14.0] - 2026-06-10

### Added

- Material-consumption domain types for consumption events, consumption types, and create payloads.
- Material-consumption service methods for list/detail reads, filtered queries, paginated reads, and create operations.
- TanStack Query hooks for material-consumption reads and create mutations.
- Public module exports for the material-consumption APIs.

### Changed

- Material-consumption parsing now normalizes append-only ledger responses into canonical domain objects with denormalized display fields.
- Material-consumption create mutations invalidate the full consumption namespace and the affected material stock cache so downstream views refetch correctly.
- Package version bumped to `0.14.0`.

## [v0.13.0] - 2026-06-10

### Added

- Materials domain types for inventory records, stock-aware reads, consumption events, enums, and create/update payloads.
- Materials service methods for list/detail reads, paginated reads, search, stock reads, CRUD operations, and material consumption handling.
- TanStack Query hooks for material list/detail/query variants and create/update/delete mutations.
- Public module exports for the materials APIs.

### Changed

- Materials parsing now normalizes stock-aware and consumption payloads into canonical domain objects with denormalized display fields.
- Materials mutation hooks now keep list, detail, and stock caches consistent across create, update, and delete flows.
- Package version bumped to `0.13.0`.

## [v0.12.1] - 2026-06-10

### Added

- Detailed vendor documentation for types, services, hooks, query keys, and request serializers.
- Public re-exports for the full vendor hook surface.

### Changed

- Vendor service, hook, and type comments were expanded to document nested sub-resource normalization, summary caching, and payment-terms handling.
- Package version bumped to `0.12.1`.

## [v0.12.0] - 2026-06-10

### Added

- Vendor domain types for vendor profiles, summaries, contacts, tax identifiers, bank accounts, payment terms, and create/update payloads.
- Vendor service methods for CRUD operations plus contact, tax identifier, bank account, payment term, search, paginated, and summary endpoints.
- TanStack Query hooks for vendor list/detail queries and vendor-related mutation workflows.
- Public module exports for the vendor APIs.

### Changed

- Vendor parsing now normalizes nested contact, tax identifier, bank account, and payment term shapes into a single canonical vendor model.
- Package version bumped to `0.12.0`.

## [v0.11.1] - 2026-06-10

### Added

- Detailed labour documentation for types, services, hooks, and query keys.
- Public re-exports for the full labour hook surface.

### Changed

- Labour service, hook, and type comments were expanded to document backend DTO differences, cache behavior, and optimistic delete rollback.
- Package version bumped to `0.11.1`.

## [v0.11.0] - 2026-06-10

### Added

- Labour domain types for labour records, create/update payloads, and employment-related enums.
- Labour service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for labour list/detail queries and create/update/delete mutations.
- Public module exports for the labour APIs.

### Changed

- Labour create/update flows now document the mixed DTO response shapes and the cache invalidation strategy used after writes.
- Labour delete mutations now preserve and restore cached list/detail state on error.
- Package version bumped to `0.11.0`.

## [v0.10.2] - 2026-06-09

### Added

- Relative `baseURL` support in the API client for browser-based apps.
- Centralized URL resolution logic for JSON, multipart, and form-data requests.

### Changed

- API client request builders now resolve relative `baseURL` values against `globalThis.location.origin` at request time.
- API client documentation now distinguishes browser-only relative URLs from absolute base URLs.
- Package version bumped to `0.10.2`.

## [v0.10.1] - 2026-06-09

### Added

- Detailed storage-location documentation for types, services, hooks, cache keys, and payload serializers.
- Public re-exports for the full storage-location hook surface.

### Changed

- Storage location comments were expanded to document flat DTO handling, list-cache coverage, and backend response shapes.
- Package version bumped to `0.10.1`.

## [v0.10.0] - 2026-06-09

### Added

- Storage location domain types for location metadata, create/update payloads, and location type labels.
- Storage location service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for storage location list/detail queries and create/update/delete mutations.
- Public module exports for the storage location APIs.

### Changed

- Storage location mutations now seed and update cache entries directly from full DTO responses, including every list cache under the namespace.
- Package version bumped to `0.10.0`.

## [v0.9.1] - 2026-06-09

### Added

- Detailed invitation documentation for types, services, hooks, and query keys.
- Public re-exports for the full invitation hook surface.

### Changed

- Invitation service and hook comments were expanded to clearly describe the current backend path mismatches and the required integration follow-up.
- Package version bumped to `0.9.1`.

## [v0.9.0] - 2026-06-09

### Added

- Invitation domain types for invite-code records, drafts, validation requests, and generate-code payloads.
- Invitation service methods for generating, listing, reading, and deleting invite codes.
- TanStack Query hooks for invitation reads and invite-code mutations.
- Public module exports for the invitation APIs.

### Changed

- Invitation query keys, service paths, and hook comments now document the current backend alignment caveats for the invitation flow.
- Package version bumped to `0.9.0`.

## [v0.8.1] - 2026-06-09

### Added

- Detailed organization documentation for types, services, query hooks, and cache keys.
- Public re-exports for the full organization hook surface.

### Changed

- Organization service, hook, and type comments were expanded to describe API shapes, multipart logo handling, and cache behavior.
- Package version bumped to `0.8.1`.

## [v0.8.0] - 2026-06-09

### Added

- Organization domain types for organization profiles, create/update payloads, and optional logo file uploads.
- Organization service methods for list/detail reads, create, update, and delete operations.
- TanStack Query hooks for organization list/detail queries and create/update/delete mutations.
- Public module exports for the organization APIs.

### Changed

- Organization parsing now preserves nested employees, projects, attachments, and derived logo data from backend responses.
- Organization mutations now preserve nested cache data where possible and invalidate related user and employee caches after writes.
- Package version bumped to `0.8.0`.

## [v0.7.1] - 2026-06-07

### Added

- Detailed issue documentation for types, services, hooks, and cache keys.
- Public re-exports for the full issue hook surface.

### Changed

- Issue service and hook comments were expanded to describe API shapes, cache behavior, and author resolution.
- Package version bumped to `0.7.1`.

## [v0.7.0] - 2026-06-07

### Added

- Issue domain types for issue metadata, status, type, comments, and file uploads.
- Issue comment domain types and serializers for issue discussion.
- Issue service functions for list/detail reads, project/task filtering, CRUD operations, and comment handling.
- TanStack Query hooks for issue reads, mutations, comments, comment mutations, and detail prefetching.
- Public module exports for the issue APIs.

### Changed

- Package version bumped to `0.7.0`.

## [v0.6.1] - 2026-06-07

### Added

- Detailed work-category documentation for types, services, hooks, and cache keys.
- Public re-exports for the full work-category hook surface.

### Changed

- Work-category service and hook comments were expanded to describe API shapes and cache behavior.
- Package version bumped to `0.6.1`.

## [v0.6.0] - 2026-06-06

### Added

- Work-category domain types for category metadata and create/update payloads.
- Work-category service functions for list/detail reads and CRUD operations.
- TanStack Query hooks for work-category reads, mutations, and cache keys.
- Public module exports for the work-category APIs.

### Changed

- Package version bumped to `0.6.0`.

## [v0.5.1] - 2026-06-06

### Added

- Expanded task module exports for the task query hooks and prefetch helper.
- Detailed documentation for task types, statuses, service methods, and hooks.

### Changed

- Task service and hook comments were normalized and expanded for the current task module surface.
- Package version bumped to `0.5.1`.

## [v0.5.0] - 2026-06-06

### Added

- Task domain types, services, and hooks for task management and project-scoped task queries.
- Task prefetch helper for warming detail caches on hover or focus.
- Public module exports for the task APIs.

### Changed

- Package version bumped to `0.5.0`.

## [v0.4.1] - 2026-06-06

### Added

- Hook exports for project list, detail, organization, employee, and project-member queries.
- Project prefetch helper for warming detail caches on hover or focus.

### Changed

- Project service and type handling now preserve richer nested project data across partial responses.
- Project and employee model definitions were expanded to support member, issue, task, and work-category relationships.
- Package version bumped to `0.4.1`.

## [v0.4.0] - 2026-06-06

### Added

- Project domain types for project metadata, statuses, file uploads, and create/update payloads.
- Issue, task, and work-category domain types used by the new project graph model.
- Project service functions for list/detail reads, organization filtering, employee membership, CRUD, and file-aware writes.
- TanStack Query hooks for project list/detail queries, prefetching, and mutation workflows.
- Public module exports for the new project APIs.

### Changed

- Package version bumped to `0.4.0`.

## [v0.3.3] - 2026-06-06

### Added

- `useEmployeeRoles()` for deriving the current employee's organisation-scope roles from the cached employee profile.
- Public export for the employee roles hook.

### Changed

- Package version bumped to `0.3.3`.
- Package license changed from `UNLICENSED` to `MIT`.

## [v0.3.2] - 2026-06-06

### Added

- GitHub Actions workflow for publishing releases to GitHub Packages.
- Package metadata for repository, homepage, issues, author, license, and published files.

### Changed

- Package version bumped to `0.3.2`.
- Publish flow now uses `prepublishOnly` to build before packaging.
- Publish configuration was added for the GitHub Packages registry.

## [v0.3.1] - 2026-06-06

### Added

- `userService.getUserEmployees()` for fetching the current user's employee memberships.
- `useUserEmployees()` for querying the current user's memberships across organizations.

### Changed

- User service parsing now handles employee membership responses with dedicated validation and error handling.
- Documentation and inline comments were refreshed across the user and attachment mutation hooks.
- Package version bumped to `0.3.1`.

## [v0.3.0] - 2026-06-06

### Added

- Employee domain types for profiles, statuses, departments, org roles, and create/update payloads.
- Employee service functions for reading, updating, deleting, and linking employees to organizations.
- TanStack Query hooks for employee queries, mutations, and manager-name lookup helpers.
- Organization query key factories for employee-related cache coordination.
- Public module exports for the employee APIs.

### Changed

- Package version bumped to `0.3.0`.
- Added `@types/react` to devDependencies to support the new hook typings.

## [v0.2.0] - 2026-06-05

### Added

- User domain types for profiles, roles, update payloads, and file-upload metadata.
- User service functions for reading and updating the current user profile.
- TanStack Query hooks for user queries and mutations.
- Public module exports for the new user APIs.

### Changed

- The TypeScript target was updated to `ES2023`.
- User-related attachment, service, and hook imports were normalized to relative paths.

## [v0.1.1] - 2026-06-05

### Fixed

- Updated attachment-related import paths to use relative imports.
- Removed the now-unneeded path alias entry from `tsconfig.json`.

## [v0.1.0] - 2026-06-05

### Added

- Initial changelog documenting the first published versions of `@tornotron/echno-core`.

## [v0.0.1] - 2026-06-05

### Added

- Attachment domain types and upload payload models.
- Attachment service functions for file handling operations.
- TanStack Query hooks for attachment queries and mutations.
- Public module exports for attachment types and services.
- Date parsing helpers and ID parsing utilities for payload normalization.

### Changed

- The package entrypoint now re-exports attachment-related APIs.

## [v0.0.0] - 2026-06-05

### Added

- Project setup for the shared `echno-core` package.
- TypeScript build and `prepare` workflow for publishing.
- Foundation utilities and module exports in `src/index.ts`.
- Error handling helpers with field-level validation support.
- Cache merge utilities and TanStack Query option profiles.
- API client and shared API service helpers.
- Structured logging with PII sanitization and environment-aware output.
- Client-side role-check utilities.
- Project README with overview, architecture, and usage guidance.

### Fixed

- `package.json` now includes a `prepare` script for TypeScript compilation.
