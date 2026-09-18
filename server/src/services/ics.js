const fmt = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
export function ics({ title, starts_at, ends_at, location, description = "", uid }) {
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Healthy Planet Recruitment//EN", "BEGIN:VEVENT", `UID:${uid}@healthyplanetschool`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(starts_at)}`, `DTEND:${fmt(ends_at)}`, `SUMMARY:${title}`, `LOCATION:${location}`, `DESCRIPTION:${description.replace(/\n/g, "\\n")}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
export const gcalLink = ({ title, starts_at, ends_at, location, description = "" }) => `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(starts_at)}/${fmt(ends_at)}&location=${encodeURIComponent(location)}&details=${encodeURIComponent(description)}`;
