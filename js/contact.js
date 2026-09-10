const CONTACT_KEY = [0x37, 0x91, 0xc4, 0x5a];
const ENCRYPTED_CONTACT = [
  0x54, 0xfe, 0xaa, 0x2e, 0x56, 0xf2, 0xb0, 0x1a, 0x5a,
  0xf4, 0xa3, 0x2f, 0x5a, 0xf8, 0xaa, 0x74, 0x43, 0xe7,
];

export function decodeContactAddress() {
  return ENCRYPTED_CONTACT
    .map((value, index) => String.fromCharCode(value ^ CONTACT_KEY[index % CONTACT_KEY.length]))
    .join("");
}

export function installContactReveal(button) {
  if (!button) return;

  button.addEventListener("click", () => {
    const address = decodeContactAddress();
    const link = document.createElement("a");
    link.className = "footer-email";
    link.href = `mailto:${address}`;
    link.textContent = address;
    link.setAttribute("aria-describedby", "contact-protection-note");
    button.replaceWith(link);
    const note = document.querySelector("#contact-protection-note");
    if (note) note.textContent = "Click the address to open your email app.";
    link.focus();
  }, { once: true });
}
