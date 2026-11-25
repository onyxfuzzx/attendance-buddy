import "@fontsource/dm-sans/latin-400.css";
import "@fontsource/dm-sans/latin-500.css";
import "@fontsource/dm-sans/latin-600.css";
import "@fontsource/manrope/latin-600.css";
import "@fontsource/manrope/latin-700.css";
import "@fontsource/manrope/latin-800.css";
import "./style.css";

const menu = document.querySelector(".menu-toggle");
menu.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  menu.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
  document.querySelector("#navigation").classList.toggle("open", open);
});
document.querySelectorAll("#navigation a").forEach((link) =>
  link.addEventListener("click", () => {
    menu.setAttribute("aria-expanded", "false");
    menu.setAttribute("aria-label", "Open navigation");
    document.querySelector("#navigation").classList.remove("open");
  }),
);
const toast = document.querySelector("#site-toast");
let toastTimer;
function notify(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3500);
}
let checkedIn = false;
document.querySelector("#sample-checkin").addEventListener("click", () => {
  checkedIn = !checkedIn;
  document.querySelector("#sample-count").innerHTML =
    `${checkedIn ? 9 : 8}<span>/12</span>`;
  const status = document.querySelector("#sample-status");
  status.textContent = checkedIn ? "Right on time" : "Not in yet";
  status.classList.toggle("checked-in", checkedIn);
  document.querySelector("#sample-checkin").innerHTML = checkedIn
    ? "<span>✓</span>Nice. You’re all checked in."
    : "<span>✓</span>Try a little check-in";
  notify(
    checkedIn
      ? "One little check. One great day. (Sample only)"
      : "Sample check-in reset.",
  );
});
const steps = [
  {
    symbol: "⌗",
    eyebrow: "YOUR WORKPLACE",
    title: "A familiar place.<br>A fresh start.",
    description:
      "The workplace QR connects your attendance to the right location and team.",
    icon: "⌾",
    location: "The Studio · HQ",
    detail: "Workplace identified",
  },
  {
    symbol: "⌾",
    eyebrow: "YOUR LOCATION",
    title: "Right place.<br>Right you.",
    description:
      "The server checks your reported GPS coordinates against the workplace boundary.",
    icon: "✓",
    location: "Within your workplace boundary",
    detail: "Sample GPS · 18m from the pin",
  },
  {
    symbol: "✓",
    eyebrow: "YOU’RE ALL SET",
    title: "One little check.<br>One great day.",
    description:
      "Your assigned shift and check-in time are verified. Now get on with the good stuff.",
    icon: "◷",
    location: "Check-in recorded",
    detail: "An attendance record, with a clear audit trail",
  },
];
const tabs = [...document.querySelectorAll("[data-step]")];
function showStep(index) {
  tabs.forEach((tab, i) => {
    tab.classList.toggle("selected", i === index);
    tab.setAttribute("aria-selected", String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
  });
  const step = steps[index];
  for (const key of ["symbol", "eyebrow", "description", "icon", "location", "detail"])
    document.querySelector(`#step-${key}`).textContent = step[key];
  document.querySelector("#step-title").innerHTML = step.title;
  document
    .querySelector("#step-panel")
    .setAttribute("aria-labelledby", `step-tab-${index}`);
  document
    .querySelectorAll(".card-progress i")
    .forEach((item, i) => item.classList.toggle("complete", i <= index));
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => showStep(index));
  tab.addEventListener("keydown", (event) => {
    let next = index;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (index + 1) % tabs.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    showStep(next);
    tabs[next].focus();
  });
});
document.querySelector("#copy-command").addEventListener("click", async () => {
  const command =
    "git clone https://github.com/onyxfuzzx/attendance-buddy.git\ncd attendance-buddy\nnpm ci\nnpm run dev";
  try {
    await navigator.clipboard.writeText(command);
    document.querySelector("#copy-command").textContent = "Copied!";
    notify("Your quick start is on the clipboard.");
    setTimeout(
      () => (document.querySelector("#copy-command").textContent = "Copy"),
      2500,
    );
  } catch {
    notify("Clipboard unavailable. Copy the commands from the setup guide.");
  }
});
document.querySelector("#year").textContent = String(new Date().getFullYear());
