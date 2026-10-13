# Car Service Website

A car service website built with HTML, CSS, Bootstrap and JavaScript.

## Features

- **Home page** (`index.html`): landing page with a "Book a service" button and a chat assistant.
- **Booking page** (`book.html`):
  - choose services and see an instant price estimate
  - pick a date and time slot (Sundays closed, 2 bookings per slot, slots must be at least 1 hour away)
  - form validation with clear error messages (name, 10 digit mobile number, email, car model, services, date, slot)
  - bookings are saved in the browser with `localStorage`, listed under "My bookings", and can be cancelled
- **AI Service Advisor** (`book.html`): describe a car problem and get likely issues, an urgency level, suggested services and a service reminder based on km or months since the last service. "Add these to my booking" fills the booking form.
- **Chat assistant** (every page): answers questions about prices, timings, booking, cancellation, payment and warranty, and understands car problems.

## About the "AI"

The advisor and chat assistant are rule-based: they match keywords and score the results. They do not use a
large language model, and they give general guidance only. To use a real LLM later, call its API from a small
backend server. Never put an API key in front-end JavaScript.

## Project structure

```
index.html          home page
book.html           booking page and AI advisor
js/ai.js            service catalog, advisor and chat logic (no DOM code)
js/booking.js       booking rules: validation, slots, totals (no DOM code)
js/app.js           connects the booking page to the logic
js/chat.js          floating chat widget
css/features.css    styles for the new features
tests/logic.test.js unit tests
```

## Run it

Open `index.html` in a browser. No install or server is needed.

Run the tests (needs Node.js):

```bash
node tests/logic.test.js
```

## Edit the sample data

Prices and services are in `SERVICES`, and the shop address, hours and policies are in `SHOP`, both at the top of `js/ai.js`.
All prices and policies are samples.
