"use client";

import { useState } from "react";

const GROOMING_SERVICES = [
  { id: "bath", name: "Bath & Dry", price: 35, duration: "45 min" },
  { id: "full", name: "Full Groom", price: 65, duration: "1.5 hr" },
  { id: "nail", name: "Nail Trim", price: 15, duration: "15 min" },
];

const TIME_SLOTS = [
  "09:00", "10:00", "11:00", "14:00", "15:00", "16:00",
];

const DAYS_AHEAD = 7;

function getNextDays() {
  const days: { date: string; label: string; weekday: string }[] = [];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  for (let i = 0; i < DAYS_AHEAD; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push({
      date: d.toISOString().slice(0, 10),
      label: d.getDate().toString(),
      weekday: weekdays[d.getDay()],
    });
  }
  return days;
}

export default function GroomingPage() {
  const [service, setService] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [petName, setPetName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const days = getNextDays();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (service && date && time && petName.trim()) {
      setSubmitted(true);
    }
  };

  if (submitted) {
    const selectedService = GROOMING_SERVICES.find((s) => s.id === service);
    return (
      <div className="bg-cream">
        <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
          <div className="rounded-2xl border border-sage-light bg-white p-8 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sage-light text-sage">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-4 text-2xl font-bold text-umber">Booking confirmed</h2>
            <p className="mt-2 text-umber/70">
              We’ll see <strong>{petName}</strong> on <strong>{date}</strong> at <strong>{time}</strong> for{" "}
              <strong>{selectedService?.name}</strong> (${selectedService?.price}).
            </p>
            <button
              type="button"
              onClick={() => {
                setSubmitted(false);
                setService(null);
                setDate(null);
                setTime(null);
                setPetName("");
              }}
              className="mt-8 rounded-xl bg-terracotta px-6 py-2.5 text-sm font-semibold text-white hover:bg-terracotta/90"
            >
              Book another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-bold tracking-tight text-umber sm:text-4xl">
          Dog Grooming
        </h1>
        <p className="mt-2 text-umber/70">
          Book a bath, full groom, or nail trim. Choose a date and time below.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-10">
          {/* Service */}
          <section>
            <h2 className="text-lg font-semibold text-umber">Service</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {GROOMING_SERVICES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setService(s.id)}
                  className={`rounded-xl border-2 p-4 text-left transition ${
                    service === s.id
                      ? "border-terracotta bg-terracotta-light/30"
                      : "border-amber-200/60 bg-white hover:border-amber-300"
                  }`}
                >
                  <span className="font-medium text-umber">{s.name}</span>
                  <p className="mt-1 text-sm text-umber/70">{s.duration} · ${s.price}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Date */}
          <section>
            <h2 className="text-lg font-semibold text-umber">Date</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {days.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => setDate(d.date)}
                  className={`rounded-xl border-2 px-4 py-3 text-center text-sm transition ${
                    date === d.date
                      ? "border-terracotta bg-terracotta-light/30 font-medium text-umber"
                      : "border-amber-200/60 bg-white text-umber/80 hover:border-amber-300"
                  }`}
                >
                  <span className="block font-semibold">{d.label}</span>
                  <span className="text-xs">{d.weekday}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Time */}
          <section>
            <h2 className="text-lg font-semibold text-umber">Time</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {TIME_SLOTS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTime(t)}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-medium transition ${
                    time === t
                      ? "border-terracotta bg-terracotta-light/30 text-umber"
                      : "border-amber-200/60 bg-white text-umber/80 hover:border-amber-300"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </section>

          {/* Pet name */}
          <section>
            <label htmlFor="petName" className="text-lg font-semibold text-umber">
              Pet name
            </label>
            <input
              id="petName"
              type="text"
              value={petName}
              onChange={(e) => setPetName(e.target.value)}
              placeholder="e.g. Max"
              className="mt-2 w-full max-w-xs rounded-xl border border-amber-200 bg-white px-4 py-3 text-umber placeholder:text-umber/40 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/20"
              required
            />
          </section>

          <button
            type="submit"
            disabled={!service || !date || !time || !petName.trim()}
            className="w-full rounded-xl bg-terracotta py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-terracotta/90 disabled:opacity-50 sm:w-auto sm:px-12"
          >
            Confirm booking
          </button>
        </form>
      </div>
    </div>
  );
}
