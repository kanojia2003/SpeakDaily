export function ExercisePreview() {
  return (
    <article className="exercise-card" aria-label="Sample speaking exercise">
      <div className="exercise-topline">
        <span className="sample-label">Sample exercise</span>
        <span className="exercise-length">About 2 minutes</span>
      </div>
      <p className="exercise-prompt">“What is something you learned recently that surprised you?”</p>
      <div className="exercise-guidance">
        <p>Take a breath, then speak in your own words. You might begin with:</p>
        <p className="starter-line">“I didn’t expect to learn that…”</p>
      </div>
      <p className="exercise-footnote">No perfect answer needed. This is a prompt to help you begin.</p>
    </article>
  )
}
