import Link from 'next/link'
import { Calendar, Clock, MapPin, Users, Trophy, ChevronRight, Timer } from 'lucide-react'

export default function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-dark-900 via-purple-900 to-bsm-800 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 left-0 w-96 h-96 bg-bsm-400 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 md:py-28">
          <div className="text-center">
            <p className="text-bsm-300 font-semibold tracking-wider uppercase text-sm mb-4">
              Masters Swimming Queensland
            </p>
            <h1 className="font-display font-black text-4xl md:text-6xl lg:text-7xl mb-6 leading-tight">
              Brisbane Southside Masters<br />
              <span className="text-bsm-300">SC Meet 2025</span>
            </h1>
            <p className="text-xl md:text-2xl text-white/80 mb-8 max-w-2xl mx-auto font-accent italic">
              Sleeman Sports Complex, Chandler
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2.5">
                <MapPin className="h-5 w-5 text-bsm-300" />
                <span className="font-semibold">Sleeman Sports Complex</span>
              </div>
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-5 py-2.5">
                <Timer className="h-5 w-5 text-bsm-300" />
                <span className="font-semibold">Short Course (25m)</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/program"
                className="bg-bsm-400 hover:bg-bsm-300 text-white font-bold px-8 py-3.5 rounded-xl transition-colors shadow-lg shadow-bsm-400/30"
              >
                View Program
              </Link>
              <Link
                href="/results"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold px-8 py-3.5 rounded-xl border border-white/20 transition-colors"
              >
                Results
              </Link>
              <Link
                href="/portal"
                className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-bold px-8 py-3.5 rounded-xl border border-white/20 transition-colors"
              >
                Swimmer Portal
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Key Info Cards */}
      <section className="max-w-7xl mx-auto px-4 -mt-8 relative z-10 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl shadow-lg p-6 flex items-start gap-4 border border-dark-100">
            <div className="bg-bsm-50 rounded-xl p-3">
              <Calendar className="h-6 w-6 text-bsm-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-dark-900">Meet Day</h3>
              <p className="text-dark-500 text-sm">Check your program for session times</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 flex items-start gap-4 border border-dark-100">
            <div className="bg-bsm-50 rounded-xl p-3">
              <MapPin className="h-6 w-6 text-bsm-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-dark-900">Sleeman Sports Complex</h3>
              <p className="text-dark-500 text-sm">Chandler, QLD</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg p-6 flex items-start gap-4 border border-dark-100">
            <div className="bg-bsm-50 rounded-xl p-3">
              <Clock className="h-6 w-6 text-bsm-600" />
            </div>
            <div>
              <h3 className="font-display font-bold text-dark-900">Short Course</h3>
              <p className="text-dark-500 text-sm">25m pool &bull; Timed finals</p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h2 className="font-display font-bold text-3xl text-dark-900 mb-6">Welcome</h2>
        <p className="text-dark-600 text-lg leading-relaxed mb-4 font-accent italic">
          Welcome to the Brisbane Southside Masters Short Course Meet hosted at the Sleeman Sports Complex in Chandler.
        </p>
        <p className="text-dark-500 mb-8">
          View the full program, check your entries, and follow results live as they come in.
          Use the Swimmer Portal to manage your events and share your bio with our announcer.
        </p>
        <div className="flex justify-center gap-4">
          <Link href="/entries" className="text-bsm-500 hover:text-bsm-600 font-semibold text-sm inline-flex items-center gap-1">
            View Entry List <ChevronRight className="h-4 w-4" />
          </Link>
          <Link href="/program" className="text-bsm-500 hover:text-bsm-600 font-semibold text-sm inline-flex items-center gap-1">
            View Full Program <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Venue Info */}
      <section className="bg-dark-50 py-16">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="font-display font-bold text-3xl text-dark-900 mb-8 text-center">Venue Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl p-6 border border-dark-100">
              <h3 className="font-bold text-dark-800 mb-3">Sleeman Sports Complex</h3>
              <p className="text-sm text-dark-600">
                The Brisbane Aquatic Centre at Sleeman Sports Complex is a world-class aquatic facility
                located in Chandler, south-east Brisbane.
              </p>
            </div>
            <div className="bg-white rounded-2xl p-6 border border-dark-100">
              <h3 className="font-bold text-dark-800 mb-3">Self-Marshalling</h3>
              <p className="text-sm text-dark-600">
                All swimmers self-marshal. Know your event, heat, and lane.
                Check the program page for your heat and lane assignments.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
