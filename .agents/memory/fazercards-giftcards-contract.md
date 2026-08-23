---
name: FazerCards gift-card contract
description: Current FazerCards API contract for loading and ordering digital gift cards.
---

FazerCards gift-card denominations are loaded with `GET /giftcards/cards?category_id=…`. Each denomination identifies itself with `card_id`; create an order with `POST /giftcards/order` using `category_id`, `card_id`, and `quantity`.

**Why:** The seemingly parallel `/giftcards/offers` path returns a 404 even for a configured, valid FazerCards account, leaving a functional catalog with empty purchase dialogs.

**How to apply:** Normalize `card_id` to the client-side offer identifier only at the server boundary. Retrieve the live card price server-side before every order and send the original `card_id` back to FazerCards.