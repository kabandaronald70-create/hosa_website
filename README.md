# HOSA — Highway Old Students' Association

A responsive web application for former students of Highway Secondary School
(Kiganda Town Council, Kassanda District, Uganda).

**Live site:** <https://hosa-website-vhts.onrender.com>

**Trello board:** <https://trello.com/b/iRLK5T7/hosa-final-project>

---

## About

Highway Secondary School opened in 2001 and offers O-Level and A-Level
education. The HOSA website reconnects former students with each other, with
current students, and with the school community. It provides an alumni
directory, event listing with RSVPs, mentorship matching, a job board, and a
collection of alumni stories.

The project addresses a real problem: keeping a dispersed alumni community
connected without a central digital platform.

---

## Tech Stack

- **HTML5**, **CSS3**, **Vanilla JavaScript** (ES Modules, classes)
- **Vite** — dev server and build tool
- **Two external APIs:**
  - [Nager.Date CountryInfo](https://date.nager.at/) — country names and metadata
  - [Nominatim (OpenStreetMap)](https://nominatim.org/) — venue geocoding
- **flagcdn.com** — country flag images
- Deployed on **Render**

No JavaScript frameworks or libraries are used, per course requirements.

---

## Features

| View               | Description                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| **Home**           | Hero, stat strip, entry points to directory and mentorship                          |
| **Directory**      | 15 members with search, decade/district/profession filters, mentor filter, and sort |
| **Member Profile** | Full profile per member with save and mentorship actions                            |
| **Events**         | 6 events with RSVP persistence, venue location lookup, and save                     |
| **Mentorship**     | 3-step flow that matches students to mentors by field                               |
| **Job Board**      | 5 opportunities with search, filter, and save                                       |
| **Stories**        | Animated carousel of alumni stories                                                 |
| **Saved Items**    | Aggregated favourites across jobs, events, and mentors                              |
| **404**            | Fallback view for unknown routes                                                    |

---

## Accessibility

- Semantic HTML5 landmarks (`header`, `nav`, `main`, `footer`, `article`)
- ARIA labels on interactive elements, uniquely-labelled navs
- Keyboard-navigable with visible focus states
- `prefers-reduced-motion` support for all animations
- WCAG AA colour contrast on all body text
- Skip link to main content
- One `H1` per view, no skipped heading levels
- Alt text on all images

---

## Development

````bash
npm install       # install dependencies
npm run dev       # dev server on http://localhost:5173
npm run build     # production build to dist/
npm run preview   # preview built site on http://localhost:4173
npm run lint      # run ESLint# HOSA — Highway Old Students' Association

A responsive web application for former students of Highway Secondary School
(Kiganda Town Council, Kassanda District, Uganda).

**Live site:** <https://hosa-website-vhts.onrender.com>

**Trello board:** <https://trello.com/b/iRLK5T7/hosa-final-project>

---

## About

Highway Secondary School opened in 2001 and offers O-Level and A-Level
education. The HOSA website reconnects former students with each other, with
current students, and with the school community. It provides an alumni
directory, event listing with RSVPs, mentorship matching, a job board, and a
collection of alumni stories.

The project addresses a real problem: keeping a dispersed alumni community
connected without a central digital platform.

---

## Tech Stack

- **HTML5**, **CSS3**, **Vanilla JavaScript** (ES Modules, classes)
- **Vite** — dev server and build tool
- **Two external APIs:**
  - [Nager.Date CountryInfo](https://date.nager.at/) — country names and metadata
  - [Nominatim (OpenStreetMap)](https://nominatim.org/) — venue geocoding
- **flagcdn.com** — country flag images
- Deployed on **Render**

No JavaScript frameworks or libraries are used, per course requirements.

---

## Features

| View | Description |
|------|-------------|
| **Home** | Hero, stat strip, entry points to directory and mentorship |
| **Directory** | 15 members with search, decade/district/profession filters, mentor filter, and sort |
| **Member Profile** | Full profile per member with save and mentorship actions |
| **Events** | 6 events with RSVP persistence, venue location lookup, and save |
| **Mentorship** | 3-step flow that matches students to mentors by field |
| **Job Board** | 5 opportunities with search, filter, and save |
| **Stories** | Animated carousel of alumni stories |
| **Saved Items** | Aggregated favourites across jobs, events, and mentors |
| **404** | Fallback view for unknown routes |

---

## Accessibility

- Semantic HTML5 landmarks (`header`, `nav`, `main`, `footer`, `article`)
- ARIA labels on interactive elements, uniquely-labelled navs
- Keyboard-navigable with visible focus states
- `prefers-reduced-motion` support for all animations
- WCAG AA colour contrast on all body text
- Skip link to main content
- One `H1` per view, no skipped heading levels
- Alt text on all images

---

## Development

```bash
npm install       # install dependencies
npm run dev       # dev server on http://localhost:5173
npm run build     # production build to dist/
npm run preview   # preview built site on http://localhost:4173
npm run lint      # run ESLint
````
