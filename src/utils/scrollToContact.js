export function scrollToContact(e) {
  const el = document.getElementById("contact");

  // If contact exists on this page → smooth scroll
  if (el) {
    e?.preventDefault?.();

    const header = document.querySelector("header");
    const headerOffset = header?.offsetHeight || 0;
    const elTop = el.getBoundingClientRect().top + window.pageYOffset;

    window.scrollTo({
      top: elTop - headerOffset - 12,
      behavior: "smooth",
    });
    return;
  }

  // Otherwise → go to landing page contact
  window.location.href = "/#contact";
}
