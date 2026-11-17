/** Session delete dialog, confirming deletion and stopping running work if necessary. */
import { useState } from 'react'
import type { SessionActivity } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { Button, Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  SessionDeleteDialogInjected,
  SessionDeleteDialogProps,
  SessionDeleteTarget,
} from '../contract/slots.ts'
import browserCss from '../rows/WorkspaceBrowser.module.css'
import { activityLine } from './ArchiveSession.tsx'
import { activeSessionRefusal } from './active-refusal.ts'

/**
 * The `shell.overlay` entry: nothing while no delete is requested, otherwise
 * one dialog per request (keyed by the Session). Confirming calls deleteSession;
 * if the Session has running work, the dialog displays the active work and
 * offers to stop and delete it.
 * @param props - the request hook, its settlement, the delete hop, and the locale seat.
 * @returns the open dialog, or null.
 */
export function SessionDeleteDialog({
  useDeleteRequest,
  settleSessionDelete,
  deleteSession,
  t,
}: SessionDeleteDialogProps) {
  const request = useDeleteRequest(pending => pending)
  if (request === null) return null
  return (
    <DeleteConfirmForm
      key={request.sessionId}
      request={request}
      deleteSession={deleteSession}
      onSettle={settleSessionDelete}
      t={t}
    />
  )
}

/** One request's dialog: in-flight, activity, and error state die with it. */
function DeleteConfirmForm({
  request,
  deleteSession,
  onSettle,
  t,
}: {
  request: SessionDeleteTarget
  deleteSession: SessionDeleteDialogInjected['deleteSession']
  onSettle: () => void
  t: SessionDeleteDialogProps['t']
}) {
  const [deleting, setDeleting] = useState(false)
  const [activity, setActivity] = useState<readonly SessionActivity[] | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)

  const close = () => {
    if (deleting) return
    onSettle()
  }

  const confirm = () => {
    if (deleting) return
    setDeleting(true)
    setError(null)
    const stopActivity = activity !== undefined
    deleteSession(request.sessionId, stopActivity ? { stopActivity: true } : {})
      .then(() => {
        setDeleting(false)
        onSettle()
      })
      .catch((reason: unknown) => {
        setDeleting(false)
        const runningActivity = activeSessionRefusal(reason)
        if (runningActivity !== undefined) {
          setActivity(runningActivity)
          return
        }
        setError(reason instanceof Error ? reason.message : String(reason))
      })
  }

  const hasActivity = activity !== undefined && activity.length > 0

  return (
    <Modal
      open
      onClose={close}
      closeLabel={t('close')}
      title={t('delete.session.title')}
      description={t(
        hasActivity ? 'delete.session.activeDesc' : 'delete.session.desc',
        { title: request.displayTitle },
      )}
      footer={(
        <>
          <Button variant="outline" disabled={deleting} onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            variant="outline"
            className={browserCss.deleteAction}
            disabled={deleting}
            onClick={confirm}
          >
            {t(hasActivity ? 'delete.session.stopAndAction' : 'delete.session.action')}
          </Button>
        </>
      )}
    >
      {hasActivity && (
        <ul className={browserCss.archiveActivity} aria-label={t('archive.confirm.activity')}>
          {activity.map((entry, index) => (
            <li key={`${entry.kind}-${String(index)}`}>{activityLine(entry, t)}</li>
          ))}
        </ul>
      )}
      {deleting && (
        <div className={browserCss.deleteStatus} role="status">
          {t('delete.session.pending')}
        </div>
      )}
      {error !== null && (
        <div className={browserCss.renameError} role="alert">
          {error}
        </div>
      )}
    </Modal>
  )
}
