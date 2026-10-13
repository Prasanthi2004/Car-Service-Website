/*
 * app.js - connects the booking page to CarAI (advisor) and CarBooking (booking rules).
 * Bookings are saved in this browser only (localStorage). There is no server.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "carservice.bookings.v1";
  var FIELD_ORDER = ["name", "phone", "email", "model", "services", "date", "slot"];
  var FIELD_INPUT = {
    name: "bk-name", phone: "bk-phone", email: "bk-email", model: "bk-model",
    date: "bk-date", slot: "bk-slot"
  };

  var EXAMPLES = [
    "Brakes squeal when I stop",
    "Car won't start and headlights are dim",
    "AC is not cooling",
    "Steering pulls to one side",
    "Engine is overheating"
  ];

  function $(id) { return document.getElementById(id); }

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "text") node.textContent = props[k];
        else if (k === "class") node.className = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) {
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // ---------- storage ----------
  function loadBookings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) return [];
      return list.filter(function (b) {
        return b && typeof b.id === "string" && typeof b.date === "string" &&
          typeof b.slot === "string" && Array.isArray(b.services);
      });
    } catch (e) {
      return [];
    }
  }

  var bookings = loadBookings();

  function saveBookings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
    } catch (e) {
      toast("Could not save in this browser. Private mode may block storage.");
    }
  }

  // ---------- toast ----------
  var toastTimer = null;
  function toast(message) {
    var node = $("cs-toast");
    if (!node) {
      node = el("div", { id: "cs-toast", class: "cs-toast", role: "status" });
      document.body.appendChild(node);
    }
    node.textContent = message;
    node.classList.add("cs-show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.classList.remove("cs-show"); }, 3500);
  }

  function formatDate(dateStr) {
    var d = CarBooking.parseDate(dateStr);
    if (!d) return dateStr;
    return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  }

  function serviceNames(ids) {
    return ids.map(function (id) {
      var s = CarAI.getService(id);
      return s ? s.name : id;
    }).join(", ");
  }

  // ---------- booking form ----------
  var form = $("booking-form");

  function selectedServices() {
    var boxes = form.querySelectorAll('input[name="service"]:checked');
    return Array.prototype.map.call(boxes, function (b) { return b.value; });
  }

  function renderServices() {
    var box = $("bk-services");
    clear(box);
    CarAI.SERVICES.forEach(function (s) {
      var input = el("input", { type: "checkbox", name: "service", value: s.id, id: "svc-" + s.id });
      var label = el("label", { class: "cs-check", for: "svc-" + s.id }, [
        input,
        el("span", { text: s.name }),
        el("em", { text: CarAI.money(s.price) })
      ]);
      box.appendChild(label);
    });
  }

  function updateEstimate() {
    var ids = selectedServices();
    var list = $("estimate-list");
    clear(list);
    if (!ids.length) {
      list.appendChild(el("li", { class: "cs-muted", text: "Select services to see the estimate." }));
    } else {
      ids.forEach(function (id) {
        var s = CarAI.getService(id);
        list.appendChild(el("li", {}, [el("span", { text: s.name }), el("strong", { text: CarAI.money(s.price) })]));
      });
    }
    $("estimate-total").textContent = CarAI.money(CarBooking.calcTotal(ids));
  }

  function renderSlots() {
    var select = $("bk-slot");
    var previous = select.value;
    clear(select);
    var date = $("bk-date").value;

    function placeholder(text) {
      select.appendChild(el("option", { value: "", text: text }));
    }

    if (!date) {
      placeholder("Choose a date first");
      select.disabled = true;
      return;
    }
    var status = CarBooking.dayStatus(date, new Date());
    if (status) {
      placeholder("Pick another date");
      select.disabled = true;
      return;
    }
    select.disabled = false;
    placeholder("Select a time");
    CarBooking.availableSlots(date, bookings, new Date()).forEach(function (s) {
      var text = s.label;
      if (!s.available) text += " (unavailable)";
      else if (s.left === 1) text += " (1 left)";
      var opt = el("option", { value: s.time, text: text });
      if (!s.available) opt.disabled = true;
      select.appendChild(opt);
    });
    if (previous) {
      var stillThere = Array.prototype.some.call(select.options, function (o) { return o.value === previous && !o.disabled; });
      if (stillThere) select.value = previous;
    }
  }

  function showErrors(errors) {
    FIELD_ORDER.forEach(function (key) {
      var msg = errors[key] || "";
      $("err-" + key).textContent = msg;
      var input = FIELD_INPUT[key] && $(FIELD_INPUT[key]);
      if (input) {
        if (msg) input.setAttribute("aria-invalid", "true");
        else input.removeAttribute("aria-invalid");
      }
    });
  }

  function focusFirstError(errors) {
    for (var i = 0; i < FIELD_ORDER.length; i++) {
      var key = FIELD_ORDER[i];
      if (!errors[key]) continue;
      var target = key === "services" ? form.querySelector('input[name="service"]') : $(FIELD_INPUT[key]);
      if (target) target.focus();
      return;
    }
  }

  function readForm() {
    return {
      name: $("bk-name").value,
      phone: $("bk-phone").value,
      email: $("bk-email").value,
      model: $("bk-model").value,
      services: selectedServices(),
      date: $("bk-date").value,
      slot: $("bk-slot").value,
      notes: $("bk-notes").value
    };
  }

  function sortedBookings() {
    return bookings.slice().sort(function (a, b) {
      return (a.date + a.slot).localeCompare(b.date + b.slot);
    });
  }

  function renderBookings() {
    var list = $("booking-list");
    clear(list);
    if (!bookings.length) {
      list.appendChild(el("li", { class: "cs-muted", text: "No bookings yet." }));
      return;
    }
    sortedBookings().forEach(function (b) {
      var cancel = el("button", { type: "button", class: "cs-btn cs-small", "data-cancel": b.id, text: "Cancel" });
      cancel.setAttribute("aria-label", "Cancel booking " + b.id);
      list.appendChild(el("li", { class: "cs-booking" }, [
        el("strong", { text: b.id + " - " + formatDate(b.date) + ", " + CarBooking.slotLabel(b.slot) }),
        el("span", { text: (b.model || "") + " - " + serviceNames(b.services) }),
        el("span", { text: "Estimate " + CarAI.money(b.total || 0) }),
        cancel
      ]));
    });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var now = new Date();
    var data = readForm();
    var errors = CarBooking.validate(data, bookings, now);
    showErrors(errors);
    var confirmBox = $("bk-confirm");
    confirmBox.hidden = true;
    if (Object.keys(errors).length) {
      focusFirstError(errors);
      return;
    }
    var booking = CarBooking.makeBooking(data, now);
    bookings.push(booking);
    saveBookings();
    form.reset();
    updateEstimate();
    renderSlots();
    renderBookings();
    confirmBox.textContent = "Booked! Your booking ID is " + booking.id + " for " + formatDate(booking.date) +
      ", " + CarBooking.slotLabel(booking.slot) + ". Estimated total " + CarAI.money(booking.total) + ".";
    confirmBox.hidden = false;
    toast("Booking confirmed: " + booking.id);
  });

  form.addEventListener("change", function (e) {
    if (e.target.name === "service") {
      updateEstimate();
      $("err-services").textContent = "";
    }
    if (e.target.id === "bk-date") {
      renderSlots();
      var status = $("bk-date").value ? CarBooking.dayStatus($("bk-date").value, new Date()) : "";
      $("err-date").textContent = status;
      $("err-slot").textContent = "";
    }
  });

  form.addEventListener("input", function (e) {
    var id = e.target.id;
    Object.keys(FIELD_INPUT).forEach(function (key) {
      if (FIELD_INPUT[key] === id && id !== "bk-date") {
        $("err-" + key).textContent = "";
        e.target.removeAttribute("aria-invalid");
      }
    });
  });

  $("booking-list").addEventListener("click", function (e) {
    var id = e.target.getAttribute && e.target.getAttribute("data-cancel");
    if (!id) return;
    if (!window.confirm("Cancel booking " + id + "?")) return;
    bookings = bookings.filter(function (b) { return b.id !== id; });
    saveBookings();
    renderBookings();
    renderSlots();
    toast("Booking " + id + " cancelled");
  });

  window.addEventListener("storage", function (e) {
    if (e.key === STORAGE_KEY) {
      bookings = loadBookings();
      renderBookings();
      renderSlots();
    }
  });

  function applyServices(ids, note) {
    ids.forEach(function (id) {
      var box = $("svc-" + id);
      if (box) box.checked = true;
    });
    updateEstimate();
    $("err-services").textContent = "";
    if (note && !$("bk-notes").value.trim()) $("bk-notes").value = note;
    $("book").scrollIntoView({ behavior: "smooth", block: "start" });
    var firstEmpty = ["bk-name", "bk-phone", "bk-model", "bk-date"].map($).filter(function (n) { return !n.value; })[0];
    if (firstEmpty) firstEmpty.focus({ preventScroll: true });
    toast("Services added to your booking");
  }

  // ---------- AI service advisor ----------
  function renderAdvisorExamples() {
    var box = $("advisor-examples");
    EXAMPLES.forEach(function (text) {
      var chip = el("button", { type: "button", class: "cs-chip", text: text });
      chip.addEventListener("click", function () {
        $("advisor-input").value = text;
        $("advisor-form").requestSubmit();
      });
      box.appendChild(chip);
    });
  }

  function renderAdvisorResult(text, d, maintenance) {
    var out = $("advisor-result");
    clear(out);
    out.appendChild(el("h3", { text: "Advisor result" }));
    out.appendChild(el("p", { class: "cs-badge cs-u" + d.urgency, text: d.urgencyLabel }));
    out.appendChild(el("p", { text: d.summary }));

    if (d.matched) {
      var ul = el("ul", { class: "cs-list cs-issues" });
      d.matches.forEach(function (m) {
        ul.appendChild(el("li", {}, [el("strong", { text: m.title }), el("span", { text: m.advice })]));
      });
      out.appendChild(ul);
    }

    var services = d.services.slice();
    if (maintenance) {
      out.appendChild(el("p", { class: "cs-maint cs-m-" + maintenance.status, text: maintenance.message }));
      if (maintenance.status === "due" && services.indexOf("general") === -1) services.push("general");
    }

    out.appendChild(el("h4", { text: "Suggested services" }));
    var chips = el("div", { class: "cs-chips" });
    services.forEach(function (id) {
      var s = CarAI.getService(id);
      chips.appendChild(el("span", { class: "cs-chip cs-static", text: s.name + " " + CarAI.money(s.price) }));
    });
    out.appendChild(chips);
    out.appendChild(el("p", { class: "cs-total", text: "Estimated total: " + CarAI.money(CarBooking.calcTotal(services)) }));

    var add = el("button", { type: "button", class: "cs-btn cs-primary", id: "add-to-booking", text: "Add these to my booking" });
    add.addEventListener("click", function () { applyServices(services, text); });
    out.appendChild(add);
    out.appendChild(el("p", { class: "cs-note", text: "General guidance only. A mechanic should confirm the actual problem." }));
  }

  $("advisor-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var text = $("advisor-input").value;
    var d = CarAI.diagnose(text);
    var err = $("err-advisor");
    if (d.error) {
      err.textContent = d.error;
      $("advisor-input").focus();
      return;
    }
    err.textContent = "";
    var maintenance = CarAI.maintenanceStatus($("adv-km").value, $("adv-months").value);
    renderAdvisorResult(text.trim(), d, maintenance);
  });

  // ---------- start ----------
  (function init() {
    var today = new Date();
    var max = new Date(today.getFullYear(), today.getMonth(), today.getDate() + CarBooking.MAX_DAYS_AHEAD);
    $("bk-date").min = CarBooking.toISO(today);
    $("bk-date").max = CarBooking.toISO(max);
    renderServices();
    updateEstimate();
    renderSlots();
    renderBookings();
    renderAdvisorExamples();

    // links such as book.html?services=brakes,tyres pre-select services
    try {
      var wanted = (new URLSearchParams(window.location.search).get("services") || "")
        .split(",").filter(function (id) { return CarAI.getService(id); });
      if (wanted.length) applyServices(wanted, "");
    } catch (e) { /* old browser: ignore */ }
  })();

  window.CarApp = { applyServices: applyServices };
})();
