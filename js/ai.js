/*
 * ai.js - service catalog, problem advisor and chat assistant.
 *
 * The advisor and the chat bot only match keywords. They are not a real AI model.
 * They give general advice only, not a mechanic's opinion.
 * Works in the browser (global CarAI) and in Node (module.exports) for testing.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CarAI = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var RUPEE = "₹";

  var SHOP = {
    name: "Car Service",
    hours: "Monday to Saturday, 9:00 AM to 6:00 PM. Closed on Sunday",
    address: "28 Jackson Blvd, Ste 1020 (sample address)",
    pickup: "Pickup and drop is available on request (sample policy).",
    payment: "You can pay by cash, card or UPI after the service (sample policy).",
    warranty: "Services come with a 30 day workmanship warranty (sample policy)."
  };

  // Sample prices in rupees. keys are used by the chat assistant to find a service in a sentence.
  var SERVICES = [
    { id: "oil", name: "Oil and filter change", price: 1500, hours: 1, keys: ["oil"] },
    { id: "general", name: "General service", price: 3500, hours: 3, keys: ["general", "full service", "regular service"] },
    { id: "brakes", name: "Brake inspection and service", price: 2500, hours: 2, keys: ["brak*"] },
    { id: "tyres", name: "Tyre rotation and alignment", price: 1200, hours: 1, keys: ["tyre*", "tire*", "alignment", "rotation"] },
    { id: "ac", name: "AC service", price: 2200, hours: 2, keys: ["ac", "a/c", "air conditioning", "air conditioner"] },
    { id: "battery", name: "Battery check and replacement", price: 800, hours: 1, keys: ["battery"] },
    { id: "diagnostics", name: "Engine diagnostics", price: 999, hours: 1, keys: ["diagnos*", "scan", "check engine"] },
    { id: "wash", name: "Car wash and detailing", price: 1800, hours: 2, keys: ["wash", "detailing", "cleaning"] }
  ];

  function getService(id) {
    for (var i = 0; i < SERVICES.length; i++) if (SERVICES[i].id === id) return SERVICES[i];
    return null;
  }

  function money(n) {
    return RUPEE + Number(n).toLocaleString("en-IN");
  }

  // ---------- text helpers ----------
  function normalize(text) {
    return (
      " " +
      String(text || "")
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[^a-z0-9'\/ ]+/g, " ")
        .replace(/\s+/g, " ") +
      " "
    );
  }

  // keyword match on whole words; a trailing * means "starts with"
  function hasKeyword(norm, kw) {
    if (kw.charAt(kw.length - 1) === "*") return norm.indexOf(" " + kw.slice(0, -1)) !== -1;
    return norm.indexOf(" " + kw + " ") !== -1;
  }

  function countHits(norm, keywords) {
    var n = 0;
    for (var i = 0; i < keywords.length; i++) if (hasKeyword(norm, keywords[i])) n++;
    return n;
  }

  // ---------- problem advisor ----------
  // urgency: 3 high, 2 medium, 1 low
  var SYMPTOMS = [
    {
      id: "brakes", title: "Brake problem", urgency: 3, services: ["brakes"],
      keywords: ["brak*", "squeal*", "squeak*", "grinding", "spongy", "soft pedal", "hard to stop", "stopping distance"],
      advice: "Brakes are a safety item. Avoid highway driving until they are inspected."
    },
    {
      id: "overheating", title: "Overheating", urgency: 3, services: ["general", "diagnostics"],
      keywords: ["overheat*", "temperature", "coolant", "steam", "radiator", "smoke", "burning smell"],
      advice: "Stop safely and switch the engine off. Do not open the radiator cap while the engine is hot."
    },
    {
      id: "oil-warning", title: "Oil warning or engine knocking", urgency: 3, services: ["oil", "diagnostics"],
      keywords: ["oil light", "oil pressure", "oil leak", "knocking", "knock"],
      advice: "If the oil light stays on, stop driving. Running with low oil can damage the engine."
    },
    {
      id: "starting", title: "Starting or battery issue", urgency: 2, services: ["battery", "diagnostics"],
      keywords: ["won't start", "wont start", "not starting", "doesn't start", "doesnt start", "no start", "battery", "clicking", "slow crank", "dim lights", "headlights dim", "dead", "jump start"],
      advice: "If the lights and dashboard are dim, a weak battery is the most common cause."
    },
    {
      id: "engine", title: "Engine performance issue", urgency: 2, services: ["diagnostics", "general"],
      keywords: ["check engine", "engine light", "warning light", "jerk*", "misfire", "misfiring", "rough idle", "stall*", "poor mileage", "low mileage", "less mileage", "pickup", "power loss"],
      advice: "A diagnostic scan reads the fault codes and shows what needs attention."
    },
    {
      id: "tyres", title: "Tyre, steering or alignment issue", urgency: 2, services: ["tyres"],
      keywords: ["steering", "pulling", "pulls", "vibrat*", "shaking", "wobble*", "uneven", "tyre*", "tire*", "alignment", "puncture", "wheel*"],
      advice: "Pulling to one side or uneven tyre wear usually means alignment or rotation is needed."
    },
    {
      id: "ac", title: "AC problem", urgency: 1, services: ["ac"],
      keywords: ["ac", "a/c", "air conditioner", "air conditioning", "not cooling", "warm air", "hot air", "ac smell"],
      advice: "Weak cooling is often low gas, a dirty filter or a faulty compressor."
    },
    {
      id: "oil-change", title: "Oil change", urgency: 1, services: ["oil"],
      keywords: ["oil change", "engine oil", "oil", "dirty oil"],
      advice: "Fresh oil protects the engine. Change it as per your car's service schedule."
    },
    {
      id: "routine", title: "Routine maintenance", urgency: 1, services: ["general"],
      keywords: ["service due", "regular service", "routine", "periodic", "maintenance", "full service", "general service", "tune up", "tuneup", "last service"],
      advice: "Regular service keeps the car reliable and protects its resale value."
    },
    {
      id: "cleaning", title: "Cleaning or detailing", urgency: 1, services: ["wash"],
      keywords: ["wash", "detailing", "polish", "interior", "dirty", "dust", "stain*", "scratch*", "cleaning"],
      advice: "A wash and interior detailing will freshen up the car."
    }
  ];

  var URGENCY_LABELS = {
    3: "High: get it checked as soon as possible",
    2: "Medium: book a visit this week",
    1: "Low: routine care"
  };

  function diagnose(text) {
    var raw = String(text || "").trim();
    if (raw.length < 3) return { error: "Describe the problem in a few words." };

    var norm = normalize(raw);
    var matches = [];
    for (var i = 0; i < SYMPTOMS.length; i++) {
      var s = SYMPTOMS[i];
      var hits = countHits(norm, s.keywords);
      if (hits > 0) matches.push({ id: s.id, title: s.title, advice: s.advice, urgency: s.urgency, services: s.services.slice(), hits: hits });
    }
    matches.sort(function (a, b) { return b.urgency - a.urgency || b.hits - a.hits; });

    if (!matches.length) {
      return {
        matched: false, matches: [], services: ["diagnostics"], urgency: 1, urgencyLabel: URGENCY_LABELS[1],
        summary: "I could not match that to a known problem. An engine diagnostic is a safe first step."
      };
    }

    var services = [];
    var urgency = 0;
    for (var m = 0; m < matches.length; m++) {
      if (matches[m].urgency > urgency) urgency = matches[m].urgency;
      for (var k = 0; k < matches[m].services.length; k++) {
        if (services.indexOf(matches[m].services[k]) === -1) services.push(matches[m].services[k]);
      }
    }
    return {
      matched: true, matches: matches, services: services, urgency: urgency, urgencyLabel: URGENCY_LABELS[urgency],
      summary: "Most likely: " + matches[0].title.toLowerCase() + "."
    };
  }

  // Reminder based on how long ago the last service was. Both inputs are optional.
  function maintenanceStatus(kmSince, monthsSince) {
    var km = parseFloat(kmSince);
    var months = parseFloat(monthsSince);
    var hasKm = isFinite(km) && km >= 0;
    var hasMonths = isFinite(months) && months >= 0;
    if (!hasKm && !hasMonths) return null;
    if ((hasKm && km >= 10000) || (hasMonths && months >= 12)) {
      return { status: "due", message: "A general service is due now. Most cars need one every 10,000 km or 12 months." };
    }
    if ((hasKm && km >= 8000) || (hasMonths && months >= 9)) {
      return { status: "soon", message: "A general service will be due soon. Consider booking it in the next few weeks." };
    }
    return { status: "ok", message: "Your service schedule looks fine for now." };
  }

  // ---------- chat assistant ----------
  function findService(norm) {
    for (var i = 0; i < SERVICES.length; i++) {
      if (countHits(norm, SERVICES[i].keys) > 0) return SERVICES[i];
    }
    return null;
  }

  function priceList() {
    return SERVICES.map(function (s) { return s.name + ": " + money(s.price); }).join("; ") + ". Prices are samples.";
  }

  var INTENTS = [
    { id: "greeting", keywords: ["hi", "hello", "hey", "good morning", "good evening", "namaste"] },
    { id: "thanks", keywords: ["thanks", "thank you", "thx"] },
    { id: "price", keywords: ["price*", "cost*", "how much", "charge*", "rate*", "fee*", "quote", "estimate"] },
    { id: "hours", keywords: ["open", "opening", "timing*", "hours", "closed", "sunday", "working hours"] },
    { id: "booking", keywords: ["book*", "appointment", "schedule", "slot*", "reserve"] },
    { id: "cancel", keywords: ["cancel*", "reschedule", "change booking"] },
    { id: "pickup", keywords: ["pickup", "pick up", "drop", "home service", "doorstep"] },
    { id: "location", keywords: ["where", "address", "location", "located", "directions"] },
    { id: "payment", keywords: ["pay", "payment", "upi", "card", "cash"] },
    { id: "warranty", keywords: ["warranty", "guarantee"] }
  ];

  var DEFAULT_SUGGESTIONS = ["How much does a service cost?", "What are your timings?", "How do I book?"];

  function respond(message) {
    var raw = String(message || "").trim();
    if (!raw) return { text: "Type a question and I will try to help.", suggestions: DEFAULT_SUGGESTIONS };

    var norm = normalize(raw);

    var best = null;
    var bestHits = 0;
    for (var i = 0; i < INTENTS.length; i++) {
      var hits = countHits(norm, INTENTS[i].keywords);
      if (hits > bestHits) { bestHits = hits; best = INTENTS[i].id; }
    }

    var service = findService(norm);

    if (best === "price") {
      if (service) {
        return { text: service.name + " costs about " + money(service.price) + " and takes around " + service.hours + (service.hours === 1 ? " hour" : " hours") + ". Prices are samples.", intent: "price", services: [service.id] };
      }
      return { text: priceList(), intent: "price" };
    }

    if (best && best !== "greeting" && best !== "thanks") {
      var answers = {
        hours: "We are open " + SHOP.hours + ".",
        booking: "You can book in the Book a Service section on this page. Choose your services, a date and a time slot.",
        cancel: "Open My bookings in the Book a Service section and press Cancel. Then book a new slot.",
        pickup: SHOP.pickup,
        location: "We are at " + SHOP.address + ".",
        payment: SHOP.payment,
        warranty: SHOP.warranty
      };
      return { text: answers[best], intent: best };
    }

    // describing a problem? use the advisor
    var d = diagnose(raw);
    if (d.matched) {
      var names = d.services.map(function (id) { return getService(id).name; }).join(", ");
      return {
        text: d.matches[0].advice + " Suggested: " + names + ". " + d.urgencyLabel + ".",
        intent: "diagnose", services: d.services
      };
    }

    if (best === "greeting") return { text: "Hello! I can help with prices, timings, booking and car problems. What do you need?", intent: "greeting", suggestions: DEFAULT_SUGGESTIONS };
    if (best === "thanks") return { text: "You are welcome! Anything else I can help with?", intent: "thanks" };

    return {
      text: "I am not sure about that. I can help with prices, timings, booking, or describing a car problem.",
      intent: "fallback", suggestions: DEFAULT_SUGGESTIONS
    };
  }

  return {
    SHOP: SHOP,
    SERVICES: SERVICES,
    getService: getService,
    money: money,
    diagnose: diagnose,
    maintenanceStatus: maintenanceStatus,
    respond: respond,
    normalize: normalize
  };
});
