import { redirect } from 'next/navigation'

/**
 * The old standalone /admin/upload page has been merged into
 * /admin/quick-upload (which is the PWA-installable mobile-first upload
 * surface). This route only exists so any bookmarks / old links keep working.
 */
export default function LegacyUploadRedirect() {
  redirect('/admin/quick-upload')
}
