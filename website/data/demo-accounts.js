/*
 * Demo login accounts for the centrix prototype.
 *
 * These are fake test accounts for the hackathon demo. They are not real people
 * or companies, and the passwords protect nothing: the login page only checks
 * them in the browser. Never put real passwords in this file.
 *
 * Use one of these on login.html. Pick the matching role (Tenant or Partner).
 */
window.CENTRIX_DEMO_ACCOUNTS = [
  // Personal logins for the two people in the demo case
  {
    role: "tenant",
    name: "Lena Hoffmann",
    email: "lena.hoffmann@centrix.test",
    password: "lena-5338b4-demo",
    unit: "Unit 4B, Musterstraße 12, Aachen"
  },
  {
    role: "partner",
    name: "Stefan Brandt",
    company: "Example Plumbing GmbH",
    email: "stefan.brandt@example-plumbing.test",
    password: "stefan-e06b44-demo",
    unit: null
  },

  // Older shared demo logins, still working
  {
    role: "tenant",
    name: "Lena Hoffmann",
    email: "lena.hoffmann@example.com",
    password: "lena-4b-demo",
    unit: "Unit 4B, Musterstraße 12, Aachen"
  },
  {
    role: "partner",
    name: "Example Plumbing GmbH",
    email: "jobs@example-plumbing.test",
    password: "plumber-demo-7",
    unit: null
  }
];
