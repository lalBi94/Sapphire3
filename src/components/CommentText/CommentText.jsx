import { parseMathText, renderMath } from '../../utils/mathText.js'
import 'katex/dist/katex.min.css'
import './CommentText.css'

// Affiche le texte d'un commentaire : le texte reste littéral, seuls les fragments `$$ ... $$` sont rendus par KaTeX.
// Le HTML mathématique provient de KaTeX configuré sans commande dangereuse ; le texte utilisateur n'est jamais interprété comme HTML.
export default function CommentText({ text }) {
  const segments = parseMathText(text)
  return (
    <>
      {segments.map((segment, index) => segment.kind === 'math'
        ? <span key={index} className="comment-text__math" dangerouslySetInnerHTML={{ __html: renderMath(segment.value) }} />
        : <span key={index} className="comment-text__text">{segment.value}</span>)}
    </>
  )
}
