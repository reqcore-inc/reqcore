/**
 * Composable for document operations (upload, download, delete, preview).
 * Used on the candidate detail page Documents tab.
 *
 * All mutations use `$fetch` (user-triggered) and refresh the candidate
 * data cache so the document list updates automatically.
 */
export function useDocuments() {
  /**
   * Upload a document for a candidate.
   * Sends multipart/form-data to POST /api/candidates/:id/documents.
   *
   * @param candidateId - The candidate to attach the document to
   * @param file - The file to upload
   * @param type - Document type: 'resume' | 'cover_letter' | 'other'
   * @returns The created document record
   */
  async function uploadDocument(
    candidateId: string,
    file: File,
    type: 'resume' | 'cover_letter' | 'other' = 'resume',
  ) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('type', type)

    const result = await $fetch(`/api/candidates/${candidateId}/documents`, {
      method: 'POST',
      body: formData,
    })

    // Refresh the candidate detail cache so the document list updates
    await refreshNuxtData(`candidate-${candidateId}`)

    return result
  }

  /**
   * Download a document by opening the server-proxied download URL.
   * The server streams the file directly from S3 with auth verification —
   * no presigned URLs are ever exposed to the client.
   *
   * @param documentId - The document to download
   */
  async function downloadDocument(documentId: string) {
    window.open(`/api/documents/${documentId}/download`, '_blank')
  }

  /**
   * Get the URL for inline preview of a PDF document.
   * Returns the API endpoint URL directly — the server streams the PDF
   * bytes so the iframe loads from the same origin (no CORS issues).
   * Only works for PDFs; the server returns 415 for other types.
   *
   * @param documentId - The document to preview
   * @returns The preview endpoint URL to use as iframe src
   */
  function getPreviewUrl(documentId: string): string {
    return `/api/documents/${documentId}/preview`
  }

  /**
   * Delete a document and refresh the candidate data cache.
   *
   * @param documentId - The document to delete
   * @param candidateId - The owning candidate (used to refresh the cache)
   */
  async function deleteDocument(documentId: string, candidateId: string) {
    await $fetch(`/api/documents/${documentId}`, { method: 'DELETE' })
    await refreshNuxtData(`candidate-${candidateId}`)
  }

  return {
    uploadDocument,
    downloadDocument,
    getPreviewUrl,
    deleteDocument,
  }
}
