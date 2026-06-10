import type { LegalDoc } from '../data/legal'

interface Props {
  doc: LegalDoc
  onClose: () => void
}

export default function LegalModal({ doc, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-iron-950">
      <div className="h-0.5 w-full bg-acid flex-shrink-0" />
      <div className="flex items-start justify-between px-5 pt-8 pb-4 flex-shrink-0">
        <div>
          <h1 className="font-display text-4xl text-white leading-none uppercase">{doc.title}</h1>
          <p className="font-mono text-iron-500 text-[10px] uppercase tracking-widest mt-2">
            Last updated · {doc.lastUpdated}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="font-mono text-iron-400 text-xs uppercase tracking-widest border border-iron-700 px-3 py-2 active:bg-iron-800"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-10">
        {doc.sections.map(section => (
          <div key={section.heading} className="mb-6">
            <p className="font-mono text-acid text-[11px] uppercase tracking-widest mb-2">
              {section.heading}
            </p>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="font-sans text-iron-300 text-sm leading-relaxed mb-2">
                {p}
              </p>
            ))}
          </div>
        ))}
      </div>

      <div className="flex-shrink-0 p-5 border-t border-iron-800">
        <button
          onClick={onClose}
          className="w-full py-4 bg-acid font-sans font-bold uppercase text-sm text-black"
          style={{ letterSpacing: '0.12em' }}
        >
          Done
        </button>
      </div>
    </div>
  )
}
