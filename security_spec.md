# Security Specification for MWSTORE

## Data Invariants

1.  **Users:**
    *   A user can only read their own profile.
    *   A user cannot change their own `balance` directly (must be via admin or top-up).
    *   A user cannot change their own `role`.
    *   Admins can read and write all user profiles.

2.  **Products:**
    *   Anyone (even unauthenticated) can read products.
    *   Only admins can create, update, or delete products.

3.  **Orders:**
    *   A user can only read their own orders.
    *   A user can create an order with status 'Pending' or 'Proses' (if paid by balance).
    *   A user can only update their own order if they are changing the status to 'Dibatalkan' (and only if currently 'Pending').
    *   Admins can manage all orders.

4.  **TopUps:**
    *   A user can only read their own top-up requests.
    *   A user can create a top-up request with status 'Pending'.
    *   Admins can update top-up status to 'Selesai'.

5.  **Messages:**
    *   A user can only read messages where they are either the sender or the recipient.
    *   A user can only create messages where they are the sender.
    *   A user can update `read` status if they are the recipient.

## The "Dirty Dozen" Payloads

1.  **Identity Theft (User Profile):** Update another user's balance.
2.  **Privilege Escalation:** Change own role to 'admin'.
3.  **Zero-Price Purchase:** Create an order with `totalAmount: 0` but containing expensive items.
4.  **Balance Injection:** Create a top-up request with status 'Selesai' manually.
5.  **Unauthorized Product Deletion:** Unauthenticated user trying to delete a product.
6.  **Fake Product Update:** User trying to change a product price.
7.  **Chat Snooping:** Read messages between Admin and another user.
8.  **Message Forgery:** Create a message with `sender: "Admin"`.
9.  **Order Hijacking:** Read another user's order by ID guessing.
10. **Shadow Field Injection:** Adding `isVerified: true` to a user profile.
11. **Malicious ID:** Using a 2KB string as a product ID.
12. **Negative Stock:** Creating a product with `stock: -100`.

## Test Runner (Draft)

Testing will focus on ensuring these payloads return `PERMISSION_DENIED`.
Rules will be written to `DRAFT_firestore.rules` first.
