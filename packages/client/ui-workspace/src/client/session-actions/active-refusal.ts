import type { SessionActivity, WorkspaceArchiveError, WorkspaceDeleteSessionError } from '@deepseek-ai/dsh-api-workspace-controller/client'

/**
 * The activity a Host `workspace/session-active` refusal reported, or nothing
 * for any other failure. The class identity check goes by name: client plugin
 * bundles do not share error-class identity.
 * @param reason - caught error from an archive or delete operation.
 * @returns reported activity list, or undefined.
 */
export function activeSessionRefusal(reason: unknown): readonly SessionActivity[] | undefined {
  if (!(reason instanceof Error) || (reason.name !== 'WorkspaceArchiveError' && reason.name !== 'WorkspaceDeleteSessionError')) return undefined
  const { rpcError } = reason as WorkspaceArchiveError | WorkspaceDeleteSessionError
  return rpcError.code === 'workspace/session-active' ? rpcError.details.activity : undefined
}
