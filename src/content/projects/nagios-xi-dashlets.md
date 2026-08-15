---
title: 'Custom Nagios XI Dashlets'
summary: 'A set of custom dashlets for Nagios XI built in PHP and JavaScript, including an external-API integration and an LCARS-styled monitoring console.'
tags: ['php', 'javascript', 'nagios', 'frontend', 'internal-tools']
role: 'TODO: e.g. Sole developer / Lead developer'
stack: ['PHP', 'JavaScript', 'Nagios XI', 'TODO: add — jQuery? Chart.js? CSS?']
year: 2025 # TODO: year this shipped
featured: true
# repo: https://github.com/TODO/nagios-xi-dashlets   # TODO: uncomment if public
draft: false
---

> **TODO** — This is a scaffold. Every section below is a prompt, not a claim.
> Replace the prompts with the real story and delete this blockquote.

## What it is

TODO: One paragraph. What is a Nagios XI dashlet, for a reader who has never
seen one? Where does it appear in the product, and who was asking for these?

## Why it exists

TODO: What was the actual need? Some angles worth considering:

- Was this scratching an internal itch, a customer request, or a demo piece?
- What did people do before these dashlets existed?
- Which of the three dashlets came first, and why that one?

## The dashlets

### PokéAPI integration

TODO: Describe it. Specifically worth covering:

- What does it pull from [PokéAPI](https://pokeapi.co/), and how is that mapped
  onto monitoring concepts (hosts? services? states?)
- Is this a genuine tool, a teaching example for the dashlet API, or a joke that
  turned out to be useful? All three are good answers — just say which.
- How is the external call handled? Cached server-side, fetched client-side,
  rate-limit handling?

### LCARS console

TODO: Describe it. Worth covering:

- What does the LCARS treatment actually apply to — a status wallboard, a
  specific host group, the whole XI dashboard?
- How much of it is CSS vs. custom-rendered markup?
- Was the constraint (LCARS is an unusual layout system) interesting to solve?

### TODO: third dashlet, if there is one

TODO: or delete this heading.

## How it works

TODO: The technical shape. Readers who care about this project want to know:

- How a Nagios XI dashlet is structured — the PHP entry point, how config
  and state are handed to it, how it gets its data.
- Anything you had to work around in the XI dashlet API.
- Where the JavaScript boundary sits: server-rendered PHP with sprinkles, or a
  real client-side app inside the dashlet frame?

```php
// TODO: a short, real snippet — the dashlet registration or the data-fetch
// path. Pick something that shows the shape of the API, not boilerplate.
```

## What I'd do differently

TODO: One honest paragraph. This section is the one hiring managers actually
read closely — a real limitation you'd fix beats a list of accomplishments.

## Status

TODO: Is this in production, shipped to customers, internal-only, or archived?
