// Run with: node tests/logic.test.js
const assert = require("node:assert/strict");
const CarAI = require("../js/ai.js");
const CarBooking = require("../js/booking.js");

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("ok -", name);
}

// ---------- advisor ----------
test("brake noise is high urgency and recommends brakes", () => {
  const r = CarAI.diagnose("My brakes squeal when I stop");
  assert.equal(r.matched, true);
  assert.equal(r.matches[0].id, "brakes");
  assert.equal(r.urgency, 3);
  assert.deepEqual(r.services, ["brakes"]);
});

test("starting problem recommends battery and diagnostics", () => {
  const r = CarAI.diagnose("Car won't start and the headlights are dim");
  assert.equal(r.matches[0].id, "starting");
  assert.ok(r.services.includes("battery") && r.services.includes("diagnostics"));
  assert.equal(r.urgency, 2);
});

test("several problems are combined and sorted by urgency", () => {
  const r = CarAI.diagnose("AC not cooling and the brakes make a grinding noise");
  assert.equal(r.matches[0].id, "brakes");
  assert.ok(r.services.includes("ac") && r.services.includes("brakes"));
  assert.equal(r.urgency, 3);
});

test("unknown text falls back to diagnostics, empty text is an error", () => {
  const r = CarAI.diagnose("something feels odd lately");
  assert.equal(r.matched, false);
  assert.deepEqual(r.services, ["diagnostics"]);
  assert.ok(CarAI.diagnose("  ").error);
});

test("whole word matching avoids false positives", () => {
  assert.equal(CarAI.diagnose("I need to pack my bags and boil water").matched, false);
  assert.equal(CarAI.respond("this is fine").intent, "fallback");
});

test("maintenance reminder", () => {
  assert.equal(CarAI.maintenanceStatus("", ""), null);
  assert.equal(CarAI.maintenanceStatus("11000", "").status, "due");
  assert.equal(CarAI.maintenanceStatus("", "10").status, "soon");
  assert.equal(CarAI.maintenanceStatus("3000", "4").status, "ok");
});

// ---------- chat ----------
test("chat answers prices, hours, booking and greetings", () => {
  assert.match(CarAI.respond("how much for brake service").text, /2,500/);
  assert.match(CarAI.respond("How much does a service cost?").text, /Oil and filter change/);
  assert.match(CarAI.respond("are you open on sunday").text, /Closed on Sunday/);
  assert.equal(CarAI.respond("I want to book a slot").intent, "booking");
  assert.equal(CarAI.respond("hi").intent, "greeting");
  assert.equal(CarAI.respond("how do I cancel").intent, "cancel");
});

test("chat uses the advisor when a problem is described", () => {
  const r = CarAI.respond("my engine is overheating");
  assert.equal(r.intent, "diagnose");
  assert.match(r.text, /High/);
});

// ---------- booking ----------
const now = new Date(2026, 9, 13, 9, 0); // Tue 13 Oct 2026, 9:00 AM
const valid = {
  name: "Prasanthi A",
  phone: "+91 99124 20986",
  email: "",
  model: "Maruti Swift",
  services: ["oil", "tyres"],
  date: "2026-10-14",
  slot: "10:00",
  notes: ""
};

test("totals and phone normalizing", () => {
  assert.equal(CarBooking.calcTotal(["oil", "tyres"]), 2700);
  assert.equal(CarBooking.normalizePhone("+91 99124-20986"), "9912420986");
});

test("valid booking has no errors and builds a record", () => {
  assert.deepEqual(CarBooking.validate(valid, [], now), {});
  const b = CarBooking.makeBooking(valid, now);
  assert.equal(b.total, 2700);
  assert.equal(b.phone, "9912420986");
  assert.match(b.id, /^CS-/);
});

test("validation errors", () => {
  assert.ok(CarBooking.validate({ ...valid, name: "" }, [], now).name);
  assert.ok(CarBooking.validate({ ...valid, name: "R2D2!!" }, [], now).name);
  assert.ok(CarBooking.validate({ ...valid, phone: "12345" }, [], now).phone);
  assert.ok(CarBooking.validate({ ...valid, email: "nope" }, [], now).email);
  assert.ok(CarBooking.validate({ ...valid, model: "" }, [], now).model);
  assert.ok(CarBooking.validate({ ...valid, services: [] }, [], now).services);
  assert.ok(CarBooking.validate({ ...valid, date: "" }, [], now).date);
  assert.ok(CarBooking.validate({ ...valid, slot: "" }, [], now).slot);
});

test("dates: past, sunday, too far ahead, impossible date", () => {
  assert.ok(CarBooking.validate({ ...valid, date: "2026-10-12" }, [], now).date);
  assert.equal(CarBooking.isSunday("2026-10-18"), true);
  assert.match(CarBooking.validate({ ...valid, date: "2026-10-18" }, [], now).date, /Sunday/);
  assert.ok(CarBooking.validate({ ...valid, date: "2027-03-01" }, [], now).date);
  assert.equal(CarBooking.parseDate("2026-02-31"), null);
});

test("slots: capacity and lead time", () => {
  const full = [
    { date: "2026-10-14", slot: "10:00" },
    { date: "2026-10-14", slot: "10:00" }
  ];
  const slots = CarBooking.availableSlots("2026-10-14", full, now);
  assert.equal(slots.find((s) => s.time === "10:00").available, false);
  assert.equal(slots.find((s) => s.time === "11:00").available, true);
  assert.ok(CarBooking.validate(valid, full, now).slot);

  // today at 9:00: the 9:00 and 10:00 slots are less than 1 hour away
  const today = CarBooking.availableSlots("2026-10-13", [], now);
  assert.equal(today.find((s) => s.time === "09:00").available, false);
  assert.equal(today.find((s) => s.time === "10:00").available, true);
  assert.equal(CarBooking.slotLabel("14:00"), "2:00 PM");
  assert.equal(CarBooking.slotLabel("12:00"), "12:00 PM");
});

console.log("\nAll " + passed + " tests passed.");
