/*
 * booking.js - booking rules: validation, slots, totals.
 * Pure functions with no DOM access, so they can be tested in Node.
 */
(function (root, factory) {
  var ai = typeof module === "object" && module.exports ? require("./ai.js") : root.CarAI;
  if (typeof module === "object" && module.exports) module.exports = factory(ai);
  else root.CarBooking = factory(ai);
})(typeof self !== "undefined" ? self : this, function (CarAI) {
  "use strict";

  var SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];
  var CAPACITY = 2; // bookings per slot
  var MAX_DAYS_AHEAD = 60;
  var LEAD_MINUTES = 60; // a slot must start at least this long from now

  function pad(n) { return (n < 10 ? "0" : "") + n; }

  function toISO(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // "2026-10-13" -> local Date, or null if invalid
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ""));
    if (!m) return null;
    var y = +m[1], mo = +m[2], d = +m[3];
    var date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
    return date;
  }

  function slotDate(dateStr, time) {
    var d = parseDate(dateStr);
    if (!d) return null;
    var parts = time.split(":");
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), +parts[0], +parts[1]);
  }

  function slotLabel(time) {
    var h = +time.split(":")[0];
    var suffix = h >= 12 ? "PM" : "AM";
    var h12 = h % 12 === 0 ? 12 : h % 12;
    return h12 + ":" + time.split(":")[1] + " " + suffix;
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function isSunday(dateStr) {
    var d = parseDate(dateStr);
    return !!d && d.getDay() === 0;
  }

  function dayStatus(dateStr, now) {
    var d = parseDate(dateStr);
    if (!d) return "Choose a valid date.";
    var today = startOfDay(now);
    if (d < today) return "That date has passed.";
    if (d > new Date(today.getFullYear(), today.getMonth(), today.getDate() + MAX_DAYS_AHEAD)) {
      return "Bookings open up to " + MAX_DAYS_AHEAD + " days ahead.";
    }
    if (d.getDay() === 0) return "We are closed on Sundays. Choose another day.";
    return "";
  }

  function bookedCount(dateStr, time, bookings) {
    var n = 0;
    for (var i = 0; i < bookings.length; i++) {
      if (bookings[i].date === dateStr && bookings[i].slot === time) n++;
    }
    return n;
  }

  // slots for a date with how many places are left; slots too soon or full are unavailable
  function availableSlots(dateStr, bookings, now) {
    if (dayStatus(dateStr, now)) return [];
    return SLOTS.map(function (time) {
      var left = CAPACITY - bookedCount(dateStr, time, bookings);
      var soonEnough = slotDate(dateStr, time) - now >= LEAD_MINUTES * 60 * 1000;
      return { time: time, label: slotLabel(time), left: Math.max(left, 0), available: left > 0 && soonEnough };
    });
  }

  function calcTotal(serviceIds) {
    var total = 0;
    for (var i = 0; i < serviceIds.length; i++) {
      var s = CarAI.getService(serviceIds[i]);
      if (s) total += s.price;
    }
    return total;
  }

  function normalizePhone(p) {
    var digits = String(p || "").replace(/[\s\-()]/g, "");
    digits = digits.replace(/^\+?91/, "");
    return digits;
  }

  // returns an object of field -> message. Empty object means valid.
  function validate(data, bookings, now) {
    var errors = {};
    var name = String(data.name || "").trim();
    if (name.length < 2) errors.name = "Enter your name (at least 2 letters).";
    else if (!/^[A-Za-z][A-Za-z .'\-]*$/.test(name)) errors.name = "Use letters only in the name.";

    if (!/^[6-9]\d{9}$/.test(normalizePhone(data.phone))) {
      errors.phone = "Enter a valid 10 digit mobile number.";
    }

    var email = String(data.email || "").trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Enter a valid email or leave it empty.";

    if (String(data.model || "").trim().length < 2) errors.model = "Enter your car make and model.";

    if (!data.services || !data.services.length) errors.services = "Select at least one service.";

    var dateError = dayStatus(data.date, now);
    if (dateError) errors.date = data.date ? dateError : "Choose a date.";

    if (!data.slot) {
      errors.slot = "Choose a time slot.";
    } else if (!errors.date) {
      var found = null;
      var slots = availableSlots(data.date, bookings, now);
      for (var i = 0; i < slots.length; i++) if (slots[i].time === data.slot) found = slots[i];
      if (!found || !found.available) errors.slot = "That slot is not available. Choose another.";
    }
    return errors;
  }

  function newId(now) {
    return "CS-" + now.getTime().toString(36).slice(-5).toUpperCase() + Math.floor(Math.random() * 36).toString(36).toUpperCase();
  }

  function makeBooking(data, now) {
    return {
      id: newId(now),
      name: String(data.name).trim(),
      phone: normalizePhone(data.phone),
      email: String(data.email || "").trim(),
      model: String(data.model).trim(),
      services: data.services.slice(),
      date: data.date,
      slot: data.slot,
      notes: String(data.notes || "").trim(),
      total: calcTotal(data.services),
      createdAt: now.toISOString()
    };
  }

  return {
    SLOTS: SLOTS,
    CAPACITY: CAPACITY,
    MAX_DAYS_AHEAD: MAX_DAYS_AHEAD,
    toISO: toISO,
    parseDate: parseDate,
    slotLabel: slotLabel,
    isSunday: isSunday,
    dayStatus: dayStatus,
    availableSlots: availableSlots,
    calcTotal: calcTotal,
    normalizePhone: normalizePhone,
    validate: validate,
    makeBooking: makeBooking
  };
});
