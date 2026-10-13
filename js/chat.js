/*
 * chat.js - floating chat assistant. Builds its own HTML, so any page can use it
 * by loading css/features.css, js/ai.js and this file.
 */
(function () {
  "use strict";
  if (!window.CarAI) return;

  var panel, toggle, log, suggestions, input;
  var opened = false;

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        if (k === "text") node.textContent = props[k];
        else if (k === "class") node.className = props[k];
        else node.setAttribute(k, props[k]);
      });
    }
    (children || []).forEach(function (c) { node.appendChild(c); });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function addMessage(who, text) {
    log.appendChild(el("div", { class: "cs-msg cs-msg-" + who, text: text }));
    log.scrollTop = log.scrollHeight;
  }

  function renderSuggestions(items) {
    clear(suggestions);
    (items || []).forEach(function (item) {
      var chip = el("button", { type: "button", class: "cs-chip", text: item.label });
      chip.addEventListener("click", item.action);
      suggestions.appendChild(chip);
    });
  }

  function textSuggestions(list) {
    return (list || []).map(function (label) {
      return { label: label, action: function () { send(label); } };
    });
  }

  // On the booking page, fill the form. On other pages, go to the booking page.
  function addToBooking(ids) {
    if (window.CarApp && window.CarApp.applyServices) {
      close();
      window.CarApp.applyServices(ids, "");
    } else {
      window.location.href = "book.html?services=" + encodeURIComponent(ids.join(","));
    }
  }

  function send(text) {
    text = String(text || "").trim();
    if (!text) return;
    addMessage("user", text);
    input.value = "";
    renderSuggestions([]);
    var reply = CarAI.respond(text);
    setTimeout(function () {
      addMessage("bot", reply.text);
      var chips = textSuggestions(reply.suggestions);
      if (reply.services && reply.services.length) {
        chips.push({ label: "Add to my booking", action: function () { addToBooking(reply.services); } });
      }
      renderSuggestions(chips);
    }, 300);
  }

  function open() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    if (!opened) {
      opened = true;
      addMessage("bot", "Hi! Ask me about prices, timings or booking, or describe a car problem.");
      renderSuggestions(textSuggestions(["How much does a service cost?", "What are your timings?", "My brakes squeal"]));
    }
    input.focus();
  }

  function close() {
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  }

  function build() {
    toggle = el("button", {
      type: "button", id: "chat-toggle", class: "cs-fab cs-fab-right",
      "aria-expanded": "false", "aria-controls": "chat-panel", text: "Chat"
    });

    var closeBtn = el("button", { type: "button", id: "chat-close", "aria-label": "Close chat", text: "×" });
    var head = el("div", { class: "cs-chat-head" }, [el("strong", { text: "Ask " + CarAI.SHOP.name }), closeBtn]);

    log = el("div", { id: "chat-log", class: "cs-chat-log", "aria-live": "polite" });
    suggestions = el("div", { id: "chat-suggestions", class: "cs-chips" });

    input = el("input", {
      id: "chat-input", type: "text", autocomplete: "off",
      placeholder: "Ask about prices, timings, problems", "aria-label": "Your message"
    });
    var sendBtn = el("button", { type: "submit", class: "cs-btn cs-primary", text: "Send" });
    var form = el("form", { id: "chat-form", class: "cs-chat-form" }, [input, sendBtn]);

    var note = el("p", { class: "cs-note", text: "Rule-based assistant. Prices and policies are samples." });

    panel = el("div", { id: "chat-panel", class: "cs-chat", role: "dialog", "aria-label": "Chat assistant" },
      [head, log, suggestions, form, note]);
    panel.hidden = true;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    toggle.addEventListener("click", function () { if (panel.hidden) open(); else close(); });
    closeBtn.addEventListener("click", function () { close(); toggle.focus(); });
    form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !panel.hidden) { close(); toggle.focus(); }
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
