import { AnnouncerLink } from './AnnouncerLink'

export function Footer() {
  return (
    <footer className="bg-dark-900 text-white/70 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 text-white font-display font-bold text-lg mb-3">
              <img src="/bsm-logo.png" alt="BSM Logo" className="h-8 rounded" />
              Brisbane Southside Masters
            </div>
            <p className="text-sm">
              Short Course Meet 2025<br />
              Masters Swimming Queensland
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Venue</h4>
            <p className="text-sm">
              Sleeman Sports Complex<br />
              Chandler, QLD
            </p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-3">Meet Director</h4>
            <p className="text-sm">
              Brisbane Southside Masters
            </p>
          </div>
        </div>
        <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <img src="/msq-logo.png" alt="Masters Swimming Queensland" className="h-20 opacity-80" />
          </div>
          <div className="flex flex-col items-center sm:items-end gap-2">
            <p className="text-xs animate-shimmer-bsm">
              Powered by Masters Swimming Queensland
            </p>
            <AnnouncerLink />
          </div>
        </div>
      </div>
    </footer>
  )
}
