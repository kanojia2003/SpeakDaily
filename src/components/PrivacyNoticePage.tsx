import { Link } from 'react-router-dom'

export function PrivacyNoticePage() {
  return (
    <main className="privacy-page page-shell" id="main-content">
      <Link className="text-link privacy-back-link" to="/">← Back to SpeakDaily</Link>
      <header className="privacy-heading">
        <p className="eyebrow">SpeakDaily privacy</p>
        <h1>What happens to your voice.</h1>
        <p>This notice describes how the current SpeakDaily speaking workflow handles recordings and saved practice. It is not a promise about the practices of third-party providers.</p>
      </header>
      <article className="privacy-content">
        <section>
          <h2>Recording and upload</h2>
          <p>Your browser asks for microphone access only after you choose Start recording. A recording stays in your browser while you preview it. It is uploaded to SpeakDaily only after you choose Submit recording, to a private Supabase Storage bucket scoped to your account.</p>
        </section>
        <section>
          <h2>Gemini analysis</h2>
          <p>When analysis is requested, SpeakDaily sends the audio and its practice prompt to the Google Gemini API from a server-side function. The request does not intentionally include your email or account identifier, but the audio itself may contain identifying or sensitive speech. Avoid speaking information you do not want processed by Google.</p>
          <p>Google's handling depends on the Gemini API service and terms that apply to the project. Google's current documentation says data handling differs between paid and unpaid services; unpaid service content may be used to improve products and may be reviewed, while paid service content is not used for product improvement but may be logged for abuse monitoring. Regional terms can differ. The current terms also include age and permitted-use conditions. Review <a href="https://ai.google.dev/gemini-api/terms">Gemini API Terms</a> and <a href="https://ai.google.dev/gemini-api/docs/usage-policies">abuse monitoring</a> before using the feature. SpeakDaily has not verified this project's billing status, region, audience eligibility, or terms for public use.</p>
        </section>
        <section>
          <h2>What is saved</h2>
          <p>SpeakDaily saves your account profile, your topic filters and interests, session topic and timing, status, transcript, scores, and written feedback in Supabase so it can personalize prompts and you can return to results later. The transcript and feedback remain until you delete your account or the service operator removes them.</p>
        </section>
        <section>
          <h2>Audio retention</h2>
          <p>The app attempts to delete the private recording after evaluation succeeds or fails. When deletion succeeds, its path is cleared from the session. If cleanup fails, the recording remains private and the session records a cleanup-needed state; it may remain until deletion is retried or the account is deleted. Account deletion attempts to remove all objects under your account's storage path before removing application records and the Auth account.</p>
        </section>
        <section>
          <h2>Deleting your account and backups</h2>
          <p>You can request deletion from your account settings. The server verifies your signed-in identity, removes private recordings in your account's storage namespace, deletes your saved practice records, and then deletes your Auth account. If cleanup fails, the request stops before Auth deletion so it can be retried. Deletion does not erase copies Google may retain under its applicable terms, or historical Supabase database backups. Restoring an older backup could restore deleted database records.</p>
          <p>Supabase documents that the Free plan does not include automatic backups and recommends making your own exports. Paid plans include plan-dependent backup windows. Check the current <a href="https://supabase.com/docs/guides/platform/backups">Supabase backup documentation</a> and <a href="https://supabase.com/pricing">plan limits</a> for the project you're using.</p>
        </section>
        <section>
          <h2>Before public launch</h2>
          <p>The operator must verify Google API terms for the intended audience, applicable region, billing status, data processing terms, and abuse-monitoring retention; review Supabase's applicable plan, backups, logs, and storage limits; and decide how to handle recordings if a processing function stops before cleanup. No compliance certification or legal conclusion is claimed here.</p>
        </section>
      </article>
    </main>
  )
}
