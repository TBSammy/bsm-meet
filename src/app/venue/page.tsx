import { MapPin, Phone, Clock, ExternalLink } from 'lucide-react'

export default function VenuePage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="font-display font-bold text-3xl text-dark-900 mb-6">About the Venue</h1>

      <div className="bg-gradient-to-br from-bsm-50 to-bsm-50 rounded-2xl p-8 mb-8">
        <h2 className="font-display font-bold text-2xl text-dark-900 mb-4">Musgrave Park Aquatic Centre</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-bsm-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-dark-800">100 Edmondstone Street</p>
                <p className="text-dark-600">South Brisbane, QLD 4101</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-bsm-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-dark-800">Meet Day Schedule</p>
                <p className="text-dark-600">Gates open: 1:00 PM</p>
                <p className="text-dark-600">Warm-up: 1:30 PM</p>
                <p className="text-dark-600">Competition: 2:30 PM — 5:30 PM</p>
              </div>
            </div>
          </div>
          <div>
            <p className="text-dark-600 mb-4">
              Located in the heart of South Brisbane with stunning views of the city skyline,
              Musgrave Park Aquatic Centre features a 50-metre competition pool with 9 lanes,
              a separate warm-up/cool-down pool, and shaded grandstand seating.
            </p>
            <a
              href="https://www.musgraveparkaquaticcentre.com.au/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-bsm-600 hover:text-bsm-700 font-semibold text-sm"
            >
              Visit venue website <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white border border-dark-100 rounded-xl p-6">
          <h3 className="font-display font-bold text-lg text-dark-900 mb-4">Facilities</h3>
          <ul className="space-y-2 text-sm text-dark-600">
            <li>50m competition pool (9 lanes)</li>
            <li>Separate warm-up/cool-down pool area</li>
            <li>Shaded grandstand (south-east facing)</li>
            <li>Grass bank seating (limited shade)</li>
            <li>BBQ from 1 PM ($2 sausage sizzle)</li>
            <li>BYO food and drinks permitted</li>
            <li>Free entry for spectators</li>
          </ul>
        </div>
        <div className="bg-white border border-dark-100 rounded-xl p-6">
          <h3 className="font-display font-bold text-lg text-dark-900 mb-4">Getting There</h3>
          <div className="space-y-4 text-sm text-dark-600">
            <div>
              <p className="font-semibold text-dark-800 mb-1">Public Transport</p>
              <p>South Bank Railway Station is a short walk away.</p>
            </div>
            <div>
              <p className="font-semibold text-dark-800 mb-1">Street Parking</p>
              <p>Edmondstone, Browning, Russell, Besant, Appel, Marly, Franklin Streets. Max $13.50 metered (may be inactive on weekends).</p>
            </div>
            <div>
              <p className="font-semibold text-dark-800 mb-1">Secure Parking</p>
              <p>Southpoint (40 Tribune St), 10 Browning St, SW1 (32 Cordelia St).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Embedded Map */}
      <div className="rounded-xl overflow-hidden border border-dark-100">
        <iframe
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3540.0!2d153.0156!3d-27.4795!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x6b915a01e2c4c0e7%3A0x7a0d2e8f3c5b2a1f!2sMusgrave%20Park%20Aquatic%20Centre!5e0!3m2!1sen!2sau!4v1"
          width="100%" height="400" style={{ border: 0 }} allowFullScreen loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  )
}
