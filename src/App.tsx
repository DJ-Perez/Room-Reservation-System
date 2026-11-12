import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
 
type Step = "welcome" | "details" | "rooms" | "confirmation" | "success";
 
type GuestDetails = {
  name: string;
  phone: string;
  email: string;
};
 
type SearchDetails = {
  date: string;
  start: string;
  end: string;
  guests: string;
};
 
type Room = {
  number: string;
  name: string;
  capacity: number;
  available: boolean;
};
 
type BookingRecord = {
  ticketCode: string;
  guest: GuestDetails;
  search: SearchDetails;
  room: Room;
  bookedAt: string;
};
 
const initialRooms: Room[] = [
  { number: "101", name: "Master Bedroom", capacity: 2, available: true },
  { number: "102", name: "Spacious Family Room", capacity: 6, available: true },
  { number: "201", name: "Fullpax Room", capacity: 12, available: true },
  { number: "202", name: "Family Bonding", capacity: 5, available: true },
];
 
const initialGuest: GuestDetails = {
  name: "",
  phone: "",
  email: "",
};
 
const initialSearch: SearchDetails = {
  date: "",
  start: "00:00",
  end: "00:00",
  guests: "1",
};
 
function Logo() {
  return (
    <button className="logo" type="button" aria-label="Return to home">
      <span>La Casa’s</span>
      <small>David Hotel</small>
    </button>
  );
}
 
function Header({ step, onHome }: { step: Step; onHome: () => void }) {
  const labels: Partial<Record<Step, string>> = {
    details: "Step 1 of 4 · Your details",
    rooms: "Step 2 of 4 · Check rooms",
    confirmation: "Step 3 of 4 · Confirmation",
    success: "Step 4 of 4 · Success",
  };
 
  return (
    <header className="site-header">
      <div className="header-inner" onClick={onHome}>
        <Logo />
        {labels[step] && <p className="step-label">{labels[step]}</p>}
      </div>
    </header>
  );
}
 
function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
 
function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6.5 12.5 3.5 3.5 7.5-8" />
    </svg>
  );
}
 
function PrimaryButton({
  children,
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`button button-primary ${className}`} {...props}>
      <span>{children}</span>
      <span className="button-arrow">
        <ArrowIcon />
      </span>
    </button>
  );
}
 
function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}
 
function formatTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes));
}
 
function generateTicketCode(): string {
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `LCD-H${randomNum}`;
}
 
function App() {
  const [step, setStep] = useState<Step>("welcome");
  const [guest, setGuest] = useState(initialGuest);
  const [search, setSearch] = useState(initialSearch);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [currentBooking, setCurrentBooking] = useState<BookingRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [bookedRoomNumbers, setBookedRoomNumbers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const scheduleValid = Boolean(search.date) && search.start < search.end;
 
  const [errors, setErrors] = useState({
    name: "",
    phone: "",
    email: "",
  });
 
  const validateName = (name: string) => /^[A-Za-zÀ-ÿ\s.'’-]+$/.test(name);
  const validatePhone = (phone: string) => /^\+?[0-9\s-]{10,11}$/.test(phone);
  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
 
  // Ask Supabase which rooms are already booked for the chosen date and time
  useEffect(() => {
    if (step !== "rooms" || !scheduleValid) {
      setBookedRoomNumbers([]);
      return;
    }
    let cancelled = false;
    supabase
      .rpc("booked_rooms", { p_date: search.date, p_start: search.start, p_end: search.end })
      .then(({ data, error }) => {
        if (cancelled || error) return;
        setBookedRoomNumbers((data ?? []).map((row: { room_number: string }) => row.room_number));
      });
    return () => {
      cancelled = true;
    };
  }, [step, scheduleValid, search.date, search.start, search.end]);
 
  const availableRooms = useMemo(() => {
    return initialRooms.map((room) => {
      const matchesCapacity = room.capacity >= Number(search.guests);
      const matchesQuery =
        room.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        room.number.includes(searchQuery);
      return {
        ...room,
        available:
          room.available &&
          matchesCapacity &&
          matchesQuery &&
          !bookedRoomNumbers.includes(room.number),
      };
    });
  }, [search.guests, searchQuery, bookedRoomNumbers]);
 
  const handleConfirmReservation = async () => {
    if (!selectedRoom || saving) return;
    setSaveError("");
    setSaving(true);
 
    let ticketCode = "";
    let saved = false;
 
    // Retry with a new code if the random ticket code was already used
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      ticketCode = generateTicketCode();
      const { error } = await supabase.from("reservationdetails").insert({
        ticket_code: ticketCode,
        room_number: selectedRoom.number,
        room_name: selectedRoom.name,
        reservation_date: search.date,
        start_time: search.start,
        end_time: search.end,
        guests: Number(search.guests),
        guest_name: guest.name.trim(),
        phone: guest.phone.trim(),
        email: guest.email.trim().toLowerCase(),
      });
 
      if (!error) {
        saved = true;
      } else if (error.code === "23P01") {
        // The database's no_double_booking rule: someone else just took this room
        setSaveError("Sorry, that room was just booked for this time. Please choose another room.");
        setSaving(false);
        return;
      } else if (error.code !== "23505") {
        setSaveError("We could not save your reservation. Please try again.");
        setSaving(false);
        return;
      }
    }
 
    setSaving(false);
    if (!saved) {
      setSaveError("We could not save your reservation. Please try again.");
      return;
    }
 
    const newBooking: BookingRecord = {
      ticketCode,
      guest: { ...guest },
      search: { ...search },
      room: { ...selectedRoom },
      bookedAt: new Date().toISOString(),
    };
    setCurrentBooking(newBooking);
    setStep("success");
  };
 
  const goHome = () => {
    setStep("welcome");
    setSelectedRoom(null);
    setCurrentBooking(null);
    setSearchQuery("");
    setSaveError("");
    setErrors({ name: "", phone: "", email: "" });
  };
 
  return (
    <div className="app-shell">
      <Header step={step} onHome={goHome} />
 
      <main>
        {step === "welcome" && (
          <section className="welcome page-wrap">
            <div className="welcome-copy">
              <p className="eyebrow">La Casa’s David Hotel</p>
              <h1>
                A room for every <em>occasion.</em>
              </h1>
              <p className="intro">
                Reserve a comfortable space in a few simple steps. No account required.
              </p>
              <PrimaryButton onClick={() => setStep("details")}>Start reservation</PrimaryButton>
            </div>
 
            <div className="welcome-arch" aria-hidden="true">
              <span />
              <p>Welcome in</p>
            </div>
          </section>
        )}
 
        {step === "details" && (
          <section className="details page-wrap">
            <div className="section-heading">
              <p className="eyebrow">Input your details</p>
              <h1>Who is booking?</h1>
              <p className="intro">We only need these to hold your room.</p>
            </div>
 
            <form
              className="card details-form"
              onSubmit={(event: FormEvent) => {
                event.preventDefault();
 
                const newErrors = {
                  name: validateName(guest.name) ? "" : "Please enter a valid full name.",
                  phone: validatePhone(guest.phone) ? "" : "Please enter a valid phone number.",
                  email: validateEmail(guest.email) ? "" : "Please enter a valid email address.",
                };
 
                setErrors(newErrors);
 
                if (!newErrors.name && !newErrors.phone && !newErrors.email) {
                  setStep("rooms");
                }
              }}
            >
              <label className="field field-wide">
                <span>Full name</span>
                <input
                  required
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={guest.name}
                  onChange={(event) => {
                    setGuest({ ...guest, name: event.target.value });
                    if (errors.name) setErrors({ ...errors, name: "" });
                  }}
                />
                {errors.name && (
                  <span style={{ color: "#b95635", fontSize: "14px", marginTop: "-6px", fontWeight: 600 }}>
                    {errors.name}
                  </span>
                )}
              </label>
 
              <label className="field">
                <span>Contact number</span>
                <input
                  required
                  type="tel"
                  autoComplete="tel"
                  placeholder="e.g. +63 XXX XXX XXXX"
                  value={guest.phone}
                  onChange={(event) => {
                    setGuest({ ...guest, phone: event.target.value });
                    if (errors.phone) setErrors({ ...errors, phone: "" });
                  }}
                />
                {errors.phone && (
                  <span style={{ color: "#b95635", fontSize: "14px", marginTop: "-6px", fontWeight: 600 }}>
                    {errors.phone}
                  </span>
                )}
              </label>
 
              <label className="field">
                <span>Email</span>
                <input
                  required
                  type="email"
                  autoComplete="email"
                  placeholder="e.g. handsome@gmail.com"
                  value={guest.email}
                  onChange={(event) => {
                    setGuest({ ...guest, email: event.target.value });
                    if (errors.email) setErrors({ ...errors, email: "" });
                  }}
                />
                {errors.email && (
                  <span style={{ color: "#b95635", fontSize: "14px", marginTop: "-6px", fontWeight: 600 }}>
                    {errors.email}
                  </span>
                )}
              </label>
 
              <PrimaryButton type="submit">Check rooms</PrimaryButton>
            </form>
          </section>
        )}
 
        {step === "rooms" && (
          <section className="rooms page-wrap">
            <form className="card search-card" onSubmit={(event) => event.preventDefault()}>
              <label className="field">
                <span>Date</span>
                <input
                  type="date"
                  value={search.date}
                  onChange={(event) => setSearch({ ...search, date: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Start</span>
                <input
                  type="time"
                  value={search.start}
                  onChange={(event) => setSearch({ ...search, start: event.target.value })}
                />
              </label>
              <label className="field">
                <span>End</span>
                <input
                  type="time"
                  value={search.end}
                  onChange={(event) => setSearch({ ...search, end: event.target.value })}
                />
              </label>
              <label className="field guest-field">
                <span>Guests</span>
                <select
                  value={search.guests}
                  onChange={(event) => setSearch({ ...search, guests: event.target.value })}
                >
                  {Array.from({ length: 12 }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field field-wide" style={{ gridColumn: "1 / -1" }}>
                <span>Search Room Name or Number</span>
                <input
                  type="text"
                  placeholder="e.g. Master Bedroom or 101"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </label>
            </form>
 
            {!scheduleValid && (
              <p className="form-note">
                Choose a date, and make sure the start time is earlier than the end time.
              </p>
            )}
 
            <div className="room-list">
              {availableRooms.map((room) => (
                <article className="card room-row" key={room.number}>
                  <div className="room-number">{room.number}</div>
                  <div className="room-copy">
                    <h2>Room {room.number}</h2>
                    <p>
                      {room.name} · Up to {room.capacity} guests
                    </p>
                  </div>
                  <span
                    className={`availability ${room.available ? "is-available" : "is-unavailable"}`}
                  >
                    {room.available ? "Available" : "Unavailable / Full"}
                  </span>
                  <button
                    className="button button-outline select-button"
                    type="button"
                    disabled={!room.available || !scheduleValid}
                    onClick={() => {
                      setSelectedRoom(room);
                      setStep("confirmation");
                    }}
                  >
                    Select
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}
 
        {step === "confirmation" && selectedRoom && (
          <section className="confirmation page-wrap">
            <aside className="selection-card">
              <p className="eyebrow">Your selection</p>
              <h2>Room {selectedRoom.number}</h2>
              <p>{selectedRoom.name}</p>
              <hr />
              <strong>{formatLongDate(search.date)}</strong>
              <strong>
                {search.start}–{search.end}
              </strong>
              <strong>
                {search.guests} {Number(search.guests) === 1 ? "guest" : "guests"}
              </strong>
            </aside>
 
            <div className="card confirmation-card">
              <h1>Confirm your reservation</h1>
              <dl>
                <div>
                  <dt>Name</dt>
                  <dd>{guest.name}</dd>
                </div>
                <div>
                  <dt>Contact number</dt>
                  <dd>{guest.phone}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{guest.email}</dd>
                </div>
              </dl>
              <div className="confirmation-actions">
                <PrimaryButton onClick={handleConfirmReservation} disabled={saving}>
                  {saving ? "Saving..." : "Confirm reservation"}
                </PrimaryButton>
                <button
                  className="button button-outline"
                  type="button"
                  onClick={() => {
                    setSelectedRoom(null);
                    setSaveError("");
                    setStep("rooms");
                  }}
                >
                  Cancel booking
                </button>
              </div>
              {saveError && (
                <p className="form-note" role="alert" style={{ color: "#b95635", fontWeight: 600 }}>
                  {saveError}
                </p>
              )}
              <p className="form-note">Cancel booking takes you back to the room search.</p>
            </div>
          </section>
        )}
 
        {step === "success" && selectedRoom && currentBooking && (
          <section className="success page-wrap">
            <div className="card success-card">
              <div className="success-icon">
                <CheckIcon />
              </div>
              <h1>Room reserved</h1>
              <p className="success-summary">
                Room {selectedRoom.number} · {formatLongDate(search.date)} ·{" "}
                {formatTime(search.start)}–{formatTime(search.end)}
              </p>
              <div className="ticket">
                <p>Your ticket · Reference code</p>
                <strong>{currentBooking.ticketCode}</strong>
              </div>
              <h2>Book another room?</h2>
              <div className="success-actions">
                <PrimaryButton
                  onClick={() => {
                    setSelectedRoom(null);
                    setCurrentBooking(null);
                    setStep("details");
                  }}
                >
                  Yes, book another
                </PrimaryButton>
                <button className="button button-outline" type="button" onClick={goHome}>
                  No, I’m done
                </button>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
 
export default App;