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
    email: "stefan.brandt@example-plumbing.test",
    password: "stefan-e06b44-demo",
    unit: null
  },

  // Maastricht data set (data/centrix/*.json). Password is the first name + "-demo".
  // Tenants: everyone who reported a case.
  { role: "tenant", id: "c_201", name: "Harrie Coenen", email: "harrie.coenen@example.com", password: "harrie-demo", unit: "Brusselsestraat 74, Ground floor, Maastricht" },
  { role: "tenant", id: "c_202", name: "Elena Rossi", email: "elena.rossi@example.com", password: "elena-demo", unit: "Brusselsestraat 74, 1st floor, Maastricht" },
  { role: "tenant", id: "c_203", name: "Daan Smeets", email: "daan.smeets@example.com", password: "daan-demo", unit: "Brusselsestraat 74, 2nd floor, Maastricht" },
  { role: "tenant", id: "c_204", name: "Amara Mensah", email: "amara.mensah@example.com", password: "amara-demo", unit: "Brusselsestraat 74, 3rd floor (attic), Maastricht" },
  { role: "tenant", id: "c_205", name: "Lukas Schmidt", email: "lukas.schmidt@example.com", password: "lukas-demo", unit: "Rechtstraat 58, 1st floor, Maastricht" },
  { role: "tenant", id: "c_206", name: "Sanne Janssen", email: "sanne.janssen@example.com", password: "sanne-demo", unit: "Rechtstraat 58, 2nd floor, Maastricht" },
  { role: "tenant", id: "c_207", name: "Mateo Garcia", email: "mateo.garcia@example.com", password: "mateo-demo", unit: "Rechtstraat 58, 3rd floor, Maastricht" },
  { role: "tenant", id: "c_208", name: "Yasmina El Amrani", email: "yasmina.elamrani@example.com", password: "yasmina-demo", unit: "Scharnerweg 112, A01, Maastricht" },
  { role: "tenant", id: "c_209", name: "Jos Vliegen", email: "jos.vliegen@example.com", password: "jos-demo", unit: "Scharnerweg 112, A02, Maastricht" },
  { role: "tenant", id: "c_211", name: "Femke Habets", email: "femke.habets@example.com", password: "femke-demo", unit: "Scharnerweg 112, B12, Maastricht" },
  { role: "tenant", id: "c_213", name: "Thomas Wouters", email: "thomas.wouters@example.com", password: "thomas-demo", unit: "Sint Maartenslaan 30, Ground floor, Maastricht" },
  { role: "tenant", id: "c_214", name: "Julia Kowalska", email: "julia.kowalska@example.com", password: "julia-demo", unit: "Sint Maartenslaan 30, 1st floor, Maastricht" },
  { role: "tenant", id: "c_215", name: "Omar Haddad", email: "omar.haddad@example.com", password: "omar-demo", unit: "Sint Maartenslaan 30, 2nd floor, Maastricht" },
  { role: "tenant", id: "c_216", name: "Leyla Yilmaz", email: "leyla.yilmaz@example.com", password: "leyla-demo", unit: "Oranjeplein 87, 87A (ground left), Maastricht" },
  { role: "tenant", id: "c_217", name: "Sjef Ubachs", email: "sjef.ubachs@example.com", password: "sjef-demo", unit: "Oranjeplein 87, 87B (ground right), Maastricht" },
  { role: "tenant", id: "c_218", name: "Lotte Hendriks", email: "lotte.hendriks@example.com", password: "lotte-demo", unit: "Oranjeplein 87, 87C (1st left), Maastricht" },
  { role: "tenant", id: "c_219", name: "Hannah Becker", email: "hannah.becker@example.com", password: "hannah-demo", unit: "Oranjeplein 87, 87D (1st right), Maastricht" },
  { role: "tenant", id: "c_222", name: "Anouk Vermeulen", email: "anouk.vermeulen@example.com", password: "anouk-demo", unit: "Randwycksingel 15, 0.1, Maastricht" },
  { role: "tenant", id: "c_223", name: "Sofia Martins", email: "sofia.martins@example.com", password: "sofia-demo", unit: "Randwycksingel 15, 0.2, Maastricht" },
  // Partners: one login per plumber (technician).
  { role: "partner", id: "t_01", name: "Bram Peters", company: "Jekerdal Loodgieters", email: "bram.peters@jekerdal.test", password: "bram-demo", unit: null },
  { role: "partner", id: "t_02", name: "Niels Hermans", company: "Jekerdal Loodgieters", email: "niels.hermans@jekerdal.test", password: "niels-demo", unit: null },
  { role: "partner", id: "t_03", name: "Karim Bouzid", company: "Maasland Installatietechniek B.V.", email: "karim.bouzid@maasland.test", password: "karim-demo", unit: null },
  { role: "partner", id: "t_04", name: "Tim Lardinois", company: "Sint-Pieter Sanitair & Riool", email: "tim.lardinois@sintpieter.test", password: "tim-demo", unit: null },

  // Aachen demo (data/tenant-data.js, data/partner-jobs.js), still working
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
    name: "Stefan Brandt",
    email: "jobs@example-plumbing.test",
    password: "plumber-demo-7",
    unit: null
  }
];
