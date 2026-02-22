const DEFAULT_PREVIEW_MESSAGE = 'Preview mode — this action is disabled. Deploy your own instance to get full access.'

type PreviewReadOnlyErrorData = {
  code?: string
  message?: string
}

type PreviewReadOnlyError = {
  status?: number
  statusCode?: number
  data?: PreviewReadOnlyErrorData
}

function isPreviewReadOnlyError(error: unknown): error is PreviewReadOnlyError {
  if (!error || typeof error !== 'object') return false

  const maybeError = error as PreviewReadOnlyError
  return maybeError.data?.code === 'PREVIEW_READ_ONLY'
}

export function usePreviewReadOnly() {
  const isUpsellOpen = useState('preview-read-only-upsell-open', () => false)
  const message = useState('preview-read-only-upsell-message', () => DEFAULT_PREVIEW_MESSAGE)

  function openUpsell(nextMessage?: string) {
    message.value = nextMessage || DEFAULT_PREVIEW_MESSAGE
    isUpsellOpen.value = true
  }

  function closeUpsell() {
    isUpsellOpen.value = false
  }

  function handlePreviewReadOnlyError(error: unknown): boolean {
    if (!isPreviewReadOnlyError(error)) return false

    openUpsell(error.data?.message)
    return true
  }

  async function withPreviewReadOnly(action: () => Promise<unknown>) {
    try {
      return await action()
    } catch (error) {
      handlePreviewReadOnlyError(error)
      throw error
    }
  }

  return {
    isUpsellOpen,
    message,
    openUpsell,
    closeUpsell,
    handlePreviewReadOnlyError,
    withPreviewReadOnly,
  }
}
